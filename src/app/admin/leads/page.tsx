import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AdminHeader } from '@/components/AdminHeader';
import { LeadForm } from '@/components/LeadForm';
import { ImportRequest } from '@/components/ImportRequest';

export default async function AdminLeadsPage({ searchParams }: {
  searchParams: Promise<{ importId?: string | string[] }>;
}) {
  const { importId } = await searchParams;
  if (importId !== undefined && (typeof importId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(importId))) notFound();
  const session = await getSession();
  if (!session) redirect(importId ? `/login?callbackUrl=${encodeURIComponent(`/admin/imports/${importId}`)}` : '/login');
  if (session.user.role !== 'ADMIN') redirect('/');
  return (
    <div className="min-h-screen">
      <AdminHeader name={session.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create Lead</h2>
          {importId ? <ImportRequest key={importId} id={importId} /> : <LeadForm key="manual" />}
        </section>
      </main>
    </div>
  );
}
