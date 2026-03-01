import Link from "next/link";

export function ContractorTabs() {
  const tabs = [
    { href: "/leads", label: "Available Leads" },
    { href: "/leads/history", label: "Purchased Leads" },
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
