const { defineConfig, devices } = require("@playwright/test");

const useExternalServer = process.env.STUDYQUEST_EXTERNAL_SERVER === "1";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: useExternalServer ? undefined : {
    command: "node local-server.cjs 4173",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: false,
    timeout: 15000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
