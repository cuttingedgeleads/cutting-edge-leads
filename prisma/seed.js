const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@cuttingedge.local";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) return;

  const passwordHash = await bcrypt.hash("Admin123!", 10);
  await prisma.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
