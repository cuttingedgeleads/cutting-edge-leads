import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/lib/auth-policy';
test('trusted canonical origin rejects unrelated production and request origins', () => {
 assert.equal(policy.authOrigin({}), 'https://www.cuttingedgeleads.net');
 assert.equal(policy.authOrigin({NEXTAUTH_URL:'https://www.cuttingedgeleads.net'}),'https://www.cuttingedgeleads.net');
 for(const url of ['https://unrelated.invalid','https://cuttingedgeleads.net','http://www.cuttingedgeleads.net','https://www.cuttingedgeleads.net.evil.invalid','https://user@www.cuttingedgeleads.net','https://www.cuttingedgeleads.net/path']) assert.throws(()=>policy.authOrigin({NEXTAUTH_URL:url}));
 assert.equal(policy.authOrigin({AUTH_TRUSTED_ORIGIN:'https://preview.example.invalid',VERCEL_ENV:'preview',VERCEL:'1'}),'https://preview.example.invalid');
 assert.throws(()=>policy.authOrigin({NEXTAUTH_URL:'https://preview.example.invalid',VERCEL_ENV:'preview',VERCEL:'1'}));
 assert.equal(policy.authOrigin({AUTH_TRUSTED_ORIGIN:'http://127.0.0.1:3100'}),'http://127.0.0.1:3100');
 assert.throws(()=>policy.authOrigin({AUTH_TRUSTED_ORIGIN:'http://localhost:3100',VERCEL:'1'}));
});
test('passwords obey minimum, confirmation and bcrypt byte limit; token shape bounded', () => {
 const p = crypto.randomUUID();
 assert.equal(policy.passwordError(p,p),null);
 assert.equal(policy.passwordError('x','x'),'weak_password');
 assert.equal(policy.passwordError('é'.repeat(37),'é'.repeat(37)),'weak_password');
 assert.equal(policy.passwordError(p,p+'x'),'password_mismatch');
 assert.equal(policy.validResetToken('a'.repeat(64)),true);
 for(const t of ['', 'a'.repeat(65), '"&x=', 'z'.repeat(64)]) assert.equal(policy.validResetToken(t),false);
});
