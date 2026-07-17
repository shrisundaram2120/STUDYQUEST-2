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
  await expect(page.locator('a[href="progress.html"]')).toHaveCount(2);
  await expect(page.locator('a[href="skill-tree.html"]')).toHaveCount(2);
  await expect(page.locator('a[href="passport.html"]')).toHaveCount(2);
  await expect(page.locator('a[href="reminders.html"]')).toHaveCount(2);
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

test("Video Quest exposes the split-pane checkpoint workflow", async ({ page }) => {
  await page.goto("/video-quest.html");
  await expect(page.getByRole("heading", { name: "Video Quest", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("FastAPI base URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load lesson" })).toBeVisible();
  await expect(page.locator(".video-quest-grid")).toBeVisible();
  await expect(page.locator("#evaluationPanel")).toBeVisible();
});

test("Progress page renders analytics and recommendations", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("studyquest.tasks", JSON.stringify([
      { id: "task-1", title: "Photosynthesis review", subject: "Science", done: true, completedAt: new Date().toISOString() },
      { id: "task-2", title: "Algebra worksheet", subject: "Math", done: false, deadline: new Date().toISOString().slice(0, 10) }
    ]));
    localStorage.setItem("studyquest.focusLog", JSON.stringify([
      { id: "focus-1", label: "Science focus", minutes: 30, completedAt: new Date().toISOString() }
    ]));
  });

  await page.goto("/progress.html");
  await expect(page.getByRole("heading", { name: "Progress intelligence" })).toBeVisible();
  await expect(page.locator("#focusChart .mini-bar")).toHaveCount(7);
  await expect(page.locator("#taskChart .mini-bar")).toHaveCount(14);
  await expect(page.locator("#subjectHeatmap")).toContainText("Science");
});

test("Skill Tree unlocks an available node", async ({ page }) => {
  await page.goto("/skill-tree.html");
  await expect(page.getByRole("heading", { name: "RPG skill tree" })).toBeVisible();
  await expect(page.locator(".skill-node")).toHaveCount(6);
  await page.getByRole("button", { name: "Unlock node" }).first().click();
  await expect(page.locator("#skillStatus")).toContainText("unlocked");
  await expect(page.locator("#badgeCount")).not.toHaveText("0");
});

test("Settings exposes first-party API sync controls", async ({ page }) => {
  await page.goto("/settings.html");
  await expect(page.getByPlaceholder("http://127.0.0.1:8000")).toBeVisible();
  await expect(page.locator("#syncProvider")).toHaveValue("studyquest-api");
  await expect(page.getByRole("button", { name: "Push data" })).toBeVisible();
});

test("Sources manage resource metadata and share-pack imports", async ({ page }) => {
  await page.goto("/source.html");
  await expect(page.getByRole("heading", { name: "Study sources" })).toBeVisible();

  await page.locator("#resourceSearch").fill("NCERT");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.locator("#bookmarksList")).toContainText("NCERT");
  await expect(page.locator("#bookmarksList")).toContainText("Curated");

  await page.locator("#customTitle").fill("Algebra drill sheet");
  await page.locator("#customUrl").fill("https://example.com/algebra");
  await page.locator("#customSubject").fill("Math");
  await page.locator("#customTags").fill("algebra, practice");
  await page.locator("#customTrust").selectOption("Teacher verified");
  await page.locator("#customNote").fill("Use before Friday's quiz.");
  await page.getByRole("button", { name: "Save resource" }).click();
  await expect(page.locator("#bookmarksList")).toContainText("Algebra drill sheet");
  await expect(page.locator("#bookmarksList")).toContainText("Teacher verified");

  await page.locator("#bookmarkTrustFilter").selectOption("Teacher verified");
  await expect(page.locator("#bookmarksList")).toContainText("Algebra drill sheet");
  await expect(page.locator("#bookmarksList")).not.toContainText("NCERT");

  await page.locator("#importSharePackFile").setInputFiles({
    name: "resources.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      resources: [{
        title: "Chemistry equations pack",
        url: "https://example.com/chemistry",
        type: "Text",
        language: "Custom",
        subject: "Chemistry",
        tags: ["chemistry", "equations"],
        trust: "Student shared",
        note: "Shared by study group."
      }]
    }))
  });
  await page.locator("#bookmarkTrustFilter").selectOption("all");
  await page.getByRole("button", { name: "Import JSON" }).click();
  await expect(page.locator("#bookmarksList")).toContainText("Chemistry equations pack");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("studyquest.resourceBookmarks")));
  expect(saved.length).toBeGreaterThanOrEqual(3);
  expect(saved.some((resource) => resource.tags?.includes("practice"))).toBe(true);
});

test("Credential Passport renders redacted export text", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("studyquest.profile", JSON.stringify({
      name: "Codex Student 9876 5432 1098",
      className: "Class 10",
      email: "student@example.com",
      goal: "Score higher in science",
      subjects: ["Science", "Math"],
      studyStyle: "Short revision blocks",
      createdAt: "2026-05-14T00:00:00.000Z"
    }));
    localStorage.setItem("studyquest.skillProgress", JSON.stringify({
      unlockedNodeIds: ["focus-foundation", "note-alchemist"],
      xpTotal: 320,
      level: 3,
      rankPoints: 180,
      leagueDivision: "Silver",
      badges: ["Focus Foundation", "Note Alchemist"]
    }));
    localStorage.setItem("studyquest.activityEvents", JSON.stringify([
      { id: "event-1", type: "focus", label: "Called student@example.com after Science focus", createdAt: new Date().toISOString() }
    ]));
  });

  await page.goto("/passport.html");
  await expect(page.getByRole("heading", { name: "Credential passport" })).toBeVisible();
  await expect(page.locator("#passportLeague")).toHaveText("Silver");
  await expect(page.locator("#passportProfile")).toContainText("[Aadhaar_Redacted]");
  await expect(page.locator("#passportOutput")).toHaveValue(/Email_Redacted/);
  await expect(page.getByRole("button", { name: "Download markdown" })).toBeVisible();
});

test("OCR extracts text in-app and saves it to notes", async ({ page }) => {
  await page.addInitScript(() => {
    window.Tesseract = {
      recognize: async (_image, _language, options = {}) => {
        options.logger?.({ status: "recognizing text", progress: 0.72 });
        return {
          data: {
            text: "Photosynthesis uses light energy to make glucose.",
            confidence: 94
          }
        };
      }
    };
  });

  await page.goto("/ocr.html");
  await expect(page.getByRole("heading", { name: "Image to text" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);

  await page.locator("#imageInput").setInputFiles({
    name: "biology-notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock image bytes")
  });
  await page.getByRole("button", { name: "Extract text" }).click();

  await expect(page.locator("#ocrText")).toHaveValue("Photosynthesis uses light energy to make glucose.");
  await expect(page.locator("#ocrConfidence")).toHaveText("94%");
  await expect(page.locator("#ocrHistoryList")).toContainText("biology-notes");

  await page.getByRole("button", { name: "Save to Notes" }).click();
  const savedNote = await page.evaluate(() => JSON.parse(localStorage.getItem("studyquest.notes")).some((note) => note.content.includes("Photosynthesis uses light energy")));
  expect(savedNote).toBe(true);
});

test("Reminder Center previews and saves notification rules", async ({ page }) => {
  await page.addInitScript(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("studyquest.tasks", JSON.stringify([
      {
        id: "task-reminder-1",
        title: "Study electricity numericals",
        subject: "Science",
        priority: "High",
        deadline: today,
        done: false
      }
    ]));
    localStorage.setItem("studyquest.schedule", JSON.stringify([
      {
        id: "schedule-reminder-1",
        time: "23:59",
        task: "Timed algebra sprint",
        note: "Ten mark practice"
      }
    ]));
    localStorage.setItem("studyquest.notificationSettings", JSON.stringify({
      enabled: false,
      taskReminders: true,
      scheduleReminders: true,
      taskReminderHour: "08:00",
      scheduleLeadMinutes: 5,
      streakReminderHour: "23:59"
    }));
  });

  await page.goto("/reminders.html");
  await expect(page.getByRole("heading", { name: "Reminder center" })).toBeVisible();
  await expect(page.locator("#permissionPill")).toContainText(/default|denied|granted|unsupported/);
  await expect(page.locator("#reminderList")).toContainText("Task due today");
  await expect(page.locator("#reminderList")).toContainText("Study electricity numericals");
  await expect(page.locator("#reminderList")).toContainText("Timed algebra sprint");

  await page.locator("#scheduleLeadMinutes").fill("15");
  await page.getByRole("button", { name: "Save reminder rules" }).click();
  await expect(page.locator("#notificationStatus")).toContainText("Reminder rules saved");
  await expect(page.locator("#enabledReminderCount")).not.toHaveText("0");

  const savedLead = await page.evaluate(() => JSON.parse(localStorage.getItem("studyquest.notificationSettings")).scheduleLeadMinutes);
  expect(savedLead).toBe(15);
});
