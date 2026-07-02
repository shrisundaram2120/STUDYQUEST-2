const CACHE_NAME = "studyquest-v8";
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./home.html",
    "./tasks.html",
    "./notes.html",
    "./ttgen.html",
    "./flashcards.html",
    "./exams.html",
    "./progress.html",
    "./skill-tree.html",
    "./passport.html",
    "./source.html",
    "./aiquest.html",
    "./video-quest.html",
    "./ocr.html",
    "./summarizer.html",
    "./chat.html",
    "./settings.html",
    "./studyquest.css",
    "./studyquest.js",
    "./manifest.webmanifest",
    "./studyquest-high-resolution-logo.png",
    "./studyquest-high-resolution-logo-transparent.png",
    "./studyquest-high-resolution-logo-black-transparent.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = requestUrl.origin === self.location.origin;

    if (!isSameOrigin || requestUrl.pathname.startsWith("/api/")) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(event.request).then((response) => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return response;
            }).catch(() => {
                if (event.request.mode === "navigate") {
                    return caches.match("./home.html");
                }
                return caches.match(event.request);
            });
        })
    );
});

self.addEventListener("message", (event) => {
    if (event.data?.type !== "STUDYQUEST_NOTIFY") {
        return;
    }
    self.registration.showNotification(event.data.title || "StudyQuest", {
        body: event.data.body || "You have a study reminder.",
        icon: "./studyquest-high-resolution-logo.png",
        badge: "./studyquest-high-resolution-logo-black-transparent.png"
    });
});
