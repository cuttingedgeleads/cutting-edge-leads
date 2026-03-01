const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='Lead' ORDER BY column_name");
  console.log(JSON.stringify(rows, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
