import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sendPasswordResetEmail} from '../src/lib/email';
import * as adapters from '../src/lib/reset-mail-transport';
const options={to:'synthetic@example.invalid',name:'<b>Test</b>',resetUrl:'https://example.invalid/reset-password?token=synthetic'};
const unavailable={message:'RESET_MAIL_UNAVAILABLE'};
test('existing Resend contract rejects falsey errors and blank message IDs',async()=>{
 for(const error of [false,0,'']) await assert.rejects(sendPasswordResetEmail(options,async()=>({data:{id:'synthetic'},error})),unavailable);
 await assert.rejects(sendPasswordResetEmail(options,async()=>({data:{id:'   '},error:null})),unavailable);
});
test('Gmail selector uses fixed verified TLS, structured sole recipient and real text newlines',async()=>{
 let config:any,message:any;
 const env={PASSWORD_RESET_EMAIL_TRANSPORT:'gmail',GMAIL_SMTP_USER:'synthetic.sender@gmail.com',GMAIL_SMTP_APP_PASSWORD:randomBytes(24).toString('hex')};
 const send=adapters.selectResetTransport(env,undefined,(c:any)=>{config=c;return {sendMail:async(m:any)=>{message=m;return {messageId:'synthetic-id',accepted:[options.to],rejected:[],pending:[],response:'250 2.0.0 OK'};}};});
 await sendPasswordResetEmail(options,send);
 assert.equal(config.host,'smtp.gmail.com');assert.equal(config.port,465);assert.equal(config.secure,true);assert.equal(config.tls.rejectUnauthorized,true);
 for(const k of ['connectionTimeout','greetingTimeout','socketTimeout']) assert.ok(config[k]>0 && config[k]<=15000);
 assert.equal(config.pool,false);assert.equal(config.logger,false);assert.equal(config.debug,false);assert.equal(config.disableFileAccess,true);assert.equal(config.disableUrlAccess,true);
 assert.equal(message.from.name,'Cutting Edge Leads');assert.equal(message.from.address,env.GMAIL_SMTP_USER);
 assert.deepEqual(message.to,{address:options.to});assert.deepEqual(message.envelope,{from:env.GMAIL_SMTP_USER,to:[options.to]});assert.equal(message.bcc,undefined);
 assert.ok(message.html.includes('&lt;b&gt;'));assert.ok(message.text.includes('\nReset'));assert.ok(!message.text.includes('\\n'));
});
test('Gmail failures and injection are sanitized without causes or fallback',async()=>{
 const env={PASSWORD_RESET_EMAIL_TRANSPORT:'gmail',GMAIL_SMTP_USER:'synthetic.sender@gmail.com',GMAIL_SMTP_APP_PASSWORD:randomBytes(24).toString('hex')};
 const good={messageId:'synthetic',accepted:[options.to],rejected:[],pending:[],response:'250 2.0.0 OK'};
 for(const result of [{...good,messageId:''},{...good,messageId:' '},{...good,accepted:[]},{...good,accepted:[options.to,'other@example.invalid']},{...good,rejected:[options.to]},{...good,pending:[options.to]},{...good,response:'450 rejected'}, {...good,response:undefined}]) {
  const send=adapters.selectResetTransport(env,undefined,()=>({sendMail:async()=>result}));
  await assert.rejects(sendPasswordResetEmail(options,send),e=>e instanceof Error && e.message==='RESET_MAIL_UNAVAILABLE' && e.cause===undefined);
 }
 for(const to of ['x@example.invalid\r\nBcc:x@example.invalid','a@example.invalid,b@example.invalid','Display <a@example.invalid>','a@example.invalid;z@example.invalid']) {
  let sends=0;
  const send=adapters.selectResetTransport(env,undefined,()=>({sendMail:async()=>{sends++;return good;}}));
  await assert.rejects(sendPasswordResetEmail({...options,to},send),unavailable);assert.equal(sends,0);
 }
 for(const bad of [{...env,GMAIL_SMTP_USER:'a@example.invalid'},{...env,GMAIL_SMTP_USER:'a@gmail.com,b@gmail.com'},{...env,GMAIL_SMTP_USER:'a@gmail.com\r\nBcc:b@gmail.com'},{...env,GMAIL_SMTP_APP_PASSWORD:' '},{...env,GMAIL_SMTP_APP_PASSWORD:'synthetic\r\ninjection'},{...env,PASSWORD_RESET_EMAIL_TRANSPORT:'smtp'}]) {
  let initialized=0;assert.throws(()=>adapters.selectResetTransport(bad,undefined,()=>{initialized++;return {sendMail:async()=>good};}),unavailable);assert.equal(initialized,0);
 }
 const send=adapters.selectResetTransport(env,undefined,()=>({sendMail:async()=>{throw new Error('synthetic private provider body');}}));
 await assert.rejects(sendPasswordResetEmail(options,send),unavailable);
});
test('selector defaults to Resend and never silently falls back',async()=>{
 let calls=0;const resend=async()=>{calls++;return {data:{id:'synthetic'},error:null};};
 await sendPasswordResetEmail(options,adapters.selectResetTransport({},resend));assert.equal(calls,1);
 assert.throws(()=>adapters.selectResetTransport({PASSWORD_RESET_EMAIL_TRANSPORT:'gmail'},resend),unavailable);assert.equal(calls,1);
});
