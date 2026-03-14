import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Pagination } from "@/components/Pagination";

function formatPostedAt(date: Date) {
  const postedAt = new Date(date);
  const datePart = postedAt.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    timeZone: "America/Chicago",
  });
  const timePart = postedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
  return `Posted: ${datePart} at ${timePart}`;
}

const PAGE_SIZE = 5;

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const params = await searchParams;
  const pageParam = Number(params?.page ?? "1");
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const purchasesCount = await prisma.leadUnlockRequest.count({
    where: { contractorId: session.user.id, status: "APPROVED" },
  });

  const totalPages = Math.max(1, Math.ceil(purchasesCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const purchases = await prisma.leadUnlockRequest.findMany({
    where: { contractorId: session.user.id, status: "APPROVED" },
    include: { lead: { include: { photos: true } } },
    orderBy: { approvedAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  const contractor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, businessName: true, serviceCities: true },
  });

  const allowedCities = (contractor?.serviceCities || "")
    .split(",")
    .map((city) => city.trim().toLowerCase())
    .filter(Boolean);

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48);

  const cityClause = allowedCities.length
    ? Prisma.sql`AND LOWER(l."city") IN (${Prisma.join(allowedCities)})`
    : Prisma.empty;

  const availableCountResult = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT l.id
      FROM "Lead" l
      LEFT JOIN "LeadUnlockRequest" u
        ON u."leadId" = l.id AND u.status = 'APPROVED'
      WHERE l."createdAt" >= ${cutoff}
      ${cityClause}
      AND NOT EXISTS (
        SELECT 1
        FROM "LeadUnlockRequest" u2
        WHERE u2."leadId" = l.id
          AND u2.status = 'APPROVED'
          AND u2."contractorId" = ${session.user.id}
      )
      GROUP BY l.id, l."unlockLimit"
      HAVING COUNT(u.id) < COALESCE(l."unlockLimit", 1)
    ) AS filtered
  `);

  const availableLeadCount = Number(availableCountResult[0]?.count ?? 0);

  return (
    <div className="min-h-screen">
      <NavBar
        name={contractor?.name ?? session.user.name}
        role={session.user.role}
        businessName={contractor?.businessName}
        availableLeadCount={availableLeadCount}
      />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold">Purchased Leads</h2>
          <p className="text-sm text-slate-600">All purchased lead unlocks.</p>
        </header>

        <div className="grid gap-4">
          {purchases.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No purchased leads yet.
            </div>
          ) : null}
          {purchases.map((purchase) => (
            <div key={purchase.id} className="relative bg-white rounded-xl border p-4 space-y-3">
              <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {`Purchased $${purchase.lead.price}`}
              </div>
              <div className="space-y-1 pr-32">
                <p className="font-semibold break-words">{purchase.lead.jobType}</p>
                <p className="text-sm text-slate-700">{purchase.lead.name}</p>
                <p className="text-sm text-slate-600">{purchase.lead.email}</p>
                {purchase.lead.phone ? (
                  <p className="text-sm text-slate-600">{purchase.lead.phone}</p>
                ) : null}
                <p className="text-sm text-slate-600">
                  {purchase.lead.address}, {purchase.lead.city}, {purchase.lead.state} {purchase.lead.zip}
                </p>
                <p className="text-sm text-slate-500">{formatPostedAt(purchase.lead.createdAt)}</p>
              </div>
              <p className="text-sm text-slate-700">{purchase.lead.description}</p>
              <PhotoLightbox photos={purchase.lead.photos} />
              <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-600">
                <p className="text-xs uppercase tracking-wide text-slate-500">Date and Time Purchased</p>
                <p className="font-medium text-slate-800">
                  {purchase.approvedAt
                    ? `${purchase.approvedAt.toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "2-digit",
                        timeZone: "America/Chicago",
                      })} at ${purchase.approvedAt.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/Chicago",
                      })}`
                    : "Approved"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Pagination page={currentPage} totalPages={totalPages} basePath="/leads/history" />
      </main>
    </div>
  );
}
