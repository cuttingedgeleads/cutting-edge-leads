"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { PullToRefresh } from "@/components/PullToRefresh";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      window.__pwaInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event("pwa-install-available"));
    }

    function handleAppInstalled() {
      window.__pwaInstallPrompt = null;
      window.dispatchEvent(new Event("pwa-install-installed"));
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <SessionProvider>
      <PullToRefresh>{children}</PullToRefresh>
    </SessionProvider>
  );
}
