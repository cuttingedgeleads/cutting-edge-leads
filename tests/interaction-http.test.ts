import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {hash} from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
import {chromium} from 'playwright';
assert.equal(process.env.DATABASE_URL,'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa');
const origin='http://127.0.0.1:3100';

test('REAL local application: owner and customer route/buttons, edit persistence and compact checkout',async()=>{
 const db=new PrismaClient();const users:string[]=[];const leads:string[]=[];
 const browser=await chromium.launch({channel:'msedge',headless:true});
 mkdirSync('.interaction-qa',{recursive:true});
 try{
  const lead=await db.lead.create({data:{name:'Synthetic QA',email:'qa@example.invalid',phone:'5045550100',jobType:'Grass Maintenance',description:'Synthetic fixture — not a customer',address:'123 Test St',city:'Metairie',state:'LA',zip:'70001',price:25}});leads.push(lead.id);
  for(const role of ['ADMIN','CONTRACTOR'] as const){
   const password=randomBytes(24).toString('base64url');const u=await db.user.create({data:{email:randomBytes(10).toString('hex')+'@example.invalid',name:'Synthetic '+role,passwordHash:await hash(password,10),role,serviceCities:'Metairie',paypalVaultId:role==='CONTRACTOR'?'synthetic-not-a-provider-token':null,notifyNewLeads:false,notifySms:false,emailNotifications:false,pushNotifications:false}});users.push(u.id);
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
   const denied:string[]=[];await context.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin){denied.push(url.hostname);return r.abort()}if(/^\/api\/(paypal|sms)\//.test(url.pathname))return r.fulfill({json:{success:true,token:'synthetic-qa'}});return r.continue()});
   const csrf=(await(await context.request.get(origin+'/api/auth/csrf')).json()).csrfToken;
   await context.request.post(origin+'/api/auth/callback/credentials',{form:{csrfToken:csrf,email:u.email,password,remember:'false',json:'true',callbackUrl:origin}});
   const p=await context.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    for(const route of role==='ADMIN'?['/admin','/admin/leads','/admin/active-leads','/admin/expired-leads','/admin/purchased-leads','/admin/contractors']:['/leads','/leads/history','/profile']){
     const response=await p.goto(origin+route);assert.equal(response?.status(),200,route);assert.equal(new URL(p.url()).pathname,route);assert.equal(await p.locator('body').innerText().then(t=>t.includes('Application error')),false);
    }
    if(role==='ADMIN'){
     await p.goto(origin+'/admin/leads');await p.screenshot({path:'.interaction-qa/owner-create.png',fullPage:true});
     await p.goto(origin+'/admin/active-leads');await p.waitForLoadState('networkidle');await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByRole('dialog',{name:'Edit lead'}).locator('textarea').fill('Synthetic edited and persisted');await p.getByRole('button',{name:'Save Changes',exact:true}).click();await p.getByRole('dialog',{name:'Edit lead'}).waitFor({state:'hidden'});
     assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).description,'Synthetic edited and persisted');await p.reload();await p.getByText('Synthetic edited and persisted',{exact:true}).waitFor();
    }else{
     await p.goto(origin+'/profile');await p.getByRole('button',{name:'Edit Business name',exact:true}).click();await p.locator('input[name=businessName]').fill('Synthetic saved business');await p.getByRole('button',{name:'Save',exact:true}).click();await p.waitForURL('**/profile?success=business_profile');assert.equal((await db.user.findUniqueOrThrow({where:{id:u.id}})).businessName,'Synthetic saved business');
     await p.goto(origin+'/leads');await p.getByRole('button',{name:'Unlock lead',exact:true}).click();await p.getByRole('button',{name:'Unlock lead ($25)',exact:true}).click();await p.getByLabel('Verification digit 1',{exact:true}).waitFor();
     for(const width of [320,390,1280]){await p.setViewportSize({width,height:844});await p.screenshot({path:`.interaction-qa/customer-checkout-${width}.png`});const fits=await p.getByRole('dialog').evaluate(el=>[...el.querySelectorAll('input')].every(n=>{const r=n.getBoundingClientRect();const row=n.parentElement!.getBoundingClientRect();return r.left>=row.left&&r.right<=row.right}));assert.equal(fits,true,`checkout input fit ${width}`);}
     await p.getByRole('button',{name:'Cancel',exact:true}).click();
    }
    assert.deepEqual(errors,[]);
   }catch(error){await p.screenshot({path:'.interaction-qa/failure-'+role+'.png',fullPage:true});writeFileSync('.interaction-qa/failure-'+role+'.json',JSON.stringify({errors,body:await p.locator('body').innerText(),html:await p.locator('body').innerHTML()},null,2));throw error;}finally{await context.unrouteAll({behavior:'wait'});await context.close();}
  }
 }finally{await browser.close();await db.leadUnlockRequest.deleteMany({where:{leadId:{in:leads}}});await db.lead.deleteMany({where:{id:{in:leads}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();}
});
