import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDateTime } from "@/lib/datetime";
import { AdminHeader } from "@/components/AdminHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";
import { EditLeadButton } from "@/components/EditLeadButton";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 5;

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 48);
  return new Date() > expiresAt;
}

export default async function ActiveLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const pageParam = Number(params?.page ?? "1");
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const activeCountResult = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT l.id
      FROM "Lead" l
      LEFT JOIN "LeadUnlockRequest" u
        ON u."leadId" = l.id AND u.status = 'APPROVED'
      GROUP BY l.id, l."unlockLimit"
      HAVING COUNT(u.id) < COALESCE(l."unlockLimit", 1)
    ) AS filtered
  `);

  const activeCount = Number(activeCountResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const activeLeadRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT l.id, l."createdAt"
    FROM "Lead" l
    LEFT JOIN "LeadUnlockRequest" u
      ON u."leadId" = l.id AND u.status = 'APPROVED'
    GROUP BY l.id, l."createdAt", l."unlockLimit"
    HAVING COUNT(u.id) < COALESCE(l."unlockLimit", 1)
    ORDER BY l."createdAt" DESC
    OFFSET ${skip} LIMIT ${PAGE_SIZE}
  `);

  const leadIds = activeLeadRows.map((row) => row.id);
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        include: {
          photos: true,
          unlocks: { where: { status: "APPROVED" }, include: { contractor: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const pagedLeads = leadIds.map((id) => leadMap.get(id)).filter((l): l is typeof leads[number] => !!l);

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section>
          <h3 className="text-lg font-semibold mb-3">Active Leads</h3>
          <div className="grid gap-4">
            {pagedLeads.map((lead) => {
              const approvedCount = lead.unlocks.length;
              const unlockLimit = lead.unlockLimit ?? 1;
              const expired = isExpired(lead.createdAt);
              const soldOut = approvedCount >= unlockLimit;
              return (
                <div key={lead.id} className="relative bg-white rounded-xl border p-4 space-y-3">
                  <div className="absolute right-4 top-4 text-right">
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      Price ${lead.price}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {approvedCount}/{unlockLimit} unlocked
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="min-w-0 pr-32">
                      <p className="font-semibold break-words">{lead.jobType}</p>
                      <p className="text-sm text-slate-700">{lead.name}</p>
                      <p className="text-sm text-slate-600">{lead.email}</p>
                      <p className="text-sm text-slate-600">{lead.phone}</p>
                      <p className="text-sm text-slate-600">
                        {lead.address}, {lead.city}, {lead.state} {lead.zip}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        Posted {formatCentralDateTime(lead.createdAt)}
                      </p>
                      <div className="mt-2 text-xs text-slate-600 text-left">
                        <p className="font-semibold text-slate-700">Unlocked by:</p>
                        {lead.unlocks.length > 0 ? (
                          <ul className="mt-1 space-y-1 list-disc pl-2">
                            {lead.unlocks.map((unlock) => {
                              const contractorLabel =
                                unlock.contractor.businessName?.trim() || unlock.contractor.name;
                              return <li key={unlock.id}>{contractorLabel}</li>;
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-slate-400">No unlocks yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{lead.description}</p>
                  <PhotoLightbox photos={lead.photos} />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {expired ? (
                      <span className="text-red-600 font-semibold">Hidden (expired after 48h)</span>
                    ) : soldOut ? (
                      <span className="text-amber-600 font-semibold">Sold out ({unlockLimit} unlocks)</span>
                    ) : (
                      <span className="text-green-600 font-semibold">Active</span>
                    )}
                    <EditLeadButton
                      lead={{
                        id: lead.id,
                        name: lead.name,
                        email: lead.email,
                        phone: lead.phone,
                        jobType: lead.jobType,
                        description: lead.description,
                        address: lead.address,
                        city: lead.city,
                        state: lead.state,
                        zip: lead.zip,
                        price: lead.price,
                      }}
                    />
                    <DeleteLeadButton leadId={lead.id} />
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination page={currentPage} totalPages={totalPages} basePath="/admin/active-leads" />
        </section>
      </main>
    </div>
  );
}
