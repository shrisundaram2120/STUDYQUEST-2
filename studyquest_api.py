"""
StudyQuest monolithic FastAPI backend.

Free-tier design goals:
- One lightweight process, no Redis, no Celery, no standalone vector database.
- MongoDB Atlas Free Tier stores app data and serves vector lookups via $vectorSearch.
- Gemini is only called on cache misses.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from enum import Enum
from typing import Any, Literal

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import BaseModel, Field, field_validator, model_validator


APP_NAME = "StudyQuest API"
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "studyquest")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
ADMIN_KEY = os.getenv("STUDYQUEST_ADMIN_KEY", "")
JWT_SECRET = os.getenv("STUDYQUEST_JWT_SECRET") or ADMIN_KEY or os.getenv("MONGODB_URI", "") or "studyquest-local-dev-secret"
VECTOR_INDEX_NAME = os.getenv("MONGODB_VECTOR_INDEX", "quest_solution_vector_index")
VECTOR_DIMENSIONS = int(os.getenv("STUDYQUEST_VECTOR_DIMENSIONS", "256"))
SPRINT_MINUTES = int(os.getenv("STUDYQUEST_SPRINT_MINUTES", "30"))
AUTH_TOKEN_HOURS = int(os.getenv("STUDYQUEST_AUTH_TOKEN_HOURS", "336"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("STUDYQUEST_RATE_LIMIT_WINDOW_SECONDS", "60"))
AUTH_RATE_LIMIT = int(os.getenv("STUDYQUEST_AUTH_RATE_LIMIT", "12"))
QUEST_RATE_LIMIT = int(os.getenv("STUDYQUEST_QUEST_RATE_LIMIT", "40"))
SPRINT_RATE_LIMIT = int(os.getenv("STUDYQUEST_SPRINT_RATE_LIMIT", "30"))
SYNC_PAYLOAD_MAX_BYTES = int(os.getenv("STUDYQUEST_SYNC_PAYLOAD_MAX_BYTES", "750000"))


class LeagueDivision(str, Enum):
    bronze = "Bronze"
    silver = "Silver"
    gold = "Gold"
    platinum = "Platinum"
    diamond = "Diamond"
    grandmaster = "Grandmaster"


LEAGUE_THRESHOLDS = [
    (LeagueDivision.bronze, 0),
    (LeagueDivision.silver, 1000),
    (LeagueDivision.gold, 2500),
    (LeagueDivision.platinum, 5000),
    (LeagueDivision.diamond, 8500),
    (LeagueDivision.grandmaster, 13000),
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_key() -> str:
    return now_utc().date().isoformat()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", value.lower())).strip()


def hash_embedding(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    """Small deterministic embedding for cache lookup without paid embedding APIs."""
    tokens = normalize_text(text).split()
    vector = [0.0] * dimensions
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=4).digest()
        index = int.from_bytes(digest, "big") % dimensions
        vector[index] += 1.0

    magnitude = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / magnitude, 6) for value in vector]


def pass_token_for(user_id: str, video_id: str, timestamp: int, solution: str) -> str:
    raw = f"{user_id}:{video_id}:{timestamp}:{normalize_text(solution)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


REDACTION_PATTERNS = [
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "[Aadhaar_Redacted]"),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b", re.IGNORECASE), "[PAN_Redacted]"),
    (re.compile(r"\b[A-Z]{2}\d{2}\s?\d{11}\b", re.IGNORECASE), "[ID_Placeholder]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[Email_Redacted]"),
    (re.compile(r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b"), "[Phone_Redacted]"),
]


def redact_sensitive(value: Any) -> Any:
    if isinstance(value, str):
        redacted = value
        for pattern, replacement in REDACTION_PATTERNS:
            redacted = pattern.sub(replacement, redacted)
        return redacted
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    if isinstance(value, dict):
        return {key: redact_sensitive(item) for key, item in value.items()}
    return value


def division_for_points(rank_points: int) -> LeagueDivision:
    active = LeagueDivision.bronze
    for division, threshold in LEAGUE_THRESHOLDS:
        if rank_points >= threshold:
            active = division
    return active


class LeagueState(BaseModel):
    division: LeagueDivision = LeagueDivision.bronze
    rank_points: int = 0
    weekly_state: Literal["stable", "promoting", "demoting"] = "stable"


class FocusState(BaseModel):
    streak_days: int = 0
    streak_multiplier: float = 1.0
    last_focus_date: str | None = None
    focus_velocity: float = 0.0


class StudyQuestUser(BaseModel):
    user_id: str
    display_name: str = "StudyQuest Learner"
    email_hash: str | None = None
    xp_total: int = 0
    level: int = 1
    focus: FocusState = Field(default_factory=FocusState)
    league: LeagueState = Field(default_factory=LeagueState)
    roles: list[Literal["learner", "mentor", "admin"]] = Field(default_factory=lambda: ["learner"])
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class SkillNode(BaseModel):
    node_id: str
    title: str
    subject: str = "General"
    xp_reward: int = 50
    prerequisite_node_ids: list[str] = Field(default_factory=list)
    unlocked_by_default: bool = False
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    @field_validator("prerequisite_node_ids")
    @classmethod
    def prevent_self_reference(cls, value: list[str], info: Any) -> list[str]:
        node_id = info.data.get("node_id")
        if node_id and node_id in value:
            raise ValueError("A skill node cannot list itself as a prerequisite.")
        return value


class VideoMilestone(BaseModel):
    timestamp_seconds: int = Field(ge=0)
    prompt: str
    mode: Literal["terminal", "scratchpad"] = "scratchpad"
    expected_concepts: list[str] = Field(default_factory=list)
    xp_reward: int = 50
    rank_reward: int = 10


class LessonConfig(BaseModel):
    lesson_id: str
    video_id: str
    title: str
    milestones: list[VideoMilestone]
    default_panel: Literal["terminal", "scratchpad"] = "scratchpad"


class SprintState(BaseModel):
    sprint_id: str
    party_id: str
    user_ids: list[str]
    started_at: datetime
    expires_at: datetime
    completed_milestones: list[str] = Field(default_factory=list)
    active: bool = True


class SprintStartRequest(BaseModel):
    party_id: str = "solo"
    user_ids: list[str]
    duration_minutes: int = Field(default=SPRINT_MINUTES, ge=5, le=30)

    @model_validator(mode="before")
    @classmethod
    def accept_single_user_alias(cls, data: Any) -> Any:
        if isinstance(data, dict) and "user_ids" not in data and data.get("user_id"):
            data = {**data, "user_ids": [str(data["user_id"])]}
        return data


class SprintResponse(BaseModel):
    sprint_id: str
    party_id: str
    expires_at: datetime
    seconds_remaining: int
    active: bool


class QuestEvaluationRequest(BaseModel):
    user_id: str
    video_id: str
    milestone_timestamp: int = Field(ge=0)
    solution_text: str = Field(min_length=1, max_length=8000)
    lesson_config: dict[str, Any] = Field(default_factory=dict)
    sprint_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def accept_client_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "solution_text" not in normalized and "solution" in normalized:
            normalized["solution_text"] = normalized["solution"]
        if "milestone_timestamp" not in normalized and "timestamp" in normalized:
            normalized["milestone_timestamp"] = normalized["timestamp"]
        return normalized


class QuestEvaluationResponse(BaseModel):
    passed: bool
    source: Literal["mongo_vector_cache", "gemini", "local_socratic_fallback"]
    pass_token: str | None = None
    hints: list[str] = Field(default_factory=list)
    socratic_questions: list[str] = Field(default_factory=list)
    xp_delta: int = 0
    rank_delta: int = 0
    league_division: LeagueDivision | None = None


class CredentialPassport(BaseModel):
    user_id: str
    display_name: str
    league_division: LeagueDivision
    xp_total: int
    level: int
    focus_velocity: float
    clear_streaks: int
    rank_points: int
    verified_execution_metrics: dict[str, Any]
    raw_output_text_logs: list[str]
    sensitive_identifiers: dict[str, str] = Field(default_factory=lambda: {
        "aadhaar": "[Aadhaar_Redacted]",
        "government_id": "[ID_Placeholder]",
    })


class SkillUnlockRequest(BaseModel):
    user_id: str
    node_id: str


class AuthRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="StudyQuest Learner", max_length=80)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            raise ValueError("A valid email address is required.")
        return email


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user_id: str
    email: str
    display_name: str
    expires_at: datetime


class SyncPushRequest(BaseModel):
    payload: dict[str, Any]
    client_updated_at: datetime | None = None

    @model_validator(mode="after")
    def enforce_payload_size(self) -> "SyncPushRequest":
        size = len(json.dumps(self.payload, default=str, separators=(",", ":")).encode("utf-8"))
        if size > SYNC_PAYLOAD_MAX_BYTES:
            raise ValueError(f"Sync payload is too large for free-tier storage ({size} bytes).")
        return self


class SyncPullResponse(BaseModel):
    payload: dict[str, Any] | None = None
    server_updated_at: datetime | None = None


app = FastAPI(title=APP_NAME, version="3.0.0-free-tier")

allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-StudyQuest-Admin-Key"],
)

mongo_client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None
if MONGODB_URI:
    mongo_client = AsyncIOMotorClient(MONGODB_URI, maxPoolSize=5, minPoolSize=0, serverSelectionTimeoutMS=5000)
    db = mongo_client[MONGODB_DB_NAME]

ACTIVE_SPRINTS: dict[str, SprintState] = {}
SPRINT_LOCK = asyncio.Lock()
RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}
RATE_LIMIT_LOCK = asyncio.Lock()


def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured. Set MONGODB_URI.")
    return db


def request_identity(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    client_host = request.client.host if request.client else "unknown"
    return forwarded_for or client_host


async def enforce_rate_limit(request: Request, bucket: str, max_requests: int) -> None:
    if max_requests <= 0:
        return

    identity = request_identity(request)
    key = f"{bucket}:{identity}"
    now = time.monotonic()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    async with RATE_LIMIT_LOCK:
        recent = [stamp for stamp in RATE_LIMIT_BUCKETS.get(key, []) if stamp >= cutoff]
        if len(recent) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests. Please retry shortly.")
        recent.append(now)
        RATE_LIMIT_BUCKETS[key] = recent

        if len(RATE_LIMIT_BUCKETS) > 1000:
            stale_keys = [
                bucket_key
                for bucket_key, stamps in RATE_LIMIT_BUCKETS.items()
                if not stamps or max(stamps) < cutoff
            ]
            for bucket_key in stale_keys[:250]:
                RATE_LIMIT_BUCKETS.pop(bucket_key, None)


def rate_limited(bucket: str, max_requests: int):
    async def dependency(request: Request) -> None:
        await enforce_rate_limit(request, bucket, max_requests)

    return dependency


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210_000)
    return f"pbkdf2_sha256$210000${b64url_encode(salt)}${b64url_encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, rounds_raw, salt_raw, digest_raw = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(rounds_raw)
        salt = b64url_decode(salt_raw)
        expected = b64url_decode(digest_raw)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def sign_token(user_id: str, email: str) -> tuple[str, datetime]:
    expires_at = now_utc() + timedelta(hours=AUTH_TOKEN_HOURS)
    payload = {
        "sub": user_id,
        "email_hash": email_hash(email),
        "exp": int(expires_at.timestamp()),
        "nonce": secrets.token_hex(8),
    }
    payload_part = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(JWT_SECRET.encode("utf-8"), payload_part.encode("utf-8"), hashlib.sha256).digest()
    return f"sq1.{payload_part}.{b64url_encode(signature)}", expires_at


def verify_token(token: str) -> dict[str, Any]:
    try:
        prefix, payload_part, signature_part = token.split(".", 2)
        if prefix != "sq1":
            raise ValueError("Invalid token prefix.")
        expected = hmac.new(JWT_SECRET.encode("utf-8"), payload_part.encode("utf-8"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, b64url_decode(signature_part)):
            raise ValueError("Invalid token signature.")
        payload = json.loads(b64url_decode(payload_part))
        if int(payload.get("exp", 0)) < int(now_utc().timestamp()):
            raise ValueError("Token expired.")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


async def require_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required.")
    payload = verify_token(authorization.split(" ", 1)[1].strip())
    database = get_db()
    account = await database.auth_accounts.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found.")
    return account


async def require_admin_key(x_studyquest_admin_key: str | None = Header(default=None)) -> None:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="Set STUDYQUEST_ADMIN_KEY before using admin endpoints.")
    if x_studyquest_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key.")


def has_role(account: dict[str, Any], role: str) -> bool:
    return role in set(account.get("roles", ["learner"]))


async def create_indexes(database: AsyncIOMotorDatabase) -> None:
    await database.users.create_index("user_id", unique=True)
    await database.users.create_index("league.division")
    await database.users.create_index([("league.division", 1), ("league.rank_points", -1)])
    await database.auth_accounts.create_index("email_hash", unique=True)
    await database.auth_accounts.create_index("user_id", unique=True)
    await database.sync_snapshots.create_index("user_id", unique=True)
    await database.sync_snapshots.create_index("server_updated_at")
    await database.skills.create_index("node_id", unique=True)
    await database.skills.create_index("prerequisite_node_ids")
    await database.video_lessons.create_index("lesson_id", unique=True)
    await database.quest_evaluation_cache.create_index(
        [("video_id", 1), ("milestone_timestamp", 1), ("normalized_solution", 1)],
        unique=True,
        name="quest_cache_exact_unique",
    )
    await database.quest_evaluation_cache.create_index([("video_id", 1), ("milestone_timestamp", 1), ("verified", 1)])
    await database.quest_evaluation_cache.create_index("updated_at")
    await database.sprint_events.create_index([("user_id", 1), ("created_at", -1)])

    try:
        await database.command({
            "createSearchIndexes": "quest_evaluation_cache",
            "indexes": [{
                "name": VECTOR_INDEX_NAME,
                "type": "vectorSearch",
                "definition": {
                    "fields": [
                        {
                            "type": "vector",
                            "path": "solution_embedding",
                            "numDimensions": VECTOR_DIMENSIONS,
                            "similarity": "cosine",
                        },
                        {"type": "filter", "path": "video_id"},
                        {"type": "filter", "path": "milestone_timestamp"},
                        {"type": "filter", "path": "verified"},
                    ]
                },
            }],
        })
    except Exception:
        # Atlas returns an error if the index already exists or if Search is not enabled locally.
        pass


@app.on_event("startup")
async def startup() -> None:
    if db is not None:
        await create_indexes(db)


@app.on_event("shutdown")
async def shutdown() -> None:
    if mongo_client is not None:
        mongo_client.close()


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "mongo_configured": db is not None,
        "gemini_configured": bool(GEMINI_API_KEY),
        "active_sprints": len(ACTIVE_SPRINTS),
        "rate_limit_buckets": len(RATE_LIMIT_BUCKETS),
    }


@app.post("/api/v1/auth/signup", response_model=AuthResponse, dependencies=[Depends(rate_limited("auth", AUTH_RATE_LIMIT))])
async def signup(request: AuthRequest) -> AuthResponse:
    database = get_db()
    email_digest = email_hash(request.email)
    user_id = str(uuid.uuid4())
    now = now_utc()
    account = {
        "user_id": user_id,
        "email": request.email,
        "email_hash": email_digest,
        "display_name": request.display_name.strip() or "StudyQuest Learner",
        "password_hash": hash_password(request.password),
        "roles": ["learner"],
        "created_at": now,
        "updated_at": now,
    }
    try:
        await database.auth_accounts.insert_one(account)
    except Exception as exc:
        raise HTTPException(status_code=409, detail="An account already exists for this email.") from exc

    await database.users.update_one(
        {"user_id": user_id},
        {
            "$setOnInsert": {
                "user_id": user_id,
                "display_name": account["display_name"],
                "created_at": now,
                "xp_total": 0,
                "level": 1,
                "league": LeagueState().model_dump(),
                "focus": FocusState().model_dump(),
                "roles": ["learner"],
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
    )
    token, expires_at = sign_token(user_id, request.email)
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        email=request.email,
        display_name=account["display_name"],
        expires_at=expires_at,
    )


@app.post("/api/v1/auth/login", response_model=AuthResponse, dependencies=[Depends(rate_limited("auth", AUTH_RATE_LIMIT))])
async def login(request: AuthRequest) -> AuthResponse:
    database = get_db()
    account = await database.auth_accounts.find_one({"email_hash": email_hash(request.email)}, {"_id": 0})
    if not account or not verify_password(request.password, account.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token, expires_at = sign_token(account["user_id"], request.email)
    await database.auth_accounts.update_one(
        {"user_id": account["user_id"]},
        {"$set": {"last_login_at": now_utc(), "updated_at": now_utc()}},
    )
    return AuthResponse(
        access_token=token,
        user_id=account["user_id"],
        email=account["email"],
        display_name=account.get("display_name", "StudyQuest Learner"),
        expires_at=expires_at,
    )


@app.get("/api/v1/auth/me")
async def me(account: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    return {
        "user_id": account["user_id"],
        "email": account.get("email"),
        "display_name": account.get("display_name", "StudyQuest Learner"),
        "roles": account.get("roles", ["learner"]),
    }


@app.post("/api/v1/sync/push")
async def push_sync(request: SyncPushRequest, account: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    database = get_db()
    now = now_utc()
    payload = {
        **request.payload,
        "serverReceivedAt": now.isoformat(),
        "userId": account["user_id"],
    }
    await database.sync_snapshots.update_one(
        {"user_id": account["user_id"]},
        {
            "$set": {
                "user_id": account["user_id"],
                "payload": payload,
                "client_updated_at": request.client_updated_at,
                "server_updated_at": now,
            }
        },
        upsert=True,
    )
    return {"ok": True, "server_updated_at": now}


@app.get("/api/v1/sync/pull", response_model=SyncPullResponse)
async def pull_sync(account: dict[str, Any] = Depends(require_user)) -> SyncPullResponse:
    database = get_db()
    snapshot = await database.sync_snapshots.find_one({"user_id": account["user_id"]}, {"_id": 0})
    if not snapshot:
        return SyncPullResponse(payload=None, server_updated_at=None)
    return SyncPullResponse(
        payload=snapshot.get("payload"),
        server_updated_at=snapshot.get("server_updated_at"),
    )


@app.post("/api/v1/skills")
async def upsert_skill(skill: SkillNode, _: None = Depends(require_admin_key)) -> dict[str, Any]:
    database = get_db()
    payload = skill.model_dump()
    await database.skills.update_one({"node_id": skill.node_id}, {"$set": payload}, upsert=True)
    return {"ok": True, "node_id": skill.node_id}


@app.get("/api/v1/skills/tree")
async def skill_tree() -> dict[str, Any]:
    database = get_db()
    nodes = await database.skills.find({}, {"_id": 0}).sort("subject", 1).to_list(length=500)
    return {"nodes": nodes}


@app.post("/api/v1/skills/unlock")
async def unlock_skill(request: SkillUnlockRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    database = get_db()
    skill = await database.skills.find_one({"node_id": request.node_id}, {"_id": 0})
    if not skill:
        raise HTTPException(status_code=404, detail="Skill node not found.")

    user = await database.users.find_one({"user_id": request.user_id}, {"_id": 0}) or {"unlocked_skill_node_ids": []}
    unlocked = set(user.get("unlocked_skill_node_ids", []))
    missing = [node_id for node_id in skill.get("prerequisite_node_ids", []) if node_id not in unlocked]
    if missing:
        raise HTTPException(status_code=409, detail={"missing_prerequisite_node_ids": missing})

    await database.users.update_one(
        {"user_id": request.user_id},
        {
            "$addToSet": {"unlocked_skill_node_ids": request.node_id},
            "$setOnInsert": {"user_id": request.user_id, "created_at": now_utc()},
            "$set": {"updated_at": now_utc()},
        },
        upsert=True,
    )
    background_tasks.add_task(apply_evaluation_rewards, request.user_id, True, int(skill.get("xp_reward", 50)), 0, None, "Skill unlocked")
    return {"ok": True, "node_id": request.node_id}


@app.post("/api/v1/sprints/start", response_model=SprintResponse, dependencies=[Depends(rate_limited("sprint", SPRINT_RATE_LIMIT))])
async def start_sprint(request: SprintStartRequest) -> SprintResponse:
    sprint = SprintState(
        sprint_id=str(uuid.uuid4()),
        party_id=request.party_id,
        user_ids=request.user_ids,
        started_at=now_utc(),
        expires_at=now_utc() + timedelta(minutes=request.duration_minutes),
    )
    async with SPRINT_LOCK:
        ACTIVE_SPRINTS[sprint.sprint_id] = sprint
    return sprint_response(sprint)


@app.get("/api/v1/sprints/{sprint_id}", response_model=SprintResponse)
async def sprint_status(sprint_id: str) -> SprintResponse:
    async with SPRINT_LOCK:
        sprint = ACTIVE_SPRINTS.get(sprint_id)
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found.")
        if sprint.expires_at <= now_utc():
            sprint.active = False
            ACTIVE_SPRINTS[sprint_id] = sprint
    return sprint_response(sprint)


def sprint_response(sprint: SprintState) -> SprintResponse:
    seconds_remaining = max(0, int((sprint.expires_at - now_utc()).total_seconds()))
    return SprintResponse(
        sprint_id=sprint.sprint_id,
        party_id=sprint.party_id,
        expires_at=sprint.expires_at,
        seconds_remaining=seconds_remaining,
        active=sprint.active and seconds_remaining > 0,
    )


@app.get("/api/v1/video-lessons/{lesson_id}", response_model=LessonConfig)
async def get_video_lesson(lesson_id: str) -> LessonConfig:
    if db is not None:
        lesson = await db.video_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
        if lesson:
            return LessonConfig(**lesson)

    return LessonConfig(
        lesson_id=lesson_id,
        video_id="M7lc1UVf-VE",
        title="Sample Time-Attack Video Quest",
        default_panel="terminal",
        milestones=[
            VideoMilestone(
                timestamp_seconds=15,
                prompt="Pause and explain the first concept in your own words.",
                mode="scratchpad",
                expected_concepts=["concept", "evidence", "reasoning"],
            ),
            VideoMilestone(
                timestamp_seconds=45,
                prompt="Write a tiny function or pseudocode that captures the idea.",
                mode="terminal",
                expected_concepts=["input", "output", "edge case"],
            ),
        ],
    )


@app.post("/api/v1/quests/evaluate", response_model=QuestEvaluationResponse, dependencies=[Depends(rate_limited("quest", QUEST_RATE_LIMIT))])
async def evaluate_quest(request: QuestEvaluationRequest, background_tasks: BackgroundTasks) -> QuestEvaluationResponse:
    cache_hit = await find_verified_cache_hit(request)
    if cache_hit:
        xp_delta = int(cache_hit.get("xp_reward", 50))
        rank_delta = int(cache_hit.get("rank_reward", 10))
        background_tasks.add_task(
            apply_evaluation_rewards,
            request.user_id,
            True,
            xp_delta,
            rank_delta,
            request.sprint_id,
            cache_hit.get("raw_output", "Verified cached solution"),
        )
        return QuestEvaluationResponse(
            passed=True,
            source="mongo_vector_cache",
            pass_token=pass_token_for(request.user_id, request.video_id, request.milestone_timestamp, request.solution_text),
            xp_delta=xp_delta,
            rank_delta=rank_delta,
            league_division=await projected_division(request.user_id, rank_delta),
        )

    gemini_result = await evaluate_with_gemini(request)
    passed = bool(gemini_result.get("passed"))
    xp_delta = int(gemini_result.get("xp_delta", 50 if passed else 0))
    rank_delta = int(gemini_result.get("rank_delta", 10 if passed else 0))
    source: Literal["gemini", "local_socratic_fallback"] = gemini_result.get("source", "gemini")

    if passed:
        await store_verified_cache(request, xp_delta=xp_delta, rank_delta=rank_delta, raw_output=gemini_result.get("raw_output", ""))

    background_tasks.add_task(
        apply_evaluation_rewards,
        request.user_id,
        passed,
        xp_delta,
        rank_delta,
        request.sprint_id,
        gemini_result.get("raw_output", ""),
    )

    return QuestEvaluationResponse(
        passed=passed,
        source=source,
        pass_token=pass_token_for(request.user_id, request.video_id, request.milestone_timestamp, request.solution_text) if passed else None,
        hints=gemini_result.get("hints", []),
        socratic_questions=gemini_result.get("socratic_questions", []),
        xp_delta=xp_delta,
        rank_delta=rank_delta,
        league_division=await projected_division(request.user_id, rank_delta),
    )


async def projected_division(user_id: str, rank_delta: int) -> LeagueDivision:
    if db is None:
        return division_for_points(rank_delta)
    user = await db.users.find_one({"user_id": user_id}, {"league.rank_points": 1, "_id": 0})
    current_rank = int((user or {}).get("league", {}).get("rank_points", 0))
    return division_for_points(current_rank + rank_delta)


async def find_verified_cache_hit(request: QuestEvaluationRequest) -> dict[str, Any] | None:
    if db is None:
        return None

    query_embedding = hash_embedding(request.solution_text)
    try:
        cursor = db.quest_evaluation_cache.aggregate([
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": "solution_embedding",
                    "queryVector": query_embedding,
                    "numCandidates": 25,
                    "limit": 3,
                    "filter": {
                        "video_id": request.video_id,
                        "milestone_timestamp": request.milestone_timestamp,
                        "verified": True,
                    },
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "score": {"$meta": "vectorSearchScore"},
                    "xp_reward": 1,
                    "rank_reward": 1,
                    "raw_output": 1,
                    "normalized_solution": 1,
                }
            },
        ])
        hits = await cursor.to_list(length=3)
        for hit in hits:
            if float(hit.get("score", 0)) >= 0.86:
                return hit
    except Exception:
        pass

    normalized = normalize_text(request.solution_text)
    candidates = db.quest_evaluation_cache.find(
        {
            "video_id": request.video_id,
            "milestone_timestamp": request.milestone_timestamp,
            "verified": True,
        },
        {"_id": 0},
    ).sort("updated_at", -1).limit(10)
    async for candidate in candidates:
        ratio = SequenceMatcher(None, normalized, candidate.get("normalized_solution", "")).ratio()
        if ratio >= 0.93:
            return candidate
    return None


async def store_verified_cache(request: QuestEvaluationRequest, xp_delta: int, rank_delta: int, raw_output: str) -> None:
    if db is None:
        return
    normalized = normalize_text(request.solution_text)
    await db.quest_evaluation_cache.update_one(
        {
            "video_id": request.video_id,
            "milestone_timestamp": request.milestone_timestamp,
            "normalized_solution": normalized,
        },
        {
            "$set": {
                "video_id": request.video_id,
                "milestone_timestamp": request.milestone_timestamp,
                "normalized_solution": normalized,
                "solution_embedding": hash_embedding(request.solution_text),
                "verified": True,
                "xp_reward": xp_delta,
                "rank_reward": rank_delta,
                "raw_output": redact_sensitive(raw_output),
                "updated_at": now_utc(),
            },
            "$setOnInsert": {"created_at": now_utc()},
        },
        upsert=True,
    )


async def evaluate_with_gemini(request: QuestEvaluationRequest) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return local_socratic_fallback(request)

    prompt = {
        "task": "Evaluate a student checkpoint answer for a StudyQuest video lesson.",
        "rules": [
            "Do not give raw fixes.",
            "Do not provide direct code snippets.",
            "Use scaffolding hints and Socratic questions.",
            "Return compact JSON only.",
        ],
        "expected_response_shape": {
            "passed": "boolean",
            "hints": ["short hint"],
            "socratic_questions": ["question"],
            "xp_delta": "integer",
            "rank_delta": "integer",
            "raw_output": "short recruiter-readable evaluation log",
        },
        "video_id": request.video_id,
        "milestone_timestamp": request.milestone_timestamp,
        "lesson_config": request.lesson_config,
        "student_solution": request.solution_text,
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            url,
            params={"key": GEMINI_API_KEY},
            json={"contents": [{"role": "user", "parts": [{"text": json.dumps(prompt)}]}]},
        )
    if response.status_code >= 400:
        return local_socratic_fallback(request, source="local_socratic_fallback")

    data = response.json()
    text = "".join(
        part.get("text", "")
        for candidate in data.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
    )
    parsed = parse_json_object(text)
    parsed["source"] = "gemini"
    parsed["raw_output"] = redact_sensitive(parsed.get("raw_output", text[:1000]))
    return parsed


def parse_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {
        "passed": False,
        "hints": ["Restate the goal, then compare your answer against the required concepts."],
        "socratic_questions": ["Which evidence in the lesson proves your answer is complete?"],
        "xp_delta": 0,
        "rank_delta": 0,
        "raw_output": text[:1000],
    }


def local_socratic_fallback(request: QuestEvaluationRequest, source: str = "local_socratic_fallback") -> dict[str, Any]:
    concepts = request.lesson_config.get("expected_concepts") or request.lesson_config.get("concepts") or []
    missing = [concept for concept in concepts if concept.lower() not in request.solution_text.lower()]
    passed = len(request.solution_text.split()) >= 20 and not missing
    return {
        "source": source,
        "passed": passed,
        "hints": [
            "Tie your answer to the milestone prompt before adding details.",
            "Name the key idea, explain why it works, and mention one edge case.",
        ],
        "socratic_questions": [
            "What assumption is your answer making?",
            "Which part of the lesson would you point to as proof?",
            "How would your answer change for a harder example?",
        ],
        "xp_delta": 50 if passed else 0,
        "rank_delta": 10 if passed else 0,
        "raw_output": "Local Socratic fallback used because Gemini was unavailable.",
    }


async def apply_evaluation_rewards(
    user_id: str,
    passed: bool,
    xp_delta: int,
    rank_delta: int,
    sprint_id: str | None,
    raw_output: str,
) -> None:
    if db is None or not passed:
        return

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {
        "user_id": user_id,
        "xp_total": 0,
        "level": 1,
        "league": {"rank_points": 0, "division": LeagueDivision.bronze.value},
        "focus": {"streak_days": 0, "streak_multiplier": 1.0, "last_focus_date": None, "focus_velocity": 0.0},
    }
    focus = user_doc.get("focus", {})
    last_focus_date = focus.get("last_focus_date")
    streak_days = int(focus.get("streak_days", 0))
    today = today_key()
    yesterday = (now_utc().date() - timedelta(days=1)).isoformat()
    if last_focus_date == yesterday:
        streak_days += 1
    elif last_focus_date != today:
        streak_days = 1

    multiplier = round(1.0 + min(streak_days, 30) * 0.05, 2)
    earned_xp = int(xp_delta * multiplier)
    next_xp = int(user_doc.get("xp_total", 0)) + earned_xp
    next_level = max(1, next_xp // 1000 + 1)
    current_rank = int(user_doc.get("league", {}).get("rank_points", 0))
    next_rank = current_rank + rank_delta
    division = division_for_points(next_rank)

    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "xp_total": next_xp,
                "level": next_level,
                "focus": {
                    "streak_days": streak_days,
                    "streak_multiplier": multiplier,
                    "last_focus_date": today,
                    "focus_velocity": round(earned_xp / max(1, SPRINT_MINUTES), 2),
                },
                "league": {
                    "rank_points": next_rank,
                    "division": division.value,
                    "weekly_state": "promoting" if rank_delta > 0 else "stable",
                },
                "updated_at": now_utc(),
            },
            "$setOnInsert": {"created_at": now_utc()},
        },
        upsert=True,
    )

    await db.sprint_events.insert_one({
        "user_id": user_id,
        "sprint_id": sprint_id,
        "xp_delta": earned_xp,
        "rank_delta": rank_delta,
        "raw_output": redact_sensitive(raw_output),
        "created_at": now_utc(),
    })

    if sprint_id:
        async with SPRINT_LOCK:
            sprint = ACTIVE_SPRINTS.get(sprint_id)
            if sprint and user_id in sprint.user_ids:
                sprint.completed_milestones.append(f"{user_id}:{now_utc().isoformat()}")
                ACTIVE_SPRINTS[sprint_id] = sprint


@app.get("/api/v1/passports/{user_id}", response_model=CredentialPassport)
async def credential_passport(user_id: str, account: dict[str, Any] = Depends(require_user)) -> CredentialPassport:
    if account["user_id"] != user_id and not has_role(account, "admin"):
        raise HTTPException(status_code=403, detail="You can only read your own Credential Passport.")
    passport = await build_passport({"user_id": user_id})
    if not passport:
        raise HTTPException(status_code=404, detail="Top-tier Credential Passport not found.")
    return passport


@app.get("/api/v1/passports", dependencies=[Depends(require_admin_key)])
async def top_tier_passports() -> dict[str, list[CredentialPassport]]:
    database = get_db()
    pipeline = [
        {"$match": {"league.division": {"$in": [LeagueDivision.diamond.value, LeagueDivision.grandmaster.value]}}},
        {"$sort": {"league.rank_points": -1}},
        {"$limit": 50},
        {"$project": {"_id": 0, "user_id": 1}},
    ]
    docs = await database.users.aggregate(pipeline).to_list(length=50)
    passports = [passport for doc in docs if (passport := await build_passport({"user_id": doc["user_id"]}))]
    return {"passports": passports}


async def build_passport(match: dict[str, Any]) -> CredentialPassport | None:
    database = get_db()
    pipeline = [
        {"$match": {**match, "league.division": {"$in": [LeagueDivision.diamond.value, LeagueDivision.grandmaster.value]}}},
        {
            "$lookup": {
                "from": "sprint_events",
                "localField": "user_id",
                "foreignField": "user_id",
                "as": "events",
                "pipeline": [
                    {"$sort": {"created_at": -1}},
                    {"$limit": 20},
                    {"$project": {"_id": 0, "xp_delta": 1, "rank_delta": 1, "raw_output": 1, "created_at": 1}},
                ],
            }
        },
        {
            "$project": {
                "_id": 0,
                "user_id": 1,
                "display_name": {"$ifNull": ["$display_name", "StudyQuest Learner"]},
                "league_division": "$league.division",
                "xp_total": {"$ifNull": ["$xp_total", 0]},
                "level": {"$ifNull": ["$level", 1]},
                "focus_velocity": {"$ifNull": ["$focus.focus_velocity", 0]},
                "clear_streaks": {"$ifNull": ["$focus.streak_days", 0]},
                "rank_points": {"$ifNull": ["$league.rank_points", 0]},
                "events": 1,
            }
        },
    ]
    docs = await database.users.aggregate(pipeline).to_list(length=1)
    if not docs:
        return None
    doc = redact_sensitive(docs[0])
    events = doc.get("events", [])
    return CredentialPassport(
        user_id=doc["user_id"],
        display_name=doc["display_name"],
        league_division=LeagueDivision(doc["league_division"]),
        xp_total=doc["xp_total"],
        level=doc["level"],
        focus_velocity=doc["focus_velocity"],
        clear_streaks=doc["clear_streaks"],
        rank_points=doc["rank_points"],
        verified_execution_metrics={
            "recent_verified_clears": len(events),
            "recent_xp": sum(int(event.get("xp_delta", 0)) for event in events),
            "recent_rank_points": sum(int(event.get("rank_delta", 0)) for event in events),
        },
        raw_output_text_logs=[str(event.get("raw_output", "")) for event in events],
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("studyquest_api:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
