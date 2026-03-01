require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSubscriptions() {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      select: {
        id: true,
        userId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`\n📊 Push Subscription Report`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Total Subscriptions: ${subscriptions.length}\n`);

    if (subscriptions.length > 0) {
      console.log('User Details:');
      subscriptions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Subscription ID: ${sub.id}`);
        console.log(`   User ID: ${sub.userId}`);
        console.log(`   User Name: ${sub.user.name}`);
        console.log(`   User Email: ${sub.user.email}`);
        console.log(`   Created: ${sub.createdAt.toISOString()}`);
      });
    } else {
      console.log('No push subscriptions found.');
    }

    console.log(`\n═══════════════════════════════════════\n`);
  } catch (error) {
    console.error('Error querying subscriptions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscriptions();
