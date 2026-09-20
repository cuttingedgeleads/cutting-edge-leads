import test from 'node:test';
import assert from 'node:assert/strict';
import {authOptions} from '../src/lib/auth';
test('NextAuth rejects nonexistent capability and ignores update elevation',async()=>{
 await assert.rejects(async () => authOptions.callbacks!.jwt!({token:{sub:'synthetic-missing',role:'ADMIN'},trigger:'update',session:{remember:true,role:'ADMIN'}} as any),/AUTH_REVOKED/);
 assert.equal(authOptions.session?.maxAge,30*86400);
 assert.equal(authOptions.cookies?.sessionToken?.options.secure,false);
});
