import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDate, formatCentralTime } from "@/lib/datetime";
import { NavBar } from "@/components/NavBar";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { UnlockButton } from "@/components/UnlockButton";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

function formatPostedAt(date: Date) {
  const datePart = formatCentralDate(date, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
  const timePart = formatCentralTime(date, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Posted: ${datePart} at ${timePart}`;
}

function formatRelativePostedAt(date: Date) {
  const postedAt = new Date(date).getTime();
  const now = Date.now();
  const diffMs = Math.max(now - postedAt, 0);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `Posted ${diffMinutes} minutes ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Posted ${diffHours} hours ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Posted ${diffDays} days ago`;
}

async function requestUnlock(formData: FormData) {
  "use server";
  const leadId = String(formData.get("leadId") || "");
  const contractorId = String(formData.get("contractorId") || "");
  if (!leadId || !contractorId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { unlocks: { where: { status: "APPROVED" } } },
  });
  if (!lead) return;
  if (isExpired(lead.createdAt)) return;
  if (lead.unlocks.length >= 2) return;

  await prisma.leadUnlockRequest.upsert({
    where: { leadId_contractorId: { leadId, contractorId } },
    update: {},
    create: { leadId, contractorId, status: "PENDING" },
  });

  redirect("/leads");
}

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const leads = await prisma.lead.findMany({
    include: {
      photos: true,
      unlocks: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const contractor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, serviceCities: true, businessName: true },
  });

  const allowedCities = (contractor?.serviceCities || "")
    .split(",")
    .map((city) => city.trim().toLowerCase())
    .filter(Boolean);

  const visibleLeads = leads
    .filter((lead) => {
      // If no service cities configured, show all leads
      const cityMatch =
        allowedCities.length === 0 || allowedCities.includes(lead.city.toLowerCase());
      return !isExpired(lead.createdAt) && cityMatch;
    })
    .sort((a, b) => {
      const aPurchased = a.unlocks.some(
        (unlock) => unlock.contractorId === session.user.id && unlock.status === "APPROVED"
      );
      const bPurchased = b.unlocks.some(
        (unlock) => unlock.contractorId === session.user.id && unlock.status === "APPROVED"
      );
      if (aPurchased !== bPurchased) {
        return aPurchased ? 1 : -1;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  return (
    <div className="min-h-screen">
      <NavBar
        name={contractor?.name ?? session.user.name}
        role={session.user.role}
        businessName={contractor?.businessName}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold">Available leads</h2>
          <p className="text-sm text-slate-600">
            Request unlocks for leads. Admin will approve manually (payment handled offline).
          </p>
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <label className="font-medium">Service area filter (placeholder)</label>
            <select className="rounded-lg border px-2 py-1" disabled>
              <option>Coming soon</option>
            </select>
          </div>
        </header>

        <div className="grid gap-4">
          {visibleLeads.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No leads currently available.
            </div>
          ) : null}
          {visibleLeads.map((lead) => {
            const myRequest = lead.unlocks.find((u) => u.contractorId === session.user.id);
            const approvedCount = lead.unlocks.filter((u) => u.status === "APPROVED").length;
            const isApproved = myRequest?.status === "APPROVED";
            const soldOut = approvedCount >= 2;
            return (
              <div key={lead.id} className="relative bg-white rounded-xl border p-4 space-y-3">
                <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {isApproved ? `Purchased $${lead.price}` : `Price $${lead.price}`}
                </div>
                <div className="space-y-1 pr-32">
                  <p className="font-semibold">{lead.jobType}</p>
                  {isApproved ? <p className="text-sm text-slate-700">{lead.name}</p> : null}
                  {isApproved ? <p className="text-sm text-slate-600">{lead.email}</p> : null}
                  {isApproved ? <p className="text-sm text-slate-600">{lead.phone}</p> : null}
                  <p className="text-sm text-slate-600">
                    {isApproved
                      ? `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`
                      : `${lead.city}, ${lead.state} ${lead.zip}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isApproved ? formatPostedAt(lead.createdAt) : formatRelativePostedAt(lead.createdAt)}
                  </p>
                </div>
                <p className="text-sm text-slate-700">{lead.description}</p>
                <PhotoLightbox photos={lead.photos} />
                <div>
                  {isApproved ? (
                    <span className="text-sm font-semibold text-green-600">
                      Unlocked - full address shown above.
                    </span>
                  ) : soldOut ? (
                    <span className="text-sm font-semibold text-amber-600">Sold out.</span>
                  ) : myRequest?.status === "REJECTED" ? (
                    <span className="text-sm font-semibold text-red-600">
                      Unlock has been denied
                    </span>
                  ) : myRequest?.status === "PENDING" ? (
                    <span className="text-sm font-semibold text-amber-600">
                      Request pending approval.
                    </span>
                  ) : (
                    <UnlockButton
                      leadId={lead.id}
                      contractorId={session.user.id}
                      jobType={lead.jobType}
                      city={lead.city}
                      price={lead.price}
                      onSubmit={requestUnlock}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
