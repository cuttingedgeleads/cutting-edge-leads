import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionCookiePolicy} from '../src/lib/auth-cookies';
test('only session chunks lose persistence, deletion and other cookies intact, fixed remembered expiry',()=>{
 const name='__Secure-next-auth.session-token';
 const lines=[`${name}.0=abc; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Max-Age=300; HttpOnly; Secure; SameSite=Lax`,`${name}.1=def; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT; HttpOnly; Secure`,`${name}.2=; Max-Age=0; Path=/`, 'next-auth.csrf-token=csrf; Expires=Wed, 01 Jan 2031 00:00:00 GMT; HttpOnly'];
 const result=sessionCookiePolicy(lines,name,{remember:false,deadline:2000000000});
 assert.ok(!/Expires|Max-Age/.test(result[0]));assert.match(result[0],/HttpOnly; Secure; SameSite=Lax/);
 assert.ok(!/Expires/.test(result[1]));assert.equal(result[2],lines[2]);assert.equal(result[3],lines[3]);
 const remembered=sessionCookiePolicy(lines,name,{remember:true,deadline:2000000000});
 assert.ok(remembered[0].includes(new Date(2000000000000).toUTCString()));
 assert.ok(!remembered[0].includes('Max-Age=300'));
 const revoked=sessionCookiePolicy(lines,name,null);assert.match(revoked[0],/Max-Age=0/);
});
