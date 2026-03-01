import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDateTime } from "@/lib/datetime";
import { AdminHeader } from "@/components/AdminHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";

const MAX_UNLOCKS = 2;

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

export default async function ArchivedLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const leads = await prisma.lead.findMany({
    include: {
      photos: true,
      unlocks: {
        where: { status: "APPROVED" },
        include: { contractor: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const archivedLeads = leads.filter((lead) => {
    const approvedCount = lead.unlocks.length;
    const expired = isExpired(lead.createdAt);
    const soldOut = approvedCount >= MAX_UNLOCKS;
    return expired || soldOut;
  });

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header>
          <h2 className="text-xl font-semibold">Archived leads</h2>
          <p className="text-sm text-slate-600">
            Sold-out leads ({MAX_UNLOCKS} unlocks) and expired/hidden leads for billing reference.
          </p>
        </header>

        <div className="grid gap-4">
          {archivedLeads.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No archived leads yet.
            </div>
          ) : null}
          {archivedLeads.map((lead) => (
            <div key={lead.id} className="relative bg-white rounded-xl border p-4 space-y-3">
              <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                Price ${lead.price}
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0 pr-32">
                  <p className="font-semibold break-words">{lead.jobType}</p>
                  <p className="text-sm text-slate-700">{lead.name}</p>
                  <p className="text-sm text-slate-600">{lead.email}</p>
                  <p className="text-sm text-slate-600">
                    {lead.address}, {lead.city}
                  </p>
                  <p className="text-xs text-slate-500">
                    Posted {formatCentralDateTime(lead.createdAt)}
                  </p>
                </div>
              </div>
              <PhotoLightbox photos={lead.photos} />
              <div>
                <p className="text-sm font-semibold">Purchases</p>
                {lead.unlocks.length === 0 ? (
                  <p className="text-sm text-slate-600">No purchases.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {lead.unlocks.map((unlock) => {
                      const contractorLabel =
                        unlock.contractor.businessName?.trim() || unlock.contractor.name;
                      return (
                        <li key={unlock.id} className="flex flex-wrap justify-between gap-2">
                          <span>
                            {unlock.contractor.name} ({contractorLabel})
                          </span>
                          <span className="text-slate-500">
                            {unlock.approvedAt
                              ? formatCentralDateTime(unlock.approvedAt)
                              : "Approved"} • ${lead.price}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
