import { randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import type { PrismaClient, Prisma } from '@prisma/client';
import { REMEMBER_SECONDS, SESSION_SECONDS } from './auth-policy';
type DB = PrismaClient;
export type AuthClaims = {sub?: string; sid?: string; iat?: number; legacyIat?: number; deadline?: number; issuedAt?: number; remember?: boolean};
export async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
  return tx.user.findUnique({where:{id}});
}
export async function issueSession(db: DB, email: string, password: string, remember: boolean) {
  if (!email || !password || Buffer.byteLength(password,'utf8') > 72) return null;
  const found = await db.user.findUnique({where:{email:email.trim().toLowerCase()}});
  if (!found) return null;
  return db.$transaction(async tx => {
    const user = await lockUser(tx,found.id);
    if (!user || (user.lockedUntil && user.lockedUntil > new Date())) return null;
    if (!await compare(password,user.passwordHash)) {
      const failedLoginAttempts = Math.min(user.failedLoginAttempts+1,5);
      await tx.user.update({where:{id:user.id},data:{failedLoginAttempts,lockedUntil:failedLoginAttempts>=5?new Date(Date.now()+600000):null}});
      return null;
    }
    await tx.user.update({where:{id:user.id},data:{failedLoginAttempts:0,lockedUntil:null}});
    const issuedAt = Math.floor(Date.now()/1000);
    const deadline = issuedAt + (remember ? REMEMBER_SECONDS : SESSION_SECONDS);
    const sid = randomBytes(32).toString('hex');
    await tx.leadAuthSession.create({data:{id:sid,userId:user.id,remember,createdAt:new Date(issuedAt*1000),expiresAt:new Date(deadline*1000)}});
    return {id:user.id,sub:user.id,sid,issuedAt,deadline,remember,role:user.role,name:user.name,email:user.email};
  });
}
export async function validateAuth(db: DB | Prisma.TransactionClient, token: AuthClaims) {
  if (!token.sub) return null;
  const now = Date.now();
  if (token.sid) {
    const session=await db.leadAuthSession.findUnique({where:{id:token.sid},include:{user:true}});
    if (!session || session.userId!==token.sub || session.expiresAt.getTime()<=now) return null;
    return {...token,role:session.user.role,name:session.user.name,email:session.user.email,remember:session.remember,deadline:Math.floor(session.expiresAt.getTime()/1000)};
  }
  const iat = token.legacyIat ?? token.iat;
  if (!Number.isFinite(iat) || !iat || iat*1000>now || (iat+SESSION_SECONDS)*1000<=now) return null;
  const user=await db.user.findUnique({where:{id:token.sub}});
  if (!user || (user.passwordChangedAt && iat*1000<=user.passwordChangedAt.getTime())) return null;
  return {...token,legacyIat:iat,deadline:iat+SESSION_SECONDS,remember:false,role:user.role,name:user.name,email:user.email};
}
export async function revokeSession(db: DB, token: AuthClaims) {
  if (token.sid) await db.leadAuthSession.deleteMany({where:{id:token.sid,userId:token.sub}});
  else if (token.sub) {
    // Legacy JWTs lack a stable session id: revoke legacy capabilities only.
    await db.user.updateMany({where:{id:token.sub},data:{passwordChangedAt:new Date()}});
  }
}
