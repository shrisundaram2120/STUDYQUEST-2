const StudyQuest = (() => {
    const storageKeys = {
        profile: "studyquest.profile",
        tasks: "studyquest.tasks",
        notes: "studyquest.notes",
        schedule: "studyquest.schedule",
        dashboardTasks: "studyquest.dashboardTasks",
        focusLog: "studyquest.focusLog",
        timetablePlans: "studyquest.timetablePlans",
        resourceBookmarks: "studyquest.resourceBookmarks",
        aiDraft: "studyquest.aiDraft",
        flashcards: "studyquest.flashcards",
        exams: "studyquest.exams",
        notificationSettings: "studyquest.notificationSettings",
        cloudConfig: "studyquest.cloudConfig",
        cloudSession: "studyquest.cloudSession",
        settings: "studyquest.settings"
    };

    const defaultSettings = {
        theme: "expedition",
        focusMinutes: 25,
        breakMinutes: 5,
        dailyFocusGoal: 90,
        aiEndpoint: "/api/ai"
    };

    const defaultNotificationSettings = {
        enabled: false,
        taskReminders: true,
        scheduleReminders: true,
        streakReminderHour: "19:00"
    };

    const quotes = [
        "Small, steady steps create the biggest academic leaps.",
        "Clarity comes after you begin, not before.",
        "Your future self is built in the next focused hour.",
        "Consistency is stronger than motivation on difficult days.",
        "Learn deeply, rest honestly, return bravely."
    ];

    const tips = [
        "Review your hardest topic first while your energy is highest.",
        "Write one clear goal before each session to reduce distraction.",
        "Keep breaks short, physical, and away from the same screen.",
        "Turn confusing notes into questions before rereading them.",
        "End every session by choosing the next smallest action."
    ];

    const themeLabels = {
        expedition: "Expedition",
        calm: "Calm",
        midnight: "Midnight"
    };

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function clampNumber(value, min, max, fallback) {
        const next = Number(value);
        if (!Number.isFinite(next)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, next));
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function nl2br(value) {
        return escapeHTML(value).replace(/\n/g, "<br>");
    }

    function pluralize(count, singular, plural = `${singular}s`) {
        return `${count} ${count === 1 ? singular : plural}`;
    }

    function newId() {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function getSettings() {
        return { ...defaultSettings, ...read(storageKeys.settings, {}) };
    }

    function saveSettings(settings) {
        write(storageKeys.settings, { ...getSettings(), ...settings });
        applyTheme();
    }

    function applyTheme() {
        const settings = getSettings();
        document.documentElement.dataset.theme = settings.theme || "expedition";
    }

    function getProfile() {
        return read(storageKeys.profile, null);
    }

    function saveProfile(profile) {
        write(storageKeys.profile, profile);
    }

    function getTasks() {
        return read(storageKeys.tasks, []);
    }

    function saveTasks(tasks) {
        write(storageKeys.tasks, tasks);
    }

    function getNotes() {
        return read(storageKeys.notes, [
            { id: newId(), name: "Mathematics", content: "", updatedAt: new Date().toISOString() },
            { id: newId(), name: "Science", content: "", updatedAt: new Date().toISOString() },
            { id: newId(), name: "English", content: "", updatedAt: new Date().toISOString() }
        ]);
    }

    function saveNotes(notes) {
        write(storageKeys.notes, notes);
    }

    function getSchedule() {
        return read(storageKeys.schedule, [
            { id: newId(), time: "06:30", task: "Morning revision", note: "Warm up with yesterday's topic" },
            { id: newId(), time: "17:00", task: "Problem practice", note: "Focus on your weakest subject" }
        ]);
    }

    function saveSchedule(rows) {
        write(storageKeys.schedule, rows);
    }

    function getDashboardTasks() {
        return read(storageKeys.dashboardTasks, []);
    }

    function saveDashboardTasks(tasks) {
        write(storageKeys.dashboardTasks, tasks);
    }

    function getFocusLog() {
        return read(storageKeys.focusLog, []);
    }

    function saveFocusLog(rows) {
        write(storageKeys.focusLog, rows);
    }

    function logFocusSession({ minutes, label = "Focus session", source = "dashboard" }) {
        const safeMinutes = clampNumber(minutes, 1, 720, 1);
        const rows = getFocusLog();
        rows.unshift({
            id: newId(),
            label,
            source,
            minutes: safeMinutes,
            completedAt: new Date().toISOString()
        });
        saveFocusLog(rows.slice(0, 500));
    }

    function getTimetablePlans() {
        return read(storageKeys.timetablePlans, []);
    }

    function saveTimetablePlans(plans) {
        write(storageKeys.timetablePlans, plans);
    }

    function getResourceBookmarks() {
        return read(storageKeys.resourceBookmarks, []);
    }

    function saveResourceBookmarks(bookmarks) {
        write(storageKeys.resourceBookmarks, bookmarks);
    }

    function getAiDraft() {
        return read(storageKeys.aiDraft, null);
    }

    function saveAiDraft(draft) {
        write(storageKeys.aiDraft, {
            ...draft,
            createdAt: new Date().toISOString()
        });
    }

    function clearAiDraft() {
        localStorage.removeItem(storageKeys.aiDraft);
    }

    function getFlashcards() {
        return read(storageKeys.flashcards, []);
    }

    function saveFlashcards(cards) {
        write(storageKeys.flashcards, cards);
    }

    function addFlashcards(cards, deck = "General") {
        const existing = getFlashcards();
        const now = new Date().toISOString();
        const nextCards = cards.map((card) => ({
            id: card.id || newId(),
            deck: card.deck || deck,
            front: card.front,
            back: card.back,
            source: card.source || "AI Quest",
            dueAt: card.dueAt || now,
            intervalDays: Number(card.intervalDays || 0),
            ease: Number(card.ease || 2.5),
            reviews: Number(card.reviews || 0),
            lapses: Number(card.lapses || 0),
            createdAt: card.createdAt || now,
            updatedAt: now
        }));
        saveFlashcards([...nextCards, ...existing]);
        return nextCards;
    }

    function getDueFlashcards(date = new Date()) {
        return getFlashcards()
            .filter((card) => new Date(card.dueAt || 0) <= date)
            .sort((a, b) => String(a.dueAt || "").localeCompare(String(b.dueAt || "")));
    }

    function reviewFlashcard(cardId, rating) {
        const now = new Date();
        const cards = getFlashcards();
        let reviewed = null;
        const nextCards = cards.map((card) => {
            if (card.id !== cardId) {
                return card;
            }

            const oldEase = Number(card.ease || 2.5);
            const oldInterval = Number(card.intervalDays || 0);
            const reviews = Number(card.reviews || 0) + 1;
            const ratingMap = {
                again: { easeDelta: -0.25, interval: 0, lapses: 1 },
                hard: { easeDelta: -0.12, interval: Math.max(1, Math.ceil(oldInterval * 1.2)) },
                good: { easeDelta: 0, interval: oldInterval < 1 ? 1 : Math.ceil(oldInterval * oldEase) },
                easy: { easeDelta: 0.18, interval: oldInterval < 1 ? 3 : Math.ceil(oldInterval * (oldEase + 0.45)) }
            };
            const update = ratingMap[rating] || ratingMap.good;
            const ease = Math.max(1.3, Number((oldEase + update.easeDelta).toFixed(2)));
            const intervalDays = Math.max(0, update.interval);
            const due = new Date(now);
            due.setDate(due.getDate() + intervalDays);

            reviewed = {
                ...card,
                ease,
                intervalDays,
                reviews,
                lapses: Number(card.lapses || 0) + Number(update.lapses || 0),
                dueAt: due.toISOString(),
                updatedAt: now.toISOString()
            };
            return reviewed;
        });
        saveFlashcards(nextCards);
        return reviewed;
    }

    function getFlashcardStats() {
        const cards = getFlashcards();
        const due = getDueFlashcards();
        const mastered = cards.filter((card) => Number(card.intervalDays || 0) >= 14).length;
        const decks = Array.from(new Set(cards.map((card) => card.deck || "General")));
        return {
            total: cards.length,
            due: due.length,
            mastered,
            decks
        };
    }

    function getExams() {
        return read(storageKeys.exams, []);
    }

    function saveExams(exams) {
        write(storageKeys.exams, exams);
    }

    function addExam(exam) {
        const exams = getExams();
        const next = {
            id: newId(),
            title: exam.title,
            subject: exam.subject || "General",
            date: exam.date,
            targetScore: clampNumber(exam.targetScore, 1, 100, 80),
            topics: exam.topics || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        exams.unshift(next);
        saveExams(exams);
        return next;
    }

    function getExamStats() {
        const exams = getExams();
        const upcoming = exams
            .filter((exam) => daysUntil(exam.date) !== null && daysUntil(exam.date) >= 0)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const weakestTopics = exams
            .flatMap((exam) => (exam.topics || []).map((topic) => ({ ...topic, examTitle: exam.title, examDate: exam.date })))
            .sort((a, b) => Number(a.confidence || 0) - Number(b.confidence || 0))
            .slice(0, 6);
        return { exams, upcoming, weakestTopics };
    }

    function buildExamRevisionPlan(exam) {
        const diff = Math.max(1, daysUntil(exam.date) ?? 1);
        const topics = (exam.topics || [])
            .slice()
            .sort((a, b) => {
                const aScore = Number(a.confidence || 1) - Number(a.weight || 1);
                const bScore = Number(b.confidence || 1) - Number(b.weight || 1);
                return aScore - bScore;
            });
        const maxBlocks = Math.min(10, Math.max(3, diff));
        return topics.slice(0, maxBlocks).map((topic, index) => ({
            day: index + 1,
            title: topic.name,
            focus: Number(topic.confidence || 1) <= 2 ? "Learn and practice" : "Timed revision",
            minutes: Number(topic.weight || 3) >= 4 ? 45 : 30
        }));
    }

    function getNotificationSettings() {
        return { ...defaultNotificationSettings, ...read(storageKeys.notificationSettings, {}) };
    }

    function saveNotificationSettings(settings) {
        write(storageKeys.notificationSettings, { ...getNotificationSettings(), ...settings });
    }

    async function requestNotifications() {
        if (!("Notification" in window)) {
            return "unsupported";
        }
        if (Notification.permission === "granted") {
            saveNotificationSettings({ enabled: true });
            return "granted";
        }
        const permission = await Notification.requestPermission();
        saveNotificationSettings({ enabled: permission === "granted" });
        return permission;
    }

    function notify(title, body) {
        const settings = getNotificationSettings();
        if (!settings.enabled || !("Notification" in window) || Notification.permission !== "granted") {
            return false;
        }
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: "STUDYQUEST_NOTIFY", title, body });
        } else {
            new Notification(title, { body, icon: "studyquest-high-resolution-logo.png" });
        }
        return true;
    }

    function scheduleSessionNotifications() {
        const settings = getNotificationSettings();
        if (!settings.enabled) {
            return 0;
        }
        const now = new Date();
        const today = todayKey(now);
        let count = 0;

        if (settings.taskReminders) {
            getTasks().filter((task) => !task.done && task.deadline === today).slice(0, 4).forEach((task, index) => {
                window.setTimeout(() => notify("StudyQuest task due today", task.title), 5000 + index * 1200);
                count += 1;
            });
        }

        if (settings.scheduleReminders) {
            getSchedule().forEach((row) => {
                if (!row.time) return;
                const target = new Date(`${today}T${row.time}:00`);
                const delay = target - now;
                if (delay > 0 && delay < 86400000) {
                    window.setTimeout(() => notify("Study block starting", row.task), delay);
                    count += 1;
                }
            });
        }

        if (settings.streakReminderHour) {
            const hasFocusToday = getFocusLog().some((session) => session.date?.slice(0, 10) === today);
            const target = new Date(`${today}T${settings.streakReminderHour}:00`);
            const delay = target - now;
            if (!hasFocusToday && Number.isFinite(delay) && delay > 0 && delay < 86400000) {
                window.setTimeout(() => notify("Keep your StudyQuest streak", "A short focus session still counts today."), delay);
                count += 1;
            }
        }

        return count;
    }

    function getCloudConfig() {
        return read(storageKeys.cloudConfig, {
            provider: "firebase",
            firebaseConfig: "",
            supabaseUrl: "",
            supabaseAnonKey: ""
        });
    }

    function saveCloudConfig(config) {
        write(storageKeys.cloudConfig, { ...getCloudConfig(), ...config });
    }

    function getCloudSession() {
        return read(storageKeys.cloudSession, null);
    }

    function saveCloudSession(session) {
        write(storageKeys.cloudSession, session);
    }

    function collectSyncPayload() {
        return {
            exportedAt: new Date().toISOString(),
            version: 4,
            data: Object.fromEntries(Object.values(storageKeys).map((key) => [key, read(key, null)]))
        };
    }

    function formatClock(date = new Date()) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    function formatDate(date = new Date()) {
        return date.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    function formatShortDate(date = new Date()) {
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric"
        });
    }

    function todayKey(date = new Date()) {
        return date.toISOString().slice(0, 10);
    }

    function isOverdue(task, date = new Date()) {
        return Boolean(task.deadline && !task.done && task.deadline < todayKey(date));
    }

    function daysUntil(dateString) {
        if (!dateString) {
            return null;
        }
        const today = new Date(`${todayKey()}T00:00:00`);
        const target = new Date(`${dateString}T00:00:00`);
        return Math.round((target - today) / 86400000);
    }

    function attachClock(clockId, dateId) {
        const clockEl = document.getElementById(clockId);
        const dateEl = document.getElementById(dateId);

        if (!clockEl || !dateEl) {
            return;
        }

        function tick() {
            const now = new Date();
            clockEl.textContent = formatClock(now);
            dateEl.textContent = formatDate(now);
        }

        tick();
        setInterval(tick, 1000);
    }

    function attachSidebarToggle(buttonId, sidebarId) {
        const button = document.getElementById(buttonId);
        const sidebar = document.getElementById(sidebarId);

        if (!button || !sidebar) {
            return;
        }

        button.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            button.setAttribute("aria-expanded", String(sidebar.classList.contains("open")));
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                sidebar.classList.remove("open");
                button.setAttribute("aria-expanded", "false");
            }
        });
    }

    function attachEnterSubmit(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        if (!input || !button) {
            return;
        }
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                button.click();
            }
        });
    }

    function ensureProfile() {
        if (!getProfile()) {
            window.location.href = "index.html";
        }
    }

    function greetName() {
        const profile = getProfile();
        return profile?.name || "Learner";
    }

    function getQuoteOfDay() {
        const day = new Date().getDate();
        return quotes[day % quotes.length];
    }

    function getTips() {
        return tips;
    }

    function getAnalytics() {
        const tasks = getTasks();
        const notes = getNotes();
        const focusLog = getFocusLog();
        const today = todayKey();
        const completedTasks = tasks.filter((task) => task.done);
        const openTasks = tasks.filter((task) => !task.done);
        const overdueTasks = tasks.filter((task) => isOverdue(task));
        const dueSoonTasks = openTasks.filter((task) => {
            const diff = daysUntil(task.deadline);
            return diff !== null && diff >= 0 && diff <= 3;
        });
        const todayFocusMinutes = focusLog
            .filter((row) => row.completedAt?.slice(0, 10) === today)
            .reduce((sum, row) => sum + Number(row.minutes || 0), 0);
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        const weekFocusMinutes = focusLog
            .filter((row) => new Date(row.completedAt) >= weekStart)
            .reduce((sum, row) => sum + Number(row.minutes || 0), 0);
        const streakDays = calculateFocusStreak(focusLog);
        const noteWords = notes.reduce((sum, note) => sum + countWords(note.content), 0);
        const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

        return {
            tasks,
            completedTasks,
            openTasks,
            overdueTasks,
            dueSoonTasks,
            focusLog,
            todayFocusMinutes,
            weekFocusMinutes,
            streakDays,
            noteWords,
            completionRate
        };
    }

    function calculateFocusStreak(focusLog) {
        const days = new Set(focusLog.map((row) => row.completedAt?.slice(0, 10)).filter(Boolean));
        let streak = 0;
        const cursor = new Date();

        while (days.has(todayKey(cursor))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return streak;
    }

    function countWords(text) {
        const matches = String(text || "").trim().match(/\b[\w'-]+\b/g);
        return matches ? matches.length : 0;
    }

    function getSubjectStats() {
        const tasks = getTasks();
        const profile = getProfile();
        const subjects = new Set([...(profile?.subjects || []), ...tasks.map((task) => task.subject).filter(Boolean)]);

        return Array.from(subjects).map((subject) => {
            const subjectTasks = tasks.filter((task) => (task.subject || "General") === subject);
            const done = subjectTasks.filter((task) => task.done).length;
            return {
                subject,
                total: subjectTasks.length,
                done,
                rate: subjectTasks.length ? Math.round((done / subjectTasks.length) * 100) : 0
            };
        });
    }

    function tokenizeSentences(text) {
        return String(text || "")
            .replace(/\s+/g, " ")
            .split(/(?<=[.!?])\s+|[\n\r]+/)
            .map((sentence) => sentence.trim())
            .filter((sentence) => sentence.length > 18);
    }

    function getKeywords(text, limit = 8) {
        const stopWords = new Set([
            "about", "after", "again", "also", "because", "before", "between", "could", "every",
            "from", "have", "into", "more", "most", "only", "other", "should", "some", "than",
            "that", "their", "there", "these", "they", "this", "through", "were", "what", "when",
            "where", "which", "while", "with", "would", "your", "the", "and", "for", "are", "was"
        ]);
        const counts = {};
        String(text || "")
            .toLowerCase()
            .match(/\b[a-z][a-z0-9'-]{3,}\b/g)
            ?.forEach((word) => {
                if (!stopWords.has(word)) {
                    counts[word] = (counts[word] || 0) + 1;
                }
            });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, limit)
            .map(([word]) => word);
    }

    function summarizeText(text, sentenceLimit = 5) {
        const sentences = tokenizeSentences(text);
        if (!sentences.length) {
            return "Add a larger passage to generate a useful summary.";
        }

        const keywords = getKeywords(text, 12);
        const scored = sentences.map((sentence, index) => {
            const lower = sentence.toLowerCase();
            const keywordScore = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0);
            const positionScore = index < 2 ? 1 : 0;
            return { sentence, index, score: keywordScore + positionScore };
        });

        return scored
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, sentenceLimit)
            .sort((a, b) => a.index - b.index)
            .map((item) => item.sentence)
            .join(" ");
    }

    function generateFlashcards(text, limit = 8) {
        const sentences = tokenizeSentences(text);
        const keywords = getKeywords(text, limit);

        return keywords.map((keyword) => {
            const sentence = sentences.find((item) => item.toLowerCase().includes(keyword)) || "";
            return {
                id: newId(),
                front: `What should you remember about "${keyword}"?`,
                back: sentence || `Review the section that mentions ${keyword}.`
            };
        });
    }

    function generateQuiz(text, limit = 6) {
        const sentences = tokenizeSentences(text);
        const keywords = getKeywords(text, limit);

        return keywords.map((keyword, index) => {
            const sentence = sentences.find((item) => item.toLowerCase().includes(keyword)) || "";
            const answer = sentence || `The passage connects this topic to ${keyword}.`;
            return {
                id: newId(),
                question: `Q${index + 1}. Explain the role of "${keyword}" in this topic.`,
                answer
            };
        });
    }

    function explainSimply(text) {
        const summary = summarizeText(text, 3);
        const keywords = getKeywords(text, 5);
        return [
            "Plain-language explanation:",
            summary,
            keywords.length ? `Key ideas to hold onto: ${keywords.join(", ")}.` : "",
            "Try teaching this back in your own words, then check what you missed."
        ].filter(Boolean).join("\n\n");
    }

    function createStudyPlanFromTasks(tasks, startValue, endValue, breakMinutes = 5) {
        const start = new Date(`1970-01-01T${startValue}:00`);
        const end = new Date(`1970-01-01T${endValue}:00`);
        const totalMinutes = Math.floor((end - start) / 60000);
        const cleanTasks = tasks.map((task) => String(task).trim()).filter(Boolean);

        if (!cleanTasks.length || totalMinutes <= 0) {
            return [];
        }

        const breakSlots = Math.max(0, cleanTasks.length - 1);
        const studyMinutes = Math.max(cleanTasks.length, totalMinutes - breakSlots * breakMinutes);
        const blockMinutes = Math.max(1, Math.floor(studyMinutes / cleanTasks.length));
        const rows = [];
        let current = new Date(start);

        cleanTasks.forEach((task, index) => {
            const isLast = index === cleanTasks.length - 1;
            const next = isLast ? new Date(end) : new Date(current.getTime() + blockMinutes * 60000);
            rows.push({
                id: newId(),
                type: "study",
                start: formatTimeForInput(current),
                end: formatTimeForInput(next),
                task
            });
            current = next;

            if (!isLast && breakMinutes > 0) {
                const breakEnd = new Date(current.getTime() + breakMinutes * 60000);
                rows.push({
                    id: newId(),
                    type: "break",
                    start: formatTimeForInput(current),
                    end: formatTimeForInput(breakEnd),
                    task: "Break"
                });
                current = breakEnd;
            }
        });

        return rows;
    }

    function formatTimeForInput(date) {
        return date.toTimeString().slice(0, 5);
    }

    function downloadText(filename, content, type = "text/plain") {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function exportData() {
        const payload = { app: "StudyQuest", ...collectSyncPayload() };
        downloadText(`studyquest-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), "application/json");
    }

    function importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const payload = JSON.parse(reader.result);
                    const data = payload.data || payload;
                    Object.values(storageKeys).forEach((key) => {
                        if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null) {
                            write(key, data[key]);
                        }
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function resetStudyData() {
        [
            storageKeys.tasks,
            storageKeys.notes,
            storageKeys.schedule,
            storageKeys.dashboardTasks,
            storageKeys.focusLog,
            storageKeys.timetablePlans,
            storageKeys.resourceBookmarks,
            storageKeys.aiDraft,
            storageKeys.flashcards,
            storageKeys.exams
        ].forEach((key) => localStorage.removeItem(key));
    }

    async function callAiTool(mode, text, options = {}) {
        const endpoint = options.endpoint || getSettings().aiEndpoint || "/api/ai";
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mode,
                text,
                title: options.title || "",
                profile: getProfile(),
                output: options.output || "text"
            })
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || "AI request failed");
        }

        return response.json();
    }

    function getWeekFocusSeries(days = 7) {
        const focusLog = getFocusLog();
        return Array.from({ length: days }).map((_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - index - 1));
            const key = todayKey(date);
            return {
                key,
                label: date.toLocaleDateString([], { weekday: "short" }),
                minutes: focusLog
                    .filter((row) => row.completedAt?.slice(0, 10) === key)
                    .reduce((sum, row) => sum + Number(row.minutes || 0), 0)
            };
        });
    }

    function getTaskCompletionSeries(days = 14) {
        const tasks = getTasks();
        return Array.from({ length: days }).map((_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - index - 1));
            const key = todayKey(date);
            return {
                key,
                label: date.getDate(),
                completed: tasks.filter((task) => task.completedAt?.slice(0, 10) === key).length
            };
        });
    }

    function renderMiniBars(rows, valueKey = "minutes") {
        const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
        return rows.map((row) => {
            const percent = Math.round((Number(row[valueKey] || 0) / max) * 100);
            return `
                <div class="mini-bar" title="${escapeHTML(row.label)}: ${Number(row[valueKey] || 0)}">
                    <span style="height:${percent}%"></span>
                    <small>${escapeHTML(row.label)}</small>
                </div>
            `;
        }).join("");
    }

    function injectMobileNav() {
        if (document.querySelector(".mobile-bottom-nav")) {
            return;
        }
        const current = location.pathname.split("/").pop() || "index.html";
        const links = [
            ["home.html", "Home"],
            ["tasks.html", "Tasks"],
            ["notes.html", "Notes"],
            ["flashcards.html", "Cards"],
            ["exams.html", "Exams"]
        ];
        const nav = document.createElement("nav");
        nav.className = "mobile-bottom-nav";
        nav.setAttribute("aria-label", "Primary mobile navigation");
        nav.innerHTML = links.map(([href, label]) => `
            <a href="${href}" class="${current === href ? "active" : ""}">
                <span>${escapeHTML(label)}</span>
            </a>
        `).join("");
        document.body.appendChild(nav);
    }

    function resetAllData() {
        Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) {
            return;
        }

        if (!["http:", "https:"].includes(window.location.protocol)) {
            return;
        }

        navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }

    function renderProgressBar(percent) {
        const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
        return `<div class="progress-track"><span style="width:${safePercent}%"></span></div>`;
    }

    function pageReady() {
        applyTheme();
        registerServiceWorker();
        injectMobileNav();
        scheduleSessionNotifications();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", pageReady);
    } else {
        pageReady();
    }

    return {
        storageKeys,
        themeLabels,
        escapeHTML,
        nl2br,
        pluralize,
        clampNumber,
        newId,
        getSettings,
        saveSettings,
        applyTheme,
        getProfile,
        saveProfile,
        getTasks,
        saveTasks,
        getNotes,
        saveNotes,
        getSchedule,
        saveSchedule,
        getDashboardTasks,
        saveDashboardTasks,
        getFocusLog,
        saveFocusLog,
        logFocusSession,
        getTimetablePlans,
        saveTimetablePlans,
        getResourceBookmarks,
        saveResourceBookmarks,
        getAiDraft,
        saveAiDraft,
        clearAiDraft,
        getFlashcards,
        saveFlashcards,
        addFlashcards,
        getDueFlashcards,
        reviewFlashcard,
        getFlashcardStats,
        getExams,
        saveExams,
        addExam,
        getExamStats,
        buildExamRevisionPlan,
        getNotificationSettings,
        saveNotificationSettings,
        requestNotifications,
        notify,
        scheduleSessionNotifications,
        getCloudConfig,
        saveCloudConfig,
        getCloudSession,
        saveCloudSession,
        collectSyncPayload,
        attachClock,
        attachSidebarToggle,
        attachEnterSubmit,
        greetName,
        getQuoteOfDay,
        getTips,
        ensureProfile,
        formatDate,
        formatShortDate,
        todayKey,
        isOverdue,
        daysUntil,
        getAnalytics,
        getSubjectStats,
        countWords,
        summarizeText,
        generateFlashcards,
        generateQuiz,
        explainSimply,
        callAiTool,
        getWeekFocusSeries,
        getTaskCompletionSeries,
        renderMiniBars,
        createStudyPlanFromTasks,
        downloadText,
        exportData,
        importData,
        resetStudyData,
        resetAllData,
        renderProgressBar
    };
})();
