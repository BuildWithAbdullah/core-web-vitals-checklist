#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   check-entry.mjs

   The browser entry point imports the web-vitals library from a URL, so it
   cannot be imported in Node and no test can drive it. The answer to that
   is not to syntax check it and call the box ticked. A syntax check proves
   the braces match.

   The answer is that the file holds no logic worth checking: it wires a
   reporter that is driven by stubs in test/report.test.mjs. This tool
   asserts the wiring, and asserts that the file has stayed thin, because
   the day a calculation moves back into it is the day it stops being
   covered by anything.
   --------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as report from '../measure/report.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = readFileSync(join(root, 'measure', 'collect-web-vitals.js'), 'utf8');

const problems = [];
const code = entry.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function require_(condition, message) {
  if (!condition) problems.push(message);
}

/* 1. It uses the attribution build. The bare package URL resolves to the
      standard build, where metric.attribution is undefined, and the first
      callback throws before logging anything. */
require_(/web-vitals\.attribution\.js/.test(code),
  'the entry point does not import the attribution build');

/* 2. Every reporter function it names is actually exported. */
const used = [...code.matchAll(/reporter\s*\.\s*(\w+)/g)].map((m) => m[1]);
require_(used.length >= 4, 'the entry point wires fewer than four callbacks');
for (const name of new Set(used)) {
  require_(typeof report.createReporter({}, {})[name] === 'function',
    `the entry point calls reporter.${name}, which report.mjs does not provide`);
}

/* 3. Every metric the library reports is wired to something. */
for (const hook of ['onLCP', 'onINP', 'onCLS', 'onTTFB', 'onFCP']) {
  require_(new RegExp(`${hook}\\s*\\(`).test(code), `${hook} is imported and never used`);
}

/* 4. It has stayed thin. Arithmetic, formatting and threshold comparisons
      belong in report.mjs and attribution.mjs, where tests can reach them. */
const LOGIC = [
  [/Math\s*\./, 'arithmetic'],
  [/\.toFixed\s*\(/, 'number formatting'],
  [/JSON\s*\.\s*stringify/, 'payload serialisation'],
  [/sendBeacon/, 'transport selection'],
  [/padStart|padEnd/, 'output formatting'],
  [/[<>]=?\s*\d/, 'a threshold comparison']
];
for (const [pattern, what] of LOGIC) {
  require_(!pattern.test(code),
    `the entry point now contains ${what}, which no test can reach. Move it into measure/report.mjs.`);
}

if (problems.length > 0) {
  console.error('The browser entry point failed its contract:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log('The browser entry point is wiring only, and every callback it names exists.');
