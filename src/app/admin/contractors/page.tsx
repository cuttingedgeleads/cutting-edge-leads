import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentralDate } from "@/lib/datetime";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";

async function createContractor(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const businessName = String(formData.get("businessName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const serviceCities = String(formData.get("serviceCities") || "")
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean)
    .join(",");

  if (!name || !businessName || !email || !password) {
    return;
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Email already taken - just redirect back (you could show an error message in a real app)
    redirect("/admin/contractors?error=email_taken");
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      businessName,
      email,
      passwordHash,
      role: "CONTRACTOR",
      serviceCities,
    },
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
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <AdminTabs />
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
                <p className="text-xs text-slate-500">
                  Cities: {contractor.serviceCities || "None"}
                </p>
                <p className="text-xs text-slate-500">
                  Created {formatCentralDate(contractor.createdAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
