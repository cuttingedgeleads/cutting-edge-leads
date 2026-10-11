import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

const sw = self;

const authPath = path => /^\/(?:admin\/imports(?:\/|$)|api\/(?:admin\/imports|integrations\/studio\/imports|leads\/create)(?:\/|$)|api\/auth(?:\/|$)|login(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$))/.test(path);
registerRoute(({url}) => authPath(url.pathname), new NetworkOnly());
precacheAndRoute((self.__WB_MANIFEST || []).filter(entry => !authPath(new URL(typeof entry === 'string' ? entry : entry.url, self.location.origin).pathname)));

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
        tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      });
    })()
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let target;
    try { target = new URL(event.notification.data?.url || '/', sw.location.origin); } catch { return; }
    if (target.origin !== sw.location.origin || target.username || target.password) return;
    if (target.pathname.startsWith('/admin/imports') && (!/^\/admin\/imports(?:\/[A-Za-z0-9_-]{1,128})?$/.test(target.pathname) || target.search || target.hash)) return;
    const windows = await sw.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin !== sw.location.origin || !client.navigate) continue;
      const navigated = await client.navigate(target.href);
      if (navigated) { await navigated.focus(); return; }
    }
    await sw.clients.openWindow(target.href);
  })());
});
