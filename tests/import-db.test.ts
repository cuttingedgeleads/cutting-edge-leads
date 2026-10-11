import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { guard } from './import-local-fixture.mjs';
import { verifyImport } from '../src/lib/import-wire';
guard();
import {
  receiveImport,
  listImports,
  getImport,
  saveImport,
  publishImport,
} from '../src/lib/import-store';
import { prefillImport } from '../src/lib/import-wire';
const db = new PrismaClient();
after(() => db.$disconnect());
test('signed BOM/invalid UTF-8 cannot create a receipt or increment the waiting badge', async () => {
  const owner = await db.user.create({
    data: {
      email: randomUUID() + '@example.invalid',
      name: 'BOM QA',
      passwordHash: 'not-a-password',
      role: 'ADMIN',
    },
  });
  const secret = 'synthetic-bom-database-key-only-32';
  const intake = async (raw: Buffer) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret)
      .update(timestamp + '.')
      .update(raw)
      .digest('hex');
    const verified = verifyImport(raw, timestamp, signature, {
      secret,
      environment: 'qa',
    });
    return receiveImport(
      db,
      verified.payload,
      raw.toString('utf8'),
      verified.payloadSha256,
      owner.email,
    );
  };
  try {
    const raw = Buffer.from(
      JSON.stringify(
        {
          ...p(),
          customerName: 'José 🌿',
          inquiryNotes: 'Internal \uFEFF Unicode',
        },
        null,
        2,
      ) + '\n',
    );
    const accepted = await intake(raw);
    assert.equal(accepted.created, true);
    assert.deepEqual(Buffer.from(accepted.record.originalPayload, 'utf8'), raw);
    assert.equal(
      accepted.record.payloadSha256,
      createHash('sha256').update(raw).digest('hex'),
    );
    assert.equal(
      (await listImports(db, owner.id, 'waiting', 0)).waitingCount,
      1,
    );
    const rejected = Buffer.from(JSON.stringify(p()));
    for (const bytes of [
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), rejected]),
      Buffer.concat([rejected, Buffer.from([0xff])]),
    ]) {
      await assert.rejects(intake(bytes), { status: 400 });
      assert.equal(
        await db.studioImport.count({ where: { recipientId: owner.id } }),
        1,
        'no rejected receipt',
      );
      assert.equal(
        (await listImports(db, owner.id, 'waiting', 0)).waitingCount,
        1,
        'no badge increment',
      );
    }
  } finally {
    await db.studioImport.deleteMany({ where: { recipientId: owner.id } });
    await db.user.delete({ where: { id: owner.id } });
  }
});
const p = () => ({
  version: 1 as const,
  source: 'command-studio' as const,
  environment: 'qa',
  transferId: randomUUID(),
  sourceRecordId: randomUUID(),
  sourceRevision: '',
  sourceActor: '',
  customerName: 'Synthetic',
  customerPhone: '',
  customerEmail: '',
  address: '123 Synthetic',
  formattedAddress: '',
  city: '',
  state: '',
  postalCode: '',
  inquiryNotes: 'PRIVATE',
  estimatorNotes: '',
  salesNotes: '',
  sourcePhotoCount: 0,
});
test('unfinished import queue retains waiting and previously saved requests until explicit publication', async () => {
  const owner = await db.user.create({data:{email:randomUUID()+'@example.invalid',name:'Queue QA',passwordHash:'not-a-password',role:'ADMIN'}});
  const leadIds: string[] = [];
  try {
    const intake = async () => {const payload=p(),raw=JSON.stringify(payload);return (await receiveImport(db,payload,raw,createHash('sha256').update(raw).digest('hex'),owner.email)).record;};
    const fresh=await intake(), saved=await intake();
    await saveImport(db,owner.id,saved.id,0,{...prefillImport(p()),name:'Previously reviewed name'});
    const before=await db.studioImport.findMany({where:{recipientId:owner.id},orderBy:{id:'asc'}});
    const queue=await listImports(db,owner.id,'pending',0);
    assert.equal(queue.total,2);
    assert.deepEqual(new Set(queue.items.map(r=>r.id)),new Set([fresh.id,saved.id]));
    assert.deepEqual(await db.studioImport.findMany({where:{recipientId:owner.id},orderBy:{id:'asc'}}),before,'opening the queue must not save or consume imports');
    const leadData={name:'Explicitly reviewed',email:'',phone:'5550101234',address:'123 Synthetic Street',city:'Synthetic',state:'LA',zip:'70000',description:'Human public description',jobType:'Grass Maintenance',price:12,unlockLimit:1,isTestLead:true};
    await assert.rejects(publishImport(db,owner.id,fresh.id,1,leadData),{status:409});
    const published=await Promise.all(Array.from({length:4},()=>publishImport(db,owner.id,fresh.id,0,leadData)));
    leadIds.push(...new Set(published.map(r=>r.lead.id)));
    assert.equal(leadIds.length,1);
    assert.equal(published.filter(r=>r.created).length,1);
    const after=await getImport(db,owner.id,fresh.id);
    assert.equal(after.status,'published');
    assert.equal(after.originalPayload,fresh.originalPayload);
    assert.equal(after.version,1);
    const remaining=await listImports(db,owner.id,'pending',0);
    assert.equal(remaining.total,1);
    assert.equal(remaining.items[0].id,saved.id);
    assert.equal((remaining.items[0].reviewedData as {name:string}).name,'Previously reviewed name');
    assert.equal((await listImports(db,owner.id,'published',0)).total,1,'historical API remains available');
  } finally {
    await db.studioImport.deleteMany({where:{recipientId:owner.id}});
    await db.lead.deleteMany({where:{id:{in:leadIds}}});
    await db.user.delete({where:{id:owner.id}});
  }
});

test('database atomic receipt/scope/save/version/publication and replay', async () => {
  const a = await db.user.create({
    data: {
      email: randomUUID() + '@example.invalid',
      name: 'QA',
      passwordHash: 'not-a-password',
      role: 'ADMIN',
    },
  });
  const b = await db.user.create({
    data: {
      email: randomUUID() + '@example.invalid',
      name: 'QA other',
      passwordHash: 'not-a-password',
      role: 'ADMIN',
    },
  });
  const payload = p(),
    raw = JSON.stringify(payload),
    hash = createHash('sha256').update(raw).digest('hex');
  try {
    const receipts = await Promise.all(
      Array.from({ length: 8 }, () =>
        receiveImport(db, payload, raw, hash, a.email),
      ),
    );
    assert.equal(new Set(receipts.map((x) => x.record.id)).size, 1);
    assert.equal(receipts.filter((x) => x.created).length, 1);
    const id = receipts[0].record.id;
    assert.equal((await listImports(db, a.id, 'waiting', 0)).waitingCount, 1);
    assert.equal((await listImports(db, b.id, 'waiting', 0)).waitingCount, 0);
    await assert.rejects(getImport(db, b.id, id), { status: 404 });
    await assert.rejects(saveImport(db, b.id, id, 0, prefillImport(payload)), {
      status: 404,
    });
    await assert.rejects(
      receiveImport(
        db,
        { ...payload, transferId: randomUUID() },
        raw + ' ',
        hash + 'x',
        a.email,
      ),
      { status: 409 },
    );
    assert.equal((await getImport(db, a.id, id)).status, 'waiting');
    const data = prefillImport(payload);
    const saved = await Promise.all([
      saveImport(db, a.id, id, 0, data),
      saveImport(db, a.id, id, 0, data),
    ]);
    assert.equal(saved[0].version, 1);
    assert.equal(saved[1].version, 1);
    assert.equal((await listImports(db, a.id, 'waiting', 0)).waitingCount, 0);
    assert.equal((await listImports(db, a.id, 'saved', 0)).total, 1);
    await assert.rejects(
      saveImport(db, a.id, id, 0, { ...data, name: 'stale' }),
      { status: 409 },
    );
    const leadData = {
      name: 'Synthetic',
      email: '',
      phone: '5550100',
      address: '123 Synthetic',
      city: 'Synthetic',
      state: 'LA',
      zip: '70000',
      description: 'Public human text',
      jobType: 'Lawn Care',
      price: 10,
      unlockLimit: 1,
      isTestLead: true,
    };
    const published = await Promise.all(
      Array.from({ length: 5 }, () => publishImport(db, a.id, id, 1, leadData)),
    );
    assert.equal(new Set(published.map((x) => x.lead.id)).size, 1);
    assert.equal(published.filter((x) => x.created).length, 1);
    const record = await getImport(db, a.id, id);
    assert.equal(record.originalPayload, raw);
    assert.equal(record.status, 'published');
    assert.equal(
      (await receiveImport(db, payload, raw, hash, a.email)).record.id,
      id,
    );
    assert.equal(
      (await db.lead.findUniqueOrThrow({ where: { id: record.leadId! } }))
        .description,
      'Public human text',
    );
    await db.studioImport.deleteMany({ where: { recipientId: a.id } });
    await db.lead.delete({ where: { id: record.leadId! } });
  } finally {
    await db.studioImport.deleteMany({ where: { recipientId: a.id } });
    await db.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
