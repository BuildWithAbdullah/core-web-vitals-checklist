# Core Web Vitals Checklist

Diagnosis order and fix order for LCP, INP and CLS.

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
| [Triage checklist](checklists/triage.md) | The working order for a whole engagement |

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
[CWV] LCP 3820ms (poor)
  element         img.hero__image
  ttfb            210 ms
  load delay      2640 ms      <- the whole problem is here
  load duration   740 ms
  render delay    230 ms
```

A breakdown like that says the browser found out about the hero far too late,
which is a `loading="lazy"` attribute or a CSS background image, not a
compression problem.

## Licence

MIT.
