import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { guard } from './import-local-fixture.mjs';
import * as store from '../src/lib/import-store';
import { prefillImport } from '../src/lib/import-wire';
import { attemptImportNotification } from '../src/lib/import-notification';
guard();
const db = new PrismaClient();
after(() => db.$disconnect());
const leadData = {name:'Synthetic delete', email:'', phone:'5550101234', address:'1 Fictional Lane', city:'Synthetic', state:'LA', zip:'70000', description:'Synthetic', jobType:'Lawn Care', price:12, unlockLimit:1, isTestLead:true};
test('delete is owner-scoped, versioned, retry-safe and never deletes a Studio or published lead', async () => {
  assert.equal(typeof store.deleteImport, 'function', 'deleteImport must exist');
  const owner = await db.user.create({data:{email:randomUUID()+'@example.invalid',name:'Synthetic delete owner',passwordHash:'not-a-password',role:'ADMIN'}});
  const other = await db.user.create({data:{email:randomUUID()+'@example.invalid',name:'Synthetic other',passwordHash:'not-a-password',role:'ADMIN'}});
  const contractor = await db.user.create({data:{email:randomUUID()+'@example.invalid',name:'Synthetic contractor',passwordHash:'not-a-password',role:'CONTRACTOR'}});
  const leadIds:string[]=[];
  const intake = async () => {
    const payload = {version:1 as const,source:'command-studio' as const,environment:'qa',transferId:randomUUID(),sourceRecordId:randomUUID(),sourceRevision:'',sourceActor:'',customerName:'Synthetic',customerPhone:'',customerEmail:'',address:'1 Fictional Lane',formattedAddress:'',city:'',state:'',postalCode:'',inquiryNotes:'Private original notes',estimatorNotes:'',salesNotes:'',sourcePhotoCount:0};
    const raw=JSON.stringify(payload),hash=createHash('sha256').update(raw).digest('hex');
    return {payload,raw,hash,record:(await store.receiveImport(db,payload,raw,hash,owner.email)).record};
  };
  try {
    for (const saved of [false,true]) {
      const x=await intake();
      const r=saved?await store.saveImport(db,owner.id,x.record.id,0,prefillImport(x.payload)):x.record;
      await assert.rejects(store.deleteImport(db,other.id,r.id,r.version),{status:404});
      await assert.rejects(store.deleteImport(db,contractor.id,r.id,r.version),{status:404});
      for (const v of [-1,1.5,Number.MAX_SAFE_INTEGER+1]) await assert.rejects(store.deleteImport(db,owner.id,r.id,v),{status:400});
      await assert.rejects(store.deleteImport(db,owner.id,r.id,r.version+1),{status:409});
      assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:r.id}}),r);
      const result=await Promise.all(Array.from({length:4},()=>store.deleteImport(db,owner.id,r.id,r.version)));
      for(const value of result) assert.deepEqual(value,{id:r.id,deleted:true});
      const tombstone=await db.studioImport.findUniqueOrThrow({where:{id:r.id}});
      assert.ok(tombstone.deletedAt);assert.equal(tombstone.version,r.version+1);
      assert.equal(tombstone.originalPayload,x.raw);assert.equal(tombstone.payloadSha256,x.hash);
      assert.deepEqual(tombstone.reviewedData,r.reviewedData);assert.equal(tombstone.leadId,null);
      assert.equal((await store.listImports(db,owner.id,'pending',0)).total,0);
      assert.equal((await store.listImports(db,owner.id,'waiting',0)).waitingCount,0);
      for(const action of [()=>store.getImport(db,owner.id,r.id),()=>store.saveImport(db,owner.id,r.id,r.version,prefillImport(x.payload)),()=>store.publishImport(db,owner.id,r.id,r.version,leadData)]) await assert.rejects(action,{status:404});
      const replay=await store.receiveImport(db,x.payload,x.raw,x.hash,owner.email);
      assert.equal(replay.created,false);assert.equal(replay.record.id,r.id);assert.ok(replay.record.deletedAt);
      let sent=0;await attemptImportNotification(db,r.id,async()=>{sent++;return 'sent';});assert.equal(sent,0);
      // Old app runtimes cannot undo deletion or publish the receipt after rollback.
      await assert.rejects(db.studioImport.update({where:{id:r.id},data:{status:'saved',reviewedData:prefillImport(x.payload)}}));
      await assert.rejects(db.studioImport.update({where:{id:r.id},data:{deletedAt:null}}));
      assert.equal(await db.lead.count({where:{isTestLead:true}}),0);
    }
    const published=await intake();
    const created=await store.publishImport(db,owner.id,published.record.id,0,leadData);leadIds.push(created.lead.id);
    await assert.rejects(store.deleteImport(db,owner.id,published.record.id,1),{status:409});
    assert.ok(await db.lead.findUnique({where:{id:created.lead.id}}));
    await assert.rejects(db.studioImport.update({where:{id:published.record.id},data:{deletedAt:new Date()}}));
    for(let i=0;i<6;i++){
      const x=await intake();
      const [del,pub]=await Promise.allSettled([store.deleteImport(db,owner.id,x.record.id,0),store.publishImport(db,owner.id,x.record.id,0,leadData)]);
      const row=await db.studioImport.findUniqueOrThrow({where:{id:x.record.id}});
      if(pub.status==='fulfilled')leadIds.push(pub.value.lead.id);
      assert.equal([del,pub].filter(r=>r.status==='fulfilled').length,1);
      assert.ok(row.deletedAt?row.leadId===null:row.status==='published'&&row.leadId);
    }
  } finally {
    await db.studioImport.deleteMany({where:{recipientId:owner.id}});
    await db.lead.deleteMany({where:{id:{in:leadIds}}});
    await db.user.deleteMany({where:{id:{in:[owner.id,other.id,contractor.id]}}});
  }
});
