import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAppSettings, setTestMode } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
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

const CHURN_DAYS = 21;

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 48);
  return new Date() > expiresAt;
}

function hoursBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 36e5;
}

function formatDaysAgo(date: Date | null) {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatContractorName(name: string, businessName?: string | null) {
  return businessName?.trim() ? businessName : name;
}

function formatResponseDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minutes`;
  }
  return `${hours.toFixed(1)} hrs`;
}

async function updateTestMode(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const currentSettings = await getAppSettings();
  const nextMode = formData.get("testMode") === "on";

  await setTestMode(nextMode);

  if (currentSettings.testMode && !nextMode) {
    await prisma.$transaction([
      prisma.leadUnlockRequest.deleteMany({ where: { lead: { isTestLead: true } } }),
      prisma.leadPhoto.deleteMany({ where: { lead: { isTestLead: true } } }),
      prisma.lead.deleteMany({ where: { isTestLead: true } }),
    ]);
  }

  await logAudit({
    action: "ADMIN_ACTION",
    userId: session.user.id,
    email: session.user.email,
    details: { type: "TEST_MODE_UPDATED", enabled: nextMode },
  });

  redirect("/admin");
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const settings = await getAppSettings();
  const testMode = settings.testMode;

  const now = new Date();
  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 30);
  const last60 = new Date(now);
  last60.setDate(last60.getDate() - 60);

  const [leadsLast30, contractors, approvedUnlocks, unlocks] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: last30 } },
      include: { unlocks: { where: { status: "APPROVED" } } },
    }),
    prisma.user.findMany({ where: { role: "CONTRACTOR" }, include: { unlocks: true } }),
    prisma.leadUnlockRequest.findMany({
      where: { status: "APPROVED" },
      include: { lead: true, contractor: true },
    }),
    prisma.leadUnlockRequest.findMany({
      include: { lead: true, contractor: true },
    }),
  ]);

  const totalLeads = leadsLast30.length;

  const leadStatuses: StatusSummary[] = [
    { label: "New", value: 0, color: "bg-sky-100 text-sky-700" },
    { label: "Claimed", value: 0, color: "bg-indigo-100 text-indigo-700" },
    { label: "Converted", value: 0, color: "bg-emerald-100 text-emerald-700" },
    { label: "Dead", value: 0, color: "bg-rose-100 text-rose-700" },
  ];

  leadsLast30.forEach((lead) => {
    const approvedCount = lead.unlocks.length;
    const unlockLimit = lead.unlockLimit ?? 1;
    if (approvedCount >= unlockLimit) {
      leadStatuses[2].value += 1;
      return;
    }
    if (approvedCount > 0) {
      leadStatuses[1].value += 1;
      return;
    }
    if (isExpired(lead.createdAt)) {
      leadStatuses[3].value += 1;
      return;
    }
    leadStatuses[0].value += 1;
  });

  const conversionRate = totalLeads
    ? (leadStatuses[2]?.value || 0) / totalLeads
    : 0;

  const activeContractorIds = new Set(
    unlocks.filter((unlock) => unlock.createdAt >= last30).map((unlock) => unlock.contractorId),
  );
  const activeContractors = activeContractorIds.size;
  const inactiveContractors = Math.max(0, contractors.length - activeContractors);

  const approvedRecent = approvedUnlocks.filter((unlock) => unlock.createdAt >= last30);
  const responseTimes = approvedRecent.map((unlock) => hoursBetween(unlock.createdAt, unlock.lead.createdAt));
  const medianResponse = median(responseTimes);
  const revenueTotal = approvedRecent.reduce((sum, unlock) => sum + (Number.isFinite(unlock.lead.price) ? unlock.lead.price : 0), 0);
  const revenueFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  const approvalsByContractor = new Map<string, {
    name: string;
    businessName?: string | null;
    conversions: number;
    responseHours: number[];
  }>();

  approvedRecent.forEach((unlock) => {
    const current = approvalsByContractor.get(unlock.contractorId) || {
      name: unlock.contractor.name,
      businessName: unlock.contractor.businessName,
      conversions: 0,
      responseHours: [],
    };
    current.conversions += 1;
    current.responseHours.push(hoursBetween(unlock.createdAt, unlock.lead.createdAt));
    approvalsByContractor.set(unlock.contractorId, current);
  });

  const topPerformers: Performer[] = Array.from(approvalsByContractor.values())
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 3)
    .map((performer) => ({
      name: formatContractorName(performer.name, performer.businessName),
      conversions: performer.conversions,
      responseHours: performer.responseHours.length
        ? Math.round((performer.responseHours.reduce((sum, value) => sum + value, 0) / performer.responseHours.length) * 10) / 10
        : 0,
    }));

  const totalApprovedRecent = approvedRecent.length;
  const averageShare = contractors.length ? totalApprovedRecent / contractors.length : 0;

  const leadDistribution: Distribution[] = contractors
    .map((contractor) => {
      const approvals = approvedRecent.filter((unlock) => unlock.contractorId === contractor.id).length;
      const share = totalApprovedRecent ? Math.round((approvals / totalApprovedRecent) * 100) : 0;
      let balance = "Balanced";
      if (averageShare > 0) {
        if (approvals > averageShare * 1.2) balance = "Slightly high";
        if (approvals < averageShare * 0.8) balance = "Low";
      }
      return {
        contractor: formatContractorName(contractor.name, contractor.businessName),
        leads: approvals,
        share,
        balance,
      };
    })
    .filter((item) => item.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  const geoMap = new Map<string, { leads: number; converted: number; jobCounts: Record<string, number> }>();

  leadsLast30.forEach((lead) => {
    const city = lead.city?.trim();
    const state = lead.state?.trim();
    const zip = lead.zip?.trim();
    const region = city && state ? `${city}, ${state}` : zip ? `Zip ${zip}` : "Unknown";
    const current = geoMap.get(region) || { leads: 0, converted: 0, jobCounts: {} };
    current.leads += 1;
    if (lead.unlocks.length > 0) current.converted += 1;
    current.jobCounts[lead.jobType] = (current.jobCounts[lead.jobType] || 0) + 1;
    geoMap.set(region, current);
  });

  const geoOverview: GeoSummary[] = Array.from(geoMap.entries())
    .map(([region, data]) => {
      const topService = Object.entries(data.jobCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      return {
        region,
        leads: data.leads,
        conversionRate: data.leads ? Math.round((data.converted / data.leads) * 100) : 0,
        topService,
      };
    })
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 4);

  const churnSignals: ChurnSignal[] = contractors
    .map((contractor) => {
      const contractorUnlocks = unlocks.filter((unlock) => unlock.contractorId === contractor.id);
      const lastActivity = contractorUnlocks.length
        ? contractorUnlocks.reduce((latest, unlock) => (unlock.createdAt > latest ? unlock.createdAt : latest), contractorUnlocks[0].createdAt)
        : null;
      const recentCount = contractorUnlocks.filter((unlock) => unlock.createdAt >= last30).length;
      const prevCount = contractorUnlocks.filter(
        (unlock) => unlock.createdAt < last30 && unlock.createdAt >= last60,
      ).length;
      let conversionDelta = "—";
      if (prevCount > 0) {
        const delta = Math.round(((recentCount - prevCount) / prevCount) * 100);
        conversionDelta = `${delta > 0 ? "+" : ""}${delta}%`;
      }
      const daysSince = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000)) : null;
      return {
        contractor: formatContractorName(contractor.name, contractor.businessName),
        lastLogin: formatDaysAgo(lastActivity),
        conversionDelta,
        note: lastActivity
          ? `No unlocks in ${daysSince ?? 0} days`
          : "No unlocks yet",
        daysSince: daysSince ?? 9999,
        recentCount,
      };
    })
    .filter((signal) => signal.recentCount === 0 || signal.daysSince >= CHURN_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 3)
    .map(({ contractor, lastLogin, conversionDelta, note }) => ({
      contractor,
      lastLogin,
      conversionDelta,
      note,
    }));

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Test mode</p>
              <h2 className="text-2xl font-semibold">
                {testMode ? "Test Mode is ON" : "Test Mode is OFF"}
              </h2>
              <p className="text-sm text-slate-600">
                {testMode
                  ? "New leads are flagged as test leads and only test contractors are notified."
                  : "All leads are live. Turning test mode on will route new leads only to test contractors."}
              </p>
            </div>
            <form action={updateTestMode} className="flex items-center gap-3">
              <label className="flex items-center gap-3 text-sm font-medium">
                <span className="text-slate-700">Toggle</span>
                <span className="relative inline-flex h-6 w-11 items-center">
                  <input
                    type="checkbox"
                    name="testMode"
                    defaultChecked={testMode}
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-emerald-500" />
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                </span>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Update
              </button>
            </form>
          </div>
        </section>

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
              value={`${(conversionRate * 100).toFixed(1)}%`}
              helper="Converted / total leads"
            />
            <StatCard
              label="Active contractors"
              value={activeContractors.toLocaleString()}
              helper={`${inactiveContractors} inactive`}
            />
            <StatCard
              label="Avg response time"
              value={formatResponseDuration(medianResponse)}
              helper="Median response"
            />
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
              <StatCard label="MRR" value={revenueFormatter.format(revenueTotal)} helper="Last 30 days" />
              <StatCard label="Total revenue" value={revenueFormatter.format(revenueTotal)} helper="Price × conversions" />
              <StatCard label="Growth" value="—" helper="Billing not configured" />
              <StatCard label="Churn impact" value="—" helper="Billing not configured" />
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
                <p className="mt-2 text-2xl font-semibold">{activeContractors}</p>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Inactive contractors</p>
                <p className="mt-2 text-2xl font-semibold">{inactiveContractors}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Top performers</p>
              <div className="mt-3 space-y-3">
                {topPerformers.length ? (
                  topPerformers.map((performer) => (
                    <div key={performer.name} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{performer.name}</p>
                        <p className="text-xs text-slate-500">Avg response {formatResponseDuration(performer.responseHours)}</p>
                      </div>
                      <p className="font-semibold text-slate-700">{performer.conversions} conversions</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No conversions yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Lead distribution</h3>
            <p className="text-sm text-slate-500">Which contractors are receiving leads.</p>
            <div className="mt-4 space-y-3">
              {leadDistribution.length ? (
                leadDistribution.map((item) => (
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
                ))
              ) : (
                <p className="text-sm text-slate-500">No approved unlocks yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Geographic overview</h3>
            <p className="text-sm text-slate-500">Lead origin by market.</p>
            <div className="mt-4 space-y-3">
              {geoOverview.length ? (
                geoOverview.map((geo) => (
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
                ))
              ) : (
                <p className="text-sm text-slate-500">No leads in the last 30 days.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Churn signals</h3>
            <p className="text-sm text-slate-500">Contractors showing early risk.</p>
            <div className="mt-4 space-y-3">
              {churnSignals.length ? (
                churnSignals.map((signal) => (
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
                ))
              ) : (
                <p className="text-sm text-slate-500">No churn signals detected.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}
