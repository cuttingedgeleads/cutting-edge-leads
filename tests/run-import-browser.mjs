import {spawn,execFileSync} from 'node:child_process';
import net from 'node:net';
import {writeFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {cleanup,database,email,guard} from './import-local-fixture.mjs';
guard();
if(process.argv[2] && process.argv[2]!=='production')throw Error('Browser acceptance uses production start only; build first');
for(const dir of ['.','prisma'])if(readdirSync(dir).some(f=>/^\.env(?:\.|$)/.test(f)&&f!=='.env.example'))throw Error('LOCAL_DOTENV_FORBIDDEN');
const env={};
for(const [k,v] of Object.entries(process.env))if(/^(path|systemroot|windir|comspec|temp|tmp|home|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|systemdrive|pathext)$/i.test(k))env[k]=v;
const driver=process.env.IMPORT_QA_PLAYWRIGHT_DRIVER;
if(!driver)throw Error('Set explicit test-only IMPORT_QA_PLAYWRIGHT_DRIVER to a compatible Playwright package');
Object.assign(env,{DATABASE_URL:database,IMPORT_QA_PLAYWRIGHT_DRIVER:driver,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXTAUTH_URL:'http://127.0.0.1:3181',AUTH_TRUSTED_ORIGIN:'http://127.0.0.1:3181',NEXTAUTH_SECRET:'synthetic-local-auth-secret-not-for-real-use-123456',STUDIO_IMPORT_SECRET:'synthetic-local-import-secret-1234567890',STUDIO_IMPORT_ENVIRONMENT:'qa',STUDIO_IMPORT_RECIPIENT_EMAIL:email});
const available=()=>new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(3181,'127.0.0.1',()=>s.close(()=>resolve(true)));});
if(!await available())throw Error('Port 3181 occupied; refusing unowned process');
await cleanup();
// Prove the selected package can launch its matching engines BEFORE fixtures/server.
const require=createRequire(import.meta.url),pw=require(driver);
console.log('Driver',require(driver+'/package.json').version);
for(const name of ['chromium','webkit']){const b=await pw[name].launch({headless:true,timeout:20000,env});try{console.log('Launch proof',name,b.version());}finally{await b.close();}}
const args=['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3181'];
let output='',server,child;
async function stop(p){if(!p||p.exitCode!==null)return;p.kill();await Promise.race([new Promise(r=>p.once('exit',r)),new Promise((_,reject)=>{setTimeout(()=>reject(Error('Owned PID '+p.pid+' did not exit within 8s')),8000).unref();})]);}
try{
 await cleanup();
 server=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});console.log('Owned server PID',server.pid,'127.0.0.1:3181');server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('server exited');try{const r=await fetch(env.NEXTAUTH_URL+'/api/auth/csrf',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Server readiness failed');
 if(process.platform==='win32'){const listeners=execFileSync('netstat',['-ano','-p','TCP'],{encoding:'utf8'}).split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(parts=>parts[1]?.endsWith(':3181')&&parts[3]==='LISTENING');if(listeners.length!==1||listeners[0][1]!=='127.0.0.1:3181'||Number(listeners[0][4])!==server.pid)throw Error('LISTENER_PID_OR_BIND_MISMATCH');console.log('Verified OS listener',listeners[0].join(' '));}
 const code=await new Promise((resolve,reject)=>{child=spawn(process.execPath,['--import','tsx','--test','--test-timeout=180000','--test-reporter=tap','--test-concurrency=1','tests/import-browser.test.ts','tests/import-recovery-browser.test.ts'],{env,stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});process.exitCode=code??1;
}finally{try{await stop(child);}finally{try{await stop(server);}finally{writeFileSync('.handoff-qa/browser-server.log',output);await cleanup();if(!await available())throw Error('Port 3181 still occupied after owned server exit; no unrelated process killed');console.log('Cleanup verified: fixture removed, port 3181 free');}}}
