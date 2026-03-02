"use client";

import { signOut } from "next-auth/react";
import { AdminTabs } from "@/components/AdminTabs";

export function AdminHeader({ name }: { name?: string | null }) {
  const normalizedName = name?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const displayName = normalizedName || "Admin";

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: "/login", redirect: true });
    } catch (err) {
      console.error("Sign out error:", err);
      // Fallback: manually redirect
      window.location.href = "/login";
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <p className="text-sm text-slate-500">Cutting Edge Leads</p>
            <p className="font-semibold">{displayName}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-center">
          <AdminTabs />
        </div>
      </div>
    </header>
  );
}
