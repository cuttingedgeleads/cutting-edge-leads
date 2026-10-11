// Run: node --import tsx tests/import-deletion-regression.ts --owned-local-deletion-fixture <evidence-label>
// Creates/drops ONLY a random new database on the explicitly verified parent-owned cluster.
// No Prisma generation, db-push, app server, files in public/, or existing fixture database changes.
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {PrismaClient} from '@prisma/client';
import {publishImport, saveImport, listImports} from '../src/lib/import-store';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [permission,label,...extra]=process.argv.slice(2);
if(permission!=='--owned-local-deletion-fixture'||!label||!/^[-a-z0-9]{1,40}$/.test(label)||extra.length) {
  throw Error('Explicit --owned-local-deletion-fixture and safe evidence label required');
}
const name=`fix_review_delete_${randomUUID().replaceAll('-','')}`;
const config={host:'127.0.0.1',port:55581,user:'handoff_qa',password:'',ssl:false,connectionTimeoutMillis:5000};
const url=`postgresql://handoff_qa@127.0.0.1:55581/${name}`;
const evidence=path.join(root,'.handoff-qa',`fix-review-${label}-${name}`);
mkdirSync(evidence,{recursive:true});
const lines:string[]=[];
function log(message:string){lines.push(message);console.log(message);writeFileSync(path.join(evidence,'result.log'),lines.join('\n')+'\n');}
function command(args:string[]){
 const result=spawnSync(args[0],args.slice(1),{cwd:root,encoding:'utf8',env:{...process.env,DATABASE_URL:url},timeout:120000});
 if(result.status!==0)throw Error(`${args.join(' ')} failed: ${result.error||result.stderr}`);
 return result.stdout;
}
const admin=new pg.Client({...config,database:'postgres'});
let created=false;
let db:PrismaClient|undefined;
let sql:pg.Client|undefined;
async function rejected(query:string,values:unknown[],code:string){
 try{await sql!.query(query,values);}catch(error:any){assert.equal(error.code,code);log(`PASS blocked ${query} SQLSTATE=${code}`);return;}
 throw Error(`Unexpectedly accepted: ${query}`);
}
async function main(){
 try {
  await admin.connect();
  const directory=(await admin.query('SHOW data_directory')).rows[0].data_directory;
  assert.equal(directory.replaceAll('\\','/').replace(/\/$/,'').toLowerCase(),'c:/users/user/ce-leads-handoff-evidence/owned-postgres');
  assert.equal((await admin.query('SELECT current_user')).rows[0].current_user,'handoff_qa');
  log(`Verified data_directory=${directory}; role=handoff_qa; host=127.0.0.1 port=55581`);
  // Name is generated here, never accepted from arguments or environment. Never DROP before CREATE.
  await admin.query(`CREATE DATABASE "${name}" OWNER handoff_qa`);created=true;
  log(`Created exclusive fixture ${name}`);
  sql=new pg.Client({...config,database:name});await sql.connect();
  assert.equal((await sql.query('SELECT current_database() AS db')).rows[0].db,name);
  const baseline='9ddab2b29d9105f54b86062ea3c9d8b12a906848';
  const schema=command(['git','show',`${baseline}:prisma/schema.prisma`]);
  assert(!schema.includes('model StudioImport'));
  const basePath=path.join(evidence,'baseline.prisma');writeFileSync(basePath,schema);
  const baseSql=command([process.execPath,'node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',basePath,'--script']);
  const migration=readFileSync(path.join(root,'prisma/migrations/20261010000100_studio_import/migration.sql'),'utf8');
  writeFileSync(path.join(evidence,'baseline.sql'),baseSql);writeFileSync(path.join(evidence,'migration.sql'),migration);
  log(`Baseline ${baseline}; actual migration SHA256=${createHash('sha256').update(migration).digest('hex')}`);
  await sql.query('BEGIN');await sql.query(baseSql);await sql.query(migration);await sql.query(readFileSync(path.join(root,'prisma/migrations/20261011000100_import_soft_delete/migration.sql'),'utf8'));await sql.query('COMMIT');
  db=new PrismaClient({datasources:{db:{url}}});
  const user=await db.user.create({data:{id:'fixture-admin',email:'deletion-fixture@example.invalid',name:'Synthetic fixture',passwordHash:'not-a-password',role:'ADMIN'}});
  const leadData={jobType:'Synthetic mowing',description:'Synthetic deletion fixture',address:'1 Fictional Fixture Lane',city:'Fictional',state:'XX',zip:'00000',price:1,isTestLead:true};
  async function children(id:string){
   await db!.leadPhoto.create({data:{id:`photo-${id}`,leadId:id,url:'https://example.invalid/no-real-photo'}});
   await db!.leadUnlockRequest.create({data:{id:`unlock-${id}`,leadId:id,contractorId:user.id}});
  }
  async function remove(id:string){
   // Exact database transaction used by src/app/api/leads/[id]/route.ts DELETE.
   await db!.$transaction([db!.leadUnlockRequest.deleteMany({where:{leadId:id}}),db!.leadPhoto.deleteMany({where:{leadId:id}}),db!.lead.delete({where:{id}})]);
  }
  const ordinary=await db.lead.create({data:{...leadData,id:'ordinary'}});await children(ordinary.id);await remove(ordinary.id);
  assert.equal(await db.lead.count({where:{id:ordinary.id}}),0);assert.equal(await db.leadPhoto.count(),0);assert.equal(await db.leadUnlockRequest.count(),0);
  log('PASS ordinary non-imported deletion including photo/unlock rows');
  const raw=JSON.stringify({source:'studio',sourceRecordId:'synthetic-source',address:leadData.address});
  const receiptData={source:'studio',environment:'qa',sourceRecordId:'synthetic-source',transferId:'synthetic-transfer',recipientId:user.id,originalPayload:raw,payloadSha256:createHash('sha256').update(raw).digest('hex')};
  const receipt=await db.studioImport.create({data:{id:'receipt',...receiptData}});
  const review={name:'Synthetic',email:'',phone:'',address:leadData.address,city:leadData.city,state:leadData.state,zip:leadData.zip,description:leadData.description,jobType:leadData.jobType,price:'1',unlockLimit:'1'};
  const saved=await saveImport(db,user.id,receipt.id,0,review);
  const published=await publishImport(db,user.id,receipt.id,saved.version,{...leadData,id:'imported'});
  assert.equal(published.created,true);await children(published.lead.id);
  const before=await db.studioImport.findUniqueOrThrow({where:{id:receipt.id}});
  try{await remove(published.lead.id);}catch(error:any){
   assert.equal(await db.lead.count({where:{id:'imported'}}),1);assert.equal(await db.leadPhoto.count(),1);assert.equal(await db.leadUnlockRequest.count(),1);
   log(`RED imported deletion failed; children rolled back; Prisma=${error.code}; ${error.message}`);throw error;
  }
  assert.equal(await db.lead.count(),0);assert.equal(await db.leadPhoto.count(),0);assert.equal(await db.leadUnlockRequest.count(),0);
  assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:receipt.id}}),before);
  assert.equal(before.status,'published');assert.equal(before.leadId,'imported');
  const waiting=await listImports(db,user.id,'waiting',0);assert.equal(waiting.waitingCount,0);assert.equal(waiting.total,0);
  const history=await listImports(db,user.id,'published',0);assert.equal(history.total,1);assert.equal(history.items[0].leadId,'imported');
  log('PASS imported deletion; entire receipt unchanged; published history retained; waiting count/list = 0');
  await assert.rejects(()=>publishImport(db!,user.id,receipt.id,before.version,{...leadData,id:'republished'}),(e:any)=>e.code==='P2025');
  await assert.rejects(()=>saveImport(db!,user.id,receipt.id,before.version,review),/Already published/);
  assert.equal(await db.lead.count(),0);log('PASS actual publishImport replay rejected P2025 without creating lead; saveImport rejected Already published');
  await db.lead.create({data:{...leadData,id:'different-lead'}});
  await rejected('UPDATE "StudioImport" SET "leadId"=$1 WHERE id=$2',['different-lead',receipt.id],'P0001');
  await rejected('UPDATE "StudioImport" SET "leadId"=NULL, status=\'waiting\' WHERE id=$1',[receipt.id],'P0001');
  for(const field of ['source','environment','sourceRecordId','transferId','recipientId','originalPayload','payloadSha256']) {
   await rejected(`UPDATE "StudioImport" SET "${field}"=$1 WHERE id=$2`,['rewritten',receipt.id],'P0001');
  }
  for(const [set,code] of [["status='waiting'",'23514'],["status='invalid'",'23514'],['"reviewedData"=NULL','23514'],['version=-1','23514'],["\"notificationStatus\"='invalid'",'23514']])await rejected(`UPDATE "StudioImport" SET ${set} WHERE id=$1`,[receipt.id],code);
  async function duplicate(overrides:Record<string,unknown>){await assert.rejects(()=>db!.studioImport.create({data:{...receiptData,id:randomUUID(),...overrides} as any}),(e:any)=>e.code==='P2002');}
  await duplicate({sourceRecordId:'different-source'});log('PASS unique transferId retained');
  await duplicate({transferId:'different-transfer'});log('PASS unique source/environment/sourceRecordId retained');
  await duplicate({sourceRecordId:'another-source',transferId:'another-transfer',leadId:'imported',status:'published',reviewedData:review});log('PASS unique historical leadId retained after deletion');
  await rejected('DELETE FROM "User" WHERE id=$1',[user.id],'23503');log('PASS recipient FK retained');
  assert.deepEqual(await db.studioImport.findUniqueOrThrow({where:{id:receipt.id}}),before);
  log('GREEN all deletion/history/immutability/once-only regression assertions passed');
 } finally {
  await db?.$disconnect();await sql?.end();
  if(created){await admin.query(`DROP DATABASE "${name}"`);assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount,0);log(`Removed exclusive fixture ${name}; absence verified`);}
  await admin.end();
 }
}
main().catch(error=>{log(`FAIL ${error.stack||error}`);process.exitCode=1;});
