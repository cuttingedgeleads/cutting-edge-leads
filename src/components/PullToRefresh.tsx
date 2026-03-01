"use client";

import { useEffect, useRef, useState } from "react";

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
  const [pullDistance, setPullDistance] = useState(0);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandaloneDisplay()) return;

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 0) return;
      startY.current = event.touches[0]?.clientY ?? null;
      isRefreshing.current = false;
      setPullDistance(0);
      setShowSpinner(false);
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || isRefreshing.current) return;
      const currentY = event.touches[0]?.clientY ?? startY.current;
      const diff = Math.max(0, currentY - startY.current);
      if (window.scrollY > 0) return;

      const clamped = Math.min(diff, PULL_DISTANCE_PX * 1.5);
      setPullDistance(clamped);
      setShowSpinner(clamped > 10);

      if (diff > PULL_DISTANCE_PX) {
        isRefreshing.current = true;
        setShowSpinner(true);
        setPullDistance(PULL_DISTANCE_PX);
        setTimeout(() => {
          window.location.reload();
        }, 150);
      }
    }

    function onTouchEnd() {
      startY.current = null;
      if (!isRefreshing.current) {
        setPullDistance(0);
        setShowSpinner(false);
      }
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

  const spinnerOpacity = showSpinner ? 1 : 0;
  const spinnerOffset = Math.min(pullDistance, PULL_DISTANCE_PX);

  return (
    <>
      <div
        className="ptr-spinner"
        style={{
          opacity: spinnerOpacity,
          transform: `translateY(${spinnerOffset}px)`
        }}
        aria-hidden="true"
      >
        <span className="ptr-spinner__icon" />
      </div>
      {children}
      <style jsx>{`
        .ptr-spinner {
          position: fixed;
          top: -32px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 50;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .ptr-spinner__icon {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(16, 185, 129, 0.2);
          border-top-color: rgba(16, 185, 129, 0.95);
          border-radius: 9999px;
          animation: ptr-spin 0.8s linear infinite;
          background: white;
          box-shadow: 0 6px 12px rgba(16, 185, 129, 0.2);
        }
        @keyframes ptr-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
