#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   audit-page.mjs

   Run the catalogue over a file and print what it reports.

     node tools/audit-page.mjs fixtures/media-elements.html
     node tools/audit-page.mjs path/to/saved-page.html

   It reads a file. It does not fetch a URL, and it will not, because the
   moment this repository needs a network to tell you anything it stops
   being something you can run on an aeroplane with a saved page and start
   being a service.

   The limits paragraph is printed with every finding rather than hidden
   behind a flag, because the finding on its own is a hypothesis.
   --------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';

import { audit } from '../lib/audit.mjs';

const path = process.argv[2];

if (!path) {
  console.error('Usage: node tools/audit-page.mjs <file.html>');
  process.exit(2);
}

const reported = audit(readFileSync(path, 'utf8'));

if (reported.length === 0) {
  console.log(`${path}: nothing reported.`);
  console.log('That is not the same as nothing wrong. Deploy measure/collect-web-vitals.js and read the field data.');
  process.exit(0);
}

console.log(`${path}: ${reported.length} finding(s).\n`);

for (const f of reported) {
  const times = f.occurrences > 1 ? ` (${f.occurrences} times)` : '';
  console.log(`${f.metric}  ${f.id}${times}`);
  console.log(`  ${f.title}`);
  console.log(`  where       ${f.phase}`);
  console.log(`  evidence    ${f.evidence}`);
  console.log(`  proves      ${f.proves}`);
  console.log(`  cannot say  ${f.doesNotProve}`);
  console.log('');
}

console.log('None of the above has measured anything. Which of them is worth an');
console.log('afternoon is decided by the phase breakdown from real visits, not by');
console.log('this list. See docs/01-field-vs-lab.md.');
