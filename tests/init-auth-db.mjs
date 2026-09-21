// One-time, empty dedicated LOCAL QA database only. Provision the database separately.
import {Client} from 'pg';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
const cwd=fileURLToPath(new URL('..',import.meta.url));
if(process.argv[2]!=='--empty-local-qa')throw new Error('Explicit --empty-local-qa confirmation required');
if([cwd,join(cwd,'prisma')].some(dir=>readdirSync(dir).some(x=>/^\.env(?:\.|$)/.test(x)&&x!=='.env.example')))throw new Error('Remove dotenv files before isolated QA');
const url='postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa';
const client=new Client({connectionString:url});
try {
 await client.connect();
 const identity=await client.query('SELECT current_database() AS db, current_user AS username');
 if(identity.rows[0].db!=='leads_auth_qa'||identity.rows[0].username!=='leads_qa')throw new Error('LOCAL_DATABASE_GUARD');
 const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
 if(tables.rowCount)throw new Error('Refusing db push: dedicated database is not empty');
}finally{await client.end();}
const env={DATABASE_URL:url};
for(const [k,v]of Object.entries(process.env))if(/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata|appdata)$/i.test(k))env[k]=v;
const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{cwd,env,stdio:'inherit'});
process.exitCode=result.status??1;
