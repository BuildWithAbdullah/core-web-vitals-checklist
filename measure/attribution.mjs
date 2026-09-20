/* ---------------------------------------------------------------------------
   attribution.mjs

   The pure part of the field measurement script: thresholds, phase
   breakdowns, which phase dominates, and what to do about it. No DOM, no
   network, no dependencies, so it can be unit tested in Node.

   collect-web-vitals.js imports this and supplies the live attribution
   objects from the web-vitals library. Everything here is arithmetic on
   numbers the library already produced.
   --------------------------------------------------------------------------- */

/* Assessment thresholds. Google assesses at the 75th percentile of real
   Chrome visits over a rolling 28 day window, and a metric is "good" only if
   it is at or below the good threshold. The boundary is inclusive: an LCP of
   exactly 2500ms is good, 2501ms is not. */
export const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' }
};

export function rate(name, value) {
  const t = THRESHOLDS[name];
  if (!t) throw new Error(`No thresholds defined for metric ${name}`);
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Value for ${name} must be a number, received ${String(value)}`);
  }
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

/* LCP splits into four consecutive phases that sum to the metric. The whole
   diagnosis is which one dominates, because the four have four unrelated
   fixes. */
export function lcpPhases(attribution) {
  return normalise([
    ['ttfb', attribution.timeToFirstByte],
    ['load delay', attribution.resourceLoadDelay],
    ['load duration', attribution.resourceLoadDuration],
    ['render delay', attribution.elementRenderDelay]
  ]);
}

/* INP splits into three. Input delay is contention before the handler runs,
   processing is the handler itself, presentation is the paint afterwards. */
export function inpPhases(attribution) {
  return normalise([
    ['input delay', attribution.inputDelay],
    ['processing', attribution.processingDuration],
    ['presentation', attribution.presentationDelay]
  ]);
}

function normalise(pairs) {
  const clean = pairs.map(([name, ms]) => [name, toFiniteNonNegative(ms)]);
  const total = clean.reduce((sum, [, ms]) => sum + ms, 0);
  return clean.map(([name, ms]) => ({
    name,
    ms,
    share: total === 0 ? 0 : ms / total
  }));
}

function toFiniteNonNegative(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/* The phase with the largest share. Ties resolve to the earlier phase,
   because the phases are consecutive and the earlier one is upstream of the
   later one: fixing it can shrink both. */
export function dominantPhase(phases) {
  if (!Array.isArray(phases) || phases.length === 0) return null;
  return phases.reduce((best, p) => (p.ms > best.ms ? p : best), phases[0]);
}

/* A phase only deserves to be called the cause when it is actually carrying
   the metric. Below this share the honest answer is that the time is spread
   and there is no single fix. */
export const DOMINANCE_THRESHOLD = 0.4;

export function isDominant(phase, threshold = DOMINANCE_THRESHOLD) {
  return Boolean(phase) && phase.share >= threshold;
}

/* One next action per phase. Every phase name produced by lcpPhases and
   inpPhases has an entry here, and a test asserts that, so the mapping
   cannot silently fall behind the breakdown. */
export const NEXT_ACTION = {
  'ttfb': 'Server response, caching, redirect chains or a blocking third party. Nothing about images will help.',
  'load delay': 'The browser found out about the resource late. Check loading="lazy" on the hero, a CSS background image as the LCP element, or content injected by JavaScript. Add fetchpriority="high".',
  'load duration': 'The resource itself is too heavy or too slow to arrive. Format, dimensions, compression, CDN.',
  'render delay': 'The bytes arrived and the browser could not paint. Render blocking CSS, a blocking font, or JavaScript hydration in front of the paint.',
  'input delay': 'The main thread was busy when the interaction arrived. Long tasks from third party scripts and hydration are the usual owners.',
  'processing': 'The handler itself is too slow. Break the work up and yield, or move it off the interaction entirely.',
  'presentation': 'The paint after the handler is expensive. Usually a large synchronous layout or a re-render of more of the page than changed.'
};

export function nextAction(phaseName) {
  const action = NEXT_ACTION[phaseName];
  if (!action) throw new Error(`No next action defined for phase ${phaseName}`);
  return action;
}

/* The readable block the browser console prints and the README shows. The
   arrow marks the dominant phase, and it is absent when no phase clears the
   dominance threshold, because pointing at a 30 percent phase as "the
   problem" is how an afternoon gets wasted. */
export function formatBreakdown(name, value, phases) {
  const t = THRESHOLDS[name];
  const rating = rate(name, value);
  const shown = t.unit === 'ms' ? `${Math.round(value)}ms` : value.toFixed(3);
  const top = dominantPhase(phases);
  const marked = isDominant(top) ? top.name : null;

  const width = Math.max(...phases.map((p) => p.name.length));
  const lines = phases.map((p) => {
    const label = p.name.padEnd(width, ' ');
    const ms = `${Math.round(p.ms)} ms`.padStart(8, ' ');
    const pct = `${Math.round(p.share * 100)}%`.padStart(4, ' ');
    const flag = p.name === marked ? '   <- the whole problem is here' : '';
    return `  ${label}  ${ms}  ${pct}${flag}`;
  });

  const footer = marked
    ? nextAction(marked)
    : 'No single phase dominates. The time is spread, so there is no one fix.';

  return [`[CWV] ${name} ${shown} (${rating})`, ...lines, `  ${footer}`].join('\n');
}
