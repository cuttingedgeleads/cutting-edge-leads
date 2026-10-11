import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import type {Browser} from 'playwright';

const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.IMPORT_QA_PLAYWRIGHT_DRIVER!);
const origin='http://127.0.0.1:3181',email='import-qa@example.invalid';
if(process.env.DATABASE_URL!=='postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa')throw Error('DATABASE_GUARD');
for(const [name,engine] of Object.entries({chromium,webkit}))test(`${name}: saved blank notes recover only in the editable draft`,async()=>{
 const db=new PrismaClient();let browser:Browser|undefined,userId:string|undefined;
 const password='Synthetic-only-password-123!';
 try{
  const user=await db.user.create({data:{email,name:'Synthetic Notes Admin',passwordHash:await bcrypt.hash(password,4),role:'ADMIN'}});userId=user.id;
  const source={version:1,source:'command-studio',environment:'qa',transferId:randomUUID(),sourceRecordId:randomUUID(),sourceRevision:'',sourceActor:'',customerName:'Synthetic Notes',customerPhone:'5550101234',customerEmail:'synthetic@example.invalid',address:'123 Synthetic Street',formattedAddress:'123 Synthetic Street, Metairie, LA 70001, USA',city:'Metairie',state:'LA',postalCode:'70001',inquiryNotes:'Inquiry\n第二行',estimatorNotes:'Estimator note',salesNotes:'Sales note',sourcePhotoCount:0};
  const raw=JSON.stringify(source),timestamp=String(Math.floor(Date.now()/1000));
  const intake=await fetch(origin+'/api/integrations/studio/imports',{method:'POST',headers:{'x-studio-timestamp':timestamp,'x-studio-signature':createHmac('sha256',process.env.STUDIO_IMPORT_SECRET!).update(timestamp+'.'+raw).digest('hex')},body:raw});
  assert.equal(intake.status,201);const {importId}=await intake.json();const detail=origin+'/api/admin/imports/'+importId;
  browser=await (engine as typeof chromium).launch({headless:true,timeout:20000});
  const context=await browser!.newContext({viewport:{width:390,height:844},serviceWorkers:'block',extraHTTPHeaders:{'x-forwarded-for':name==='chromium'?'127.0.0.12':'127.0.0.13'}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/login',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/admin/leads',{waitUntil:'domcontentloaded'});
  const reviewed={name:'Reviewed Notes',email:'reviewed@example.invalid',phone:'5550105678',address:'456 Reviewed Street, Apt 4',city:'Kenner',state:'LA',zip:'70065',description:'',jobType:'',price:'',unlockLimit:'2'};
  assert.equal((await context.request.post(detail,{headers:{origin},data:{version:0,data:reviewed}})).status(),200);
  const saved=await db.studioImport.findUniqueOrThrow({where:{id:importId}});assert.equal(saved.version,1);assert.equal(saved.status,'saved');
  // NextAuth may log a canceled session request during navigation; that endpoint
  // is telemetry, not a business-data mutation. Every other unsafe request fails.
  const mutations:string[]=[];page.on('request',request=>{const path=new URL(request.url()).pathname;if(!['GET','HEAD','OPTIONS'].includes(request.method())&&path!=='/api/auth/_log')mutations.push(path);});
  await page.goto(origin+'/admin/imports/'+importId,{waitUntil:'domcontentloaded'});
  await page.waitForURL('**/admin/leads?importId='+importId,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('form [name=name]')?.value==='Reviewed Notes');
  const notes=[source.inquiryNotes,source.estimatorNotes,source.salesNotes].join('\n\n');
  const description=page.locator('form [name=description]');assert.equal(await description.inputValue(),notes);
  for(const [field,value]of Object.entries(reviewed))if(field!=='description')assert.equal(await page.locator(`form [name=${field}]`).inputValue(),value);
  assert.equal(await page.locator('aside').count(),0);assert.equal(await page.getByRole('button',{name:'Publish lead',exact:true}).count(),1);
  assert.equal(await page.locator('nav a[href^="/admin/"]').last().getAttribute('href'),'/admin/imports');
  assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:importId}}),saved);assert.equal(await db.lead.count(),0);
  // Explicit clearing while editing must survive an ordinary background refresh.
  await description.fill('');const refreshed=page.waitForResponse(r=>r.url()===detail&&r.request().method()==='GET');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));const refreshResponse=await refreshed;assert.equal(refreshResponse.status(),200);await refreshResponse.finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await description.inputValue(),'');assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:importId}}),saved);
  // A nonempty saved description remains authoritative on an explicit reopen.
  const edited={...reviewed,description:'Human-reviewed description\nKeep verbatim.'};
  assert.equal((await context.request.post(detail,{headers:{origin},data:{version:1,data:edited}})).status(),200);
  const editedSaved=await db.studioImport.findUniqueOrThrow({where:{id:importId}});
  await page.goto(origin+'/admin/imports',{waitUntil:'domcontentloaded'});
  await page.getByRole('link',{name:'Create lead',exact:true}).click();
  await page.waitForFunction(expected=>document.querySelector<HTMLTextAreaElement>('form [name=description]')?.value===expected,edited.description);
  assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:importId}}),editedSaved);
  assert.equal(await db.lead.count(),0);assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);
 }finally{
  await browser?.close();
  if(userId){const imports=await db.studioImport.findMany({where:{recipientId:userId},select:{leadId:true}});for(const row of imports)if(row.leadId)await db.lead.deleteMany({where:{id:row.leadId}});await db.studioImport.deleteMany({where:{recipientId:userId}});await db.user.deleteMany({where:{id:userId}});}
  await db.$disconnect();
 }
});
