import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {deepmerge}=require('deepmerge-ts');
const serialize=createRequire(require.resolve('rollup-plugin-terser'))('serialize-javascript');

test('Prisma configuration merger preserves cyclic graphs without exhausting the stack',()=>{
 const input={value:1}; input.self=input;
 const other={flag:true}; other.self=other;
 const merged=deepmerge(input,other);
 assert.equal(merged.value,1); assert.equal(merged.flag,true); assert.equal(merged.self.value,1);
 assert.deepEqual(deepmerge({nested:{a:1},items:[1]},{nested:{b:2},items:[2]}),{nested:{a:1,b:2},items:[1,2]});
});

test('PWA serializer rejects or safely encodes hostile Date output without executing it',()=>{
 const value=new Date('2020-01-01T00:00:00Z'); value.toISOString=()=> '\"), "x": (globalThis.executed = true), "y": new Date(\"';
 const sandbox={executed:false};
 try { const encoded=serialize({value}); vm.runInNewContext('('+encoded+')',sandbox,{timeout:1000}); } catch (e) { assert.ok(e instanceof Error || typeof e==='object'); }
 assert.equal(sandbox.executed,false);
 const safe=serialize({value:new Date('2020-01-01T00:00:00Z'),regex:/safe/gi});
 assert.equal(vm.runInNewContext('('+safe+').value.toISOString()',{}, {timeout:1000}),'2020-01-01T00:00:00.000Z');
});
