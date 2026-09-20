import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  THRESHOLDS,
  DOMINANCE_THRESHOLD,
  rate,
  lcpPhases,
  inpPhases,
  dominantPhase,
  isDominant,
  nextAction,
  NEXT_ACTION,
  formatBreakdown
} from '../measure/attribution.mjs';

test('the good boundary is inclusive', () => {
  assert.equal(rate('LCP', 2500), 'good');
  assert.equal(rate('LCP', 2500.1), 'needs-improvement');
  assert.equal(rate('INP', 200), 'good');
  assert.equal(rate('INP', 200.1), 'needs-improvement');
  assert.equal(rate('CLS', 0.1), 'good');
});

test('the poor boundary is inclusive of needs-improvement', () => {
  assert.equal(rate('LCP', 4000), 'needs-improvement');
  assert.equal(rate('LCP', 4000.1), 'poor');
  assert.equal(rate('CLS', 0.25), 'needs-improvement');
  assert.equal(rate('CLS', 0.251), 'poor');
});

test('CLS is rated unitless, not in milliseconds', () => {
  assert.equal(THRESHOLDS.CLS.unit, '');
  assert.equal(rate('CLS', 0.05), 'good');
  // The mistake this guards against is sending CLS multiplied by 1000 for
  // transport and then rating the transported number.
  assert.equal(rate('CLS', 50), 'poor');
});

test('an unknown metric throws rather than guessing', () => {
  assert.throws(() => rate('SPEED_INDEX', 1000), /No thresholds defined/);
});

test('a non-numeric value throws rather than being coerced', () => {
  assert.throws(() => rate('LCP', undefined), /must be a number/);
  assert.throws(() => rate('LCP', Number.NaN), /must be a number/);
});

test('LCP phases sum to the metric and shares sum to one', () => {
  const phases = lcpPhases({
    timeToFirstByte: 210,
    resourceLoadDelay: 2640,
    resourceLoadDuration: 740,
    elementRenderDelay: 230
  });
  const total = phases.reduce((sum, p) => sum + p.ms, 0);
  assert.equal(total, 3820);
  const shares = phases.reduce((sum, p) => sum + p.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9);
});

test('missing or negative phase values become zero instead of poisoning the total', () => {
  const phases = lcpPhases({
    timeToFirstByte: 400,
    resourceLoadDelay: undefined,
    resourceLoadDuration: -5,
    elementRenderDelay: 100
  });
  assert.deepEqual(phases.map((p) => p.ms), [400, 0, 0, 100]);
  assert.equal(phases.reduce((sum, p) => sum + p.ms, 0), 500);
});

test('a zero total does not divide by zero', () => {
  const phases = inpPhases({ inputDelay: 0, processingDuration: 0, presentationDelay: 0 });
  assert.deepEqual(phases.map((p) => p.share), [0, 0, 0]);
  assert.equal(dominantPhase(phases).name, 'input delay');
});

test('the dominant phase is the largest one', () => {
  const phases = lcpPhases({
    timeToFirstByte: 210,
    resourceLoadDelay: 2640,
    resourceLoadDuration: 740,
    elementRenderDelay: 230
  });
  assert.equal(dominantPhase(phases).name, 'load delay');
  assert.ok(isDominant(dominantPhase(phases)));
});

test('a tie resolves to the earlier phase, which is upstream', () => {
  const phases = lcpPhases({
    timeToFirstByte: 500,
    resourceLoadDelay: 500,
    resourceLoadDuration: 0,
    elementRenderDelay: 0
  });
  assert.equal(dominantPhase(phases).name, 'ttfb');
});

test('spread time is not reported as a dominant phase', () => {
  const phases = lcpPhases({
    timeToFirstByte: 900,
    resourceLoadDelay: 800,
    resourceLoadDuration: 800,
    elementRenderDelay: 700
  });
  const top = dominantPhase(phases);
  assert.equal(top.name, 'ttfb');
  assert.ok(top.share < DOMINANCE_THRESHOLD);
  assert.equal(isDominant(top), false);
});

test('INP splits into the three phases in order', () => {
  const phases = inpPhases({ inputDelay: 40, processingDuration: 310, presentationDelay: 60 });
  assert.deepEqual(phases.map((p) => p.name), ['input delay', 'processing', 'presentation']);
  assert.equal(dominantPhase(phases).name, 'processing');
});

test('every phase the breakdown can produce has a next action', () => {
  const lcp = lcpPhases({
    timeToFirstByte: 1, resourceLoadDelay: 1, resourceLoadDuration: 1, elementRenderDelay: 1
  });
  const inp = inpPhases({ inputDelay: 1, processingDuration: 1, presentationDelay: 1 });
  for (const phase of [...lcp, ...inp]) {
    assert.equal(typeof nextAction(phase.name), 'string', `no next action for ${phase.name}`);
    assert.ok(nextAction(phase.name).length > 20);
  }
});

test('there are no next actions for phases the breakdown never produces', () => {
  const lcp = lcpPhases({
    timeToFirstByte: 1, resourceLoadDelay: 1, resourceLoadDuration: 1, elementRenderDelay: 1
  });
  const inp = inpPhases({ inputDelay: 1, processingDuration: 1, presentationDelay: 1 });
  const produced = new Set([...lcp, ...inp].map((p) => p.name));
  for (const name of Object.keys(NEXT_ACTION)) {
    assert.ok(produced.has(name), `NEXT_ACTION has a stale entry for ${name}`);
  }
});

test('an undefined phase name throws rather than returning undefined advice', () => {
  assert.throws(() => nextAction('hydration'), /No next action defined/);
});

test('the breakdown marks the dominant phase and names the next action', () => {
  const phases = lcpPhases({
    timeToFirstByte: 210,
    resourceLoadDelay: 2640,
    resourceLoadDuration: 740,
    elementRenderDelay: 230
  });
  const out = formatBreakdown('LCP', 3820, phases);
  assert.match(out, /\[CWV\] LCP 3820ms \(needs-improvement\)/);
  assert.match(out, /load delay\s+2640 ms\s+69%\s+<- the whole problem is here/);
  assert.equal(out.match(/<- the whole problem is here/g).length, 1);
  assert.match(out, /fetchpriority="high"/);
});

test('the breakdown refuses to point at a phase when the time is spread', () => {
  const phases = lcpPhases({
    timeToFirstByte: 900,
    resourceLoadDelay: 800,
    resourceLoadDuration: 800,
    elementRenderDelay: 700
  });
  const out = formatBreakdown('LCP', 3200, phases);
  assert.doesNotMatch(out, /<- the whole problem is here/);
  assert.match(out, /No single phase dominates/);
});

test('CLS formats to three decimal places, not as milliseconds', () => {
  const out = formatBreakdown('CLS', 0.184, []);
  assert.match(out, /\[CWV\] CLS 0\.184 \(needs-improvement\)/);
});
