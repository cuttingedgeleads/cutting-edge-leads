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
  return (raw: Buffer) =>
    module.exports.render({
      id: 'synthetic',
      status: 'waiting',
      version: 0,
      originalPayload: raw.toString('utf8'),
      reviewedData: null,
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
  assert.doesNotMatch(html, />Waiting<|>Saved requests<|>Published</);
  assert.equal((html.match(/>Create lead<\/a>/g) || []).length, 1);
  assert.match(html, /José 🌿/);
  assert.match(html, /Unicode 内部/);
});

test('import immediately supplies the existing create form, retaining private notes outside its description', async () => {
  const render = await renderer();
  const [, editor] = render(body());
  const html = editor();
  assert.match(html, /data-prefill=/);
  assert.match(html, /&quot;name&quot;:&quot;José 🌿&quot;/);
  assert.match(html, /&quot;description&quot;:&quot;&quot;/);
  assert.match(html, /Unicode 内部/);
  assert.doesNotMatch(html, />Save request<|>Review &amp; publish</);
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
