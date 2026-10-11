// Dedicated disposable QA only. Legacy initial migration is invalid SQL; generate BASE schema,
// then exercise the actual additive import migration, without editing historical migrations.
import {Client} from 'pg';import {spawnSync} from 'node:child_process';import {writeFileSync,readFileSync} from 'node:fs';
if(process.env.DATABASE_URL!=='postgresql://handoff_qa@127.0.0.1:55581/ce_leads_handoff_qa')throw Error('LOCAL_DATABASE_GUARD');
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{const identity=(await db.query('select current_database() db,current_user username')).rows[0];if(identity.db!=='ce_leads_handoff_qa'||identity.username!=='handoff_qa')throw Error('IDENTITY');
const tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename <> '_prisma_migrations'")).rows;if(tables.length)throw Error('NONEMPTY_DATABASE');
const base=spawnSync('git',['show','9ddab2b29d9105f54b86062ea3c9d8b12a906848:prisma/schema.prisma'],{encoding:'utf8'});if(base.status)throw Error('BASE_SCHEMA');writeFileSync('.handoff-qa/base.prisma',base.stdout);
const sql=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','.handoff-qa/base.prisma','--script'],{encoding:'utf8',env:process.env});if(sql.status)throw Error(sql.stderr);await db.query('BEGIN');await db.query(sql.stdout);await db.query(readFileSync('prisma/migrations/20261010000100_studio_import/migration.sql','utf8'));await db.query(readFileSync('prisma/migrations/20261011000100_import_soft_delete/migration.sql','utf8'));await db.query('COMMIT');console.log('Base schema + actual additive migration applied to exclusive QA database; legacy migrate-deploy failure retained in evidence.');
}finally{await db.end();}
