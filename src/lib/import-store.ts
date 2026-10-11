import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ImportError, ImportPayload } from './import-wire';
export const reviewLimits = {
  name: 200,
  email: 320,
  phone: 100,
  address: 4000,
  city: 200,
  state: 100,
  zip: 32,
  description: 60000,
  jobType: 200,
  price: 16,
  unlockLimit: 1,
} as const;
export function reviewData(
  value: unknown,
): Record<keyof typeof reviewLimits, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ImportError(400, 'Invalid request');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== Object.keys(reviewLimits).length)
    throw new ImportError(400, 'Invalid request');
  const result = {} as Record<keyof typeof reviewLimits, string>;
  for (const [key, max] of Object.entries(reviewLimits)) {
    if (typeof data[key] !== 'string' || (data[key] as string).length > max)
      throw new ImportError(400, 'Invalid request');
    result[key as keyof typeof reviewLimits] = data[key] as string;
  }
  return result;
}
async function admin(db: Prisma.TransactionClient, id: string) {
  if (
    !(await db.user.findFirst({
      where: { id, role: 'ADMIN' },
      select: { id: true },
    }))
  )
    throw new ImportError(404, 'Not found');
}
export async function receiveImport(
  db: PrismaClient,
  p: ImportPayload,
  raw: string,
  hash: string,
  email: string,
) {
  const recipient = await db.user.findFirst({
    where: { email: email.toLowerCase(), role: 'ADMIN' },
    select: { id: true },
  });
  if (!recipient) throw new ImportError(503, 'Integration unavailable');
  try {
    return {
      created: true,
      record: await db.studioImport.create({
        data: {
          source: p.source,
          environment: p.environment,
          sourceRecordId: p.sourceRecordId,
          transferId: p.transferId,
          recipientId: recipient.id,
          originalPayload: raw,
          payloadSha256: hash,
        },
      }),
    };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    )
      throw error;
    const records = await db.studioImport.findMany({
      where: {
        OR: [
          { transferId: p.transferId },
          {
            source: p.source,
            environment: p.environment,
            sourceRecordId: p.sourceRecordId,
          },
        ],
      },
    });
    if (
      records.length !== 1 ||
      records[0].transferId !== p.transferId ||
      records[0].source !== p.source ||
      records[0].environment !== p.environment ||
      records[0].sourceRecordId !== p.sourceRecordId ||
      records[0].payloadSha256 !== hash
    )
      throw new ImportError(409, 'Conflicting receipt');
    return { created: false, record: records[0] };
  }
}
export async function getImport(
  db: Prisma.TransactionClient,
  userId: string,
  id: string,
) {
  await admin(db, userId);
  const record = await db.studioImport.findFirst({
    where: { id, recipientId: userId },
  });
  if (!record) throw new ImportError(404, 'Not found');
  return record;
}
export async function listImports(
  db: PrismaClient,
  userId: string,
  status: string,
  offset: number,
) {
  await admin(db, userId);
  if (
    !['waiting', 'saved', 'published'].includes(status) ||
    !Number.isInteger(offset) ||
    offset < 0
  )
    throw new ImportError(400, 'Invalid list');
  return db.$transaction(
    async (tx) => ({
      waitingCount: await tx.studioImport.count({
        where: { recipientId: userId, status: 'waiting' },
      }),
      total: await tx.studioImport.count({
        where: { recipientId: userId, status },
      }),
      items: await tx.studioImport.findMany({
        where: { recipientId: userId, status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: 25,
      }),
    }),
    { isolationLevel: 'RepeatableRead' },
  );
}
async function lock(db: Prisma.TransactionClient, userId: string, id: string) {
  await admin(db, userId);
  await db.$queryRaw`SELECT "id" FROM "StudioImport" WHERE "id"=${id} AND "recipientId"=${userId} FOR UPDATE`;
  return getImport(db, userId, id);
}
export async function saveImport(
  db: PrismaClient,
  userId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const data = reviewData(input);
  if (!Number.isInteger(version) || version < 0)
    throw new ImportError(400, 'Invalid version');
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return db.$transaction(async (tx) => {
    const r = await lock(tx, userId, id);
    if (r.status === 'published')
      throw new ImportError(409, 'Already published');
    if (r.lastSaveVersion === version && r.lastSaveHash === hash) return r;
    if (r.version !== version)
      throw new ImportError(409, 'Request changed. Reload before saving.');
    return tx.studioImport.update({
      where: { id },
      data: {
        reviewedData: data,
        status: 'saved',
        version: { increment: 1 },
        lastSaveVersion: version,
        lastSaveHash: hash,
      },
    });
  });
}
export async function publishImport(
  db: PrismaClient,
  userId: string,
  id: string,
  version: number,
  data: Prisma.LeadCreateInput,
) {
  return db.$transaction(async (tx) => {
    const r = await lock(tx, userId, id);
    if (r.leadId)
      return {
        created: false,
        lead: await tx.lead.findUniqueOrThrow({
          where: { id: r.leadId },
          include: { photos: true },
        }),
      };
    if (r.status !== 'saved' || r.version !== version)
      throw new ImportError(409, 'Save request and reload before publishing.');
    const lead = await tx.lead.create({ data, include: { photos: true } });
    await tx.studioImport.update({
      where: { id },
      data: { status: 'published', leadId: lead.id, version: { increment: 1 } },
    });
    return { created: true, lead };
  });
}
