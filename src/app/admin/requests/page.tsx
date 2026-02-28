import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";

function isExpired(date: Date) {
  const expiresAt = new Date(date);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return new Date() > expiresAt;
}

async function approveRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return;

  const request = await prisma.leadUnlockRequest.findUnique({
    where: { id: requestId },
    include: { lead: { include: { unlocks: { where: { status: "APPROVED" } } } } },
  });
  if (!request) return;

  if (isExpired(request.lead.createdAt)) {
    await prisma.leadUnlockRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
    redirect("/admin/requests");
  }

  if (request.lead.unlocks.length >= 2) {
    await prisma.leadUnlockRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
    redirect("/admin/requests");
  }

  await prisma.leadUnlockRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  redirect("/admin/requests");
}

async function rejectRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) return;
  await prisma.leadUnlockRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });
  redirect("/admin/requests");
}

export default async function RequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const requests = await prisma.leadUnlockRequest.findMany({
    where: { status: "PENDING" },
    include: { lead: true, contractor: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <AdminTabs />
        <header>
          <h2 className="text-xl font-semibold">Purchase requests</h2>
          <p className="text-sm text-slate-600">
            Approve unlocks manually. Payment collection is handled offline.
          </p>
        </header>

        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-sm text-slate-600">
              No pending requests.
            </div>
          ) : null}
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-xl border p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{request.lead.jobType}</p>
                  <p className="text-sm text-slate-700">{request.lead.name}</p>
                  <p className="text-sm text-slate-600">{request.lead.email}</p>
                  <p className="text-sm text-slate-600">
                    {request.lead.address}, {request.lead.city}, {request.lead.state} {request.lead.zip}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${request.lead.price}</p>
                  <p className="text-xs text-slate-500">Requested by {request.contractor.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <form action={approveRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg bg-green-600 text-white px-3 py-1 text-sm">
                    Approve
                  </button>
                </form>
                <form action={rejectRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg bg-slate-200 text-slate-700 px-3 py-1 text-sm">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
