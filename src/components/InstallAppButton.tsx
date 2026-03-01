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
      const promptEvent = (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent })
        .__pwaInstallPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
        setCanInstall(true);
      }
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    }

    handleInstallAvailable();

    window.addEventListener("pwa-install-available", handleInstallAvailable);
    window.addEventListener("pwa-install-installed", handleAppInstalled);

    return () => {
      window.removeEventListener("pwa-install-available", handleInstallAvailable);
      window.removeEventListener("pwa-install-installed", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    const promptEvent =
      deferredPrompt ||
      (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt;
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setCanInstall(false);
    setDeferredPrompt(null);
    (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt =
      null;
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
