"use client";

import { useEffect, useMemo, useState } from "react";

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

const DISMISS_KEY = "ios-install-banner-dismissed";

export function IosInstallBanner() {
  const isIOS = useMemo(detectIOS, []);
  const isStandalone = useMemo(isStandaloneDisplay, []);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (!isIOS || isStandalone || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "true");
    }
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: "Cutting Edge Leads",
        url: window.location.href,
      });
    } else {
      window.alert("Tap the Share button (□↑) then ‘Add to Home Screen’. Notifications only work when installed.");
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Install the app to get iOS notifications</span>
          <span className="text-xs text-amber-800">
            Open the Share menu (□↑) and tap “Add to Home Screen.” Notifications only work when installed.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Open Share Sheet
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-amber-800 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
