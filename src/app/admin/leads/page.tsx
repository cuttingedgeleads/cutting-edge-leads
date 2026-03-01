import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminHeader } from "@/components/AdminHeader";
import { LeadForm } from "@/components/LeadForm";

export default async function AdminLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create Lead</h2>
          <LeadForm />
        </section>
      </main>
    </div>
  );
}
