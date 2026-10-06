import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lcpPhases, inpPhases } from '../measure/attribution.mjs';

/* collect-web-vitals.js runs in a browser and imports web-vitals from a CDN,
   so it cannot be executed here. What can be checked without a network is
   that it asks for the right build and reads fields that build actually
   has. Both have been wrong before: the bare package URL loaded the standard
   build, which has no attribution at all, and the LCP element was read
   under its version 5 name from a version 4 import. Either mistake passes
   every other test in this repository and logs undefined in production. */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'measure', 'collect-web-vitals.js'), 'utf8');

/* Attribution fields per metric, copied from the type definitions shipped
   in web-vitals 4.2.4 (dist/modules/types/lcp.d.ts, inp.d.ts, cls.d.ts).
   Moving the import to another major means checking those files again and
   adding an entry here; the first test fails until that is done. */
const FIELDS = {
  4: {
    LCP: ['element', 'url', 'timeToFirstByte', 'resourceLoadDelay',
      'resourceLoadDuration', 'elementRenderDelay', 'navigationEntry',
      'lcpResourceEntry', 'lcpEntry'],
    INP: ['interactionTarget', 'interactionTargetElement', 'interactionTime',
      'nextPaintTime', 'interactionType', 'processedEventEntries',
      'longAnimationFrameEntries', 'inputDelay', 'processingDuration',
      'presentationDelay', 'loadState'],
    CLS: ['largestShiftTarget', 'largestShiftTime', 'largestShiftValue',
      'largestShiftEntry', 'largestShiftSource', 'loadState']
  }
};

const importMatch = /from\s+'([^']*web-vitals@(\d+)[^']*)'/.exec(source);
const major = importMatch ? Number(importMatch[2]) : null;

test('the collector imports the attribution build of a known major version', () => {
  assert.ok(importMatch, 'collect-web-vitals.js imports web-vitals with a pinned major');
  assert.match(importMatch[1], /\/dist\/web-vitals\.attribution\.js/);
  assert.ok(FIELDS[major], `no attribution field list recorded for web-vitals ${major}`);
});

// The body of each on<Metric>((metric) => { ... }); callback.
function callbackBody(metric) {
  const match = new RegExp(`on${metric}\\(\\(metric\\) => \\{([\\s\\S]*?)\\n\\}\\);`).exec(source);
  assert.ok(match, `collect-web-vitals.js has an on${metric} callback`);
  return match[1];
}

function fieldsRead(body) {
  const read = new Set();
  for (const m of body.matchAll(/metric\.attribution\.(\w+)/g)) read.add(m[1]);
  // The CLS callback aliases the attribution object as `a`.
  if (/const a = metric\.attribution;/.test(body)) {
    for (const m of body.matchAll(/\ba\.(\w+)/g)) read.add(m[1]);
  }
  return [...read];
}

function assertFieldsExist(metric) {
  const known = FIELDS[major]?.[metric] ?? [];
  const read = fieldsRead(callbackBody(metric));
  assert.ok(read.length > 0, `the ${metric} callback reads at least one attribution field`);
  const unknown = read.filter((name) => !known.includes(name));
  assert.deepEqual(unknown, [], `fields not in web-vitals ${major} ${metric} attribution`);
}

// Declared one per metric rather than in a loop, because tools/verify.mjs
// counts an indented test() as one declared per example pair.
test('every LCP attribution field the collector logs exists in that version', () => assertFieldsExist('LCP'));
test('every INP attribution field the collector logs exists in that version', () => assertFieldsExist('INP'));
test('every CLS attribution field the collector logs exists in that version', () => assertFieldsExist('CLS'));

// Records every property the phase functions read from the object they are
// given, so the arithmetic module is held to the same field list.
function readsOf(fn) {
  const seen = new Set();
  fn(new Proxy({}, { get: (target, key) => { seen.add(key); return 0; } }));
  return [...seen];
}

test('the LCP and INP phase breakdowns read only real attribution fields', () => {
  const lcpUnknown = readsOf(lcpPhases).filter((k) => !FIELDS[major]?.LCP.includes(k));
  const inpUnknown = readsOf(inpPhases).filter((k) => !FIELDS[major]?.INP.includes(k));
  assert.deepEqual(lcpUnknown, []);
  assert.deepEqual(inpUnknown, []);
});
