"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallAppButtonProps = {
  label?: string;
  className?: string;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone || Boolean(isIosStandalone);
}

export function InstallAppButton({ label = "Install App", className = "" }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

    function handleInstallAvailable() {
      const promptEvent =
        (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent })
          .__pwaInstallPrompt ||
        (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
      if (promptEvent) {
        console.log("[PWA] install prompt available", promptEvent);
        setDeferredPrompt(promptEvent);
        setCanInstall(true);
      }
    }

    function handleAppInstalled() {
      console.log("[PWA] app installed");
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    }

    function handleBeforeInstallPrompt(event: Event) {
      console.log("[PWA] beforeinstallprompt captured in button", event);
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt =
        promptEvent;
      (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt =
        promptEvent;
      setDeferredPrompt(promptEvent);
      setCanInstall(true);
    }

    handleInstallAvailable();

    window.addEventListener("pwa-install-available", handleInstallAvailable);
    window.addEventListener("pwa-install-installed", handleAppInstalled);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("pwa-install-available", handleInstallAvailable);
      window.removeEventListener("pwa-install-installed", handleAppInstalled);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    const promptEvent =
      deferredPrompt ||
      (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt ||
      (window as Window & { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (!promptEvent) {
      console.log("[PWA] install click ignored - no deferred prompt");
      return;
    }

    console.log("[PWA] prompting install");
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      console.log("[PWA] user choice", choice);
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
    } catch (error) {
      console.error("[PWA] prompt failed", error);
    }

    setCanInstall(false);
    setDeferredPrompt(null);
    (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt =
      null;
    (window as Window & { deferredPrompt?: BeforeInstallPromptEvent | null }).deferredPrompt = null;
  }

  if (isInstalled || !canInstall) return null;

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className={`inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:translate-y-px ${className}`}
    >
      {label}
    </button>
  );
}
