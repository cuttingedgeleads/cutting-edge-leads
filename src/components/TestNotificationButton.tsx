"use client";

import { useState } from "react";

export function TestNotificationButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");

    try {
      const response = await fetch("/api/notifications/test", { method: "POST" });
      setStatus(response.ok ? "success" : "error");
    } catch (error) {
      setStatus("error");
    }
  }

  const isLoading = status === "loading";
  const feedback =
    status === "success"
      ? "Test notification sent."
      : status === "error"
        ? "Could not send test notification."
        : null;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
          isLoading
            ? "cursor-wait border-slate-200 text-slate-500"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900"
        }`}
      >
        {isLoading ? "Sending..." : "Send test notification"}
      </button>
      {feedback ? <span className="text-[10px] text-slate-500">{feedback}</span> : null}
    </div>
  );
}
