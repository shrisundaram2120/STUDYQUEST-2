const { test, expect } = require("@playwright/test");

const profile = {
  name: "Codex Student",
  className: "Class 10",
  email: "student@example.com",
  goal: "Score higher in science",
  subjects: ["Science", "Math"],
  studyStyle: "Short revision blocks",
  createdAt: "2026-05-14T00:00:00.000Z"
};

async function seedProfile(page) {
  await page.addInitScript((nextProfile) => {
    localStorage.setItem("studyquest.profile", JSON.stringify(nextProfile));
  }, profile);
}

test.beforeEach(async ({ page }) => {
  await seedProfile(page);
});

test("dashboard exposes the upgraded study surfaces", async ({ page }) => {
  await page.goto("/home.html");
  await expect(page.getByRole("heading", { name: "Weekly progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Flashcards" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exam Mode" })).toBeVisible();
  await expect(page.locator("#weeklyFocusChart .mini-bar")).toHaveCount(7);
});

test("flashcard review updates spaced repetition state", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("studyquest.flashcards", JSON.stringify([
      {
        id: "card-1",
        deck: "Science",
        front: "What is photosynthesis?",
        back: "Plants convert light, water, and carbon dioxide into glucose and oxygen.",
        dueAt: new Date(Date.now() - 60000).toISOString(),
        intervalDays: 0,
        ease: 2.5,
        reviews: 0
      }
    ]));
  });

  await page.goto("/flashcards.html");
  await expect(page.locator("#dueCount")).toHaveText("1");
  await page.getByRole("button", { name: "Good" }).click();
  await expect(page.locator("#dueCount")).toHaveText("0");
  await expect(page.getByText("No cards due")).toBeVisible();
});

test("exam mode creates a weak-topic revision plan", async ({ page }) => {
  await page.goto("/exams.html");
  await page.getByPlaceholder("Exam title").fill("Science Midterm");
  await page.getByPlaceholder("Subject").fill("Science");
  await page.locator("#examDate").fill("2026-06-01");
  await page.getByPlaceholder("Target score").fill("90");
  await page.locator("#examTopics").fill("Photosynthesis | 2 | 5\nElectricity | 4 | 3");
  await page.getByRole("button", { name: "Save exam" }).click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Science Midterm revision plan" })).toBeVisible();
  await expect(page.locator("#revisionPlan").getByText("Photosynthesis")).toBeVisible();
  await expect(page.locator("#revisionPlan").getByText("Learn and practice")).toBeVisible();
});

test("AI Quest falls back when no server key is configured", async ({ page }) => {
  await page.goto("/aiquest.html");
  await page.getByPlaceholder("Paste a chapter, notes, OCR text, or source material here...").fill(
    "Photosynthesis happens in chloroplasts. Chlorophyll absorbs light energy. Plants produce glucose and oxygen."
  );
  await page.getByRole("button", { name: "Summary" }).click();
  await expect(page.getByText("Revision summary")).toBeVisible();
});
