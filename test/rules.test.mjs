import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { audit, findingIds } from '../lib/audit.mjs';
import { pairs } from '../lib/pairs.mjs';
import { fixtures } from '../fixtures/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readExample = (id, file) => readFileSync(join(root, 'examples', id, `${file}.html`), 'utf8');
const readFixture = (file) => readFileSync(join(root, 'fixtures', file), 'utf8');

const sorted = (list) => [...list].sort();

/* The pairs and the fixtures are asserted as sets in both directions. A
   rule that stops reporting is caught by one direction and a rule that
   starts reporting something new is caught by the other, and the second is
   the one a repository usually misses. */

for (const pair of pairs) {
  test(`${pair.id}: the failing page reports exactly its declared findings`, () => {
    assert.deepEqual(sorted(findingIds(readExample(pair.id, 'fail'))), sorted(pair.onFail));
  });

  test(`${pair.id}: the corrected page reports exactly its declared residual`, () => {
    assert.deepEqual(sorted(findingIds(readExample(pair.id, 'pass'))), sorted(pair.onPass));
  });

  test(`${pair.id}: the primary finding is present before the fix and gone after it`, () => {
    assert.ok(pair.onFail.includes(pair.primary), `${pair.primary} is not in the failing set`);
    assert.ok(!pair.onPass.includes(pair.primary), `${pair.primary} survives the fix`);
  });
}

for (const fixture of fixtures) {
  test(`${fixture.file}: reports exactly its declared findings`, () => {
    assert.deepEqual(sorted(findingIds(readFixture(fixture.file))), sorted(fixture.expect));
  });
}

test('every finding carries evidence and its catalogue text', () => {
  const reported = audit(readFixture('media-elements.html'));
  assert.ok(reported.length > 5);
  for (const f of reported) {
    assert.ok(typeof f.evidence === 'string' && f.evidence.length > 0, `${f.id} reported no evidence`);
    assert.ok(f.doesNotProve.length > 60, `${f.id} lost its limits text on the way out`);
    assert.ok(f.rule.length > 0);
  }
});

test('repeated occurrences of one finding collapse to one entry', () => {
  const html = `<body>
    <img src="/a.png" alt="a"><img src="/b.png" alt="b"><img src="/c.png" alt="c">
  </body>`;
  const reported = audit(html).filter((f) => f.id === 'cls-image-without-dimensions');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].occurrences, 3);
});

test('findings come back in catalogue order whatever order the rules ran in', () => {
  const reported = findingIds(readFixture('media-elements.html'));
  const metrics = reported.map((id) => id.split('-')[0]);
  const firstCls = metrics.indexOf('cls');
  const lastLcp = metrics.lastIndexOf('lcp');
  assert.ok(lastLcp < firstCls, 'the LCP findings should all precede the CLS findings');
  assert.equal(metrics.at(-1), 'method');
});

test('an empty document reports only that it measures nothing', () => {
  assert.deepEqual(findingIds('<!doctype html><html><head></head><body></body></html>'),
    ['method-no-field-measurement']);
});

test('a page with no body element is still read', () => {
  /* The region split looks for a body tag. A fragment has none, and
     everything in it has to count as body rather than silently as head,
     or every rule that asks for body elements reports nothing. */
  assert.ok(findingIds('<img src="/a.png" alt="a">').includes('cls-image-without-dimensions'));
});
