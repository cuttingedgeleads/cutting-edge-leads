import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('profile password fields have associated labels and correct autocomplete',()=>{
 const source=read('src/components/ProfileEditableField.tsx');
 for(const id of ['currentPassword','newPassword','confirmPassword']) {
  assert.ok(source.includes(`htmlFor="${id}"`));assert.ok(source.includes(`id="${id}"`));
 }
 assert.ok(source.includes('autoComplete="current-password"'));assert.ok(source.includes('autoComplete="new-password"'));
});
test('routes wire durable services; forms retain opt-out and recover network failure; no reset referrer/cache',()=>{
 const forgot=read('src/app/forgot-password/page.tsx');assert.match(forgot,/requestReset\(prisma/);assert.ok(!forgot.includes('passwordResetToken.deleteMany'));
 assert.match(read('src/app/reset-password/page.tsx'),/consumeReset\(prisma/);
 assert.match(read('src/app/profile/page.tsx'),/changePassword\(prisma, session.auth/);
 const login=read('src/app/login/page.tsx');assert.match(login,/useState\(true\)/);assert.match(login,/remember: String\(remember\)/);assert.match(login,/finally/);assert.match(login,/autoComplete="username"/);assert.match(login,/autoComplete="current-password"/);
 assert.match(read('src/app/api/auth/[...nextauth]/route.ts'),/sessionCookiePolicy/);
 assert.match(read('next.config.ts'),/no-referrer/);
 assert.match(read('src/worker/sw.js'),/NetworkOnly/);
});
