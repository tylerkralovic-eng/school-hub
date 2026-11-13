// Minimal service worker: makes School Hub installable (required for the
// Android share target). No offline caching of family data by design.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
