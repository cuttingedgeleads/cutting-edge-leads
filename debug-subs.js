const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const subs = await prisma.pushSubscription.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true } } }
  });
  
  console.log('=== Push Subscriptions ===');
  console.log('Total:', subs.length);
  subs.forEach(s => {
    console.log('');
    console.log('User:', s.user.name, '(' + s.user.role + ')');
    console.log('Email:', s.user.email);
    console.log('UserId:', s.userId);
    console.log('Endpoint:', s.endpoint.substring(0, 80) + '...');
  });
  
  // Check for duplicate endpoints
  const endpoints = subs.map(s => s.endpoint);
  const uniqueEndpoints = [...new Set(endpoints)];
  if (endpoints.length !== uniqueEndpoints.length) {
    console.log('\n⚠️  WARNING: Duplicate endpoints found!');
  }
  
  await prisma.$disconnect();
})();
