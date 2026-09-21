import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {hash} from 'bcryptjs';
import {requestReset,resetBudget,quotaKey,consumeReset,tokenDigest,changePassword} from '../src/lib/password-reset';
import {issueSession,validateAuth} from '../src/lib/auth-service';
import {authOptions} from '../src/lib/auth';
assert.equal(process.env.DATABASE_URL,'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa');
const clients=[new PrismaClient(),new PrismaClient()];const db=clients[0];const ids:string[]=[];const seeded:string[]=[];
const random=()=>randomBytes(24).toString('hex');
after(async()=>{await db.user.deleteMany({where:{id:{in:ids}}});await db.leadResetAttempt.deleteMany({where:{id:{in:seeded}}});await Promise.all(clients.map(c=>c.$disconnect()));});
test('real PG concurrent email/IP/global limits across independent clients',async()=>{
 const u=await db.user.create({data:{name:'Synthetic',email:random()+'@example.invalid',passwordHash:await hash(random(),10)}});ids.push(u.id);
 let rejected=0;
 await Promise.all(Array.from({length:8},(_,i)=>requestReset(clients[i%2],u.email,random(),async()=>{rejected++;throw new Error('synthetic provider rejection');})));
 assert.equal(rejected,3);assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),0);
 assert.equal(await db.leadResetAttempt.count({where:{key:quotaKey('email',u.email)}}),3);
 await requestReset(db,u.email,random(),async()=>{rejected++;});assert.equal(rejected,3);
 const email=random()+'@example.invalid';const ip=random();
 const emailResults=await Promise.all(Array.from({length:8},(_,i)=>resetBudget(clients[i%2],email,random())));assert.equal(emailResults.filter(Boolean).length,3);
 const ipResults=await Promise.all(Array.from({length:14},(_,i)=>resetBudget(clients[i%2],random()+'@example.invalid',ip)));assert.equal(ipResults.filter(Boolean).length,10);
 const key=quotaKey('global','all');const count=await db.leadResetAttempt.count({where:{key,createdAt:{gt:new Date(Date.now()-3600000)}}});
 const data=Array.from({length:99-count},()=>{const id=random();seeded.push(id);return {id,key};});await db.leadResetAttempt.createMany({data});
 const globalResults=await Promise.all(Array.from({length:6},(_,i)=>resetBudget(clients[i%2],random()+'@example.invalid',random())));assert.equal(globalResults.filter(Boolean).length,1);
 assert.equal(await db.leadResetAttempt.count({where:{key,createdAt:{gt:new Date(Date.now()-3600000)}}}),100);
});
test('invalid/expired reset and byte-bound passwords do not change any security state',async()=>{
 const p=random();const u=await db.user.create({data:{name:'Synthetic',email:random()+'@example.invalid',passwordHash:await hash(p,10)}});ids.push(u.id);
 const session=await issueSession(db,u.email,p,false);assert.ok(session);
 const raw=randomBytes(32).toString('hex');const token=await db.passwordResetToken.create({data:{userId:u.id,token:tokenDigest(raw),expiresAt:new Date(Date.now()-1)}});
 const next=random();assert.equal(await consumeReset(db,raw,next,next),'invalid_token');
 await db.passwordResetToken.update({where:{id:token.id},data:{expiresAt:new Date(Date.now()+3600000)}});
 for(const bad of ['',random().slice(0,3),'é'.repeat(37),random().repeat(3)]) {
  assert.ok(await consumeReset(db,raw,bad,bad));assert.ok(await changePassword(db,session,p,bad,bad));
 }
 assert.ok(await changePassword(db,session,random(),next,next));
 assert.equal(await issueSession(db,u.email,'é'.repeat(37),true),null);
 assert.ok((await db.user.findUniqueOrThrow({where:{id:u.id}})).passwordHash===u.passwordHash);
 assert.ok(await validateAuth(db,session));assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),1);
 await assert.rejects(consumeReset(db,raw,next,next,async()=>{throw new Error('synthetic rollback');}));
 assert.ok((await db.user.findUniqueOrThrow({where:{id:u.id}})).passwordHash===u.passwordHash);assert.ok(await validateAuth(db,session));assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),1);
});
test('legacy callback refresh cannot renew origin deadline or bypass password revocation',async()=>{
 const u=await db.user.create({data:{name:'Synthetic',email:random()+'@example.invalid',passwordHash:await hash(random(),10)}});ids.push(u.id);
 const original=Math.floor(Date.now()/1000)-3600;
 const jwt=authOptions.callbacks!.jwt!;
 const first:any=await jwt({token:{sub:u.id,iat:original}} as any);
 const refreshed:any=await jwt({token:{...first,iat:Math.floor(Date.now()/1000)},trigger:'update',session:{legacyIat:Math.floor(Date.now()/1000),role:'ADMIN',remember:true}} as any);
 assert.equal(refreshed.deadline,original+86400);assert.equal(refreshed.legacyIat,original);assert.equal(refreshed.remember,false);
 await db.user.update({where:{id:u.id},data:{passwordChangedAt:new Date()}});
 await assert.rejects(async()=>jwt({token:refreshed} as any),/AUTH_REVOKED/);
});
