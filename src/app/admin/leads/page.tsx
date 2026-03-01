import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDateTime } from "@/lib/datetime";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LeadForm } from "@/components/LeadForm";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

export default async function AdminLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const leads = await prisma.lead.findMany({
    include: {
      photos: true,
      unlocks: { where: { status: "APPROVED" }, include: { contractor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeLeads = leads.filter((lead) => lead.unlocks.length < 2);

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <AdminTabs />
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create a lead</h2>
          <LeadForm />
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">Leads</h3>
          <div className="grid gap-4">
            {activeLeads.map((lead) => {
              const approvedCount = lead.unlocks.length;
              const expired = isExpired(lead.createdAt);
              const soldOut = approvedCount >= 2;
              return (
                <div key={lead.id} className="relative bg-white rounded-xl border p-4 space-y-3">
                  <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                    Price ${lead.price}
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lead.jobType}</p>
                      <p className="text-sm text-slate-700">{lead.name}</p>
                      <p className="text-sm text-slate-600">{lead.email}</p>
                      <p className="text-sm text-slate-600">{lead.phone}</p>
                      <p className="text-sm text-slate-600">
                        {lead.address}, {lead.city}, {lead.state} {lead.zip}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{approvedCount}/2 unlocks</p>
                      <p className="text-xs text-slate-500">
                        Posted {formatCentralDateTime(lead.createdAt)}
                      </p>
                      {lead.unlocks.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-xs text-slate-500">
                          {lead.unlocks.map((unlock) => (
                            <li key={unlock.id}>
                              {unlock.contractor.name}{" • "}
                              {unlock.approvedAt ? formatCentralDateTime(unlock.approvedAt) : "Approved"}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No purchasers yet.</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{lead.description}</p>
                  <PhotoLightbox photos={lead.photos} />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {expired ? (
                      <span className="text-red-600 font-semibold">Hidden (expired after 24h)</span>
                    ) : soldOut ? (
                      <span className="text-amber-600 font-semibold">Sold out (2 unlocks)</span>
                    ) : (
                      <span className="text-green-600 font-semibold">Active</span>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <DeleteLeadButton leadId={lead.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
