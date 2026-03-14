"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { AdminTabs } from "@/components/AdminTabs";

export function AdminHeader({ name: _name }: { name?: string | null }) {
  const displayName = "Admin Dashboard";

  const handleSignOut = async () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) return;
    try {
      await signOut({ callbackUrl: "/login", redirect: true });
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.href = "/login";
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <p className="text-sm text-slate-500">Cutting Edge Leads</p>
            <Link
              href="/admin"
              className="font-semibold text-slate-900 hover:text-slate-700"
            >
              {displayName}
            </Link>
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
