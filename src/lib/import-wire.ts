import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export class ImportError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const stringLimits = {
  sourceRecordId: 128,
  sourceRevision: 128,
  sourceActor: 200,
  customerName: 200,
  customerPhone: 100,
  customerEmail: 320,
  address: 4000,
  formattedAddress: 4000,
  city: 200,
  state: 100,
  postalCode: 32,
  inquiryNotes: 60000,
  estimatorNotes: 60000,
  salesNotes: 60000,
} as const;
export type ImportPayload = Record<keyof typeof stringLimits, string> & {
  version: 1;
  source: 'command-studio';
  environment: string;
  transferId: string;
  sourcePhotoCount: number;
};
export function verifyImport(
  raw: Buffer,
  timestamp: string | null,
  signature: string | null,
  config: { secret?: string; environment?: string },
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !config.secret ||
    Buffer.byteLength(config.secret) < 32 ||
    !config.environment
  )
    throw new ImportError(503, 'Integration unavailable');
  if (raw.length > 262144) throw new ImportError(413, 'Body too large');
  if (
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    Math.abs(Number(timestamp) - now) > 300 ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new ImportError(401, 'Invalid signature');
  const expected = createHmac('sha256', config.secret)
    .update(timestamp + '.')
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    throw new ImportError(401, 'Invalid signature');
  // A leading UTF-8 BOM is unsupported: TextDecoder would strip it, while
  // the immutable original and later JSON.parse retain it. Reject, never rewrite.
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)
    throw new ImportError(400, 'Invalid JSON');
  let p: ImportPayload;
  try {
    p = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new ImportError(400, 'Invalid JSON');
  }
  const keys = [
    ...Object.keys(stringLimits),
    'version',
    'source',
    'environment',
    'transferId',
    'sourcePhotoCount',
  ];
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    Object.keys(p).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(p, k)) ||
    p.version !== 1 ||
    p.source !== 'command-studio' ||
    p.environment !== config.environment ||
    typeof p.transferId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      p.transferId,
    ) ||
    !Number.isInteger(p.sourcePhotoCount) ||
    p.sourcePhotoCount < 0 ||
    p.sourcePhotoCount > 10000
  )
    throw new ImportError(400, 'Invalid payload');
  for (const [key, max] of Object.entries(stringLimits))
    if (
      typeof p[key as keyof typeof stringLimits] !== 'string' ||
      p[key as keyof typeof stringLimits].length > max
    )
      throw new ImportError(400, 'Invalid payload');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(p.sourceRecordId))
    throw new ImportError(400, 'Invalid source identity');
  return {
    payload: p,
    payloadSha256: createHash('sha256').update(raw).digest('hex'),
  };
}
export function prefillImport(p: ImportPayload) {
  return {
    name: p.customerName,
    email: p.customerEmail,
    phone: p.customerPhone,
    address: p.formattedAddress || p.address,
    city: p.city,
    state: p.state,
    zip: p.postalCode,
    description: '',
    jobType: '',
    price: '',
    unlockLimit: '',
  };
}
export { safeImportReturn } from './import-navigation';
