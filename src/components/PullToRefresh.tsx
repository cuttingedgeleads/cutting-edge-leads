"use client";

import { useEffect, useState } from "react";

type PullToRefreshProps = { children: React.ReactNode };
const PULL_DISTANCE_PX = 80;
const PROTECTED = 'a,button,input,textarea,select,form,[contenteditable],canvas,iframe,[role="dialog"],[data-no-pull-refresh]';

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    let start: { x: number; y: number; id: number } | null = null;
    let distance = 0;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const blocked = () => Boolean(document.querySelector('[role="dialog"],dialog[open],[aria-busy="true"]'));
    const cancel = () => { start = null; distance = 0; if (!busy) setPullDistance(0); };

    function onTouchStart(event: TouchEvent) {
      if (busy) return;
      cancel();
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || window.scrollY > 0 || blocked() || target?.closest(PROTECTED)) return;
      // Nested scroll containers own their gesture, even when the page is at its top.
      for (let node = target; node && node !== document.body; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    }
    function onTouchMove(event: TouchEvent) {
      if (!start || busy) return;
      if (event.touches.length !== 1 || window.scrollY > 0 || blocked()) { cancel(); return; }
      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);
      if (touch.identifier !== start.id || dy < 0 || dx > Math.max(10, dy)) { cancel(); return; }
      distance = Math.min(dy, PULL_DISTANCE_PX * 1.5);
      if (distance > 10 && event.cancelable) event.preventDefault();
      setPullDistance(distance);
    }
    function onTouchEnd(event: TouchEvent) {
      const shouldRefresh = start && distance >= PULL_DISTANCE_PX && event.touches.length === 0 && window.scrollY <= 0 && !blocked();
      cancel();
      if (!shouldRefresh || busy) return;
      busy = true;
      setRefreshing(true);
      setPullDistance(PULL_DISTANCE_PX);
      timer = setTimeout(() => window.location.reload(), 150);
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", cancel);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);

  const visible = refreshing || pullDistance > 10;
  return (
    <>
      <div className="ptr-spinner" role="status" aria-live="polite" style={{ opacity: visible ? 1 : 0, transform: `translateY(${Math.min(pullDistance, PULL_DISTANCE_PX)}px)` }}>
        <span className="ptr-spinner__icon" aria-hidden="true" />
        <span className="sr-only">{refreshing ? "Refreshing…" : pullDistance >= PULL_DISTANCE_PX ? "Release to refresh" : visible ? "Pull to refresh" : ""}</span>
      </div>
      {children}
      <style jsx>{`
        .ptr-spinner { position:fixed; top:-32px; left:0; right:0; display:flex; justify-content:center; z-index:50; pointer-events:none; transition:opacity .2s ease; }
        .ptr-spinner__icon { width:24px; height:24px; border:3px solid rgba(16,185,129,.2); border-top-color:rgba(16,185,129,.95); border-radius:9999px; animation:ptr-spin .8s linear infinite; background:white; box-shadow:0 6px 12px rgba(16,185,129,.2); }
        @keyframes ptr-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { .ptr-spinner { transition:none; } .ptr-spinner__icon { animation:none; } }
      `}</style>
    </>
  );
}
