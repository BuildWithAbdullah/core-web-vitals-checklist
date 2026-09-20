#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   verify.mjs

   What makes this repository something other than a set of opinions.

   It asserts that every failing example actually exhibits the defect it
   claims to, that every corrected example is clean under every check in the
   repository rather than only its own, that the thresholds quoted in the
   README are the thresholds the code uses, and that the example index has
   not drifted from the checks it describes.

   No dependencies. Run it with `npm run verify`, or `node tools/verify.mjs`.
   `--write` regenerates the generated index instead of asserting it.
   --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checks } from './checks.mjs';
import { THRESHOLDS } from '../measure/attribution.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = join(root, 'examples');
const write = process.argv.includes('--write');

const results = [];
let failures = 0;

function assert(condition, label, detail) {
  results.push({ ok: Boolean(condition), label, detail });
  if (!condition) failures += 1;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

/* --- 1. Every check fires on its failing example ------------------------- */

for (const check of checks) {
  const dir = join(examplesDir, check.id);
  if (!existsSync(dir)) {
    assert(false, `${check.id}: example directory exists`);
    continue;
  }

  const failPath = join(dir, 'fail.html');
  const passPath = join(dir, 'pass.html');

  if (!existsSync(failPath) || !existsSync(passPath)) {
    assert(false, `${check.id}: has both fail.html and pass.html`);
    continue;
  }

  const onFail = check.detect(read(failPath));
  assert(onFail.found, `${check.id}: the defect is present in fail.html`,
    onFail.found ? onFail.evidence : 'the detector did not fire, so the example proves nothing');

  const onPass = check.detect(read(passPath));
  assert(!onPass.found, `${check.id}: the defect is gone from pass.html`,
    onPass.found ? `still detected: ${onPass.evidence}` : undefined);
}

/* --- 2. No corrected example carries anyone else's defect ---------------- */

for (const check of checks) {
  const passPath = join(examplesDir, check.id, 'pass.html');
  if (!existsSync(passPath)) continue;
  const html = read(passPath);
  const tripped = checks
    .filter((other) => other.id !== check.id)
    .map((other) => ({ other, result: other.detect(html) }))
    .filter(({ result }) => result.found)
    .map(({ other }) => other.id);

  assert(tripped.length === 0,
    `${check.id}/pass.html is clean under all eleven checks`,
    tripped.length ? `also trips ${tripped.join(', ')}` : undefined);
}

/* --- 3. Every example directory belongs to a check ----------------------- */

const dirs = readdirSync(examplesDir)
  .filter((name) => statSync(join(examplesDir, name)).isDirectory())
  .sort();
const ids = checks.map((c) => c.id).sort();
assert(
  dirs.length === ids.length && dirs.every((d, i) => d === ids[i]),
  'every example directory has a check and every check has a directory',
  `directories: ${dirs.join(', ')}`
);

/* --- 4. The README thresholds are the code thresholds -------------------- */

const readme = read(join(root, 'README.md'));

const quoted = [
  ['LCP', /\|\s*LCP\s*\|\s*([\d.]+)s or less\s*\|/, (m) => Number(m[1]) * 1000],
  ['INP', /\|\s*INP\s*\|\s*(\d+)ms or less\s*\|/, (m) => Number(m[1])],
  ['CLS', /\|\s*CLS\s*\|\s*([\d.]+) or less\s*\|/, (m) => Number(m[1])]
];

for (const [metric, pattern, parse] of quoted) {
  const match = pattern.exec(readme);
  if (!match) {
    assert(false, `README quotes a good threshold for ${metric}`);
    continue;
  }
  const inReadme = parse(match);
  assert(inReadme === THRESHOLDS[metric].good,
    `README good threshold for ${metric} matches the code`,
    `README says ${inReadme}, code says ${THRESHOLDS[metric].good}`);
}

/* --- 5. Every document the README links to exists ------------------------ */

const links = [...readme.matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
for (const link of new Set(links)) {
  assert(existsSync(join(root, link)), `README link resolves: ${link}`);
}

/* --- 5b. The test count quoted in the README is the real one ------------- */

const testFiles = readdirSync(join(root, 'test')).filter((n) => n.endsWith('.test.mjs'));
let declared = 0;
for (const file of testFiles) {
  const body = read(join(root, 'test', file));
  const plain = (body.match(/^\s*test\(/gm) || []).length;
  // Three of the example tests are declared inside a loop over the checks,
  // so they run once per pair.
  const looped = (body.match(/^\s{2}test\(/gm) || []).length;
  declared += plain - looped + looped * checks.length;
}

const quotedTests = /npm test\s+#\s*(\d+) tests/.exec(readme);
assert(quotedTests !== null, 'README quotes a test count');
if (quotedTests) {
  assert(Number(quotedTests[1]) === declared,
    'the test count in the README is the number of tests that exist',
    Number(quotedTests[1]) === declared ? undefined
      : `README says ${quotedTests[1]}, the suite declares ${declared}`);
}

/* --- 6. No em dashes or en dashes, anywhere ------------------------------ */

// Built from code points so this file does not itself contain the
// characters it is banning.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const textFiles = walk(root).filter((p) => /\.(md|mjs|js|html|yml|json)$/.test(p));
const offenders = textFiles.filter((p) => {
  const body = read(p);
  return body.includes(EM) || body.includes(EN);
}).map((p) => relative(root, p));

assert(offenders.length === 0, 'no em dashes or en dashes in any tracked text file',
  offenders.length ? offenders.join(', ') : undefined);

/* --- 7. The example index has not drifted from the checks ---------------- */

const index = buildIndex();
const indexPath = join(examplesDir, 'README.md');

if (write) {
  writeFileSync(indexPath, index);
  console.log(`Wrote ${relative(root, indexPath)}`);
} else {
  const current = existsSync(indexPath) ? read(indexPath) : null;
  assert(current === index,
    'examples/README.md is up to date with checks.mjs',
    current === index ? undefined : 'run `node tools/verify.mjs --write` to regenerate it');
}

/* --- report -------------------------------------------------------------- */

for (const r of results) {
  const mark = r.ok ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${r.label}`);
  if (r.detail) console.log(`       ${r.detail}`);
}

console.log('');
console.log(`${results.length - failures} passed, ${failures} failed, ${checks.length} example pairs`);
process.exit(failures === 0 ? 0 : 1);

/* --- helpers ------------------------------------------------------------- */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function buildIndex() {
  const byMetric = new Map();
  for (const check of checks) {
    if (!byMetric.has(check.metric)) byMetric.set(check.metric, []);
    byMetric.get(check.metric).push(check);
  }

  const lines = [
    '# Examples',
    '',
    'Eleven defects, each as a failing page and a corrected one. A static',
    'detector in [`tools/checks.mjs`](../tools/checks.mjs) asserts in CI that the',
    'defect is present in `fail.html` and absent from `pass.html`, and that no',
    '`pass.html` carries any of the other ten defects.',
    '',
    'This file is generated by `node tools/verify.mjs --write`. Edit the checks,',
    'not the table.',
    ''
  ];

  for (const [metric, group] of byMetric) {
    lines.push(`## ${metric}`, '');
    lines.push('| Example | Phase | What the detector proves | What it does not prove |');
    lines.push('|---|---|---|---|');
    for (const c of group) {
      lines.push(`| [${c.title}](${c.id}/) | ${c.phase} | ${c.proves} | ${c.doesNotProve} |`);
    }
    lines.push('');
  }

  lines.push('## The limit that applies to all of them', '');
  lines.push('Every check here is static. It reads markup and stylesheets and looks for');
  lines.push('a shape. None of them measures anything, none of them runs the page, and');
  lines.push('none of them can tell you whether the defect it found is costing you');
  lines.push('anything on real visits. That is what the field data in');
  lines.push('[`measure/`](../measure/) is for. Use these to know what to look for and');
  lines.push('what the fix is. Use attribution to know whether it is worth doing.');
  lines.push('');

  return lines.join('\n');
}
