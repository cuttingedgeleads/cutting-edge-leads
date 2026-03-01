import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";
import { LeadForm } from "@/components/LeadForm";

export default async function AdminLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <AdminTabs />
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create Lead</h2>
          <LeadForm />
        </section>
      </main>
    </div>
  );
}
