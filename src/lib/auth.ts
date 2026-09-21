import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { encode } from 'next-auth/jwt';
import { prisma } from './prisma';
import { authOrigin, REMEMBER_SECONDS } from './auth-policy';
import { issueSession, validateAuth, revokeSession } from './auth-service';
import { getClientIpFromHeaders } from './ratelimit';
import { logAudit } from './audit';
const secure = authOrigin().startsWith('https:');
export const sessionCookieName = `${secure ? '__Secure-' : ''}next-auth.session-token`;
export const authOptions: NextAuthOptions = {
  session:{strategy:'jwt',maxAge:REMEMBER_SECONDS},
  useSecureCookies:secure,
  cookies:{sessionToken:{name:sessionCookieName,options:{httpOnly:true,sameSite:'lax',path:'/',secure}}},
  jwt:{async encode(params) {
    const deadline = params.token?.deadline;
    if (typeof deadline !== 'number' || deadline*1000<=Date.now()) throw new Error('AUTH_REVOKED');
    return encode({...params,maxAge:Math.max(1,deadline-Math.floor(Date.now()/1000))});
  }},
  providers:[CredentialsProvider({
    name:'Credentials',
    credentials:{email:{label:'Email',type:'email'},password:{label:'Password',type:'password'},remember:{label:'Remember me',type:'text'}},
    async authorize(credentials,req) {
      const email=String(credentials?.email||'').trim().toLowerCase();
      const user=await issueSession(prisma,email,String(credentials?.password||''),credentials?.remember!=='false');
      await logAudit({action:user?'LOGIN_SUCCESS':'LOGIN_FAILED',userId:user?.id,email,ip:req.headers?getClientIpFromHeaders(new Headers(req.headers)):'unknown'});
      return user;
    }
  })],
  callbacks:{
    async jwt({token,user}) {
      const claims=user?{...token,sub:user.id,sid:user.sid,deadline:user.deadline,remember:user.remember}:token;
      const valid=await validateAuth(prisma,claims);
      if(!valid) throw new Error('AUTH_REVOKED');
      return {...token,...valid};
    },
    async session({session,token}) {
      if(typeof token.deadline!=='number' || token.deadline*1000<=Date.now() || !token.sub) throw new Error('AUTH_REVOKED');
      session.user={...session.user,id:token.sub,role:token.role!,name:token.name,email:token.email};
      session.expires=new Date(token.deadline*1000).toISOString();
      session.auth={sub:token.sub,sid:token.sid,legacyIat:token.legacyIat,deadline:token.deadline,remember:token.remember};
      return session;
    },
    async redirect({url}) {
      const origin=authOrigin();
      if(url.startsWith('/') && !url.startsWith('//')) return origin+url;
      try {if(new URL(url).origin===origin) return url;} catch {}
      return origin;
    }
  },
  events:{async signOut({token}) {if(token) await revokeSession(prisma,token);}},
  logger:{error(code){console.error('[Auth]',code);},warn(code){console.warn('[Auth]',code);},debug(){}},
  pages:{signIn:'/login'},
};
