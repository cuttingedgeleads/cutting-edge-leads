import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync,readdirSync,openSync,closeSync,unlinkSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import net from 'node:net';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const mode=process.argv[2] || 'gate';
if(!['gate','test','build'].includes(mode)) throw new Error('Use gate, test or build; standalone unowned servers are not supported');
// Allowlist OS plumbing only. Never inherit application/provider/database/NODE_OPTIONS config.
const env={};
for(const [key,value] of Object.entries(process.env)) if(/^(path|systemroot|windir|comspec|temp|tmp|home|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|systemdrive|pathext)$/i.test(key)) env[key]=value;
Object.assign(env,{DATABASE_URL:'postgresql://leads_qa@127.0.0.1:55474/leads_auth_qa',NEXTAUTH_SECRET:randomBytes(48).toString('hex'),NEXTAUTH_URL:'http://127.0.0.1:3100',AUTH_TRUSTED_ORIGIN:'http://127.0.0.1:3100',RESEND_API_KEY:'',PASSWORD_RESET_EMAIL_TRANSPORT:'resend',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
const url=new URL(env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='55474'||url.pathname!=='/leads_auth_qa'||url.username!=='leads_qa'||url.password) throw new Error('LOCAL_DATABASE_GUARD');
if([cwd,join(cwd,'prisma')].some(dir=>readdirSync(dir).some(x=>/^\.env(?:\.|$)/.test(x)&&x!=='.env.example'))) throw new Error('Remove local dotenv files before isolated QA; their contents are never read');
const evidence=resolve(cwd,process.env.AUTH_QA_EVIDENCE_DIR || '.auth-qa');mkdirSync(evidence,{recursive:true});
const lock=join(cwd,'.auth-qa.lock');const fd=openSync(lock,'wx');closeSync(fd);
const report={status:'running',mode,steps:[],server:null,cleanup:false};let server;let active;let failed=false;
const sanitize=s=>s.split(env.NEXTAUTH_SECRET).join('[LOCAL_SECRET]').replace(/(passwordHash|password|csrfToken|sessionToken|token)["']?\s*[:=]\s*["']?[^\s,}]+/gi,'$1=[REDACTED]');
function launch(name,args){
 const child=spawn(process.execPath,args,{cwd,env,stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',b=>{output+=b.toString();});child.stderr.on('data',b=>{output+=b.toString();});
 const done=new Promise(resolve=>{child.on('error',()=>resolve(1));child.on('close',code=>{writeFileSync(join(evidence,name+'.log'),sanitize(output));resolve(code??1);});});
 return {child,done,getOutput:()=>output};
}
async function run(name,args){const start=Date.now();const task=launch(name,args);active=task.child;const code=await task.done;active=undefined;
 const out=task.getOutput();const pass=Number(out.match(/# pass (\d+)/)?.[1]??0),fail=Number(out.match(/# fail (\d+)/)?.[1]??0);
 report.steps.push({name,code,passed:pass,failed:fail,durationMs:Date.now()-start,log:name+'.log'});console.log(`${name}: ${code===0?'PASS':'FAIL'} (${pass} tests passed, ${fail} failed)`);if(code!==0) throw new Error(name+' failed');}
function portOpen(){return new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:3100});s.setTimeout(500);s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.once('timeout',()=>{s.destroy();resolve(false);});});}
async function ready(){const end=Date.now()+45000;while(Date.now()<end){if(server.child.exitCode!==null) throw new Error('server exited');try{const r=await fetch(env.NEXTAUTH_URL+'/api/auth/csrf',{signal:AbortSignal.timeout(1500)});if(r.ok&&typeof (await r.json()).csrfToken==='string')return;}catch{}await new Promise(r=>setTimeout(r,150));}throw new Error('readiness timeout');}
const testArgs=files=>['--import','tsx','--test','--test-timeout=120000','--test-reporter=tap','--test-concurrency=1',...files];
const signals=()=>{active?.kill();server?.child.kill();failed=true;};process.on('SIGINT',signals);process.on('SIGTERM',signals);
// Generated SW outputs are build artifacts. Preserve tracked checkout bytes rather than churn them.
const generated=readdirSync(join(cwd,'public')).filter(x=>/^(sw\.js|workbox-.*\.js|worker-.*\.js)(\.map)?$/.test(x));
const snapshots=new Map(generated.map(x=>[x,readFileSync(join(cwd,'public',x))]));
try {
 if(await portOpen()) throw new Error('Port 3100 occupied; will not stop or reuse an unowned server');
 await run('generate',['node_modules/prisma/build/index.js','generate']);
 if(mode!=='build')await run('aggregate',testArgs(readdirSync(join(cwd,'tests')).filter(x=>/^auth-.*\.test\.(ts|mjs)$/.test(x)&&x!=='auth-http.test.ts').map(x=>'tests/'+x)));
 await run('tsc',['node_modules/typescript/bin/tsc','--noEmit']);
 if(mode!=='test') {
  await run('build',['node_modules/next/dist/bin/next','build','--webpack']);
  if(mode==='gate') {
   server=launch('server',['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100']);report.server={pid:server.child.pid,command:'next start --hostname 127.0.0.1 --port 3100'};
   await ready();await run('http-browser',testArgs(['tests/auth-http.test.ts']));
  }
 }
 if(failed)throw new Error('interrupted');report.status='passed';
}catch(error){failed=true;report.status='failed';report.failure=error.message;console.error(error.message);}
finally {
 if(server){server.child.kill();await Promise.race([server.done,new Promise(r=>setTimeout(r,10000))]);report.cleanup=server.child.exitCode!==null||server.child.signalCode!==null;report.portClosed=!await portOpen();if(!report.cleanup||!report.portClosed){failed=true;report.status='failed';}}
 else report.cleanup=true;
 for(const file of readdirSync(join(cwd,'public')).filter(x=>/^(sw\.js|workbox-.*\.js|worker-.*\.js)(\.map)?$/.test(x)))if(!snapshots.has(file))unlinkSync(join(cwd,'public',file));
 for(const [file,bytes]of snapshots)writeFileSync(join(cwd,'public',file),bytes);
 if(existsSync(lock))unlinkSync(lock);
 writeFileSync(join(evidence,'gate-result.json'),JSON.stringify(report,null,2)+'\n');
}
process.exitCode=failed?1:0;
