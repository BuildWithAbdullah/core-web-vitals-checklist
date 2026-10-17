#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   verify.mjs

   What makes this repository something other than a set of opinions.

   It asserts that every catalogued finding has been observed firing on a
   real page, that every example pair and every fixture reports exactly the
   set of findings it declares and no other, that every corrected page's
   residual set is the one written down, that the rules have stayed free of
   raw markup, that the thresholds quoted in the README are the thresholds
   the code uses, and that the generated files have not drifted from the
   source they are generated from.

   The set assertions run in both directions on purpose. One direction
   catches a rule that has stopped reporting. The other catches a rule that
   has started reporting something new, which is the direction a repository
   usually misses, because a new finding on a page nobody is looking at
   looks exactly like no finding at all.

   No dependencies. Run it with `npm run verify`, or `node tools/verify.mjs`.
   `--write` regenerates the generated index instead of asserting it.
   --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findings, finding, ids as catalogueIds, PHASES } from '../lib/catalogue.mjs';
import { rules, findingIds } from '../lib/audit.mjs';
import { pairs } from '../lib/pairs.mjs';
import { fixtures } from '../fixtures/index.mjs';
import { buildCatalogue } from './catalogue.mjs';
import { trackedTextFiles } from './tracked.mjs';
import { THRESHOLDS } from '../measure/attribution.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = join(root, 'examples');
const fixturesDir = join(root, 'fixtures');
const write = process.argv.includes('--write');

const results = [];
let failures = 0;

function assert(condition, label, detail) {
  results.push({ ok: Boolean(condition), label, detail });
  if (!condition) failures += 1;
}

function assertSame(actual, expected, label) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  const missing = b.filter((x) => !a.includes(x));
  const extra = a.filter((x) => !b.includes(x));
  const detail = (missing.length || extra.length)
    ? `${missing.length ? `never reported: ${missing.join(', ')}. ` : ''}${extra.length ? `reported and not declared: ${extra.join(', ')}.` : ''}`
    : undefined;
  assert(missing.length === 0 && extra.length === 0, label, detail);
}

const read = (path) => readFileSync(path, 'utf8');
const observed = new Set();

/* --- 1. Every pair reports exactly what it declares, both ways ---------- */

for (const pair of pairs) {
  const dir = join(examplesDir, pair.id);
  const failPath = join(dir, 'fail.html');
  const passPath = join(dir, 'pass.html');

  if (!existsSync(failPath) || !existsSync(passPath)) {
    assert(false, `${pair.id}: has both fail.html and pass.html`);
    continue;
  }

  const onFail = findingIds(read(failPath));
  const onPass = findingIds(read(passPath));
  for (const id of [...onFail, ...onPass]) observed.add(id);

  assertSame(onFail, pair.onFail, `${pair.id}/fail reports exactly its declared findings`);
  assertSame(onPass, pair.onPass, `${pair.id}/pass reports exactly its declared residual`);
  assert(pair.onFail.includes(pair.primary),
    `${pair.id}: the primary finding is present before the fix`);
  assert(!pair.onPass.includes(pair.primary),
    `${pair.id}: the primary finding is gone after the fix`);
}

/* --- 2. Every fixture reports exactly what it declares, both ways -------- */

for (const fixture of fixtures) {
  const path = join(fixturesDir, fixture.file);
  if (!existsSync(path)) {
    assert(false, `fixture ${fixture.file} exists`);
    continue;
  }
  const reported = findingIds(read(path));
  for (const id of reported) observed.add(id);
  assertSame(reported, fixture.expect, `${fixture.file} reports exactly its declared findings`);
  assert(fixture.about.length > 20, `${fixture.file} says what it is for`);
}

/* --- 3. The directories and the declarations are the same sets ----------- */

const dirs = readdirSync(examplesDir)
  .filter((name) => statSync(join(examplesDir, name)).isDirectory());
assertSame(dirs, pairs.map((p) => p.id), 'every example directory has a pair and every pair has a directory');

const fixtureFiles = readdirSync(fixturesDir).filter((n) => n.endsWith('.html'));
assertSame(fixtureFiles, fixtures.map((f) => f.file), 'every fixture file is declared and every declaration has a file');

/* --- 4. Every catalogued finding has been seen firing -------------------- */

assertSame(observed, catalogueIds,
  'every catalogued finding fires on a real page and every finding that fires is catalogued');

/* Per rule, so the report names the rule that has gone quiet rather than
   only the finding. A rule that declares a finding it can no longer emit is
   the most common way a catalogue rots. */
for (const rule of rules) {
  const unseen = rule.emits.filter((id) => !observed.has(id));
  assert(unseen.length === 0, `rule ${rule.id}: every finding it declares is observed`,
    unseen.length ? `never observed: ${unseen.join(', ')}` : undefined);
}

/* --- 5. The catalogue entries are complete ------------------------------- */

for (const f of findings) {
  const problems = [];
  if (f.proves.length < 60) problems.push('proves is too short');
  if (f.doesNotProve.length < 60) problems.push('doesNotProve is too short');
  if (!PHASES[f.metric]?.includes(f.phase)) problems.push(`${f.metric} has no phase ${f.phase}`);
  if (f.proves === f.doesNotProve) problems.push('the limits sentence repeats the proves sentence');
  assert(problems.length === 0, `${f.id}: the catalogue entry is complete`, problems.join('; '));
}

/* --- 6. The rules have stayed out of the markup -------------------------- */

/* The collector reads documents and decides nothing; the rules decide
   everything and never see a document. The split is what makes the rules
   testable with plain objects, and it only holds if something checks it. */
const rulesDir = join(root, 'lib', 'rules');
for (const file of readdirSync(rulesDir).filter((n) => n.endsWith('.mjs'))) {
  const body = read(join(rulesDir, file));
  const breaches = [];
  if (/\bdoc\s*\.\s*html\b/.test(body)) breaches.push('reads the raw document');
  if (/\bdocument\s*\./.test(body)) breaches.push('reaches for a DOM');
  if (/from\s+'[^']*tools\/html\.mjs'/.test(body)) breaches.push('imports the HTML scanner');
  assert(breaches.length === 0, `lib/rules/${file} decides without parsing`, breaches.join('; '));
}

/* --- 7. The README thresholds are the code thresholds -------------------- */

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
  assert(parse(match) === THRESHOLDS[metric].good,
    `README good threshold for ${metric} matches the code`,
    `README says ${parse(match)}, code says ${THRESHOLDS[metric].good}`);
}

/* --- 8. Every document the README links to exists ------------------------ */

const links = [...readme.matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
for (const link of new Set(links)) {
  assert(existsSync(join(root, link)), `README link resolves: ${link}`);
}

/* --- 9. Every test file is in the test script ---------------------------- */

const pkg = JSON.parse(read(join(root, 'package.json')));
const testFiles = readdirSync(join(root, 'test')).filter((n) => n.endsWith('.test.mjs'));
const missingFromScript = testFiles.filter((f) => !pkg.scripts.test.includes(`test/${f}`));
assert(missingFromScript.length === 0,
  'every test file is named in the npm test script',
  missingFromScript.length ? `not run: ${missingFromScript.join(', ')}` : undefined);

/* --- 10. The counts the README quotes are the real ones ------------------ */

function quotedNumbers(shape) {
  return [...readme.matchAll(shape)].map((m) => Number(m[1]));
}

const COUNTS = [
  [/(\d+) catalogued findings/g, findings.length, 'catalogued findings', 2],
  [/(\d+) rules/g, rules.length, 'rules', 1],
  [/(\d+) example pairs/g, pairs.length, 'example pairs', 2],
  [/(\d+) fixtures/g, fixtures.length, 'fixtures', 1]
];

for (const [shape, actual, name, atLeast] of COUNTS) {
  const found = quotedNumbers(shape);
  const wrong = found.filter((n) => n !== actual);
  assert(found.length >= atLeast && wrong.length === 0,
    `the README states ${name} correctly everywhere it states it`,
    found.length < atLeast
      ? `stated ${found.length} time(s), expected at least ${atLeast}`
      : (wrong.length ? `README says ${[...new Set(found)].join(' and ')}, there are ${actual}` : undefined));
}

/* --- 11. No em dashes or en dashes, anywhere ----------------------------- */

/* Built from code points so this file does not itself contain the
   characters it is banning, and read through the ignore rules so a
   node_modules that happens to be present cannot fail it. */
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const offenders = trackedTextFiles(root)
  .filter((p) => { const body = read(p); return body.includes(EM) || body.includes(EN); })
  .map((p) => relative(root, p));

assert(offenders.length === 0, 'no em dashes or en dashes in any tracked text file',
  offenders.length ? offenders.join(', ') : undefined);

/* --- 12. The generated files have not drifted --------------------------- */

const generated = [
  [join(root, 'docs', 'CATALOGUE.md'), buildCatalogue(), 'node tools/catalogue.mjs'],
  [join(examplesDir, 'README.md'), buildIndex(), 'node tools/verify.mjs --write']
];

for (const [path, content, command] of generated) {
  const name = relative(root, path);
  if (write) {
    writeFileSync(path, content);
    console.log(`Wrote ${name}`);
    continue;
  }
  const current = existsSync(path) ? read(path) : null;
  assert(current === content, `${name} is up to date with its source`,
    current === content ? undefined : `run \`${command}\` to regenerate it`);
}

/* --- 13. The assertion total, including this assertion ------------------- */

/* The figure beside the command in the README has to be the figure a reader
   gets when they run it, which means the comparison has to count itself.
   Every occurrence of the shape is read rather than the first one, and all
   of them have to agree, because a number corrected in one place and
   forgotten in another is the failure this is here to catch. */
const total = results.length + 1;
const statedAssertions = quotedNumbers(/(\d+) repository assertions/g);
const wrongAssertions = statedAssertions.filter((n) => n !== total);
assert(statedAssertions.length >= 2 && wrongAssertions.length === 0,
  'the assertion count in the README is the number of assertions that run',
  statedAssertions.length < 2
    ? `the README states it ${statedAssertions.length} time(s), it should state it at least twice`
    : (wrongAssertions.length ? `README says ${[...new Set(statedAssertions)].join(' and ')}, this run made ${total}` : undefined));

/* --- report -------------------------------------------------------------- */

for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.label}`);
  if (r.detail) console.log(`       ${r.detail}`);
}

console.log('');
console.log(`${results.length - failures} passed, ${failures} failed, ${results.length} repository assertions`);
console.log(`${findings.length} catalogued findings, ${rules.length} rules, ${pairs.length} example pairs, ${fixtures.length} fixtures`);
process.exit(failures === 0 ? 0 : 1);

/* --- the generated examples index ---------------------------------------- */

function buildIndex() {
  /* Driven by the pairs and the catalogue rather than by a second list of
     detectors kept alongside them. There used to be one: eleven checks in
     tools/checks.mjs, one per example, with their own titles and their own
     limits text. Two detection systems in one repository is two systems
     that can disagree about the same page, and the one nobody runs is the
     one that rots. */
  const byMetric = new Map();
  for (const pair of pairs) {
    const primary = finding(pair.primary);
    const entry = { id: pair.id, title: primary.title, phase: primary.phase, pair, primary };
    if (!byMetric.has(primary.metric)) byMetric.set(primary.metric, []);
    byMetric.get(primary.metric).push(entry);
  }

  const lines = [
    '# Examples',
    '',
    `${pairs.length} defects, each as a failing page and a corrected one. Every page is`,
    'audited in CI against the full finding catalogue in',
    '[`lib/catalogue.mjs`](../lib/catalogue.mjs), and the result is compared as a',
    'set against the declaration in [`lib/pairs.mjs`](../lib/pairs.mjs): what the',
    'failing page reports, and what the corrected page still reports afterwards.',
    '',
    'That second set is the one worth reading. A corrected page here is not',
    'clean. It is repaired of one named defect, and what it still carries is',
    'written down rather than left out.',
    '',
    'This file is generated by `node tools/verify.mjs --write`. Edit the source,',
    'not the table.',
    ''
  ];

  for (const [metric, group] of byMetric) {
    lines.push(`## ${metric}`, '');
    lines.push('| Example | Phase | Primary finding | Still reported on the corrected page |');
    lines.push('|---|---|---|---|');
    for (const entry of group) {
      const residual = entry.pair.onPass.map((id) => `\`${id}\``).join(', ');
      lines.push(`| [${entry.title}](${entry.id}/) | ${entry.phase} | \`${entry.pair.primary}\` | ${residual} |`);
    }
    lines.push('');
  }

  lines.push('## The limit that applies to all of them', '');
  lines.push('Every rule here is static. It reads markup and stylesheets and looks for');
  lines.push('a shape. None of them measures anything, none of them runs the page, and');
  lines.push('none of them can tell you whether the defect it found is costing you');
  lines.push('anything on real visits. That is what the field data in');
  lines.push('[`measure/`](../measure/) is for, and [`test/gap.test.mjs`](../test/gap.test.mjs)');
  lines.push('asserts it rather than asking you to take it on trust.');
  lines.push('');

  return lines.join('\n');
}
