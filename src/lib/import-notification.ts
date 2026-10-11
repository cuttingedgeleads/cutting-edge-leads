import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
export type NotificationResult = 'sent' | 'pending' | 'unavailable';
export async function attemptImportNotification(
  db: PrismaClient,
  id: string,
  send: (recipientId: string, id: string) => Promise<NotificationResult>,
) {
  const now = new Date(),
    lease = randomUUID();
  const claim = await db.studioImport.updateMany({
    where: {
      id,
      deletedAt: null,
      notificationStatus: { not: 'sent' },
      OR: [
        { notificationLeaseUntil: null },
        { notificationLeaseUntil: { lt: now } },
      ],
    },
    data: {
      notificationLease: lease,
      notificationLeaseUntil: new Date(now.getTime() + 60000),
      notificationAttemptedAt: now,
    },
  });
  if (!claim.count) return;
  let status: NotificationResult = 'pending';
  try {
    const r = await db.studioImport.findUniqueOrThrow({
      where: { id },
      include: {
        recipient: {
          select: { id: true, role: true, pushNotifications: true },
        },
      },
    });
    status =
      !r.deletedAt && r.recipient.role === 'ADMIN' && r.recipient.pushNotifications
        ? await send(r.recipientId, id)
        : 'unavailable';
  } catch {
    /* Receipt survives unavailable transport; retry after durable lease. */
  }
  await db.studioImport.updateMany({
    where: { id, deletedAt: null, notificationLease: lease },
    data: {
      notificationStatus: status,
      notificationLease: null,
      notificationLeaseUntil: new Date(Date.now() + 60000),
    },
  });
}
