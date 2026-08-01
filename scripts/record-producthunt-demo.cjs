const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("@playwright/test");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.STUDYQUEST_DEMO_PORT || 4186);
const outputDir = path.join(root, "launch-assets");
const videoTarget = path.join(outputDir, "studyquest-producthunt-workflow.webm");
const coverTarget = path.join(outputDir, "studyquest-producthunt-cover.png");

function waitForServer(url, timeoutMs = 15000) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve();
            });
            request.on("error", () => {
                if (Date.now() - startedAt > timeoutMs) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(check, 250);
            });
        };
        check();
    });
}

async function main() {
    fs.mkdirSync(outputDir, { recursive: true });

    const server = spawn(process.execPath, ["local-server.cjs", String(port)], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, STUDYQUEST_RECORDING_SERVER: "1" }
    });

    try {
        await waitForServer(`http://127.0.0.1:${port}/producthunt-demo.html`);

        const browser = await chromium.launch();
        const coverContext = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1
        });
        const coverPage = await coverContext.newPage();
        await coverPage.goto(`http://127.0.0.1:${port}/producthunt-demo.html`, { waitUntil: "networkidle" });
        await coverPage.screenshot({ path: coverTarget, fullPage: false });
        await coverContext.close();

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1,
            recordVideo: {
                dir: outputDir,
                size: { width: 1280, height: 720 }
            }
        });

        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${port}/producthunt-demo.html?record=1`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => document.body.dataset.recordingDone === "true", null, { timeout: 90000 });

        const video = page.video();
        await page.close();
        const videoPath = await video.path();
        await context.close();
        await browser.close();

        if (fs.existsSync(videoTarget)) {
            fs.rmSync(videoTarget);
        }
        fs.renameSync(videoPath, videoTarget);

        console.log(`Product Hunt workflow video: ${videoTarget}`);
        console.log(`Product Hunt cover image: ${coverTarget}`);
    } finally {
        server.kill("SIGTERM");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
