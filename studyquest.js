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
        settings: "studyquest.settings"
    };

    const defaultSettings = {
        theme: "expedition",
        focusMinutes: 25,
        breakMinutes: 5,
        dailyFocusGoal: 90
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
        const payload = {
            exportedAt: new Date().toISOString(),
            app: "StudyQuest",
            version: 2,
            data: Object.fromEntries(Object.values(storageKeys).map((key) => [key, read(key, null)]))
        };
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
            storageKeys.aiDraft
        ].forEach((key) => localStorage.removeItem(key));
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
        createStudyPlanFromTasks,
        downloadText,
        exportData,
        importData,
        resetStudyData,
        resetAllData,
        renderProgressBar
    };
})();
