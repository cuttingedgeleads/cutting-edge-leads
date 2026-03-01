"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function NavBar({ name, role }: { name?: string | null; role?: string }) {
  const initial = name?.trim()?.[0]?.toUpperCase() || "P";

  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="text-sm text-slate-500">Cutting Edge Leads</p>
          <p className="font-semibold">Welcome, {name || "User"}</p>
          <span className="text-xs text-slate-500">{role}</span>
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
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold">
                  {initial}
                </span>
                <span>Profile</span>
              </Link>
            </>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
