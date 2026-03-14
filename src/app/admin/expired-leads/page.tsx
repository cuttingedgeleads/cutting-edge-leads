import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDateTime } from "@/lib/datetime";
import { AdminHeader } from "@/components/AdminHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 5;

export default async function ExpiredLeadsPage({
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

  const expiredCountResult = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "Lead" l
    WHERE l."createdAt" < ${cutoff}
      AND NOT EXISTS (
        SELECT 1
        FROM "LeadUnlockRequest" u
        WHERE u."leadId" = l.id
          AND u.status = 'APPROVED'
      )
  `);

  const expiredCount = Number(expiredCountResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(expiredCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const expiredLeadRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT l.id, l."createdAt"
    FROM "Lead" l
    WHERE l."createdAt" < ${cutoff}
      AND NOT EXISTS (
        SELECT 1
        FROM "LeadUnlockRequest" u
        WHERE u."leadId" = l.id
          AND u.status = 'APPROVED'
      )
    ORDER BY l."createdAt" DESC
    OFFSET ${skip} LIMIT ${PAGE_SIZE}
  `);

  const leadIds = expiredLeadRows.map((row) => row.id);
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
  const pagedLeads = leadIds.map((id) => leadMap.get(id)).filter((l): l is typeof leads[number] => !!l);

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header>
          <h2 className="text-xl font-semibold">Expired leads</h2>
          <p className="text-sm text-slate-600">Leads that expired after 48 hours without a purchase.</p>
        </header>

        <div className="grid gap-4">
          {expiredCount === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No expired leads yet.
            </div>
          ) : null}
          {pagedLeads.map((lead) => {
            const approvedCount = lead.unlocks.length;
            const unlockLimit = lead.unlockLimit ?? 1;
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
                    <p className="text-sm text-slate-600">
                      {lead.address}, {lead.city}
                    </p>
                    <p className="text-xs text-slate-500">Posted {formatCentralDateTime(lead.createdAt)}</p>
                  </div>
                </div>
                <PhotoLightbox photos={lead.photos} />
                <div>
                  <p className="text-sm font-semibold">Purchases</p>
                  <p className="text-sm text-slate-600">No purchases.</p>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination page={currentPage} totalPages={totalPages} basePath="/admin/expired-leads" />
      </main>
    </div>
  );
}
