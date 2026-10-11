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
for(const [name,engine] of Object.entries({chromium,webkit}))test(`${name}: real login, Create lead navigation, private prefill, recovery, once-only publication and normal create`,async()=>{
 const db=new PrismaClient(),password='Synthetic-only-password-123!';let browser:Browser|undefined,userId:string|undefined;const normalLeadIds:string[]=[];
 try{
 const user=await db.user.create({data:{email,name:'Synthetic Admin',passwordHash:await bcrypt.hash(password,4),role:'ADMIN'}});userId=user.id;
 const p={version:1,source:'command-studio',environment:'qa',transferId:randomUUID(),sourceRecordId:randomUUID(),sourceRevision:'',sourceActor:'',customerName:'Synthetic Person',customerPhone:'5550101234',customerEmail:'synthetic@example.invalid',address:'123 Synthetic Street, Metairie',formattedAddress:'123 Synthetic Street, Metairie, LA 70001, USA',city:'',state:'LA',postalCode:'70001',inquiryNotes:'PRIVATE synthetic context',estimatorNotes:'Private estimator context',salesNotes:'Private sales context',sourcePhotoCount:0};
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
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/admin/leads?importId='+receipt.importId,{waitUntil:'domcontentloaded'});
 const publish=page.getByRole('button',{name:'Publish lead',exact:true});await publish.waitFor();
 await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='Synthetic Person');
 assert.equal(new URL(page.url()).pathname,'/admin/leads');
 assert.equal(new URL(page.url()).searchParams.get('importId'),receipt.importId);
 const selected=page.getByRole('navigation').getByRole('link',{name:'Create Lead',exact:true});
 assert.match(await selected.getAttribute('class')||'',/bg-sky-100/);
 const badgeStyle=await page.getByTestId('import-count').evaluate(el=>({radius:parseFloat(getComputedStyle(el).borderRadius),height:el.getBoundingClientRect().height,background:getComputedStyle(el).backgroundColor}));
 assert.ok(badgeStyle.radius>=10&&badgeStyle.height>=20&&badgeStyle.background!=='rgba(0, 0, 0, 0)');
 const detail='/api/admin/imports/'+receipt.importId;
 const response=await context.request.get(origin+detail);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);assert.equal(response.headers()['x-content-type-options'],'nosniff');
 assert.equal((await context.request.post(origin+detail,{headers:{origin:'https://unsafe.invalid'},data:{}})).status(),403);
 assert.equal((await fetch(origin+detail)).status,404);
 for(const field of ['price','jobType'])assert.equal(await page.locator(`form [name=${field}]`).inputValue(),'');
 const expectedNotes=[p.inquiryNotes,p.estimatorNotes,p.salesNotes].join('\n\n');
 assert.equal(await page.locator('form [name=description]').inputValue(),expectedNotes);
 assert.equal(await page.locator('form [name=unlockLimit]').inputValue(),'1');
 assert.equal(await page.locator('form [name=address]').inputValue(),'123 Synthetic Street');
 assert.equal(await page.locator('form [name=city]').inputValue(),'Metairie');
 assert.equal(await page.locator('aside').count(),0);
 assert.equal(await page.getByText(/Private Studio information|photos remain in Studio|Review the imported|Nothing is published/).count(),0);
 assert.deepEqual(await page.locator('nav a[href^="/admin/"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['/admin/leads','/admin/active-leads','/admin/contractors','/admin/purchased-leads','/admin/expired-leads','/admin/imports']);
 const formShape=()=>page.locator('form').evaluate(form=>Array.from(form.querySelectorAll('input,textarea,select,button')).map(e=>({tag:e.tagName,name:e.getAttribute('name'),type:e.getAttribute('type'),options:e instanceof HTMLSelectElement?Array.from(e.options).map(o=>[o.value,o.text]):undefined})));
 const importedShape=await formShape();
 await capture(page,name,'create-import');
 const before=await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}});
 const mutations:string[]=[];
 page.on('request',request=>{if(request.method()==='POST'&&/\/api\/(admin\/imports|leads\/create)/.test(new URL(request.url()).pathname))mutations.push(request.url());});
 await page.locator('nav a[href="/admin/imports"]').click();
 const create=page.getByRole('link',{name:'Create lead',exact:true});await create.waitFor();
 for(const label of ['Waiting','Saved requests','Published'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0);
 assert.equal(await create.count(),1);
 await capture(page,name,'inbox');
 const bounds=await create.boundingBox();assert.ok(bounds&&bounds.height>=44);
 await create.click();await publish.waitFor();
 await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='Synthetic Person');
 assert.equal(new URL(page.url()).pathname,'/admin/leads');
 assert.equal(new URL(page.url()).searchParams.get('importId'),receipt.importId);
 assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}}),before);
 assert.equal(await db.lead.count(),0);assert.deepEqual(mutations,[],'Create lead only navigates and prefills');
 for(const [field,value] of Object.entries({name:p.customerName,email:p.customerEmail,phone:p.customerPhone,address:'123 Synthetic Street'}))assert.equal(await page.locator(`form [name=${field}]`).inputValue(),value);
 assert.equal(await page.locator('form [name=description]').inputValue(),expectedNotes);assert.equal(await page.locator('aside').count(),0);
 await publish.click();await page.getByText(/Please fill out the following fields:/).waitFor();assert.equal(await db.lead.count(),0);
 // A transient background read preserves the same dirty form, not just its text.
 await page.locator('form [name=description]').fill('Unsaved human work');await page.locator('form [name=description]').evaluate(e=>e.setAttribute('data-survival','same-editor'));
 await page.route('**/api/admin/imports/**',route=>route.request().method()==='GET'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic outage"}'}):route.continue());
 await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('main').getByRole('alert').filter({hasText:'Unable to load'}).waitFor();assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');assert.equal(await page.locator('form [name=description]').getAttribute('data-survival'),'same-editor');await page.getByTestId('import-count').filter({hasText:'!'}).waitFor();
 await page.unroute('**/api/admin/imports/**');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('main').getByRole('alert').waitFor({state:'hidden'});assert.equal(await page.locator('form [name=description]').inputValue(),'Unsaved human work');
 for(const [field,value] of Object.entries({city:'Synthetic',state:'LA',zip:'70000',price:'12',description:'Human public description'}))await page.locator(`form [name=${field}]`).fill(value);await page.locator('select[name=jobType]').selectOption({index:1});await page.locator('select[name=unlockLimit]').selectOption('1');
 const reviewedJobType=await page.locator('select[name=jobType]').inputValue();
 // Commit the real publish but lose its acknowledgement. Explicit retry must
 // resolve the same linked lead, not manufacture a second listing.
 let lost=false;await page.route('**/api/leads/create',async route=>{if(!lost){lost=true;const accepted=await route.fetch();assert.equal(accepted.status(),200);await route.abort('failed');}else await route.continue();});
 await publish.click();await page.getByText(/Network error:/).waitFor();assert.equal(await db.lead.count(),1);assert.equal(await page.locator('form [name=description]').inputValue(),'Human public description');
 await page.unroute('**/api/leads/create');await publish.click();await page.getByText(/This lead has already been created/).waitFor();
 const record=await db.studioImport.findUniqueOrThrow({where:{id:receipt.importId}});assert.ok(record.leadId);assert.equal(record.version,1);assert.equal(record.originalPayload,raw);assert.equal((await db.lead.findUniqueOrThrow({where:{id:record.leadId!}})).description,'Human public description');
 const repeats=await Promise.all(Array.from({length:3},()=>context.request.post(origin+'/api/leads/create',{headers:{origin},multipart:{importId:receipt.importId,importVersion:'0'}})));for(const r of repeats){assert.equal(r.status(),200);assert.equal((await r.json()).leadId,record.leadId);}assert.equal(await db.lead.count(),1);
 await capture(page,name,'created');
 await page.locator('nav a[href="/admin/imports"]').click();await page.getByText('No imports to create.').waitFor();assert.equal(await create.count(),0);
 // Retain previously saved requests in the same simple queue. Legacy private
 // save/replay stays supported, without adding that step to the new UI.
 const p2={...p,transferId:randomUUID(),sourceRecordId:randomUUID(),customerName:'Second Import'};
 const raw2=JSON.stringify(p2),second=await (await fetch(intake,{method:'POST',headers:signed(raw2),body:raw2})).json();
 const savedData={name:'Reviewed Person',email:'reviewed@example.invalid',phone:'5550105678',address:'456 Reviewed Street',city:'Reviewed City',state:'LA',zip:'70001',description:'Reviewed public description',jobType:reviewedJobType,price:'15',unlockLimit:'2'};
 const secondDetail='/api/admin/imports/'+second.importId;
 for(let i=0;i<2;i++)assert.equal((await context.request.post(origin+secondDetail,{headers:{origin},data:{version:0,data:savedData}})).status(),200);
 const saved=await db.studioImport.findUniqueOrThrow({where:{id:second.importId}});assert.equal(saved.version,1);assert.equal(await db.lead.count(),1);assert.equal((await(await context.request.get(origin+'/api/admin/imports/count')).json()).pendingCount,1);
 await page.reload({waitUntil:'domcontentloaded'});await create.waitFor();assert.equal(await create.count(),1);await page.getByTestId('import-count').filter({hasText:'1'}).waitFor();await capture(page,name,'saved-in-queue');await create.click();await publish.waitFor();
 await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='Reviewed Person');
 for(const [field,value]of Object.entries(savedData))assert.equal(await page.locator(`form [name=${field}]`).inputValue(),value);
 // Background refresh must not advance the version of a dirty editor.
 await page.locator('form [name=description]').fill('My unsaved description');
 assert.equal((await context.request.post(origin+secondDetail,{headers:{origin},data:{version:1,data:{...savedData,name:'Other Editor'}}})).status(),200);
 const refreshed=page.waitForResponse(r=>r.url()===origin+secondDetail&&r.request().method()==='GET');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal((await refreshed).status(),200);
 await page.waitForFunction(()=>!document.querySelector('main [role=alert]'));
 assert.equal(await page.locator('form [name=description]').inputValue(),'My unsaved description');
 const conflictResponse=page.waitForResponse(r=>r.url()===origin+'/api/leads/create'&&r.request().method()==='POST');await publish.click();assert.equal((await conflictResponse).status(),409);await page.getByText('Import changed. Reopen it before publishing.',{exact:true}).waitFor();assert.equal(await db.lead.count(),1);assert.equal(await page.locator('form [name=description]').inputValue(),'My unsaved description');
 // Explicit reopen accepts the new version; it must never happen automatically.
 await page.reload({waitUntil:'domcontentloaded'});await publish.waitFor();await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='Other Editor');
 for(const version of [undefined,'','-1','1','1.5']){
  const multipart:Record<string,string>={...savedData,importId:second.importId};if(version!==undefined)multipart.importVersion=version;
  assert.equal((await context.request.post(origin+'/api/leads/create',{headers:{origin},multipart})).status(),409);
 }
 await page.route('**/api/leads/create',async route=>{const [a,b]=await Promise.all([route.fetch(),context.request.post(origin+'/api/leads/create',{headers:route.request().headers(),data:route.request().postDataBuffer()!})]);assert.equal(a.status(),200);assert.equal(b.status(),200);assert.equal((await a.json()).leadId,(await b.json()).leadId);assert.match(a.headers()['cache-control'],/no-store/);await route.fulfill({response:a});});
 await publish.click();await page.getByText(/This lead has already been created/).waitFor();await page.unroute('**/api/leads/create');assert.equal(await db.lead.count(),2);

 // A fresh imported draft must disappear when this account loses admin access.
 const p3={...p,transferId:randomUUID(),sourceRecordId:randomUUID(),customerName:'Revocation Draft'};
 const raw3=JSON.stringify(p3),third=await(await fetch(intake,{method:'POST',headers:signed(raw3),body:raw3})).json();
 await page.goto(origin+'/admin/leads?importId='+third.importId,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='Revocation Draft');
 assert.equal(await page.locator('form [name=description]').inputValue(),expectedNotes);
 await db.user.update({where:{id:user.id},data:{role:'CONTRACTOR'}});
 for(const path of [detail,'/api/admin/imports','/api/admin/imports/count']){const denied=await context.request.get(origin+path);assert.equal(denied.status(),404);assert.match(denied.headers()['cache-control'],/no-store/);}
 assert.equal((await context.request.post(origin+detail,{headers:{origin},data:{version:1,data:saved.reviewedData}})).status(),404);
 const deniedPublish=await context.request.post(origin+'/api/leads/create',{headers:{origin},multipart:{importId:receipt.importId,importVersion:'1'}});assert.ok([401,404].includes(deniedPublish.status()));
 await page.evaluate(()=>window.dispatchEvent(new Event('imports-changed')));await page.locator('form [name=description]').waitFor({state:'hidden'});assert.equal(await page.getByRole('heading',{name:'Private Studio information'}).count(),0);
 await db.user.update({where:{id:user.id},data:{role:'ADMIN'}});
 await page.goto(origin+'/admin/leads',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Publish lead',exact:true}).waitFor();assert.equal(await page.locator('input[name=name]').inputValue(),'');await page.screenshot({path:`.handoff-qa/${name}-normal-create.png`,fullPage:true});
 assert.equal(await page.locator('select[name=unlockLimit]').inputValue(),'1');assert.equal(await page.locator('input[name=importId]').count(),0);assert.deepEqual(await formShape(),importedShape,'Imported and ordinary Create Lead use identical fields and options');
 for(const [field,value] of Object.entries({name:'Synthetic Normal',email,phone:'5550101234',address:'456 Synthetic Street',city:'Synthetic',state:'LA',zip:'70000',price:'12',description:'Synthetic normal form regression fixture'}))await page.locator(`form [name=${field}]`).fill(value);
 await page.locator('select[name=jobType]').selectOption({index:1});const normalResponse=page.waitForResponse(r=>r.url()===origin+'/api/leads/create'&&r.request().method()==='POST');await page.getByRole('button',{name:'Publish lead',exact:true}).click();const normal=await normalResponse;assert.equal(normal.status(),200);const normalResult=await normal.json();normalLeadIds.push(normalResult.leadId);assert.equal(await db.lead.count(),3);assert.equal(await db.studioImport.count({where:{recipientId:user.id}}),3);await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name=name]')?.value==='');
 console.log(name,'acceptance complete');
 }finally{try{await browser?.close();}finally{try{if(userId){const rows=await db.studioImport.findMany({where:{recipientId:userId}});const leads=[...normalLeadIds,...rows.flatMap(r=>r.leadId?[r.leadId]:[])];await db.studioImport.deleteMany({where:{recipientId:userId}});await db.leadPhoto.deleteMany({where:{leadId:{in:leads}}});await db.lead.deleteMany({where:{id:{in:leads}}});await db.leadAuthSession.deleteMany({where:{userId:userId}});await db.auditLog.deleteMany({where:{email,userId}});await db.user.delete({where:{id:userId}});}}finally{await db.$disconnect();}}}
});
