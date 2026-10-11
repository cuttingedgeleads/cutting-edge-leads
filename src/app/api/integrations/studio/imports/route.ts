import { prisma } from '@/lib/prisma';
import { verifyImport, ImportError } from '@/lib/import-wire';
import { readBoundedBody, importJson, importFailure } from '@/lib/import-http';
import { receiveImport } from '@/lib/import-store';
import { attemptImportNotification } from '@/lib/import-notification';
import { sendImportPush } from '@/lib/push';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const email = process.env.STUDIO_IMPORT_RECIPIENT_EMAIL;
    if (!email) throw new ImportError(503, 'Integration unavailable');
    const raw = await readBoundedBody(request);
    const { payload, payloadSha256 } = verifyImport(
      raw,
      request.headers.get('x-studio-timestamp'),
      request.headers.get('x-studio-signature'),
      {
        secret: process.env.STUDIO_IMPORT_SECRET,
        environment: process.env.STUDIO_IMPORT_ENVIRONMENT,
      },
    );
    const result = await receiveImport(
      prisma,
      payload,
      raw.toString('utf8'),
      payloadSha256,
      email,
    );
    await attemptImportNotification(
      prisma,
      result.record.id,
      sendImportPush,
    ).catch(() => {});
    const r = await prisma.studioImport.findUniqueOrThrow({
      where: { id: result.record.id },
    });
    return importJson(
      {
        version: 1,
        importId: r.id,
        transferId: r.transferId,
        sourceRecordId: r.sourceRecordId,
        payloadSha256: r.payloadSha256,
        status: r.status,
        notificationStatus: r.notificationStatus,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return importFailure(error);
  }
}
