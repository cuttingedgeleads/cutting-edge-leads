"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone || Boolean(isIosStandalone);
}

export function InstallAppSection() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installState, setInstallState] = useState<"idle" | "prompting" | "accepted" | "dismissed">(
    "idle",
  );

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

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

  if (isInstalled && installState !== "accepted") return null;
  if (!deferredPrompt && installState === "idle") return null;

  async function handleInstallClick() {
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
  }

  return (
    <section className="bg-white rounded-2xl shadow p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Install Cutting Edge Leads</h2>
        <p className="text-sm text-slate-600">
          Add the app to your home screen for faster access to new leads.
        </p>
        {installState === "accepted" ? (
          <p className="text-sm font-medium text-emerald-700">
            Success! Cutting Edge Leads is ready on your home screen.
          </p>
        ) : null}
      </div>
      {installState !== "accepted" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:translate-y-px sm:w-auto"
        >
          {installState === "prompting" ? "Opening installer..." : "Install App"}
        </button>
      ) : null}
    </section>
  );
}
