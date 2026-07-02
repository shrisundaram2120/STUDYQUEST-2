import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from studyquest_api import app


def main() -> None:
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["service"] == "StudyQuest API"

    lesson = client.get("/api/v1/video-lessons/sample-video-quest")
    assert lesson.status_code == 200, lesson.text
    assert lesson.json()["milestones"], lesson.text

    sprint = client.post("/api/v1/sprints/start", json={"user_id": "smoke-user", "party_id": "smoke"})
    assert sprint.status_code == 200, sprint.text
    assert sprint.json()["active"] is True

    evaluation = client.post(
        "/api/v1/quests/evaluate",
        json={
            "user_id": "smoke-user",
            "video_id": "sample-video-quest",
            "milestone_timestamp": 15,
            "solution": (
                "The answer names the concept, gives evidence, explains the reasoning, "
                "and describes how I would apply it to a harder example."
            ),
        },
    )
    assert evaluation.status_code == 200, evaluation.text
    assert evaluation.json()["source"] in {"local_socratic_fallback", "gemini", "mongo_vector_cache"}

    print("StudyQuest API smoke test passed.")


if __name__ == "__main__":
    main()
