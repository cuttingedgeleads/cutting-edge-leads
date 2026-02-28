import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { ContractorTabs } from "@/components/ContractorTabs";
import { PhotoLightbox } from "@/components/PhotoLightbox";

export default async function PurchaseHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "CONTRACTOR") redirect("/");

  const purchases = await prisma.leadUnlockRequest.findMany({
    where: { contractorId: session.user.id, status: "APPROVED" },
    include: { lead: { include: { photos: true } } },
    orderBy: { approvedAt: "desc" },
  });

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <ContractorTabs />
        <header className="space-y-2">
          <h2 className="text-xl font-semibold">Purchased leads</h2>
          <p className="text-sm text-slate-600">All approved lead unlocks.</p>
        </header>

        <div className="grid gap-4">
          {purchases.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No approved purchases yet.
            </div>
          ) : null}
          {purchases.map((purchase) => (
            <div key={purchase.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold">{purchase.lead.jobType}</p>
                  <p className="text-sm text-slate-700">{purchase.lead.name}</p>
                  <p className="text-sm text-slate-600">{purchase.lead.email}</p>
                  <p className="text-sm text-slate-600">
                    {purchase.lead.address}, {purchase.lead.city}, {purchase.lead.state} {purchase.lead.zip}
                  </p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="font-semibold">${purchase.lead.price}</p>
                  <p className="text-xs text-slate-500">Price paid</p>
                </div>
              </div>

              <p className="text-sm text-slate-700">{purchase.lead.description}</p>

              <PhotoLightbox photos={purchase.lead.photos} />

              <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 border px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date and Time Purchased</p>
                  <p className="font-medium text-slate-800">
                    {purchase.approvedAt?.toLocaleString() || "Approved"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 border px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date and Time Posted</p>
                  <p className="font-medium text-slate-800">
                    {purchase.lead.createdAt.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
