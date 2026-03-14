import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDateTime } from "@/lib/datetime";
import { AdminHeader } from "@/components/AdminHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 5;

export default async function ArchivedLeadsPage({
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

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48);

  const archivedCountResult = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT l.id
      FROM "Lead" l
      LEFT JOIN "LeadUnlockRequest" u
        ON u."leadId" = l.id AND u.status = 'APPROVED'
      GROUP BY l.id, l."unlockLimit", l."createdAt"
      HAVING l."createdAt" < ${cutoff}
        OR COUNT(u.id) >= COALESCE(l."unlockLimit", 1)
    ) AS filtered
  `);

  const archivedCount = Number(archivedCountResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(archivedCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const archivedLeadRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT l.id, l."createdAt"
    FROM "Lead" l
    LEFT JOIN "LeadUnlockRequest" u
      ON u."leadId" = l.id AND u.status = 'APPROVED'
    GROUP BY l.id, l."unlockLimit", l."createdAt"
    HAVING l."createdAt" < ${cutoff}
      OR COUNT(u.id) >= COALESCE(l."unlockLimit", 1)
    ORDER BY l."createdAt" DESC
    OFFSET ${skip} LIMIT ${PAGE_SIZE}
  `);

  const leadIds = archivedLeadRows.map((row) => row.id);
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        include: {
          photos: true,
          unlocks: {
            where: { status: "APPROVED" },
            include: { contractor: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const pagedLeads = leadIds.map((id) => leadMap.get(id)).filter(Boolean);

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header>
          <h2 className="text-xl font-semibold">Archived leads</h2>
          <p className="text-sm text-slate-600">
            Sold-out leads (unlock limit reached) and expired/hidden leads for billing reference.
          </p>
        </header>

        <div className="grid gap-4">
          {archivedCount === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No archived leads yet.
            </div>
          ) : null}
          {pagedLeads.map((lead) => (
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

        <Pagination page={currentPage} totalPages={totalPages} basePath="/admin/archived-leads" />
      </main>
    </div>
  );
}
