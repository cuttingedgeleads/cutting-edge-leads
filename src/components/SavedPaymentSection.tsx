"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SavedPaymentSection({ hasPaypalVault }: { hasPaypalVault: boolean }) {
  const [status, setStatus] = useState<"idle" | "removing" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleRemove = async () => {
    setStatus("removing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/contractor/remove-vault", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || "Unable to remove saved PayPal.";
        setErrorMessage(message);
        setStatus("error");
        return;
      }

      setStatus("success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove saved PayPal.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Saved payment</h3>
        <p className="text-sm text-slate-600">
          Manage your saved PayPal details for faster checkout.
        </p>
      </div>
      {hasPaypalVault ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Saved Payment: PayPal (connected)</p>
            <p className="text-sm text-slate-600">Use your saved PayPal for one-tap checkout.</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            disabled={status === "removing"}
          >
            {status === "removing" ? "Removing..." : "Remove"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">No saved PayPal account yet.</p>
        </div>
      )}
      {status === "error" ? (
        <p className="text-sm text-red-600">{errorMessage || "Unable to remove saved PayPal."}</p>
      ) : null}
      {status === "success" ? (
        <p className="text-sm text-green-600">Saved PayPal removed.</p>
      ) : null}
    </section>
  );
}
