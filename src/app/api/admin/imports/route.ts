import { prisma } from '@/lib/prisma';
import { importUser } from '@/lib/import-session';
import { listImports } from '@/lib/import-store';
import { importJson, importFailure } from '@/lib/import-http';
export async function GET(request: Request) {
  try {
    const user = await importUser(),
      url = new URL(request.url);
    return importJson(
      await listImports(
        prisma,
        user,
        url.searchParams.get('status') || 'waiting',
        Number(url.searchParams.get('offset') || 0),
      ),
    );
  } catch (e) {
    return importFailure(e);
  }
}
