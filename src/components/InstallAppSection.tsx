"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallState = "idle" | "prompting" | "accepted" | "dismissed";

type InstallAction =
  | "prompt"
  | "share"
  | "open-safari"
  | "open-chrome"
  | "open-default"
  | "open-app";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone || Boolean(isIosStandalone);
}

function detectIOS() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOS;
}

function detectAndroid() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  return /Android/i.test(ua);
}

function detectInAppBrowser() {
  if (typeof window === "undefined") return false;
  const ua = (navigator.userAgent || navigator.vendor || "").toLowerCase();
  return [
    "telegram",
    "fbav",
    "fban",
    "fb_iab",
    "instagram",
    "line",
    "twitter",
    "tiktok",
    "snapchat",
    "whatsapp",
    "pinterest",
    "linkedin",
    "wechat",
    "micromessenger",
  ].some((marker) => ua.includes(marker));
}

export function InstallAppSection() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installState, setInstallState] = useState<InstallState>("idle");
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const alreadyInstalled = isStandaloneDisplay();
    setIsInstalled(alreadyInstalled);
    if (alreadyInstalled) setInstallState("accepted");

    setIsIOS(detectIOS());
    setIsAndroid(detectAndroid());
    setIsInAppBrowser(detectInAppBrowser());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt =
        promptEvent;
      setDeferredPrompt(promptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setInstallState("accepted");
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const { action, label, helper, subhelper } = useMemo(() => {
    if (isInstalled) {
      return {
        action: "open-app" as InstallAction,
        label: "Open App",
        helper: "Already installed ✓",
        subhelper: "",
      };
    }

    if (isIOS) {
      if (isInAppBrowser) {
        return {
          action: "open-safari" as InstallAction,
          label: "Open in Safari",
          helper: "Install requires Safari.",
          subhelper: "Tap the Share button (□↑) then ‘Add to Home Screen’.",
        };
      }

      return {
        action: "share" as InstallAction,
        label: "Open Share Sheet",
        helper: "Tap the Share button (□↑) then ‘Add to Home Screen’.",
        subhelper: "",
      };
    }

    if (isInAppBrowser) {
      return {
        action: "open-chrome" as InstallAction,
        label: "Open in Chrome",
        helper: "Install isn’t supported in in-app browsers.",
        subhelper: "Open this page in Chrome to install the app.",
      };
    }

    if (deferredPrompt) {
      return {
        action: "prompt" as InstallAction,
        label: "Install App",
        helper: "",
        subhelper: "",
      };
    }

    return {
      action: "open-default" as InstallAction,
      label: "Open in Chrome",
      helper: "Install isn’t supported in this browser.",
      subhelper: "Try Chrome (Android) or Safari (iOS) to add it to your home screen.",
    };
  }, [deferredPrompt, isIOS, isInAppBrowser, isInstalled]);

  async function handleInstallClick() {
    if (action === "prompt") {
      if (!deferredPrompt) return;
      setInstallState("prompting");
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstallState("accepted");
          setIsInstalled(true);
        } else {
          setInstallState("dismissed");
        }
      } catch (error) {
        setInstallState("dismissed");
        console.error("[PWA] prompt failed", error);
      }

      setDeferredPrompt(null);
      (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt =
        null;
      return;
    }

    if (action === "share") {
      if (navigator.share) {
        await navigator.share({
          title: "Cutting Edge Leads",
          url: window.location.href,
        });
      } else {
        window.alert("Tap the Share button (□↑) then ‘Add to Home Screen’.");
      }
      return;
    }

    if (action === "open-chrome") {
      const url = window.location.href;
      if (isAndroid) {
        const safeUrl = url.replace(/^https?:\/\//, "");
        const scheme = url.startsWith("https") ? "https" : "http";
        window.location.href = `intent://${safeUrl}#Intent;scheme=${scheme};package=com.android.chrome;end`;
      } else {
        window.open(url, "_blank");
      }
      return;
    }

    if (action === "open-safari") {
      window.open(window.location.href, "_blank");
      return;
    }

    if (action === "open-app") {
      window.location.assign(window.location.href);
      return;
    }

    window.open(window.location.href, "_blank");
  }

  return (
    <section className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Install Cutting Edge Leads</h2>
        <p className="text-sm text-slate-600">
          Add the app to your home screen for faster access to new leads.
        </p>
        {helper ? <p className="text-sm font-medium text-emerald-700">{helper}</p> : null}
        {subhelper ? <p className="text-sm text-slate-600">{subhelper}</p> : null}
        {installState === "dismissed" ? (
          <p className="text-sm text-slate-500">Installer dismissed. You can try again anytime.</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-base font-semibold shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700 focus-visible:outline-emerald-500 active:translate-y-px ${
          installState === "prompting" ? "opacity-90" : ""
        }`}
      >
        {installState === "prompting" ? "Opening installer..." : label}
      </button>
    </section>
  );
}
