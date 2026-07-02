const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || 4173);
const host = "127.0.0.1";
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".cjs": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
};

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) {
            return;
        }
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    });
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
    res.writeHead(status, { "Content-Type": contentType });
    res.end(body);
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                reject(new Error("Request too large"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on("error", reject);
    });
}

function instructionForMode(mode, output) {
    if (mode === "flashcards") {
        return "Create 8 concise spaced-repetition flashcards. Return JSON only as {\"cards\":[{\"front\":\"...\",\"back\":\"...\"}]}.";
    }
    if (mode === "quiz") {
        return "Create 6 exam-style practice questions with answers. Return JSON only as {\"questions\":[{\"question\":\"...\",\"answer\":\"...\"}]}.";
    }
    if (mode === "explain") {
        return "Explain the material in simple language, then add key takeaways and one check question.";
    }
    return "Summarize this material into clear revision notes with important terms and exam-ready bullet points.";
}

async function handleAi(req, res) {
    try {
        const payload = await readJson(req);
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            send(res, 503, JSON.stringify({ error: "OPENAI_API_KEY is not configured on this local server." }), "application/json; charset=utf-8");
            return;
        }
        const mode = payload.mode || "summary";
        const instruction = instructionForMode(mode, payload.output);
        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                input: [
                    {
                        role: "system",
                        content: "You are StudyQuest, a concise exam-focused study assistant. Return only JSON for flashcards or quiz modes."
                    },
                    {
                        role: "user",
                        content: `${instruction}\n\nTitle: ${payload.title || "Study material"}\n\nMaterial:\n${payload.text || ""}`
                    }
                ]
            })
        });
        const data = await response.json();
        if (!response.ok) {
            send(res, response.status, JSON.stringify({ error: data.error?.message || "OpenAI request failed" }), "application/json; charset=utf-8");
            return;
        }

        const text = data.output_text || (data.output || [])
            .flatMap((item) => item.content || [])
            .map((part) => part.text || "")
            .join("\n")
            .trim();

        if (mode === "flashcards" || mode === "quiz") {
            try {
                const parsed = JSON.parse(text);
                send(res, 200, JSON.stringify(parsed), "application/json; charset=utf-8");
                return;
            } catch (error) {
                send(res, 200, JSON.stringify({ text }), "application/json; charset=utf-8");
                return;
            }
        }

        send(res, 200, JSON.stringify({ text }), "application/json; charset=utf-8");
    } catch (error) {
        send(res, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
    }
}

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${host}:${port}`);
    if (req.method === "POST" && requestUrl.pathname === "/api/ai") {
        handleAi(req, res);
        return;
    }

    const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.normalize(path.join(root, decodeURIComponent(requestedPath)));

    if (!filePath.startsWith(root)) {
        send(res, 403, "Forbidden");
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            send(res, 404, "Not found");
            return;
        }

        send(res, 200, data, types[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    });
});

server.listen(port, host, () => {
    console.log(`StudyQuest running at http://${host}:${port}/`);
});

function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
