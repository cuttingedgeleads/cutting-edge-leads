import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDate } from "@/lib/datetime";
import { AdminHeader } from "@/components/AdminHeader";
import { sanitizeInput } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

async function createContractor(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const name = sanitizeInput(String(formData.get("name") || ""));
  const businessName = sanitizeInput(String(formData.get("businessName") || ""));
  const email = sanitizeInput(String(formData.get("email") || "")).toLowerCase();
  const password = String(formData.get("password") || "");
  const serviceCities = sanitizeInput(String(formData.get("serviceCities") || ""))
    .split(",")
    .map((city) => sanitizeInput(city))
    .filter(Boolean)
    .join(",");

  if (!name || !businessName || !email || !password) {
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/admin/contractors?error=email_taken");
  }

  const passwordHash = await hash(password, 10);
  const created = await prisma.user.create({
    data: {
      name,
      businessName,
      email,
      passwordHash,
      role: "CONTRACTOR",
      serviceCities,
    },
  });

  await logAudit({
    action: "ADMIN_ACTION",
    userId: session.user.id,
    email: session.user.email,
    details: { type: "CREATE_CONTRACTOR", contractorId: created.id, contractorEmail: created.email },
  });

  redirect("/admin/contractors");
}

async function updateTestAccount(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const contractorId = String(formData.get("contractorId") || "");
  const isTestAccount = formData.get("isTestAccount") === "on";

  if (!contractorId) return;

  await prisma.user.update({
    where: { id: contractorId },
    data: { isTestAccount },
  });

  await logAudit({
    action: "ADMIN_ACTION",
    userId: session.user.id,
    email: session.user.email,
    details: { type: "UPDATE_TEST_CONTRACTOR", contractorId, isTestAccount },
  });

  redirect("/admin/contractors");
}

export default async function ContractorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const contractors = await prisma.user.findMany({
    where: { role: "CONTRACTOR" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create contractor account</h2>
          <form action={createContractor} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input name="name" className="mt-1 w-full rounded-lg border px-3 py-2" required />
            </div>
            <div>
              <label className="text-sm font-medium">Business name</label>
              <input
                name="businessName"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="ABC Lawn Services"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Temp password</label>
              <input
                name="password"
                type="password"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Service cities (comma-separated)</label>
              <input
                name="serviceCities"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Dallas, Plano, Frisco"
              />
              <p className="text-xs text-slate-500 mt-1">
                Contractors only see leads in these cities.
              </p>
            </div>
            <div className="flex items-end sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium"
              >
                Create contractor
              </button>
            </div>
          </form>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">Contractors</h3>
          <div className="grid gap-3">
            {contractors.map((contractor) => (
              <div key={contractor.id} className="bg-white rounded-xl border p-4">
                <p className="font-medium">{contractor.name}</p>
                <p className="text-sm text-slate-600">{contractor.businessName || "Business name pending"}</p>
                <p className="text-sm text-slate-600">{contractor.email}</p>
                <p className="text-sm text-slate-600">{contractor.phone || "Phone pending"}</p>
                <p className="text-xs text-slate-500">
                  Cities: {contractor.serviceCities || "None"}
                </p>
                <p className="text-xs text-slate-500">
                  Created {formatCentralDate(contractor.createdAt, {
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </p>
                <form action={updateTestAccount} className="mt-3 flex items-center gap-3">
                  <input type="hidden" name="contractorId" value={contractor.id} />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      name="isTestAccount"
                      defaultChecked={contractor.isTestAccount}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Test Account
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Save
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
