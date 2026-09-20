import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';
import { authOptions, sessionCookieName } from '@/lib/auth';
import { isSessionCookie, sessionCookiePolicy } from '@/lib/auth-cookies';
import { validateAuth } from '@/lib/auth-service';
import { prisma } from '@/lib/prisma';
const handler=NextAuth(authOptions);
async function auth(request: NextRequest, context: {params: Promise<{nextauth:string[]}>}) {
 const response: Response=await handler(request,context);
 const headers=new Headers(response.headers);
 const lines=headers.getSetCookie();
 // Read the newly encoded token (not client-submitted remember/update fields).
 const pieces=lines.map(l=>l.split(';')[0]).map(p=>{const eq=p.indexOf('=');return {name:p.slice(0,eq),value:p.slice(eq+1)};}).filter(p=>isSessionCookie(p.name,sessionCookieName)&&p.value).sort((a,b)=>Number(a.name.split('.').pop())-Number(b.name.split('.').pop()));
 let claims=null;
 if(pieces.length) {
  try {
   const token=await decode({token:pieces.map(p=>p.value).join(''),secret:process.env.NEXTAUTH_SECRET!});
   if(token) claims=await validateAuth(prisma,token);
  } catch { /* Fail closed on decoding or database failure. */ }
 }
 headers.delete('set-cookie');
 for(const line of sessionCookiePolicy(lines,sessionCookieName,claims)) headers.append('set-cookie',line);
 headers.set('Cache-Control','private, no-store, max-age=0');
 headers.set('Pragma','no-cache');headers.set('Referrer-Policy','no-referrer');
 // A concurrent logout/reset may have revoked the outgoing refresh after the callback.
 const body=pieces.length&&!claims&&new URL(request.url).pathname.endsWith('/session')?'{}':response.body;
 return new Response(body,{status:response.status,headers});
}
export {auth as GET,auth as POST};
