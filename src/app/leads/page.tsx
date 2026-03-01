import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ContractorTabs } from "@/components/ContractorTabs";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { UnlockButton } from "@/components/UnlockButton";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

function formatPostedAt(date: Date) {
  const postedAt = new Date(date);
  const datePart = postedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = postedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Posted: ${datePart} at ${timePart}`;
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
    select: { serviceCities: true },
  });

  const allowedCities = (contractor?.serviceCities || "")
    .split(",")
    .map((city) => city.trim().toLowerCase())
    .filter(Boolean);

  const visibleLeads = leads.filter((lead) => {
    // If no service cities configured, show all leads
    const cityMatch = allowedCities.length === 0 || allowedCities.includes(lead.city.toLowerCase());
    return !isExpired(lead.createdAt) && cityMatch;
  });

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <ContractorTabs />
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
              <div key={lead.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{lead.jobType}</p>
                    {isApproved ? <p className="text-sm text-slate-700">{lead.name}</p> : null}
                    {isApproved ? <p className="text-sm text-slate-600">{lead.email}</p> : null}
                    {isApproved ? <p className="text-sm text-slate-600">{lead.phone}</p> : null}
                    <p className="text-sm text-slate-600">
                      {isApproved ? `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}` : lead.city}
                    </p>
                    <p className="text-sm text-slate-500">{formatPostedAt(lead.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {isApproved ? `Purchased for $${lead.price}` : `$${lead.price}`}
                    </p>
                  </div>
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
