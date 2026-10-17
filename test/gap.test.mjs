import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findings, PHASES } from '../lib/catalogue.mjs';
import {
  lcpPhases, inpPhases, dominantPhase, isDominant, nextAction, DOMINANCE_THRESHOLD
} from '../measure/attribution.mjs';

/* ---------------------------------------------------------------------------
   The claim this repository is built on, asserted instead of written down.

   Every finding in the catalogue carries a sentence saying it has not
   measured anything and cannot say whether the defect is costing anything.
   That sentence is the most important thing in the repository and it was,
   until this file existed, the one thing nothing checked.

   What it asserts is a gap in both directions. A static finding does not
   tell you which phase is carrying the metric, and a phase carrying the
   metric does not tell you which finding caused it. Neither half is a
   claim about a tool being bad. It is the reason the two halves of this
   repository exist separately, and the reason the working order is to
   measure first.

   The breakdowns below are constructed rather than collected, and that is
   the honest scope of the test: it asserts what the arithmetic in
   attribution.mjs admits, which is what makes the implication unsound. It
   does not assert how often each outcome happens in the field, which no
   test in a repository with no network could tell you.
   --------------------------------------------------------------------------- */

const LCP_PHASE_FIELDS = {
  'ttfb': 'timeToFirstByte',
  'load delay': 'resourceLoadDelay',
  'load duration': 'resourceLoadDuration',
  'render delay': 'elementRenderDelay'
};

const INP_PHASE_FIELDS = {
  'input delay': 'inputDelay',
  'processing': 'processingDuration',
  'presentation': 'presentationDelay'
};

function breakdownWhere(metric, dominant, share) {
  const fields = metric === 'LCP' ? LCP_PHASE_FIELDS : INP_PHASE_FIELDS;
  const names = Object.keys(fields);
  const others = names.filter((n) => n !== dominant);
  const rest = (1 - share) / others.length;

  const attribution = { [fields[dominant]]: Math.round(share * 4000) };
  for (const name of others) attribution[fields[name]] = Math.round(rest * 4000);

  return metric === 'LCP' ? lcpPhases(attribution) : inpPhases(attribution);
}

const MEASURABLE = findings.filter((f) => f.metric === 'LCP' || f.metric === 'INP');

test('the catalogue reaches both metrics that have phases', () => {
  assert.ok(MEASURABLE.length >= 20, 'too few findings to make this test mean anything');
  assert.ok(MEASURABLE.some((f) => f.metric === 'LCP'));
  assert.ok(MEASURABLE.some((f) => f.metric === 'INP'));
});

for (const f of MEASURABLE) {
  test(`${f.id}: its phase can dominate and can fail to dominate`, () => {
    const dominates = breakdownWhere(f.metric, f.phase, 0.7);
    const top = dominantPhase(dominates);
    assert.equal(top.name, f.phase);
    assert.equal(isDominant(top), true);

    /* The same finding, on a page where the time is somewhere else. The
       breakdown names a different phase, so the next action is a different
       next action, and the finding is the same finding. */
    const elsewhere = PHASES[f.metric].find((p) => p !== f.phase);
    const doesNot = breakdownWhere(f.metric, elsewhere, 0.7);
    const other = dominantPhase(doesNot);
    assert.equal(other.name, elsewhere);
    assert.notEqual(other.name, f.phase);
    assert.notEqual(nextAction(other.name), nextAction(f.phase));
  });
}

test('one finding set, two field outcomes, two different next actions', () => {
  /* This is the sentence. The static reading of the page is identical in
     both columns, because it is the same page. The only thing that differs
     is what the visits did, and it is the only thing that decides what to
     do on Monday. */
  const slowServer = breakdownWhere('LCP', 'ttfb', 0.72);
  const lateDiscovery = breakdownWhere('LCP', 'load delay', 0.72);

  const a = dominantPhase(slowServer);
  const b = dominantPhase(lateDiscovery);

  assert.notEqual(a.name, b.name);
  assert.notEqual(nextAction(a.name), nextAction(b.name));
  assert.match(nextAction(a.name), /Nothing about images will help/);
  assert.match(nextAction(b.name), /found out about the resource late/);
});

test('a spread breakdown names no phase at all', () => {
  /* Four phases at a quarter each. Naming the largest of those as the cause
     is how an afternoon gets spent for no movement, so the dominance
     threshold refuses to name one. */
  const even = breakdownWhere('LCP', 'ttfb', 0.25);
  const top = dominantPhase(even);
  assert.equal(isDominant(top), false);
  assert.ok(top.share < DOMINANCE_THRESHOLD);
});

test('attribution narrows the cause to a set rather than to one finding', () => {
  /* The other direction. Knowing which phase dominates leaves every
     finding filed under that phase as a candidate, and for all but one
     phase in the catalogue that is more than one candidate. The exception
     is declared rather than tolerated, and it is asserted as an exception:
     if a second time to first byte finding is added, this test goes red and
     the sentence above it has to change. */
  const SINGLETONS = ['ttfb'];
  const counted = new Map();
  for (const f of MEASURABLE) {
    counted.set(f.phase, (counted.get(f.phase) ?? 0) + 1);
  }

  const singletons = [...counted.entries()].filter(([, n]) => n === 1).map(([p]) => p).sort();
  assert.deepEqual(singletons, SINGLETONS);

  for (const [phase, n] of counted) {
    if (SINGLETONS.includes(phase)) continue;
    assert.ok(n > 1, `${phase} maps to a single finding, so the set above needs updating`);
  }

  assert.equal(counted.get('load delay') > 1, true);
});

test('every phase a finding names is a phase the breakdown produces', () => {
  for (const f of findings) {
    assert.ok(PHASES[f.metric].includes(f.phase),
      `${f.id} names the phase ${f.phase}, which ${f.metric} does not have`);
  }
});
