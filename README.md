# Core Web Vitals Checklist

Diagnosis order and fix order for LCP, INP and CLS, with eleven failing and
corrected example pairs checked in CI and a tested field measurement script.

This is not a list of performance tips. It is the order to work in, because the
expensive mistake on a performance engagement is not applying the wrong fix, it
is applying a reasonable fix to the wrong phase of the wrong metric and
producing no movement at all.

## The one idea

**Every metric is a sum of phases. Get the breakdown before you fix anything.**

LCP is not "the hero image is slow". It is time to first byte, plus how late
the browser discovered the resource, plus how long the resource took, plus how
long the browser then took to paint it. Those four have four unrelated fixes.
Compressing the hero on a site where 80 percent of LCP is server response time
changes nothing, and it is the single most common wasted afternoon in this
work.

[`measure/collect-web-vitals.js`](measure/collect-web-vitals.js) logs the
breakdown for all three metrics using the web-vitals attribution build. Deploy
it before changing anything.

## Diagnosis order

| Metric | Phases | Where the fix lives |
|---|---|---|
| **LCP** | TTFB, resource load delay, load duration, element render delay | Hosting, discovery, bytes, or render blocking. One of the four, rarely more. |
| **INP** | Input delay, processing duration, presentation delay | Main thread contention, handler cost, or a large synchronous paint. |
| **CLS** | Individual shift sources | Almost always something that occupied no space until it loaded. |

## Documents

| Document | What it covers |
|---|---|
| [01 Field data and lab data](docs/01-field-vs-lab.md) | Why a site scores 100 in Lighthouse and fails its assessment, and the 28 day lag to set expectations against |
| [02 LCP](docs/02-lcp.md) | The four-phase breakdown and the fix for each |
| [03 INP](docs/03-inp.md) | Why INP is much harder than the FID it replaced, and where it fails in practice |
| [04 CLS](docs/04-cls.md) | The six causes in order of how often they are the answer |
| [05 What this cannot tell you](docs/05-limits.md) | Where the checks and the arithmetic stop, and what only field data can settle |
| [Triage checklist](checklists/triage.md) | The working order for a whole engagement |
| [Examples index](examples/README.md) | Eleven defects, each as a failing page and a corrected one |

## Thresholds

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | 2.5s or less | 2.5s to 4.0s | over 4.0s |
| INP | 200ms or less | 200ms to 500ms | over 500ms |
| CLS | 0.1 or less | 0.1 to 0.25 | over 0.25 |

Assessed at the 75th percentile of real Chrome visits over a rolling 28 day
window. All three must pass.

## Three things that decide most engagements

**Lighthouse cannot measure INP.** There is no user in a lab run, so there is
nothing to interact with. Lighthouse reports Total Blocking Time instead, which
is a related proxy and not the same metric. If INP is the failing metric, and
since March 2024 it very often is, a lab score tells you almost nothing.

**Assessment is at p75, not the average.** The 75th percentile is driven by the
slower quarter of visits, which is usually a different population on different
hardware. Improving the median can leave the assessment untouched.

**Field data lags four weeks.** CrUX is a rolling 28 day window. Say this
before the work starts, or a client checking Search Console the next morning
will reasonably conclude nothing happened. Your own RUM, filtered to post-deploy
visits, is how you show the improvement in the meantime.

## Measuring

```html
<script type="module">
  import './collect-web-vitals.js';
</script>
```

With no endpoint configured it logs a readable breakdown to the console, so it
is useful immediately on any site you are diagnosing. Set `ENDPOINT` to collect
properly.

```
[CWV] LCP 3820ms (needs-improvement)
  ttfb             210 ms    5%
  load delay      2640 ms   69%   <- the whole problem is here
  load duration    740 ms   19%
  render delay     230 ms    6%
  The browser found out about the resource late. Check loading="lazy" on the
  hero, a CSS background image as the LCP element, or content injected by
  JavaScript. Add fetchpriority="high".
  element   img.hero__image
```

A breakdown like that says the browser found out about the hero far too late,
which is a `loading="lazy"` attribute or a CSS background image, not a
compression problem.

The arrow is not always there. When no phase reaches 40 percent of the total
the report says that no single phase dominates, because naming a 30 percent
phase as the cause is how an afternoon gets spent for no movement.

3820ms is `needs-improvement`, not `poor`. The boundaries are inclusive and
they are in one place, [`measure/attribution.mjs`](measure/attribution.mjs),
which the thresholds table above is checked against in CI.

## Examples

Eleven defects, each as a failing page beside a corrected one, in
[`examples/`](examples/). Every pair is checked in CI: a static detector
asserts that the defect is present in `fail.html`, absent from `pass.html`,
and that no corrected page carries any of the other ten defects.

| Metric | Examples |
|---|---|
| **LCP** | Lazy loaded hero, CSS background hero, `@import` stylesheet chain, render blocking web font |
| **CLS** | Unsized image, unreserved third party embed, banner injected after load, font swap into different metrics |
| **INP** | Handler that never yields, layout read and written in the same loop, third party script blocking the head |

Two of them are deliberately the same problem twice. Giving a blocking font
`font-display: swap` fixes the LCP defect in example 04 and creates the CLS
defect in example 08, and the corrected page for 04 therefore carries the fix
for both. That pairing is the most common way a performance engagement moves
a number sideways.

Each detector states what finding it proves and, more usefully, what it does
not. The checks are static: they read markup, they do not measure anything,
and they cannot tell you whether the defect they found is costing you
anything on real visits. [`docs/05-limits.md`](docs/05-limits.md) is the
longer version of that caveat.

## Verifying

```
npm test      # 54 tests: the attribution arithmetic, and every example pair
npm run verify   # the example pairs and the repository invariants
```

`npm test` unit tests [`measure/attribution.mjs`](measure/attribution.mjs):
threshold boundaries, phases summing to the metric, missing phase values
becoming zero rather than poisoning the total, ties resolving to the upstream
phase, and every phase the breakdown can produce having a documented next
action.

`npm run verify` runs the example pairs and the repository invariants: that
the thresholds quoted in the table above are the thresholds the code uses,
that every document linked from this README exists, that the generated
examples index has not drifted from the checks it describes, and that no file
contains an em dash or an en dash. It also asserts that the test count quoted
two paragraphs above is the number of tests that exist, because a README that
is checked is worth more than a README that is careful.

Both run on Node 18, 20 and 22 in CI on every push to `main`. Neither needs a
network, an API key, or a browser.

## Licence

MIT.
