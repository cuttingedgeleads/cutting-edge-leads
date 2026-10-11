import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { AdminHeader } from '@/components/AdminHeader';
import { ImportInbox } from '@/components/ImportInbox';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await getSession();
  if (!s) redirect('/login?callbackUrl=%2Fadmin%2Fimports');
  if (
    s.user.role !== 'ADMIN' ||
    !(await prisma.user.findFirst({ where: { id: s.user.id, role: 'ADMIN' } }))
  )
    notFound();
  return (
    <div className="min-h-screen">
      <AdminHeader name={s.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ImportInbox />
      </main>
    </div>
  );
}
