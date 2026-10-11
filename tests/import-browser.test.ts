import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import type {Page,Browser} from 'playwright';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {createHmac,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
// Explicit test-only compatible driver; never hardcode executablePath.
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.IMPORT_QA_PLAYWRIGHT_DRIVER!);
const origin='http://127.0.0.1:3181',email='import-qa@example.invalid';
if(process.env.DATABASE_URL!=='postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa')throw Error('DATABASE_GUARD');
async function capture(page:Page,engine:string,view:string){
 for(const width of [390,1280,320]){await page.setViewportSize({width,height:844});await page.screenshot({path:`.handoff-qa/${engine}-${view}-${width}.png`,fullPage:true});const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main input,main textarea,main button,main a')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.textContent?.slice(0,80))}));writeFileSync(`.handoff-qa/${engine}-${view}-${width}.json`,JSON.stringify({geometry,text:await page.locator('main').innerText()},null,2));assert.ok(geometry.scroll<=width+1,`${view} overflow ${JSON.stringify(geometry)}`);}
 await page.setViewportSize({width:390,height:844});
}
for(const [name,engine] of Object.entries({chromium,webkit}))test(`${name}: real login, private save, recovery, publication and normal create`,async()=>{
 const db=new PrismaClient(),password='Synthetic-only-password-123!';let browser:Browser|undefined,userId:string|undefined;const normalLeadIds:string[]=[];
 try{
 const user=await db.user.create({data:{email,name:'Synthetic Admin',passwordHash:await bcrypt.hash(password,4),role:'ADMIN'}});userId=user.id;
 const p={version:1,source:'command-studio',environment:'qa',transferId:randomUUID(),sourceRecordId:randomUUID(),sourceRevision:'',sourceActor:'',customerName:'Synthetic Person',customerPhone:'5550101234',customerEmail:'synthetic@example.invalid',address:'123 Synthetic Street',formattedAddress:'',city:'',state:'',postalCode:'',inquiryNotes:'PRIVATE synthetic context',estimatorNotes:'Private estimator context',salesNotes:'Private sales context',sourcePhotoCount:0};
 const raw=JSON.stringify(p),timestamp=String(Math.floor(Date.now()/1000));
 const signed=(body=raw,ts=timestamp)=>({'x-studio-timestamp':ts,'x-studio-signature':createHmac('sha256',process.env.STUDIO_IMPORT_SECRET!).update(ts+'.'+body).digest('hex')});
 const intake=origin+'/api/integrations/studio/imports';
 for(const headers of [{},{...signed(),'x-studio-signature':'0'.repeat(64)},{...signed(),'x-studio-signature':signed()['x-studio-signature']+','+signed()['x-studio-signature']},{...signed(),'x-studio-timestamp':timestamp+','+timestamp},signed(raw,'1')])assert.equal((await fetch(intake,{method:'POST',headers,body:raw})).status,401);
 const receipts=await Promise.all(Array.from({length:4},()=>fetch(intake,{method:'POST',headers:signed(),body:raw})));assert.equal(receipts.filter(r=>r.status===201).length,1);assert.equal(receipts.filter(r=>r.status===200).length,3);const receipt=await receipts[0].json();
 const conflict=JSON.stringify({...p,customerName:'Conflict'});assert.equal((await fetch(intake,{method:'POST',headers:signed(conflict),body:conflict})).status,409);
 const oversized='x'.repeat(262145);assert.equal((await fetch(intake,{method:'POST',headers:signed(oversized),body:oversized})).status,413);
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(oversized.slice(0,150000)));c.enqueue(new TextEncoder().encode(oversized.slice(150000)));c.close();}});
 assert.equal((await fetch(intake,{method:'POST',headers:signed(oversized),body:stream,duplex:'half'} as RequestInit)).status,413);
 assert.equal(await db.studioImport.count({where:{recipientId:user.id}}),1);assert.equal(await db.lead.count(),0);
 browser=await (engine as typeof chromium).launch({headless:true,timeout:20000});console.log(name,'engine',browser!.version());
 const context=await browser!.newContext({extraHTTPHeaders:{'x-forwarded-for':name==='chromium'?'127.0.0.2':'127.0.0.3'},viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 console.log(name,'navigate signed-out detail');await page.goto(origin+'/admin/imports/'+receipt.importId,{waitUntil:'domcontentloaded'});
 await page.waitForURL('**/login?*',{waitUntil:'domcontentloaded'});console.log(name,'login',page.url());
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/admin/imports/'+receipt.importId,{waitUntil:'domcontentloaded'});
 const save=page.getByRole('button',{name:'Save request',exact:true});await save.waitFor();
 const badgeStyle=await page.getByTestId('import-count').evaluate(el=>({radius:parseFloat(getComputedStyle(el).borderRadius),height:el.getBoundingClientRect().height,background:getComputedStyle(el).backgroundColor}));
 assert.ok(badgeStyle.radius>=10&&badgeStyle.height>=20&&badgeStyle.background!=='rgba(0, 0, 0, 0)','Waiting count must be a visible numeric badge');
 const detail='/api/admin/imports/'+receipt.importId;
 const response=await context.request.get(origin+detail);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);assert.equal(response.headers()['x-content-type-options'],'nosniff');
 assert.equal((await context.request.post(origin+detail,{headers:{origin:'https://unsafe.invalid'},data:{}})).status(),403);
 assert.equal((await fetch(origin+detail)).status,404);
 for(const field of ['city','description','price','jobType'])assert.equal(await page.locator(`form [name=${field}]`).inputValue(),'');
 await capture(page,name,'detail');
 await page.getByRole('link',{name:'Back to Import / Saved requests'}).click();await page.getByRole('link',{name:/Synthetic Person/}).waitFor();await capture(page,name,'inbox');await page.getByRole('link',{name:/Synthetic Person/}).click();await save.waitFor();
 // Failure during focus/visibility refresh must preserve the SAME dirty editor DOM.
 await page.locator('form [name=description]').fill('Unsaved human work');await page.locator('form [name=description]').evaluate(e=>e.setAttribute('data-survival','same-editor'));
 await page.route('**/api/admin/imports/**',route=>route.request().method()==='GET'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic outage"}'}):route.continue());
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('main').getByRole('alert').filter({hasText:'Unable to load'}).waitFor();assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');assert.equal(await page.locator('form [name=description]').getAttribute('data-survival'),'same-editor');await page.getByTestId('import-count').filter({hasText:'!'}).waitFor();
 await page.unroute('**/api/admin/imports/**');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('main').getByRole('alert').waitFor({state:'hidden'});assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');
 // Lost save acknowledgement: commit real request but abort response; exact retry is idempotent.
 let lost=false;await page.route('**'+detail,async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await save.click();await page.locator('main').getByRole('alert').waitFor();assert.equal((await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}})).status,'saved');assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');await page.unroute('**'+detail);await save.click();await page.getByRole('button',{name:'Review & publish',exact:true}).waitFor();
 const saved=await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}});assert.equal(saved.version,1);assert.equal(await db.lead.count(),0);
 assert.equal((await context.request.post(origin+detail,{headers:{origin},data:{version:0,data:{...(saved.reviewedData as object),name:'Stale'}}})).status(),409);
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Review & publish',exact:true}).waitFor();assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');await capture(page,name,'saved-detail');
 await page.getByRole('link',{name:'Back to Import / Saved requests'}).click();await page.getByRole('button',{name:'Saved requests',exact:true}).click();await page.getByRole('link',{name:/Synthetic Person/}).waitFor();await capture(page,name,'saved-inbox');await page.getByRole('link',{name:/Synthetic Person/}).click();await page.getByRole('button',{name:'Review & publish',exact:true}).click();
 assert.equal(await page.locator('textarea[name=description]').inputValue(),'Unsaved human work');assert.equal(await page.locator('input[name=price]').inputValue(),'');assert.equal(await page.locator('select[name=jobType]').inputValue(),'');await capture(page,name,'publish-review');
 for(const [field,value] of Object.entries({city:'Synthetic',state:'LA',zip:'70000',price:'12',description:'Human public description'}))await page.locator(`form [name=${field}]`).fill(value);await page.locator('select[name=jobType]').selectOption({index:1});await page.locator('select[name=unlockLimit]').selectOption('1');
 await page.route('**/api/leads/create',async route=>{const [a,b]=await Promise.all([route.fetch(),context.request.post(origin+'/api/leads/create',{headers:route.request().headers(),data:route.request().postDataBuffer()!})]);assert.equal(a.status(),200);assert.equal(b.status(),200);assert.equal((await a.json()).leadId,(await b.json()).leadId);assert.match(a.headers()['cache-control'],/no-store/);await route.fulfill({response:a});});
 await page.getByRole('button',{name:'Publish lead',exact:true}).click();await page.getByText('This request is published.').waitFor();await page.unroute('**/api/leads/create');await capture(page,name,'published');
 const record=await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}});assert.ok(record.leadId);assert.equal((await db.lead.findUniqueOrThrow({where:{id:record.leadId!}})).description,'Human public description');
 const repeats=await Promise.all(Array.from({length:1},()=>context.request.post(origin+'/api/leads/create',{headers:{origin},multipart:{importId:receipt.importId,importVersion:'1'}})));for(const r of repeats){assert.equal(r.status(),200);assert.equal((await r.json()).leadId,record.leadId);}assert.equal(await db.lead.count(),1);
 // Current role revocation is checked on the server, even with a previously valid session.
 await db.user.update({where:{id:user.id},data:{role:'CONTRACTOR'}});
 for(const path of [detail,'/api/admin/imports','/api/admin/imports/count']){const denied=await context.request.get(origin+path);assert.equal(denied.status(),404);assert.match(denied.headers()['cache-control'],/no-store/);}
 assert.equal((await context.request.post(origin+detail,{headers:{origin},data:{version:1,data:saved.reviewedData}})).status(),404);
 const deniedPublish=await context.request.post(origin+'/api/leads/create',{headers:{origin},multipart:{importId:receipt.importId,importVersion:'1'}});assert.ok([401,404].includes(deniedPublish.status()));
 await page.evaluate(()=>window.dispatchEvent(new Event('imports-changed')));await page.getByText('PRIVATE synthetic context',{exact:false}).waitFor({state:'hidden'});assert.equal(await page.getByRole('heading',{name:'Private imported request'}).count(),0);
 await db.user.update({where:{id:user.id},data:{role:'ADMIN'}});
 await page.goto(origin+'/admin/leads',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Publish lead',exact:true}).waitFor();assert.equal(await page.locator('input[name=name]').inputValue(),'');await page.screenshot({path:`.handoff-qa/${name}-normal-create.png`,fullPage:true});
 assert.equal(await page.locator('select[name=unlockLimit]').inputValue(),'1');assert.equal(await page.locator('input[name=importId]').count(),0);
 for(const [field,value] of Object.entries({name:'Synthetic Normal',email,phone:'5550101234',address:'456 Synthetic Street',city:'Synthetic',state:'LA',zip:'70000',price:'12',description:'Synthetic normal form regression fixture'}))await page.locator(`form [name=${field}]`).fill(value);
 await page.locator('select[name=jobType]').selectOption({index:1});const normalResponse=page.waitForResponse(r=>r.url()===origin+'/api/leads/create'&&r.request().method()==='POST');await page.getByRole('button',{name:'Publish lead',exact:true}).click();const normal=await normalResponse;assert.equal(normal.status(),200);const normalResult=await normal.json();normalLeadIds.push(normalResult.leadId);assert.equal(await db.lead.count(),2);assert.equal(await db.studioImport.count({where:{recipientId:user.id}}),1);await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='');
 console.log(name,'acceptance complete');
 }finally{try{await browser?.close();}finally{try{if(userId){const rows=await db.studioImport.findMany({where:{recipientId:userId}});const leads=[...normalLeadIds,...rows.flatMap(r=>r.leadId?[r.leadId]:[])];await db.studioImport.deleteMany({where:{recipientId:userId}});await db.leadPhoto.deleteMany({where:{leadId:{in:leads}}});await db.lead.deleteMany({where:{id:{in:leads}}});await db.leadAuthSession.deleteMany({where:{userId:userId}});await db.auditLog.deleteMany({where:{email,userId}});await db.user.delete({where:{id:userId}});}}finally{await db.$disconnect();}}}
});
