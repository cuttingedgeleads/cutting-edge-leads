"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationBadge } from "@/components/NotificationBadge";
import { IosInstallBanner } from "@/components/IosInstallBanner";

const contractorLinks = [
  { href: "/leads", label: "Available Leads" },
  { href: "/leads/history", label: "Purchased Leads" },
];

function isActiveContractorLink(pathname: string, href: string) {
  if (href === "/leads") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function NavBar({
  name,
  role,
  businessName,
}: {
  name?: string | null;
  role?: string;
  businessName?: string | null;
}) {
  const pathname = usePathname();
  const normalizedName = name?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const initial = normalizedName?.[0]?.toUpperCase() || "P";
  const displayName = normalizedName || "Profile";

  const handleSignOut = () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) return;
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Cutting Edge Leads</p>
            <p className="font-semibold">Welcome</p>
            {role && role !== "CONTRACTOR" ? (
              <span className="text-xs text-slate-500">{role}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBadge />
            {role === "CONTRACTOR" ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
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
        <IosInstallBanner />
        <div className="flex flex-wrap items-center gap-3">
          {role === "CONTRACTOR" && (
            <>
              {contractorLinks.map((link) => {
                const isActive = isActiveContractorLink(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-sky-100 text-sky-900 border-sky-200"
                        : "text-slate-700 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
