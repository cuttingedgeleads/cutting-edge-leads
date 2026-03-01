"use client";

import { useEffect, useRef } from "react";

type PullToRefreshProps = {
  children: React.ReactNode;
};

const PULL_DISTANCE_PX = 80;

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone || Boolean(isIosStandalone);
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const startY = useRef<number | null>(null);
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandaloneDisplay()) return;

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 0) return;
      startY.current = event.touches[0]?.clientY ?? null;
      isRefreshing.current = false;
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || isRefreshing.current) return;
      const currentY = event.touches[0]?.clientY ?? startY.current;
      const diff = currentY - startY.current;
      if (diff > PULL_DISTANCE_PX && window.scrollY <= 0) {
        isRefreshing.current = true;
        window.location.reload();
      }
    }

    function onTouchEnd() {
      startY.current = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return <>{children}</>;
}
