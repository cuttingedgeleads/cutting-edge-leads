"use client";

import { useMemo, useState } from "react";
import { useNotificationCount } from "@/components/NotificationProvider";

function detectIOS() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOS;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone || Boolean(isIosStandalone);
}

export function EnableNotificationsButton() {
  const {
    permission,
    isSupported,
    isSubscribed,
    requestPermission,
    ensureSubscription,
  } = useNotificationCount();
  const [isHelping, setIsHelping] = useState(false);
  const isIOS = useMemo(detectIOS, []);
  const isStandalone = useMemo(isStandaloneDisplay, []);

  if (!isSupported) return null;

  const label = isSubscribed
    ? "Notifications enabled"
    : permission === "granted"
      ? "Enable Notifications"
      : "Enable Notifications";

  async function handleClick() {
    if (permission === "granted") {
      await ensureSubscription();
      return;
    }
    await requestPermission();
  }

  const needsInstallHint = isIOS && !isStandalone;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
          isSubscribed
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
        }`}
      >
        {label}
      </button>
      <div className="flex items-center gap-3">
        {needsInstallHint ? (
          <span className="text-[10px] text-amber-600">Install the app to enable iOS alerts.</span>
        ) : null}
        {isIOS ? (
          <button
            type="button"
            onClick={() => setIsHelping(true)}
            className="text-[10px] font-medium text-slate-500 hover:text-slate-700"
          >
            How to enable on iOS
          </button>
        ) : null}
      </div>

      {isHelping ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Enable iOS Notifications</h2>
              <button
                type="button"
                onClick={() => setIsHelping(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                <strong>Install the app</strong> from Safari: tap Share (□↑) and choose “Add to Home
                Screen.”
              </li>
              <li>Open Cutting Edge Leads from your home screen.</li>
              <li>Tap <strong>Enable Notifications</strong> and allow alerts.</li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">Requires iOS 16.4 or newer.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
