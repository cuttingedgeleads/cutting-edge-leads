require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const leads = await prisma.lead.count();
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, name: true, businessName: true, createdAt: true }});
  const unlocks = await prisma.leadUnlockRequest.count();
  const auditLogs = await prisma.auditLog.count();
  const pushSubs = await prisma.pushSubscription.count();
  const photos = await prisma.leadPhoto.count();
  
  console.log('=== DATABASE SUMMARY ===');
  console.log('Leads:', leads);
  console.log('Lead Photos:', photos);
  console.log('Unlock Requests (purchases):', unlocks);
  console.log('Audit Logs:', auditLogs);
  console.log('Push Subscriptions:', pushSubs);
  console.log('');
  console.log('=== USERS ===');
  users.forEach(u => console.log(u.role + ':', u.email, '|', u.businessName || u.name, '| Created:', u.createdAt.toISOString().split('T')[0]));
  await prisma.$disconnect();
}
checkData();
