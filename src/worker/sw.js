import { precacheAndRoute } from "workbox-precaching";

const sw = self;

precacheAndRoute(self.__WB_MANIFEST || []);

const BADGE_CACHE = "app-badge";
const BADGE_URL = "/badge-count";

async function readBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const response = await cache.match(BADGE_URL);
    if (!response) return 0;
    const text = await response.text();
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function writeBadgeCount(count) {
  const cache = await caches.open(BADGE_CACHE);
  await cache.put(BADGE_URL, new Response(String(count)));
}

sw.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  const title = payload.title || "Cutting Edge Leads";
  const body = payload.body || "";
  const url = payload.url || "/";

  event.waitUntil(
    (async () => {
      const previousCount = await readBadgeCount();
      const nextCount = previousCount + 1;
      await writeBadgeCount(nextCount);

      const registrationWithBadge = sw.registration;
      if (registrationWithBadge?.setAppBadge) {
        await registrationWithBadge.setAppBadge(nextCount);
      }

      const clients = await sw.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      clients.forEach((client) =>
        client.postMessage({
          type: "push-notification",
          payload,
          badgeCount: nextCount,
        })
      );

      await sw.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
      });
    })()
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(sw.clients.openWindow(url));
});
