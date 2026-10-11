import { prisma } from '@/lib/prisma';
import { importUser } from '@/lib/import-session';
import { getImport, saveImport, deleteImport } from '@/lib/import-store';
import {
  importJson,
  importFailure,
  assertImportOrigin,
  readBoundedBody,
} from '@/lib/import-http';
import { ImportError } from '@/lib/import-wire';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return importJson(
      await getImport(prisma, await importUser(), (await context.params).id),
    );
  } catch (e) {
    return importFailure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertImportOrigin(request);
    const user = await importUser();
    let b;
    try {
      b = JSON.parse((await readBoundedBody(request)).toString('utf8'));
    } catch (e) {
      if (e instanceof ImportError) throw e;
      throw new ImportError(400, 'Invalid JSON');
    }
    if (!b || Object.keys(b).sort().join(',') !== 'data,version')
      throw new ImportError(400, 'Invalid request');
    return importJson(
      await saveImport(
        prisma,
        user,
        (await context.params).id,
        b.version,
        b.data,
      ),
    );
  } catch (e) {
    return importFailure(e);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertImportOrigin(request);
    const user = await importUser();
    let body;
    try {
      body = JSON.parse((await readBoundedBody(request)).toString('utf8'));
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError(400, 'Invalid JSON');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join(',') !== 'version')
      throw new ImportError(400, 'Invalid request');
    return importJson(await deleteImport(prisma, user, (await context.params).id, body.version));
  } catch (error) {
    return importFailure(error);
  }
}
