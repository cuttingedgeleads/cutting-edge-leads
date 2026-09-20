import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
test('patched same-major authentication dependencies', () => {
  assert.equal(require('next/package.json').version, '16.3.5');
  assert.equal(require('../node_modules/next-auth/package.json').version, '4.24.15');
  assert.equal(require('../node_modules/eslint-config-next/package.json').version, '16.3.5');
  assert.equal(require('../node_modules/nodemailer/package.json').version, '10.0.10');
  assert.equal(require('../node_modules/sharp/package.json').version, '0.35.4');
});
