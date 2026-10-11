import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {safeImportReturn} from '../src/lib/import-navigation';
const origin='https://www.cuttingedgeleads.net';
// Execute the actual worker body in a worker-API harness; only Workbox imports are stubbed.
function worker(warm:boolean){const handlers:Record<string,Function>={},calls:string[]=[];const self={location:{origin},__WB_MANIFEST:[],addEventListener:(n:string,f:Function)=>handlers[n]=f,clients:{matchAll:async()=>warm?[{url:origin+'/admin',navigate:async(url:string)=>{calls.push('navigate '+url);return {focus:async()=>calls.push('focus')};}}]:[],openWindow:async(url:string)=>calls.push('open '+url)}};
 vm.runInNewContext(readFileSync('src/worker/sw.js','utf8').replace(/^import .*;\r?\n/gm,''),{self,URL,precacheAndRoute:()=>{},registerRoute:()=>{},NetworkOnly:class {}});
 return {calls,async click(url:string){let result:Promise<unknown>|undefined;handlers.notificationclick({notification:{data:{url},close:()=>calls.push('close')},waitUntil:(p:Promise<unknown>)=>result=p});await result;}};}
test('actual notificationclick worker: warm navigation/focus and cold exact import open',async()=>{for(const warm of [true,false]){const w=worker(warm);await w.click('/admin/imports/opaque_123');assert.deepEqual(w.calls,['close',`${warm?'navigate':'open'} ${origin}/admin/imports/opaque_123`,...(warm?['focus']:[])]);}});
test('actual notificationclick rejects unsafe origins, credentials, protocols and invalid import paths',async()=>{for(const url of ['https://evil.invalid/admin/imports/a','//evil.invalid/x','javascript:alert(1)','data:text/html,x','https://user:pass@www.cuttingedgeleads.net/admin/imports/a','/admin/imports/a?redirect=evil','/admin/imports/a#x','/admin/imports/a/b','/admin/imports/%2f%2fevil']){const w=worker(false);await w.click(url);assert.deepEqual(w.calls,['close'],url);}});
test('notification destination retains exact validated login continuation; manifest identity unchanged',()=>{assert.equal(safeImportReturn('/admin/imports/opaque_123'),'/admin/imports/opaque_123');const paths=execFileSync('git',['ls-tree','-r','--name-only','HEAD'],{encoding:'utf8'}).split('\n').filter(p=>/(?:\.webmanifest|manifest.*\.(?:json|ts))$/.test(p));assert.ok(paths.length);for(const path of paths)assert.equal(readFileSync(path,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','HEAD:'+path],{encoding:'utf8'}).replace(/\r\n/g,'\n'));});
