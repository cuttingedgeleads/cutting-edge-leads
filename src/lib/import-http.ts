import { ImportError } from './import-wire';
export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
export function importJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: privateHeaders });
}
export function importFailure(error: unknown) {
  return importJson(
    {
      error:
        error instanceof ImportError
          ? error.message
          : 'Import unavailable. Try again.',
    },
    error instanceof ImportError ? error.status : 503,
  );
}
export async function readBoundedBody(request: Request) {
  if (Number(request.headers.get('content-length')) > 262144)
    throw new ImportError(413, 'Body too large');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 262144) {
        await reader.cancel();
        throw new ImportError(413, 'Body too large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function assertImportOrigin(
  request: Request,
  trusted = process.env.AUTH_TRUSTED_ORIGIN || process.env.NEXTAUTH_URL,
) {
  let origin: string;
  try {
    origin = new URL(trusted || '').origin;
  } catch {
    throw new ImportError(403, 'Invalid request origin');
  }
  if (
    request.headers.get('origin') !== origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new ImportError(403, 'Invalid request origin');
}
