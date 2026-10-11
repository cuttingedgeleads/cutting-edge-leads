import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getImport } from '@/lib/import-store';
import { safeImportReturn } from '@/lib/import-navigation';

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
  redirect(`/admin/leads?importId=${encodeURIComponent(id)}`);
}
