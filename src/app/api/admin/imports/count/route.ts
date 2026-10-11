import { prisma } from '@/lib/prisma';
import { importUser } from '@/lib/import-session';
import { importJson, importFailure } from '@/lib/import-http';
export async function GET() {
  try {
    const recipientId = await importUser();
    const [waitingCount, pendingCount] = await prisma.$transaction([
      prisma.studioImport.count({ where: { recipientId, status: 'waiting' } }),
      prisma.studioImport.count({ where: { recipientId, status: { in: ['waiting', 'saved'] } } }),
    ], { isolationLevel: 'RepeatableRead' });
    return importJson({ waitingCount, pendingCount });
  } catch (e) {
    return importFailure(e);
  }
}
