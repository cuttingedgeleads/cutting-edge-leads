import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {hash} from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
import * as service from '../src/lib/auth-service';
import * as reset from '../src/lib/password-reset';
assert.equal(process.env.DATABASE_URL,'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa');
const db = new PrismaClient();
const ids: string[]=[];
const password=()=>randomBytes(24).toString('base64url');
async function account() {
 const p=password(); const u=await db.user.create({data:{email:`${randomBytes(12).toString('hex')}@example.invalid`,name:'Synthetic',passwordHash:await hash(p,10)}});ids.push(u.id);return {u,p};
}
after(async()=>{await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});
test('reset service refuses noncanonical stored mailboxes before invoking any transport',async()=>{
 const u=await db.user.create({data:{name:'Synthetic',email:`${randomBytes(12).toString('hex')}@example.invalid,other@example.invalid`,passwordHash:await hash(password(),10)}});ids.push(u.id);
 let calls=0;await reset.requestReset(db,u.email,randomBytes(12).toString('hex'),async()=>{calls++;});
 assert.equal(calls,0);assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),0);
});
test('durable remembered/session deadlines; current role/deletion; revocation and failed login',async()=>{
 const {u,p}=await account();
 assert.equal(await service.issueSession(db,u.email,password(),true),null);
 const remembered=await service.issueSession(db,u.email,p,true);
 const browser=await service.issueSession(db,u.email,p,false);
 assert.ok(remembered && browser);
 assert.equal(remembered.deadline-remembered.issuedAt,30*86400);
 assert.equal(browser.deadline-browser.issuedAt,86400);
 assert.equal(browser.remember,false);
 assert.ok(!JSON.stringify(remembered).includes(u.passwordHash));
 assert.ok(await service.validateAuth(db,remembered));
 await db.user.update({where:{id:u.id},data:{role:'ADMIN'}});
 assert.equal((await service.validateAuth(db,remembered))?.role,'ADMIN');
 await service.revokeSession(db,remembered);
 assert.equal(await service.validateAuth(db,remembered),null);
 await db.leadAuthSession.update({where:{id:browser.sid},data:{expiresAt:new Date(0)}});
 assert.equal(await service.validateAuth(db,browser),null);
 const newer=await service.issueSession(db,u.email,p,true);assert.ok(newer);
 await db.user.delete({where:{id:u.id}});
 assert.equal(await service.validateAuth(db,newer),null);
});
test('reset delivery stores only digest, failure retains old link, durable budgets count failure and unknown equally',async()=>{
 const {u}=await account();let url='';let calls=0;
 const mail=async(m:{to:string;resetUrl:string})=>{assert.equal(m.to,u.email);url=m.resetUrl;calls++;};
 const ip=randomBytes(12).toString('hex');
 const result=await reset.requestReset(db,u.email.toUpperCase(),ip,mail);
 const raw=new URL(url).searchParams.get('token')!;
 assert.match(raw,/^[a-f0-9]{64}$/);
 const saved=await db.passwordResetToken.findFirst({where:{userId:u.id}});assert.ok(saved);
 assert.ok(saved.token===reset.tokenDigest(raw));assert.ok(saved.token!==raw);
 assert.equal(await reset.requestReset(db,u.email,ip,async()=>{calls++;throw new Error('private');}),result);
 assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),1);
 await reset.requestReset(db,u.email,ip,async()=>{calls++;throw new Error('private');});
 await reset.requestReset(db,u.email,ip,mail);assert.equal(calls,3);
 const unknown=`${randomBytes(12).toString('hex')}@example.invalid`;
 assert.equal(await reset.requestReset(db,unknown,ip,async()=>{throw new Error('must not send');}),result);
 assert.ok(await db.leadResetAttempt.count({where:{key:reset.quotaKey('email',unknown)}}));
});

test('atomic reset single-use for same/different tokens, rollback and sign-in race; profile stale actor',async()=>{
 for(const different of [false,true]) {
 const {u,p}=await account();
 const old=await service.issueSession(db,u.email,p,true);assert.ok(old);
 const a=randomBytes(32).toString('hex'),b=different?randomBytes(32).toString('hex'):a;
 for(const raw of new Set([a,b])) await db.passwordResetToken.create({data:{userId:u.id,token:reset.tokenDigest(raw),expiresAt:new Date(Date.now()+3600000)}});
 const next=password();
 await assert.rejects(reset.consumeReset(db,a,next,next,async()=>{throw new Error('rollback');}));
 assert.ok(await service.validateAuth(db,old));
 assert.ok((await db.user.findUniqueOrThrow({where:{id:u.id}})).passwordHash===u.passwordHash);
 const outcomes=await Promise.all([reset.consumeReset(db,a,next,next),reset.consumeReset(db,b,next,next)]);
 assert.equal(outcomes.filter(x=>x===null).length,1);
 assert.equal(await service.validateAuth(db,old),null);
 assert.equal(await service.issueSession(db,u.email,p,true),null);
 assert.equal(await reset.consumeReset(db,a,next,next),'invalid_token');
 assert.equal(await db.passwordResetToken.count({where:{userId:u.id}}),0);
 const current=await service.issueSession(db,u.email,next,true);assert.ok(current);
 const third=password();
 assert.equal(await reset.changePassword(db,old,next,third,third),'bad_password');
 assert.equal(await reset.changePassword(db,current,next,third,third),null);
 assert.equal(await service.validateAuth(db,current),null);
 }
 const {u,p}=await account();const raw=randomBytes(32).toString('hex');
 await db.passwordResetToken.create({data:{userId:u.id,token:raw,expiresAt:new Date(Date.now()+3600000)}});
 const next=password();const [login,result]=await Promise.all([service.issueSession(db,u.email,p,true),reset.consumeReset(db,raw,next,next)]);
 assert.equal(result,null);if(login) assert.equal(await service.validateAuth(db,login),null);
 assert.equal(await reset.consumeReset(db,'bad',next,next),'invalid_token');
});

test('legacy JWT keeps original deadline and is invalid after password change',async()=>{
 const {u}=await account();const iat=Math.floor(Date.now()/1000)-100;
 const token={sub:u.id,iat};
 const valid=await service.validateAuth(db,token);assert.ok(valid);
 assert.equal(valid.deadline,iat+86400);
 assert.equal(valid.remember,false);
 assert.equal(await service.validateAuth(db,{...token,iat:iat-86400}),null);
 assert.equal(await service.validateAuth(db,{sub:u.id}),null);
 await db.user.update({where:{id:u.id},data:{passwordChangedAt:new Date()}});
 assert.equal(await service.validateAuth(db,token),null);
});
