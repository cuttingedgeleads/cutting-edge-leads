import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../src/lib/prisma';
import {getAppSettings,getTestMode,setTestMode} from '../src/lib/settings';
import {Client} from 'pg';
assert.equal(process.env.DATABASE_URL,'postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa');
after(async()=>{await prisma.$disconnect();});
test('concurrent cold settings reads do not fail publication or overwrite a chosen mode',async()=>{
 const prior=await prisma.appSetting.findUnique({where:{id:'global'}});
 try {
  await prisma.appSetting.deleteMany({where:{id:'global'}});
  const barrier=new Client({connectionString:process.env.DATABASE_URL});await barrier.connect();
  let pending:Promise<PromiseSettledResult<Awaited<ReturnType<typeof getAppSettings>>>[]>|undefined;
  let blocked=0;
  try {
   await barrier.query('BEGIN');await barrier.query('LOCK TABLE "AppSetting" IN SHARE MODE');
   pending=Promise.allSettled(Array.from({length:20},()=>getAppSettings()));
   const deadline=Date.now()+4000;
   while(Date.now()<deadline){await barrier.query('SELECT pg_stat_clear_snapshot()');blocked=Number((await barrier.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%AppSetting%'")).rows[0].count);if(blocked>=2)break;await new Promise(r=>setTimeout(r,20));}
  }finally{await barrier.query('COMMIT');await barrier.end();}
  const results=await pending!;
  assert.ok(blocked>=2,'Both initializers must reach the real database race');
  assert.equal(results.filter(r=>r.status==='rejected').length,0,'Cold publication must not fail with a settings upsert race');
  assert.equal(await prisma.appSetting.count({where:{id:'global'}}),1);
  await setTestMode(true);
  const chosen=await prisma.appSetting.findUniqueOrThrow({where:{id:'global'}});
  assert.deepEqual(await Promise.all(Array.from({length:20},()=>getTestMode())),Array(20).fill(true));
  assert.deepEqual(await prisma.appSetting.findUniqueOrThrow({where:{id:'global'}}),chosen,'Reads must not change settings or update timestamp');
 }finally{
  if(prior)await prisma.appSetting.upsert({where:{id:'global'},create:prior,update:prior});
  else await prisma.appSetting.deleteMany({where:{id:'global'}});
 }
});
