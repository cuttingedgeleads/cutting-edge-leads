"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Create Lead" },
  { href: "/admin/active-leads", label: "Active Leads" },
  { href: "/admin/purchased-leads", label: "Purchased Leads" },
  { href: "/admin/expired-leads", label: "Expired Leads" },
  { href: "/admin/contractors", label: "Contractors" },
];

function isActiveTab(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }
  if (href === "/admin/leads") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {tabs.map((tab) => {
        const isActive = isActiveTab(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sky-100 text-sky-900 border-sky-200"
                : "text-slate-600 hover:text-slate-900 hover:border-slate-400"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
