"use client";

import { signOut } from "next-auth/react";

export function NavBar({ name, role }: { name?: string | null; role?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="text-sm text-slate-500">Cutting Edge Leads</p>
          <p className="font-semibold">Welcome, {name || "User"}</p>
          <span className="text-xs text-slate-500">{role}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
