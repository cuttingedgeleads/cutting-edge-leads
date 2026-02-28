import Link from "next/link";

export function AdminTabs() {
  const tabs = [
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/archived-leads", label: "Archived Leads" },
    { href: "/admin/requests", label: "Requests" },
    { href: "/admin/contractors", label: "Contractors" },
  ];

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="rounded-full border px-3 py-1 text-slate-600 hover:text-slate-900 hover:border-slate-400"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
