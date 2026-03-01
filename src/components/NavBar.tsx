"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function NavBar({
  name,
  role,
  businessName,
}: {
  name?: string | null;
  role?: string;
  businessName?: string | null;
}) {
  const normalizedName = name?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const initial = normalizedName?.[0]?.toUpperCase() || "P";
  const displayName = normalizedName || "Profile";

  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="text-sm text-slate-500">Cutting Edge Leads</p>
          <p className="font-semibold">Welcome, {displayName || "User"}</p>
          {role && role !== "CONTRACTOR" ? (
            <span className="text-xs text-slate-500">{role}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role === "CONTRACTOR" && (
            <>
              <Link
                href="/leads"
                className="rounded-full border px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Available Leads
              </Link>
              <Link
                href="/leads/history"
                className="rounded-full border px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Purchased Leads
              </Link>
            </>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Sign out
          </button>
          {role === "CONTRACTOR" ? (
            <Link
              href="/profile"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-semibold">
                {initial}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-900">{displayName}</span>
                {businessName ? (
                  <span className="text-[10px] text-slate-500">{businessName}</span>
                ) : null}
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
