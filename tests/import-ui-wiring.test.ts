import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Import count is rendered as a visually distinct numeric badge',()=>{
 const source=readFileSync('src/components/ImportState.tsx','utf8');
 const badge=source.slice(source.indexOf('export function ImportBadge'));
 assert.match(badge,/className="[^"]*rounded-full/);
 assert.match(badge,/className="[^"]*bg-slate-900/);
 assert.match(badge,/className="[^"]*text-white/);
});
test('Import is the last tab, preserving the other destinations in order',()=>{
 const source=readFileSync('src/components/AdminTabs.tsx','utf8');
 const tabs=source.slice(source.indexOf('const tabs = ['),source.indexOf('];'));
 assert.deepEqual([...tabs.matchAll(/href: "([^"]+)"/g)].map(m=>m[1]),[
  '/admin/leads','/admin/active-leads','/admin/contractors','/admin/purchased-leads','/admin/expired-leads','/admin/imports',
 ]);
});
test('import uses the same address control and contractor options as ordinary Create Lead',()=>{
 const source=readFileSync('src/components/LeadForm.tsx','utf8');
 assert.doesNotMatch(source,/importRequest \? <input name="address"|Select unlock limit/);
 assert.match(source,/defaultValue="1"/);
});
test('UI routes and private service-worker routing are wired',()=>{assert.match(readFileSync('src/components/ImportInbox.tsx','utf8'),/Create lead/);assert.match(readFileSync('src/components/ImportRequest.tsx','utf8'),/<LeadForm importRequest=/);assert.match(readFileSync('src/worker/sw.js','utf8'),/admin.*imports/);assert.match(readFileSync('src/app/login/page.tsx','utf8'),/safeImportReturn/);});
