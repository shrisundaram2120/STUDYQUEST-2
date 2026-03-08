const StudyQuest = (() => {
    const storageKeys = {
        profile: "studyquest.profile",
        tasks: "studyquest.tasks",
        notes: "studyquest.notes",
        schedule: "studyquest.schedule",
        dashboardTasks: "studyquest.dashboardTasks"
    };

    const quotes = [
        "Small, steady steps create the biggest academic leaps.",
        "Clarity comes after you begin, not before.",
        "Your future self is built in the next focused hour.",
        "Consistency is stronger than motivation on difficult days.",
        "Learn deeply, rest honestly, return bravely."
    ];

    const tips = [
        "Keep water nearby and take a sip between study blocks.",
        "Use 5 minute breaks to stretch your neck, shoulders, and wrists.",
        "Review your hardest topic first while your energy is highest.",
        "Write one clear goal before each session to reduce distraction.",
        "Sleep is part of studying because memory needs recovery time."
    ];

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

    function newId() {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function getNotes() {
        return read(storageKeys.notes, [
            { id: newId(), name: "Mathematics", content: "" },
            { id: newId(), name: "Science", content: "" },
            { id: newId(), name: "English", content: "" }
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
        });
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

    function ensureProfile() {
        if (!getProfile()) {
            window.location.href = "index.html";
        }
    }

    return {
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
        attachClock,
        attachSidebarToggle,
        greetName,
        getQuoteOfDay,
        getTips,
        ensureProfile,
        formatDate,
        newId
    };
})();
