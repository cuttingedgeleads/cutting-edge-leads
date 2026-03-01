const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
  if (err) {
    console.error('Error querying tables:', err);
    db.close();
    return;
  }

  console.log('\n📋 Database Tables:');
  console.log('═══════════════════════════════════════');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  console.log('═══════════════════════════════════════\n');

  // Check if PushSubscription table exists
  const hasPushSubscription = tables.some(t => t.name === 'PushSubscription');
  
  if (hasPushSubscription) {
    db.all("SELECT COUNT(*) as count FROM PushSubscription", [], (err, result) => {
      if (err) {
        console.error('Error counting subscriptions:', err);
      } else {
        console.log(`Push Subscriptions count: ${result[0].count}\n`);
        
        if (result[0].count > 0) {
          db.all("SELECT id, userId, createdAt FROM PushSubscription", [], (err, subs) => {
            if (err) {
              console.error('Error fetching subscriptions:', err);
            } else {
              console.log('Subscription details:');
              subs.forEach((sub, i) => {
                console.log(`  ${i + 1}. ID: ${sub.id}, User ID: ${sub.userId}, Created: ${sub.createdAt}`);
              });
            }
            db.close();
          });
        } else {
          db.close();
        }
      }
    });
  } else {
    console.log('❌ PushSubscription table does not exist in the database.\n');
    db.close();
  }
});
