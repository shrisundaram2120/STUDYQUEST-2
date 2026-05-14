const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || 4173);
const host = "127.0.0.1";

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

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
    res.writeHead(status, { "Content-Type": contentType });
    res.end(body);
}

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${host}:${port}`);
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
