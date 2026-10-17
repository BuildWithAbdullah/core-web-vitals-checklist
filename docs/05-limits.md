# What this repository cannot tell you

Everything here is either arithmetic on numbers your own visitors produced,
or a static reading of markup. Neither of those is a measurement of your
site. The gap between the two is where most wasted performance work happens,
so it is worth being precise about where it sits.

## The rules do not measure anything, and this is asserted

The rules behind the 37 findings in [`docs/CATALOGUE.md`](CATALOGUE.md) read
HTML and CSS and look for a shape. A rule that finds `loading="lazy"` on the
first image of a page has found a real defect worth fixing. It has not
established that the image is the LCP element on a real visit, that the page
is slow, or that removing the attribute will move the metric.

That sentence is the kind that sits in a document like this one and is never
checked, so here it is checked. [`test/gap.test.mjs`](../test/gap.test.mjs)
takes every finding that names a phase and proves against the real
arithmetic in [`measure/attribution.mjs`](../measure/attribution.mjs) that
the phase it names can fail to dominate: the same page, the same finding,
two sets of visits, two different next actions. It asserts the converse as
well, that knowing which phase dominates narrows the cause to a set of
candidate findings rather than to one, and the single phase in the catalogue
where it narrows to exactly one is declared as an exception and checked as
an exception.

If a future rule makes one of those implications sound, the build goes red,
which is correct, because the sentence at the top of this section will have
become false.

On a text-heavy template the LCP element is frequently a heading, and the
hero image is irrelevant to the score. Only field attribution decides which
element is being measured, and it decides it per visit, per viewport, per
device.

## A static rule cannot see the page that is actually served

The rules read one file. A real page is assembled from a template, a theme,
a page builder, a tag manager, a consent platform and whatever a plugin
appended last Tuesday. Defects that only exist in the rendered output, and
that is most of them on a commercial site, are invisible to a file scanner.

They are also, often, invisible to a single lab run, because they depend on
which variant the visitor was bucketed into or whether they had consented
already.

## The rules are deliberately narrow

Each rule fires on one shape. `cls-iframe-without-dimensions` looks for an
iframe with no reserved height and no definite height in the stylesheet. An
ad slot that reserves 250 pixels and then renders a 600 pixel creative
reports nothing and shifts the page anyway. The correct height is a
measurement and a negotiation with whoever owns the slot, not something a
scanner can decide.

`cls-reserved-slot-missing` is narrower still, and worse: it reads class and
id names, so it finds a container called `promo-banner` and misses the same
container called `c-7`. It is in the catalogue because the heuristic earns
its place on real themes, and its entry says plainly that it is a heuristic.

## A corrected page here is not a clean page

Every example pair declares the exact set of findings that survives its
repair, and the set is almost never empty. The pages that fix a lazy hero
still serve one image candidate to every device. Every corrected page in the
repository still reports `method-no-field-measurement`, because not one of
them measures anything.

That is deliberate. Asserting that a repaired page is clean is easy and
slightly dishonest, because it is only clean under the rules that were
written for it.

## Lab tools cannot measure INP at all

There is no user in a lab run, so there is nothing to interact with.
Lighthouse reports Total Blocking Time, which is a related proxy on the same
main thread and is not the same metric. If INP is the failing metric, and
since it replaced FID it very often is, a lab score tells you almost nothing
about it.

## Field data lags four weeks

CrUX is a rolling 28 day window at the 75th percentile. A fix deployed today
is diluted by 27 days of the old behaviour before it shows. Say this before
the work starts. Your own RUM, filtered to visits after the deploy, is how
you demonstrate the improvement in the meantime, and it is the reason
[`measure/`](../measure/) exists at all.

## The attribution arithmetic trusts its input

[`measure/attribution.mjs`](../measure/attribution.mjs) is unit tested, but
the tests prove that the arithmetic is right, not that the numbers going into
it are. Phase values are supplied by the web-vitals attribution build, which
reads browser performance entries. Where the browser reports nothing, the
module treats the phase as zero rather than guessing, and a breakdown with a
missing phase will look confidently wrong unless you notice that the phases
no longer sum to the metric.

When no single phase reaches 40 percent of the total, the report says so
instead of naming one. A 30 percent phase is not the cause of anything.
