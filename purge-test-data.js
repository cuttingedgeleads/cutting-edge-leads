require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEEP_EMAILS = [
  'admin@cuttingedge.local',
  'cuttingedgelawnnola@gmail.com'
];

async function purgeTestData() {
  console.log('=== PURGING TEST DATA ===\n');
  
  // Get IDs of users to delete
  const usersToDelete = await prisma.user.findMany({
    where: {
      email: { notIn: KEEP_EMAILS }
    },
    select: { id: true, email: true }
  });
  
  const userIdsToDelete = usersToDelete.map(u => u.id);
  
  console.log('Users to delete:', usersToDelete.map(u => u.email));
  console.log('Users to keep:', KEEP_EMAILS);
  console.log('');

  // 1. Delete all LeadUnlockRequests (references Lead and User)
  const unlocks = await prisma.leadUnlockRequest.deleteMany({});
  console.log(`✓ Deleted ${unlocks.count} unlock requests`);

  // 2. Delete all LeadPhotos (references Lead)
  const photos = await prisma.leadPhoto.deleteMany({});
  console.log(`✓ Deleted ${photos.count} lead photos`);

  // 3. Delete all Leads
  const leads = await prisma.lead.deleteMany({});
  console.log(`✓ Deleted ${leads.count} leads`);

  // 4. Delete PushSubscriptions for users being deleted
  const pushSubs = await prisma.pushSubscription.deleteMany({
    where: { userId: { in: userIdsToDelete } }
  });
  console.log(`✓ Deleted ${pushSubs.count} push subscriptions (for deleted users)`);

  // 5. Delete all remaining PushSubscriptions (for kept users too - they're test subscriptions)
  const remainingPushSubs = await prisma.pushSubscription.deleteMany({});
  console.log(`✓ Deleted ${remainingPushSubs.count} remaining push subscriptions`);

  // 6. Delete PasswordResetTokens for users being deleted
  const resetTokens = await prisma.passwordResetToken.deleteMany({
    where: { userId: { in: userIdsToDelete } }
  });
  console.log(`✓ Deleted ${resetTokens.count} password reset tokens (for deleted users)`);

  // 7. Delete all remaining PasswordResetTokens
  const remainingTokens = await prisma.passwordResetToken.deleteMany({});
  console.log(`✓ Deleted ${remainingTokens.count} remaining password reset tokens`);

  // 8. Delete all AuditLogs
  const auditLogs = await prisma.auditLog.deleteMany({});
  console.log(`✓ Deleted ${auditLogs.count} audit logs`);

  // 9. Delete contractor accounts (not in keep list)
  const users = await prisma.user.deleteMany({
    where: {
      email: { notIn: KEEP_EMAILS }
    }
  });
  console.log(`✓ Deleted ${users.count} user accounts`);

  console.log('\n=== PURGE COMPLETE ===\n');

  // Verify final state
  console.log('=== FINAL DATABASE STATE ===');
  const finalLeads = await prisma.lead.count();
  const finalPhotos = await prisma.leadPhoto.count();
  const finalUnlocks = await prisma.leadUnlockRequest.count();
  const finalLogs = await prisma.auditLog.count();
  const finalPush = await prisma.pushSubscription.count();
  const finalUsers = await prisma.user.findMany({ select: { email: true, role: true, businessName: true }});

  console.log('Leads:', finalLeads);
  console.log('Lead Photos:', finalPhotos);
  console.log('Unlock Requests:', finalUnlocks);
  console.log('Audit Logs:', finalLogs);
  console.log('Push Subscriptions:', finalPush);
  console.log('');
  console.log('Remaining Users:');
  finalUsers.forEach(u => console.log(`  - ${u.role}: ${u.email} (${u.businessName || 'no business name'})`));

  await prisma.$disconnect();
}

purgeTestData().catch(async (e) => {
  console.error('ERROR:', e);
  await prisma.$disconnect();
  process.exit(1);
});
