import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { verifyImport } from '../src/lib/import-wire';

const secret = 'synthetic-bom-regression-key-only-32';
const now = 1800000000;
export function signedVerify(raw: Buffer) {
  const timestamp = String(now);
  const signature = createHmac('sha256', secret)
    .update(timestamp + '.')
    .update(raw)
    .digest('hex');
  return verifyImport(
    raw,
    timestamp,
    signature,
    { secret, environment: 'qa' },
    now,
  );
}

function body() {
  return Buffer.from(
    JSON.stringify(
      {
        version: 1,
        source: 'command-studio',
        environment: 'qa',
        transferId: randomUUID(),
        sourceRecordId: randomUUID(),
        sourceRevision: '',
        sourceActor: '',
        customerName: 'José 🌿',
        customerPhone: '',
        customerEmail: '',
        address: '123 Synthetic',
        formattedAddress: '',
        city: '',
        state: '',
        postalCode: '',
        inquiryNotes: 'Unicode 内部 \uFEFF context',
        estimatorNotes: '',
        salesNotes: '',
        sourcePhotoCount: 0,
      },
      null,
      2,
    ) + '\n',
  );
}

async function renderer() {
  // Execute the actual components and React renderer; only hook data, navigation
  // and the unrelated publish form are controlled. No copied JSON/render logic.
  const result = await build({
    stdin: {
      contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {ImportInbox} from './src/components/ImportInbox';
      import {ImportRequest} from './src/components/ImportRequest';
      import {setRecord} from './src/components/ImportState';
      export function render(record) {
        setRecord(record);
        return [() => renderToStaticMarkup(<ImportInbox/>),
          () => renderToStaticMarkup(<ImportRequest id={record.id}/> )];
      }`,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    external: ['react', 'react-dom/server', 'react/jsx-runtime'],
    plugins: [
      {
        name: 'controlled-render-data',
        setup(b) {
          b.onResolve(
            { filter: /(?:ImportState|LeadForm)$|^next\/link$/ },
            (args) => ({
              path: args.path.split('/').pop()!,
              namespace: 'fixture',
            }),
          );
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            loader: 'js',
            contents: args.path.endsWith('ImportState')
              ? `let record; export const setRecord=r=>record=r;
          export const importsChanged=()=>{};
          export function usePrivateImport(url){return {owner:'synthetic', data:url.includes('?')?{waitingCount:1,total:1,items:[record]}:record};}`
              : args.path.endsWith('LeadForm')
                ? `const React=require('react'); export const LeadForm=({importRequest})=>React.createElement('output',{'data-prefill':JSON.stringify(importRequest.data)},importRequest.data.name);`
                : `const React=require('react'); export default function Link({children,prefetch,...props}){return React.createElement('a',props,children);}`,
          }));
        },
      },
    ],
  });
  const module = {
    exports: {} as { render: (record: object) => (() => string)[] },
  };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  return (raw: Buffer, reviewedData: Record<string,string> | null = null) =>
    module.exports.render({
      id: 'synthetic',
      status: 'waiting',
      version: 0,
      originalPayload: raw.toString('utf8'),
      reviewedData,
      leadId: null,
    });
}

test('actual tiles/editor render exact accepted Unicode bytes; signed leading BOM is rejected', async () => {
  const raw = body();
  const original = Buffer.from(raw);
  const verified = signedVerify(raw);
  assert.equal(
    verified.payloadSha256,
    createHash('sha256').update(raw).digest('hex'),
  );
  assert.deepEqual(raw, original);
  const render = await renderer();
  for (const component of render(raw)) assert.match(component(), /José 🌿/);
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw]);
  // Discriminate the real historical failure, not merely an arbitrary invalid body.
  for (const component of render(bom)) assert.throws(component, SyntaxError);
  assert.throws(() => signedVerify(bom), { status: 400 });
});

test('inbox has one Create lead action into the existing tab, without workflow filters', async () => {
  const render = await renderer();
  const [inbox] = render(body());
  const html = inbox();
  assert.match(html, /href="\/admin\/leads\?importId=synthetic"[^>]*>Create lead<\/a>/);
  assert.doesNotMatch(html, />Waiting<|>Saved requests<|>Published<|Choose Create lead to load/);
  assert.equal((html.match(/>Create lead<\/a>/g) || []).length, 1);
  assert.match(html, /José 🌿/);
  assert.match(html, /Unicode 内部/);
  assert.match(html, /<button[^>]*>Delete<\/button>/, 'each import tile has a Delete control');
});

test('import carries source notes into the editable description for explicit review', async () => {
  const render = await renderer();
  const [, editor] = render(body());
  const html = editor();
  assert.match(html, /data-prefill=/);
  assert.match(html, /&quot;name&quot;:&quot;José 🌿&quot;/);
  assert.ok(html.includes('&quot;description&quot;:&quot;Unicode 内部 '+String.fromCharCode(0xfeff)+' context&quot;'));
  assert.match(html, /Unicode 内部/);
  assert.doesNotMatch(html, />Save request<|>Review &amp; publish</);
});

test('import renders only the existing form without extra context or instruction copy', async () => {
  const render = await renderer();
  const [, editor] = render(body());
  const html = editor();
  assert.doesNotMatch(html, /<aside|Back to Import|Private Studio|Original address|Full address|photos remain|Review the imported|Nothing is published/);
  assert.match(html, /<output/);
});

function prefilled(html: string) {
  const encoded = /data-prefill="([^"]*)"/.exec(html)![1];
  return JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}

test('import uses street and city fields, not the full mailing address, and defaults to one contractor', async () => {
  const render = await renderer();
  const p = {...JSON.parse(body().toString()), address: '123 Synthetic Street, Metairie',
    formattedAddress: '123 Synthetic Street, Metairie, LA 70001, USA', city: '', state: 'LA', postalCode: '70001',
    inquiryNotes: 'First note\nSecond line', estimatorNotes: 'Estimator note', salesNotes: 'Sales note'};
  const [,editor] = render(Buffer.from(JSON.stringify(p)));
  const data = prefilled(editor());
  assert.equal(data.address, '123 Synthetic Street');
  assert.equal(data.city, 'Metairie');
  assert.equal(data.unlockLimit, '1');
  assert.equal(data.description, 'First note\nSecond line\n\nEstimator note\n\nSales note');
  assert.equal(data.state, 'LA'); assert.equal(data.zip, '70001');
});

test('prefill preserves explicit reviewed edits and contractor choice without changing receipt data', async () => {
  const render = await renderer();
  const reviewed = { name: 'Reviewed', email: '', phone: '', address: '456 Reviewed Street', city: 'Kenner', state: 'LA', zip: '70065', description: '', jobType: 'Other', price: '15', unlockLimit: '2' };
  const copy = {...reviewed};
  const [,editor] = render(body(), reviewed);
  assert.deepEqual(prefilled(editor()), {...reviewed, description: JSON.parse(body().toString()).inquiryNotes});
  assert.deepEqual(reviewed, copy);
  const edited = {...reviewed, description: 'Explicitly reviewed description'};
  const [,editedEditor] = render(body(), edited);
  assert.deepEqual(prefilled(editedEditor()), edited);
});

test('prefill preserves street-only and empty addresses, units and original note formatting', async () => {
  const render = await renderer();
  const cases = [
    {address:'',formattedAddress:'',city:'',street:'',locality:''},
    {address:'123 Synthetic Street, Apt 4',formattedAddress:'123 Synthetic Street, Apt 4',city:'',street:'123 Synthetic Street, Apt 4',locality:''},
    {address:'123 Synthetic Street Metairie LA 70001 USA',formattedAddress:'123 Synthetic Street, Metairie, LA 70001, USA',city:'',street:'123 Synthetic Street',locality:'Metairie'},
    {address:'123 Synthetic Street',formattedAddress:'',city:'',street:'123 Synthetic Street',locality:''},
    {address:'123 Synthetic Street, Apt 4, Metairie, LA 70001, USA',formattedAddress:'',city:'',street:'123 Synthetic Street, Apt 4',locality:'Metairie'},
    {address:'123 Synthetic Street',formattedAddress:'123 Synthetic Street, Kenner, LA 70065, USA',city:'',street:'123 Synthetic Street',locality:'Kenner'},
  ];
  for (const c of cases) {
    const raw=Buffer.from(JSON.stringify({...JSON.parse(body().toString()),...c}));
    const [,editor]=render(raw);const data=prefilled(editor());
    assert.equal(data.address,c.street);assert.equal(data.city,c.locality);
    assert.equal(data.unlockLimit,'1');assert.equal(data.description,JSON.parse(body().toString()).inquiryNotes);
  }
});

test('correctly signed malformed UTF-8 remains rejected', () => {
  const raw = body();
  const offset = raw.indexOf(Buffer.from('José'));
  const invalid = Buffer.concat([
    raw.subarray(0, offset),
    Buffer.from([0xc3, 0x28]),
    raw.subarray(offset + 1),
  ]);
  assert.throws(() => signedVerify(invalid), { status: 400 });
});
