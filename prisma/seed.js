const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("1234", 10);

  const users = [
    {
      name: "Admin",
      email: "admin@cuttingedge.local",
      role: "ADMIN",
    },
    {
      name: "Test Contractor",
      businessName: "ABC Lawn Services",
      email: "contractor@test.com",
      role: "CONTRACTOR",
    },
    {
      name: "Test Contractor 2",
      businessName: "Green Edge Landscaping",
      email: "contractor2@test.com",
      role: "CONTRACTOR",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        businessName: user.businessName || "",
        passwordHash,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
