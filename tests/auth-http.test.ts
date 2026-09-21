import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {hash} from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
import {request, chromium} from 'playwright';
import {consumeReset,tokenDigest} from '../src/lib/password-reset';
assert.equal(process.env.DATABASE_URL,'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa');
const origin='http://127.0.0.1:3100';
const db=new PrismaClient();const ids:string[]=[];
const password=()=>randomBytes(24).toString('base64url');
async function user(){const p=password();const u=await db.user.create({data:{email:`${randomBytes(12).toString('hex')}@example.invalid`,name:'Synthetic browser',passwordHash:await hash(p,10)}});ids.push(u.id);return {u,p};}
after(async()=>{await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});
test('REAL activated service worker: auth is network-only even with poisoned cache while offline',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 try {
  await page.goto(origin+'/login');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:15000});
  const paths=['/login','/forgot-password','/reset-password?token=synthetic','/api/auth/session'];
  for(const path of paths) assert.equal(await page.evaluate(async path=>(await fetch(path)).ok,path),true);
  const cached=await page.evaluate(async()=>{const urls:string[]=[];for(const key of await caches.keys())for(const req of await (await caches.open(key)).keys())urls.push(new URL(req.url).pathname);return urls;});
  assert.equal(cached.some(p=>/^\/(login|forgot-password|reset-password|api\/auth)(\/|$)/.test(p)),false);
  await page.evaluate(async paths=>{const c=await caches.open('synthetic-stale-auth');for(const p of paths)await c.put(p,new Response('synthetic cached auth'));},paths);
  await context.setOffline(true);
  for(const path of paths) assert.equal(await page.evaluate(async path=>{try{await fetch(path);return true;}catch{return false;}},path),false);
 }finally{await context.close();await browser.close();}
});
async function client(){return request.newContext({baseURL:origin});}
async function csrf(c:Awaited<ReturnType<typeof client>>){return (await (await c.get('/api/auth/csrf')).json()).csrfToken;}
async function login(c:Awaited<ReturnType<typeof client>>,email:string,p:string,remember:boolean){return c.post('/api/auth/callback/credentials',{form:{csrfToken:await csrf(c),email,password:p,remember:String(remember),json:'true',callbackUrl:origin},maxRedirects:0});}
test('REAL HTTP: persistent and session-only cookies survive refresh/update; logout/reset kills stolen cookies',async()=>{
 for(const remember of [false,true]){
  const {u,p}=await user();const c=await client();
  try {
   const response=await login(c,u.email,p,remember);assert.equal(response.status(),200);
   const cookies=response.headersArray().filter(h=>h.name.toLowerCase()==='set-cookie'&&h.value.startsWith('next-auth.session-token='));assert.equal(cookies.length,1);
   assert.equal(/expires=/i.test(cookies[0].value),remember);assert.match(cookies[0].value,/HttpOnly/i);
   const state=await c.storageState();const saved=state.cookies.find(x=>x.name==='next-auth.session-token')!;assert.ok(saved);
   assert.equal(saved.expires===-1,!remember);
   const session=await (await c.get('/api/auth/session')).json();assert.equal(session.user.id,u.id);
   const deadline=session.expires;
   const updated=await c.post('/api/auth/session',{data:{csrfToken:await csrf(c),data:{role:'ADMIN',remember:true,deadline:9999999999}}});
   const updatedBody=await updated.json();assert.equal(updatedBody.user.role,'CONTRACTOR');assert.equal(updatedBody.expires,deadline);
   const after=(await c.storageState()).cookies.find(x=>x.name==='next-auth.session-token')!;assert.equal(after.expires===-1,!remember);
   await db.user.update({where:{id:u.id},data:{role:'ADMIN'}});
   assert.equal((await (await c.get('/api/auth/session')).json()).user.role,'ADMIN');
   await c.post('/api/auth/signout',{form:{csrfToken:await csrf(c),json:'true',callbackUrl:origin+'/login'}});
   const stolen=await request.newContext({baseURL:origin,storageState:state});
   try {assert.equal((await (await stolen.get('/api/auth/session')).json()).user,undefined);}finally{await stolen.dispose();}
   await db.user.update({where:{id:u.id},data:{role:'CONTRACTOR'}});
   await login(c,u.email,p,remember);const beforeReset=await c.storageState();
   const raw=randomBytes(32).toString('hex');await db.passwordResetToken.create({data:{userId:u.id,token:tokenDigest(raw),expiresAt:new Date(Date.now()+3600000)}});
   const next=password();assert.equal(await consumeReset(db,raw,next,next),null);
   const stale=await request.newContext({baseURL:origin,storageState:beforeReset});
   try {assert.equal((await (await stale.get('/api/auth/session')).json()).user,undefined);}finally{await stale.dispose();}
  } finally {await c.dispose();}
 }
});
test('REAL browser profile labels and session update cannot persist opt-out or elevate authority',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({baseURL:origin,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage();const {u,p}=await user();
 try {
  await login(context.request,u.email,p,false);await page.goto(origin+'/profile');
  await page.getByRole('button',{name:'Edit password',exact:true}).click();
  for(const [label,autocomplete] of [['Current password','current-password'],['New password','new-password'],['Confirm password','new-password']]) assert.equal(await page.getByLabel(label,{exact:true}).getAttribute('autocomplete'),autocomplete);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const before=await page.evaluate(async()=>await (await fetch('/api/auth/session')).json());
  const after=await page.evaluate(async()=>{const {csrfToken}=await (await fetch('/api/auth/csrf')).json();return (await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrfToken,data:{remember:true,role:'ADMIN',deadline:9999999999}})})).json();});
  assert.equal(after.expires,before.expires);assert.equal(after.user.role,'CONTRACTOR');await page.reload();
  const cookie=(await context.cookies()).find(c=>c.name==='next-auth.session-token');assert.ok(cookie);assert.equal(cookie.expires,-1);
 }finally{await context.close();await browser.close();}
});
test('REAL browser phone-width Edge: default checked, failed/network opt-out preserved, labels, reset headers',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({baseURL:origin,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin) return route.abort();return route.continue();});
 const page=await context.newPage();
 try {
  await page.goto(origin+'/login');const check=page.getByRole('checkbox',{name:'Remember me for 30 days'});
  assert.equal(await check.isChecked(),true);await check.uncheck();
  await page.getByLabel('Email',{exact:true}).fill('unknown@example.invalid');await page.getByLabel('Password',{exact:true}).fill(password());
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await check.isChecked(),false);assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled(),true);
  await page.route('**/api/auth/callback/credentials',r=>r.abort());
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.textContent==='Sign in');assert.equal(await check.isChecked(),false);
  const box=await check.locator('..').boundingBox();assert.ok(box&&box.height>=44);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const response=await page.goto(origin+'/reset-password?token=invalid');assert.equal(response?.headers()['referrer-policy'],'no-referrer');assert.match(response?.headers()['cache-control']||'',/no-store/);
  assert.equal(await page.locator('input[name=token]').inputValue(),'');
  assert.equal(await page.getByLabel('New password',{exact:true}).getAttribute('autocomplete'),'new-password');
 }finally{await context.close();await browser.close();}
});
