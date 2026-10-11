import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getImport } from '@/lib/import-store';
import { safeImportReturn } from '@/lib/import-navigation';
import { AdminHeader } from '@/components/AdminHeader';
import { ImportRequest } from '@/components/ImportRequest';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const target = safeImportReturn(`/admin/imports/${id}`);
  if (target === '/') notFound();
  const s = await getSession();
  if (!s) redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
  if (s.user.role !== 'ADMIN') notFound();
  try {
    await getImport(prisma, s.user.id, id);
  } catch {
    notFound();
  }
  return (
    <div className="min-h-screen">
      <AdminHeader name={s.user.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ImportRequest id={id} />
      </main>
    </div>
  );
}
