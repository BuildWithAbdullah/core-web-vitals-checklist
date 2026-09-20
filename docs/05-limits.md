# What this repository cannot tell you

Everything here is either arithmetic on numbers your own visitors produced,
or a static reading of markup. Neither of those is a measurement of your
site. The gap between the two is where most wasted performance work happens,
so it is worth being precise about where it sits.

## The checks do not measure anything

The eleven checks in [`tools/checks.mjs`](../tools/checks.mjs) read HTML and
CSS and look for a shape. A check that finds `loading="lazy"` on the first
image of a page has found a real defect worth fixing. It has not established
that the image is the LCP element on a real visit, that the page is slow, or
that removing the attribute will move the metric.

On a text-heavy template the LCP element is frequently a heading, and the
hero image is irrelevant to the score. Only field attribution decides which
element is being measured, and it decides it per visit, per viewport, per
device.

## A static check cannot see the page that is actually served

The checks read one file. A real page is assembled from a template, a theme,
a page builder, a tag manager, a consent platform and whatever a plugin
appended last Tuesday. Defects that only exist in the rendered output, and
that is most of them on a commercial site, are invisible to a file scanner.

They are also, often, invisible to a single lab run, because they depend on
which variant the visitor was bucketed into or whether they had consented
already.

## The checks are deliberately narrow

Each detector fires on one shape. `06-unreserved-embed` looks for an iframe
with no reserved height and no minimum height in the stylesheet. An ad slot
that reserves 250 pixels and then renders a 600 pixel creative passes the
check and shifts the page anyway. The correct height is a measurement and a
negotiation with whoever owns the slot, not something a scanner can decide.

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
