import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checks, checkById } from '../tools/checks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = join(root, 'examples');
const read = (id, file) => readFileSync(join(examplesDir, id, file), 'utf8');

/* tools/verify.mjs is the CI entry point and prints a report. These tests
   assert the same properties through node --test, so a contributor running
   `npm test` in an editor sees a broken example immediately rather than
   after pushing. */

for (const check of checks) {
  test(`${check.id}: the defect is present in fail.html`, () => {
    assert.equal(check.detect(read(check.id, 'fail.html')).found, true);
  });

  test(`${check.id}: the defect is absent from pass.html`, () => {
    assert.equal(check.detect(read(check.id, 'pass.html')).found, false);
  });

  test(`${check.id}: pass.html carries none of the other defects`, () => {
    const html = read(check.id, 'pass.html');
    for (const other of checks) {
      if (other.id === check.id) continue;
      assert.equal(other.detect(html).found, false,
        `${check.id}/pass.html also trips ${other.id}`);
    }
  });
}

test('every check documents what it does not prove', () => {
  for (const check of checks) {
    assert.ok(check.proves.length > 40, `${check.id} has no proves text`);
    assert.ok(check.doesNotProve.length > 40, `${check.id} has no limits text`);
    assert.ok(['LCP', 'INP', 'CLS'].includes(check.metric));
  }
});

test('example directories and checks are the same set', () => {
  const dirs = readdirSync(examplesDir)
    .filter((n) => statSync(join(examplesDir, n)).isDirectory())
    .sort();
  assert.deepEqual(dirs, checks.map((c) => c.id).sort());
});

test('looking up an unknown check throws', () => {
  assert.throws(() => checkById('99-not-a-check'), /No check with id/);
  assert.equal(checkById('05-unsized-image').metric, 'CLS');
});
