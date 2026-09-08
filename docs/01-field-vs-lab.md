# Field data and lab data

The first question on any performance engagement is which number the client is
actually being judged on. Getting this wrong wastes the whole engagement.

## The two kinds of data

**Field data**, also called RUM, is what real visitors experienced. Google's
Core Web Vitals assessment uses the Chrome User Experience Report: the 75th
percentile of real Chrome visits over a rolling 28 day window. This is what
appears in Search Console, and it is the only data that carries any search
implication.

**Lab data** is a synthetic load. Lighthouse, PageSpeed Insights' lab section,
WebPageTest. One load, one simulated device, one simulated network, cold cache,
no extensions, no consent banner interaction, no user.

## Why a site scores 100 and still fails

This is the single most common confusion, and it is worth being able to explain
in one breath.

**Lighthouse cannot measure INP.** INP measures how long the page takes to
respond to a real interaction. There is no user in a lab run, so there is
nothing to measure. Lighthouse substitutes Total Blocking Time, which is a
useful proxy and is not the same metric. A page can have excellent TBT and poor
INP.

**The device is a guess.** Lighthouse mobile simulates a mid-tier device on a
throttled connection. If the real audience is on slower hardware, the lab
number is optimistic. If they are mostly on desktop over fibre, it is
pessimistic.

**The cache is always cold.** Returning visitors have a different experience
entirely, and they are a large share of a typical site's traffic.

**Nothing that depends on a user ever fires.** Consent banners that shift
layout on dismissal, personalisation that swaps the hero after login, lazy
content that loads on scroll, third-party scripts that only initialise on
interaction. All invisible to the lab, all present in the field.

## The 28 day lag

CrUX is a rolling 28 day window. Ship a fix today and the field data moves
gradually, reaching its new steady state around four weeks later.

Two consequences worth setting expectations on before the work starts:

- A client checking Search Console the day after a deploy will see almost no
  change. Say so in advance, or it reads as the work having failed.
- The correct way to demonstrate an improvement inside four weeks is your own
  RUM, filtered to visits after the deploy. Set it up before you change
  anything, so a baseline exists.

## Thresholds

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | 2.5s or less | 2.5s to 4.0s | over 4.0s |
| INP | 200ms or less | 200ms to 500ms | over 500ms |
| CLS | 0.1 or less | 0.1 to 0.25 | over 0.25 |

Assessment is at the 75th percentile, per metric, and a URL group passes only
if all three pass. Chasing an average is a common and expensive mistake: the
p75 is driven by the slower quarter of visits, which is usually a different
population on different hardware, and improving the median can leave it
untouched.

## Origin data and page data

CrUX reports both an origin-level summary and, where there is enough traffic,
per-URL data. Search Console groups URLs by similarity.

If a client's homepage is fine and the origin is failing, the problem is on
templates with less traffic: product pages, blog articles, search results.
Diagnose the template, not the homepage, because the homepage is the page
everyone has already optimised.

## What to set up first

Before changing anything:

1. Deploy [`collect-web-vitals.js`](../measure/collect-web-vitals.js) or an
   equivalent RUM collector, so a real baseline exists and improvements can be
   demonstrated inside the 28 day window.
2. Record the current CrUX state per metric and per template.
3. Only then run Lighthouse, and only to reproduce what the field data has
   already told you to look at.

Running Lighthouse first, and optimising whatever it complains about, is how
performance engagements end with a better score and an unchanged assessment.
