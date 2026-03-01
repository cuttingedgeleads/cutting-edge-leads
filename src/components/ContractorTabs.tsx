"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/leads", label: "Available Leads" },
  { href: "/leads/history", label: "Purchased Leads" },
];

function isActiveTab(pathname: string, href: string) {
  if (href === "/leads") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function ContractorTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
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
