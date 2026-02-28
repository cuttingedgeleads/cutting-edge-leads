const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.update({
  where: { email: 'contractor@test.com' },
  data: { serviceCities: 'Kenner,Metairie,Harahan' }
})
.then(u => console.log('Updated service cities:', u.serviceCities))
.catch(console.error)
.finally(() => prisma.$disconnect());
