const path = require('path');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');

const sqlitePath = path.resolve(__dirname, '../prisma/dev.db');
const sqlite = new Database(sqlitePath, { readonly: true });

const prisma = new PrismaClient();

function getAll(table) {
  return sqlite.prepare(`SELECT * FROM ${table}`).all();
}

async function main() {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('SQLite tables:', tables.map(t => t.name).join(', '));

  const users = tables.find(t => t.name === 'User') ? getAll('User') : [];
  const leads = tables.find(t => t.name === 'Lead') ? getAll('Lead') : [];
  const photos = tables.find(t => t.name === 'LeadPhoto') ? getAll('LeadPhoto') : [];
  const unlocks = tables.find(t => t.name === 'LeadUnlockRequest') ? getAll('LeadUnlockRequest') : [];

  console.log(`Found ${users.length} users, ${leads.length} leads, ${photos.length} lead photos, ${unlocks.length} unlock requests.`);

  if (users.length) {
    await prisma.user.createMany({
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash,
        role: u.role,
        serviceCities: u.serviceCities ?? '',
        notifyNewLeads: !!u.notifyNewLeads,
        notifyUnlockApproved: !!u.notifyUnlockApproved,
        notifyMarketing: !!u.notifyMarketing,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
      })),
      skipDuplicates: true,
    });
  }

  const postgresUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const postgresEmailToId = new Map(postgresUsers.map(u => [u.email, u.id]));
  const sqliteUsersById = new Map(users.map(u => [u.id, u]));

  if (leads.length) {
    await prisma.lead.createMany({
      data: leads.map(l => ({
        id: l.id,
        jobType: l.jobType,
        description: l.description,
        address: l.address,
        city: l.city,
        state: l.state,
        zip: l.zip,
        price: l.price,
        createdAt: l.createdAt ? new Date(l.createdAt) : undefined,
      })),
      skipDuplicates: true,
    });
  }

  if (photos.length) {
    await prisma.leadPhoto.createMany({
      data: photos.map(p => ({
        id: p.id,
        leadId: p.leadId,
        url: p.url,
      })),
      skipDuplicates: true,
    });
  }

  if (unlocks.length) {
    const normalizedUnlocks = unlocks.map(u => {
      const sqliteUser = sqliteUsersById.get(u.contractorId);
      const mappedContractorId = sqliteUser ? (postgresEmailToId.get(sqliteUser.email) || u.contractorId) : u.contractorId;
      return {
        id: u.id,
        leadId: u.leadId,
        contractorId: mappedContractorId,
        status: u.status,
        createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
        approvedAt: u.approvedAt ? new Date(u.approvedAt) : null,
      };
    });

    await prisma.leadUnlockRequest.createMany({
      data: normalizedUnlocks,
      skipDuplicates: true,
    });
  }

  const leadCount = await prisma.lead.count();
  const unlockCount = await prisma.leadUnlockRequest.count();
  const photoCount = await prisma.leadPhoto.count();
  const userCount = await prisma.user.count();

  console.log('Postgres counts:', { userCount, leadCount, photoCount, unlockCount });
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    sqlite.close();
  });
