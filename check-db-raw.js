require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // First, check what tables exist
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `;
    
    console.log('\n📋 Database Tables:');
    console.log('═══════════════════════════════════════');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    console.log('═══════════════════════════════════════\n');

    // Check if PushSubscription exists
    const hasPushSubscription = tables.some(t => t.name === 'PushSubscription');
    
    if (hasPushSubscription) {
      const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM PushSubscription`;
      console.log(`Push Subscriptions count: ${count[0].count}\n`);
      
      if (count[0].count > 0) {
        const subs = await prisma.$queryRaw`SELECT id, userId, createdAt FROM PushSubscription`;
        console.log('Subscription details:');
        subs.forEach((sub, i) => {
          console.log(`  ${i + 1}. ID: ${sub.id}, User ID: ${sub.userId}, Created: ${sub.createdAt}`);
        });
        console.log('\n');
      }
    } else {
      console.log('❌ PushSubscription table does not exist in the database.\n');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
