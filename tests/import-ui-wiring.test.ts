import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Import count is rendered as a visually distinct numeric badge',()=>{
 const source=readFileSync('src/components/ImportState.tsx','utf8');
 const badge=source.slice(source.indexOf('export function ImportBadge'));
 assert.match(badge,/className="[^"]*rounded-full/);
 assert.match(badge,/className="[^"]*bg-slate-900/);
 assert.match(badge,/className="[^"]*text-white/);
});
test('UI routes and private service-worker routing are wired',()=>{assert.match(readFileSync('src/components/ImportInbox.tsx','utf8'),/Saved requests/);assert.match(readFileSync('src/components/ImportRequest.tsx','utf8'),/Save request/);assert.match(readFileSync('src/worker/sw.js','utf8'),/admin.*imports/);assert.match(readFileSync('src/app/login/page.tsx','utf8'),/safeImportReturn/);});
