import { createHash, createHmac, randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import type { PrismaClient, Prisma } from '@prisma/client';
import { authOrigin, passwordError, validResetToken } from './auth-policy';
import { sendPasswordResetEmail } from './email';
import { validResetRecipient } from './reset-mail-transport';
import { lockUser, validateAuth, type AuthClaims } from './auth-service';
async function replacePassword(tx: Prisma.TransactionClient, userId: string, passwordHash: string) {
  await tx.user.update({where:{id:userId},data:{passwordHash,passwordChangedAt:new Date(),failedLoginAttempts:0,lockedUntil:null}});
  await tx.leadAuthSession.deleteMany({where:{userId}});
  await tx.passwordResetToken.deleteMany({where:{userId}});
}
export async function consumeReset(db: PrismaClient, token: string, password: string, confirmation: string, afterWrite?: () => Promise<void>) {
  if (!validResetToken(token)) return 'invalid_token';
  const error=passwordError(password,confirmation);if(error) return error;
  const record=await db.passwordResetToken.findFirst({where:{token:{in:[tokenDigest(token),token]}}});
  if (!record) return 'invalid_token';
  const passwordHash=await hash(password,12);
  return db.$transaction(async tx=>{
    if (!await lockUser(tx,record.userId)) return 'invalid_token';
    const current=await tx.passwordResetToken.findUnique({where:{id:record.id}});
    const now=Date.now();
    if (!current || current.expiresAt.getTime()<=now || current.createdAt.getTime()+3600000<=now) return 'invalid_token';
    await replacePassword(tx,current.userId,passwordHash);
    await afterWrite?.();
    return null;
  });
}
export async function changePassword(db: PrismaClient, actor: AuthClaims, currentPassword: string, password: string, confirmation: string) {
  const error=passwordError(password,confirmation);if(error) return error;
  if (!actor.sub || Buffer.byteLength(currentPassword,'utf8')>72) return 'bad_password';
  const passwordHash=await hash(password,12);
  return db.$transaction(async tx=>{
    const user=await lockUser(tx,actor.sub!);
    const active=await validateAuth(tx,actor);
    if (!user || !active || active.role!=='CONTRACTOR' || !await compare(currentPassword,user.passwordHash)) return 'bad_password';
    await replacePassword(tx,user.id,passwordHash);
    return null;
  });
}
export const RESET_RESPONSE = 'If the account is eligible and delivery is available, a reset link will arrive. Check spam or try again later.';
export const tokenDigest = (token: string) => 'sha256:' + createHash('sha256').update(token).digest('hex');
export function quotaKey(kind: string, value: string) {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('AUTH_SECRET_REQUIRED');
  return createHmac('sha256',process.env.NEXTAUTH_SECRET).update(`leads-reset:${kind}:${value.trim().toLowerCase()}`).digest('hex');
}
export async function resetBudget(db: PrismaClient, email: string, ip: string) {
  const budgets = [{key:quotaKey('email',email),limit:3},{key:quotaKey('ip',ip),limit:10},{key:quotaKey('global','all'),limit:100}].sort((a,b)=>a.key.localeCompare(b.key));
  return db.$transaction(async tx=>{
    // Same canonical lock order in every process; global lock bounds storage even for unknown accounts.
    for (const b of budgets) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${b.key}, 0))::text`;
    const since=new Date(Date.now()-3600000);
    for (const b of budgets) if(await tx.leadResetAttempt.count({where:{key:b.key,createdAt:{gt:since}}})>=b.limit) return false;
    await tx.leadResetAttempt.createMany({data:budgets.map(b=>({key:b.key}))});
    await tx.leadResetAttempt.deleteMany({where:{createdAt:{lt:new Date(Date.now()-86400000)}}});
    return true;
  });
}
export async function requestReset(db: PrismaClient, input: string, ip: string, send: typeof sendPasswordResetEmail = sendPasswordResetEmail) {
  const email=input.trim().toLowerCase();
  try {
    if (!validResetRecipient(email)) return RESET_RESPONSE;
    if (!await resetBudget(db,email,ip.slice(0,128))) return RESET_RESPONSE;
    const origin=authOrigin();
    const user=await db.user.findUnique({where:{email}});
    if (!user) return RESET_RESPONSE;
    const token=randomBytes(32).toString('hex');
    const stored=await db.$transaction(async tx=>{
      const current=await lockUser(tx,user.id);
      if (!current || !validResetRecipient(current.email)) return null;
      const record=await tx.passwordResetToken.create({data:{userId:current.id,token:tokenDigest(token),expiresAt:new Date(Date.now()+3600000)}});
      return {record,email:current.email,name:current.name};
    });
    if (!stored) return RESET_RESPONSE;
    try {
      await send({to:stored.email,name:stored.name,resetUrl:`${origin}/reset-password?token=${token}`});
    } catch {
      await db.passwordResetToken.deleteMany({where:{id:stored.record.id}});
    }
  } catch {
    // Same user-visible outcome for unknown accounts, quota, configuration and provider failure.
  }
  return RESET_RESPONSE;
}
