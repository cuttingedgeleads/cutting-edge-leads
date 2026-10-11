import {test} from 'node:test';import assert from 'node:assert/strict';import {PrismaClient} from '@prisma/client';import {randomUUID} from 'node:crypto';import {attemptImportNotification} from '../src/lib/import-notification';
if(process.env.DATABASE_URL!=='postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa')throw Error('DATABASE_GUARD');
test('notification durable claim: concurrent receipt, transport failure, preference, role, retry throttle and expired lease',async()=>{
 const db=new PrismaClient();let uid:string|undefined,rid:string|undefined;
 try{const u=await db.user.create({data:{email:randomUUID()+'@example.invalid',name:'QA push',passwordHash:'invalid',role:'ADMIN',pushNotifications:true}});uid=u.id;
 const r=await db.studioImport.create({data:{source:'command-studio',environment:'qa',sourceRecordId:randomUUID(),transferId:randomUUID(),recipientId:u.id,originalPayload:'{}',payloadSha256:'0'.repeat(64)}});rid=r.id;
 let sends=0;await Promise.all(Array.from({length:5},()=>attemptImportNotification(db,r.id,async id=>{assert.equal(id,u.id);sends++;await new Promise(r=>setTimeout(r,25));throw Error('Synthetic push failure');})));assert.equal(sends,1);
 let row=await db.studioImport.findUniqueOrThrow({where:{id:r.id}});assert.equal(row.notificationStatus,'pending');assert.ok(row.notificationLeaseUntil!.getTime()>Date.now());
 for(let n=0;n<5;n++)await attemptImportNotification(db,r.id,async()=>{sends++;return 'sent';});assert.equal(sends,1,'replays within 60 seconds must not retry');
 const expire=()=>db.studioImport.update({where:{id:r.id},data:{notificationLeaseUntil:new Date(0)}});
 await expire();await db.user.update({where:{id:u.id},data:{pushNotifications:false}});await attemptImportNotification(db,r.id,async()=>{throw Error('disabled preferences must not call transport');});row=await db.studioImport.findUniqueOrThrow({where:{id:r.id}});assert.equal(row.notificationStatus,'unavailable');
 await expire();await db.user.update({where:{id:u.id},data:{pushNotifications:true,role:'CONTRACTOR'}});await attemptImportNotification(db,r.id,async()=>{sends++;return 'sent';});assert.equal(sends,1);assert.equal((await db.studioImport.findUniqueOrThrow({where:{id:r.id}})).notificationStatus,'unavailable');
 await expire();await db.user.update({where:{id:u.id},data:{role:'ADMIN'}});await attemptImportNotification(db,r.id,async()=>{sends++;return 'sent';});assert.equal(sends,2);assert.equal((await db.studioImport.findUniqueOrThrow({where:{id:r.id}})).notificationStatus,'sent');
 await expire();await attemptImportNotification(db,r.id,async()=>{sends++;return 'sent';});assert.equal(sends,2,'sent receipt never re-notifies');
 }finally{try{if(rid)await db.studioImport.delete({where:{id:rid}});if(uid)await db.user.delete({where:{id:uid}});}finally{await db.$disconnect();}}
});
