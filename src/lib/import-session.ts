import { getSession } from './session';
import { prisma } from './prisma';
import { ImportError } from './import-wire';
export async function importUser() {
  const s = await getSession();
  if (
    !s ||
    s.user.role !== 'ADMIN' ||
    !(await prisma.user.findFirst({
      where: { id: s.user.id, role: 'ADMIN' },
      select: { id: true },
    }))
  )
    throw new ImportError(404, 'Not found');
  return s.user.id;
}
