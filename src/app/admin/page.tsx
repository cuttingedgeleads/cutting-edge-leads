import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminHeader } from "@/components/AdminHeader";

type StatusSummary = {
  label: string;
  value: number;
  color: string;
};

type Performer = {
  name: string;
  conversions: number;
  responseHours: number;
};

type Distribution = {
  contractor: string;
  leads: number;
  share: number;
  balance: string;
};

type GeoSummary = {
  region: string;
  leads: number;
  conversionRate: number;
  topService: string;
};

type ChurnSignal = {
  contractor: string;
  lastLogin: string;
  conversionDelta: string;
  note: string;
};

const leadStatuses: StatusSummary[] = [
  { label: "New", value: 128, color: "bg-sky-100 text-sky-700" },
  { label: "Claimed", value: 214, color: "bg-indigo-100 text-indigo-700" },
  { label: "Converted", value: 103, color: "bg-emerald-100 text-emerald-700" },
  { label: "Dead", value: 37, color: "bg-rose-100 text-rose-700" },
];

const topPerformers: Performer[] = [
  { name: "GreenPro Lawn", conversions: 34, responseHours: 1.8 },
  { name: "Lone Star Turf", conversions: 29, responseHours: 2.1 },
  { name: "Sunrise Mowing", conversions: 24, responseHours: 2.4 },
];

const leadDistribution: Distribution[] = [
  { contractor: "GreenPro Lawn", leads: 56, share: 18, balance: "Balanced" },
  { contractor: "Lone Star Turf", leads: 49, share: 16, balance: "Slightly high" },
  { contractor: "Northside Grounds", leads: 44, share: 14, balance: "Balanced" },
  { contractor: "Sunrise Mowing", leads: 38, share: 12, balance: "Balanced" },
  { contractor: "Oak Valley Lawn", leads: 31, share: 10, balance: "Low" },
];

const geoOverview: GeoSummary[] = [
  { region: "Dallas, TX", leads: 120, conversionRate: 26, topService: "Weekly mowing" },
  { region: "Plano, TX", leads: 94, conversionRate: 22, topService: "Seasonal cleanup" },
  { region: "Frisco, TX", leads: 82, conversionRate: 19, topService: "Fertilization" },
  { region: "Irving, TX", leads: 66, conversionRate: 23, topService: "Weekly mowing" },
];

const churnSignals: ChurnSignal[] = [
  {
    contractor: "Lone Star Turf",
    lastLogin: "24 days ago",
    conversionDelta: "-8%",
    note: "Declining conversion rate",
  },
  {
    contractor: "Prairie Lawn Care",
    lastLogin: "31 days ago",
    conversionDelta: "-5%",
    note: "Low lead response",
  },
  {
    contractor: "Oak Valley Lawn",
    lastLogin: "18 days ago",
    conversionDelta: "-6%",
    note: "Fewer follow-ups",
  },
];

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const totalLeads = leadStatuses.reduce((sum, status) => sum + status.value, 0);
  const conversionRate = ((leadStatuses[2]?.value || 0) / totalLeads) * 100;

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Admin dashboard</h2>
            <p className="text-sm text-slate-600">
              Overview of lead flow, revenue, and contractor performance.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total leads" value={totalLeads.toLocaleString()} helper="Last 30 days" />
            <StatCard
              label="Conversion rate"
              value={`${conversionRate.toFixed(1)}%`}
              helper="Converted / total leads"
            />
            <StatCard label="Active contractors" value="42" helper="+4 this month" />
            <StatCard label="Avg response time" value="2.3 hrs" helper="Median response" />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Lead overview</h3>
            <p className="text-sm text-slate-500">Pipeline status for the last 30 days.</p>
            <div className="mt-4 grid gap-3">
              {leadStatuses.map((status) => (
                <div key={status.label} className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                    <p className="text-sm text-slate-600">{status.label} leads</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{status.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Revenue</h3>
            <p className="text-sm text-slate-500">Recurring revenue from active contractors.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <StatCard label="MRR" value="$18,450" helper="+6.2% MoM" />
              <StatCard label="Total revenue" value="$242,300" helper="YTD" />
              <StatCard label="Growth" value="+12.4%" helper="Quarterly" />
              <StatCard label="Churn impact" value="-$1,120" helper="Last 30 days" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Contractor health</h3>
            <p className="text-sm text-slate-500">Active vs inactive and top performers.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Active contractors</p>
                <p className="mt-2 text-2xl font-semibold">42</p>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Inactive contractors</p>
                <p className="mt-2 text-2xl font-semibold">8</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Top performers</p>
              <div className="mt-3 space-y-3">
                {topPerformers.map((performer) => (
                  <div key={performer.name} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{performer.name}</p>
                      <p className="text-xs text-slate-500">Avg response {performer.responseHours} hrs</p>
                    </div>
                    <p className="font-semibold text-slate-700">{performer.conversions} conversions</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Lead distribution</h3>
            <p className="text-sm text-slate-500">Which contractors are receiving leads.</p>
            <div className="mt-4 space-y-3">
              {leadDistribution.map((item) => (
                <div key={item.contractor} className="rounded-xl border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{item.contractor}</p>
                      <p className="text-xs text-slate-500">{item.share}% share of leads</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{item.leads} leads</p>
                      <p className="text-xs text-slate-500">{item.balance}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Geographic overview</h3>
            <p className="text-sm text-slate-500">Lead origin by market.</p>
            <div className="mt-4 space-y-3">
              {geoOverview.map((geo) => (
                <div key={geo.region} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{geo.region}</p>
                    <p className="text-xs text-slate-500">Top service: {geo.topService}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{geo.leads} leads</p>
                    <p className="text-xs text-slate-500">{geo.conversionRate}% conversion</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Churn signals</h3>
            <p className="text-sm text-slate-500">Contractors showing early risk.</p>
            <div className="mt-4 space-y-3">
              {churnSignals.map((signal) => (
                <div key={signal.contractor} className="rounded-xl border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{signal.contractor}</p>
                      <p className="text-xs text-slate-500">Last login {signal.lastLogin}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-rose-600">{signal.conversionDelta}</p>
                      <p className="text-xs text-slate-500">{signal.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
