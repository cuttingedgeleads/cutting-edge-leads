import type { DefaultSession } from 'next-auth';
import type { AuthClaims } from '../lib/auth-service';
declare module 'next-auth' {
 interface Session {
  auth: AuthClaims;
  user: {id:string;role:'ADMIN'|'CONTRACTOR'} & DefaultSession['user'];
 }
 interface User {id:string;role:'ADMIN'|'CONTRACTOR';sid?:string;deadline?:number;remember?:boolean;}
}
declare module 'next-auth/jwt' {
 interface JWT {role?:'ADMIN'|'CONTRACTOR';sid?:string;deadline?:number;remember?:boolean;legacyIat?:number;}
}
