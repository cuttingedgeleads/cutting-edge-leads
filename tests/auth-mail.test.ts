import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPasswordResetEmail } from '../src/lib/email';
test('reset mail rejects missing configuration instead of reporting success', async () => {
  await assert.rejects(sendPasswordResetEmail({to:'synthetic@example.invalid',name:'Test',resetUrl:'https://www.cuttingedgeleads.net/reset-password?token=test'}), /RESET_MAIL_UNAVAILABLE/);
});

test('reset mail checks provider errors and ids, escapes HTML, text and sanitizes errors', async () => {
  const options = {to:'synthetic@example.invalid',name:'<img src=x>',resetUrl:'https://www.cuttingedgeleads.net/reset-password?token=a&x="'};
  for (const result of [{data:null,error:{message:'private'}},{data:null,error:null},{data:{id:''},error:null}]) {
    await assert.rejects(sendPasswordResetEmail(options, async () => result), /^Error: RESET_MAIL_UNAVAILABLE$/);
  }
  await assert.rejects(sendPasswordResetEmail(options, async () => {throw new Error('private');}), /^Error: RESET_MAIL_UNAVAILABLE$/);
  let message: any;
  await sendPasswordResetEmail(options, async (m) => {message=m;return {data:{id:'synthetic-id'},error:null};});
  assert.equal(message.to,options.to);
  assert.ok(!message.html.includes('<img'));
  assert.ok(message.html.includes('&lt;img'));
  assert.ok(message.html.includes('&amp;x=&quot;'));
  assert.ok(message.text.includes('one hour'));
  assert.ok(message.text.includes(options.resetUrl));
  assert.equal(message.bcc,undefined);
});
