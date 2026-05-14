const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = process.env.PORT || "4173";
const baseUrl = `http://127.0.0.1:${port}`;

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      ...options
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

(async () => {
  const server = spawn(process.execPath, ["local-server.cjs", port], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    shell: false
  });

  const stopServer = () => {
    if (!server.killed) {
      server.kill();
    }
  };

  process.on("SIGINT", () => {
    stopServer();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stopServer();
    process.exit(143);
  });

  try {
    await waitForServer(`${baseUrl}/index.html`);
    const code = await run(process.execPath, ["./node_modules/playwright/cli.js", "test", ...process.argv.slice(2)], {
      env: { ...process.env, STUDYQUEST_EXTERNAL_SERVER: "1" }
    });
    stopServer();
    process.exit(code);
  } catch (error) {
    console.error(error.message);
    stopServer();
    process.exit(1);
  }
})();
