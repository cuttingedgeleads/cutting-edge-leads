const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });

  const passwordHash = await bcrypt.hash("1234", 10);
  await prisma.user.updateMany({ data: { passwordHash } });

  return users;
}

main()
  .then((users) => {
    console.log(JSON.stringify(users, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
