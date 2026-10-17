# Core Web Vitals Checklist

Diagnosis order and fix order for LCP, INP and CLS.
A static audit of 37 catalogued findings, 11 example pairs showing a defect
beside its repair, and a test that asserts what none of it can tell you.

This is not a list of performance tips. It is the order to work in, because
the expensive mistake on a performance engagement is not applying the wrong
fix, it is applying a reasonable fix to the wrong phase of the wrong metric
and producing no movement at all.

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

## The second idea, which is the one this repository argues for

**A static finding is a hypothesis. It is never the answer.**

Every finding in the catalogue carries two sentences: what it proves, and what
it does not. The second one is the one that matters, and in most repositories
it is a paragraph near the bottom that nobody checks.

Here it is asserted. [`test/gap.test.mjs`](test/gap.test.mjs) takes every
finding that names a phase and proves, through the real arithmetic in
[`measure/attribution.mjs`](measure/attribution.mjs), that the phase it names
can fail to be the phase that dominates. The same page, the same finding, two
different sets of visits, two different next actions. It asserts the gap in
the other direction too: a dominant phase narrows the cause to a set of
candidate findings rather than to one, and the single phase in the catalogue
where it narrows to exactly one is declared as an exception and checked.

That is the whole argument for measuring first, and it is the thing a client
is actually buying when they ask what is wrong with their site.

## Diagnosis order

| Metric | Phases | Where the fix lives |
|---|---|---|
| **LCP** | TTFB, resource load delay, load duration, element render delay | Hosting, discovery, bytes, or render blocking. One of the four, rarely more. |
| **INP** | Input delay, processing duration, presentation delay | Main thread contention, handler cost, or a large synchronous paint. |
| **CLS** | Individual shift sources | Almost always something that occupied no space until it loaded. |

## Documents

| Document | What it covers |
|---|---|
| [Finding catalogue](docs/CATALOGUE.md) | Every finding the audit can report, what each proves, and what each does not |
| [01 Field data and lab data](docs/01-field-vs-lab.md) | Why a site scores 100 in Lighthouse and fails its assessment, and the 28 day lag to set expectations against |
| [02 LCP](docs/02-lcp.md) | The four-phase breakdown and the fix for each |
| [03 INP](docs/03-inp.md) | Why INP is much harder than the FID it replaced, and where it fails in practice |
| [04 CLS](docs/04-cls.md) | The six causes in order of how often they are the answer |
| [05 What this cannot tell you](docs/05-limits.md) | Where the checks and the arithmetic stop, and what only field data can settle |
| [Triage checklist](checklists/triage.md) | The working order for a whole engagement |
| [Examples index](examples/README.md) | The defect in each pair and what the corrected page still reports |

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

## Auditing a page

```
node tools/audit-page.mjs fixtures/media-elements.html
```

It reads a file and prints what the catalogue reports, with the limits
paragraph beside every finding rather than behind a flag. It does not fetch a
URL and it never will, because the moment this needs a network it stops being
something you can run on a saved page with no connection.

```
CLS  cls-layout-property-animated
  A transition or animation runs on a layout property
  where       layout shift
  evidence    .panel declares transition: height 240ms ease-out
  proves      Animating width, height, top, left or a margin makes the browser
              lay the page out again on every frame.
  cannot say  That the shift counts. Layout shifts within five hundred
              milliseconds of a user interaction are excluded from the score.
```

A page that reports nothing has not been given a clean bill of health. It has
been read by a scanner that does not run it.

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

The browser entry point is wiring and nothing else. The rating, the phase
arithmetic, the payload shape and the choice of transport all live in
[`measure/report.mjs`](measure/report.mjs), which is driven by stubs in the
test suite, and [`tools/check-entry.mjs`](tools/check-entry.mjs) fails the
build if any of it moves back into the file that imports a browser. A file
that can only be syntax checked should not be a file worth checking.

## The catalogue

There are 37 catalogued findings across 34 rules, listed in full in
[`docs/CATALOGUE.md`](docs/CATALOGUE.md), each filed under the metric and
the phase it would move. Every one of them is observed firing on a real page
in CI, and the verifier asserts the set of observed findings against the
catalogue in both directions, so a finding cannot sit in the list having never
fired and a rule cannot start reporting something nobody declared.

The rules never see markup. [`lib/collect.mjs`](lib/collect.mjs) reads the
document and decides nothing; everything under [`lib/rules/`](lib/rules/)
decides everything and has never seen a document. The verifier fails a rule
file that reaches for the raw text or for a DOM. That split is why the rules
can be driven with plain objects, and four of the defects fixed while this was
being written were found by writing those tests.

## Examples

11 example pairs, each a failing page beside a corrected one, in
[`examples/`](examples/). Both sides are audited against the whole catalogue
and compared as a set against a declaration in
[`lib/pairs.mjs`](lib/pairs.mjs).

| Metric | Examples |
|---|---|
| **LCP** | Lazy loaded hero, CSS background hero, `@import` stylesheet chain, render blocking web font |
| **CLS** | Unsized image, unreserved third party embed, banner injected after load, font swap into different metrics |
| **INP** | Handler that never yields, layout read and written in the same loop, third party script blocking the head |

**The corrected pages are not clean, and the repository says so in an
assertion rather than a footnote.** Each pair declares the exact set of
findings that survives its repair. The corrected page in example 01 still
offers one image candidate to every device. The corrected page in example 02
reports a finding the failing page could not, because moving a hero out of a
stylesheet and into an image element is what gives a rule about images
something to look at. And every corrected page in the repository still reports
`method-no-field-measurement`, because not one of them measures anything, which
is the argument of this README standing in its own test output.

Two pairs are deliberately the same problem twice. Giving a blocking font
`font-display: swap` fixes the LCP defect in example 04 and creates the CLS
defect in example 08, and the corrected page for 04 therefore carries the fix
for both.

Beyond the pairs there are 10 fixtures, which exist because a catalogue whose
entries are only exercised by the examples written alongside them is a
catalogue in which most entries have never fired. 22 of the findings here are
reached only by a fixture, and four of the defects found while building this
were in rules the example pairs never touch.

## Verifying

```
npm test        # 127 tests
npm run verify  # 171 repository assertions over the catalogue, the pairs and the fixtures
npm run count   # runs the suite and checks the test count above is the real one
npm run check   # the browser entry point is wiring only
```

`npm test` covers the attribution arithmetic, the reporter, the collector, the
rules, and the gap between the two halves. `npm run verify` asserts the
repository invariants: that every catalogued finding has fired, that every pair
and fixture reports exactly its declared set in both directions, that the rules
have stayed out of the markup, that the thresholds quoted above are the
thresholds the code uses, that every generated file matches its source, and
that no file contains an em dash or an en dash.

The last of the 171 repository assertions is that the number printed beside
the command is the number of assertions that ran, counting itself. The same
holds for the 127 tests: `npm run count` reads them from the structured event
stream that `node:test` emits rather than from reporter output, because
reporter output changes between Node versions and a counter that parses it is
a counter with an expiry date.

Everything runs on Node 20, 22 and 24 in CI on every push to `main`, with a
separate job that installs on the declared engines floor exactly. Nothing here
needs a network, an API key, a browser, or a single dependency.

## Licence

MIT.
