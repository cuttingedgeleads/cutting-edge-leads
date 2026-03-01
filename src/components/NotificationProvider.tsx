"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";

type NotificationContextValue = {
  count: number;
  permission: NotificationPermission | "unsupported";
  isSupported: boolean;
  isSubscribed: boolean;
  requestPermission: () => Promise<NotificationPermission | "unsupported">;
  ensureSubscription: () => Promise<void>;
};

const BADGE_CACHE = "app-badge";
const BADGE_URL = "/badge-count";

const NotificationContext = createContext<NotificationContextValue>({
  count: 0,
  permission: "default",
  isSupported: false,
  isSubscribed: false,
  requestPermission: async () => "unsupported",
  ensureSubscription: async () => {},
});

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function readBadgeCount() {
  if (typeof window === "undefined") return 0;

  try {
    if ("caches" in window) {
      const cache = await caches.open(BADGE_CACHE);
      const response = await cache.match(BADGE_URL);
      if (response) {
        const text = await response.text();
        const value = Number.parseInt(text, 10);
        if (Number.isFinite(value)) return value;
      }
    }

    const stored = window.localStorage.getItem("badge-count");
    const value = stored ? Number.parseInt(stored, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function persistBadgeCount(count: number) {
  if (typeof window === "undefined") return;

  try {
    if ("caches" in window) {
      const cache = await caches.open(BADGE_CACHE);
      await cache.put(BADGE_URL, new Response(String(count)));
    }
    window.localStorage.setItem("badge-count", String(count));
  } catch {
    // ignore
  }
}

async function syncAppBadge(count: number) {
  if (typeof navigator === "undefined") return;

  const appBadge = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  try {
    if (count === 0) {
      if (appBadge.clearAppBadge) {
        await appBadge.clearAppBadge();
      }
      return;
    }

    if (appBadge.setAppBadge) {
      await appBadge.setAppBadge(count);
    }
  } catch {
    // ignore
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const updateCount = useCallback((next: number) => {
    setCount(next);
    void persistBadgeCount(next);
    void syncAppBadge(next);
  }, []);

  const increment = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;
      void persistBadgeCount(next);
      void syncAppBadge(next);
      return next;
    });
  }, []);

  const clearCount = useCallback(() => {
    setCount((prev) => {
      if (prev === 0) return prev;
      const next = 0;
      void persistBadgeCount(next);
      void syncAppBadge(next);
      return next;
    });
  }, []);

  const ensureServiceWorker = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (!("serviceWorker" in navigator)) return null;

    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;

    try {
      const registered = await navigator.serviceWorker.register("/sw.js");
      console.log("[notifications] service worker registered", registered);
      return registered;
    } catch (error) {
      console.warn("[notifications] failed to register service worker", error);
      return null;
    }
  }, []);

  const ensureSubscription = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!session?.user?.id) return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("[notifications] missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      return;
    }

    const registration = await ensureServiceWorker();
    if (!registration) return;

    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("[notifications] subscribing for push");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      console.warn("[notifications] failed to save subscription", await response.text());
    } else {
      console.log("[notifications] subscription saved");
      setIsSubscribed(true);
    }
  }, [ensureServiceWorker, session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void (async () => {
      const stored = await readBadgeCount();
      if (stored > 0) {
        setCount(stored);
        void syncAppBadge(stored);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    console.log("[notifications] permission status", currentPermission);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (permission !== "granted") return;
    void ensureSubscription();
  }, [ensureSubscription, permission, session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFocus = () => {
      clearCount();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        clearCount();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [clearCount]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return "unsupported";
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported";
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !isStandalone) {
      window.alert("Install the app to enable notifications on iOS.");
      return "default";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      console.log("[notifications] permission result", result);
      if (result === "granted") {
        await ensureSubscription();
      }
      return result;
    } catch (error) {
      console.warn("[notifications] permission request failed", error);
      return Notification.permission;
    }
  }, [ensureSubscription]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event?.data?.type === "push-notification") {
        const badgeCount = event.data?.badgeCount;
        if (typeof badgeCount === "number") {
          updateCount(badgeCount);
        } else {
          increment();
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [increment, updateCount]);

  const value = useMemo(
    () => ({
      count,
      permission,
      isSupported: permission !== "unsupported",
      isSubscribed,
      requestPermission,
      ensureSubscription,
    }),
    [count, ensureSubscription, isSubscribed, permission, requestPermission],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationCount() {
  return useContext(NotificationContext);
}
