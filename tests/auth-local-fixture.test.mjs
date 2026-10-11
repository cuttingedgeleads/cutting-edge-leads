import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authLocalFixture} from './auth-local-fixture.mjs';

test('auth QA retains the existing default fixture identity',()=>{
 const c=authLocalFixture({});
 assert.equal(c.databaseURL,'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa');
 assert.equal(c.origin,'http://127.0.0.1:3100');
});
test('auth QA supports explicit owned loopback ports without accepting a database URL override',()=>{
 const c=authLocalFixture({AUTH_QA_PG_PORT:'55581',AUTH_QA_HTTP_PORT:'3183',DATABASE_URL:'postgresql://forbidden.invalid/not_qa'});
 assert.equal(c.databaseURL,'postgresql://leads_qa@127.0.0.1:55581/leads_auth_qa');
 assert.equal(c.origin,'http://127.0.0.1:3183');
 assert.equal(c.httpPort,3183);
});
test('invalid fixture ports fail before opening any transport',()=>{
 for(const value of ['0','80','65536','-1','55581/production','55581@elsewhere','55581?sslmode=require','3.5','abc',' 55581']) {
  assert.throws(()=>authLocalFixture({AUTH_QA_PG_PORT:value}),/LOCAL_PORT_GUARD/);
  assert.throws(()=>authLocalFixture({AUTH_QA_HTTP_PORT:value}),/LOCAL_PORT_GUARD/);
 }
});
