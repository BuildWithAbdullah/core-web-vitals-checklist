# Triage checklist

A working order for a Core Web Vitals engagement. The order is the point: each
step is cheap and rules out a class of problem, so you are not optimising
images on a site whose real problem is a 1.8 second server response.

## Before touching anything

- [ ] Which metric is failing? Search Console, Core Web Vitals report, per
      metric and per URL group. Do not start from a Lighthouse score.
- [ ] Which templates? Origin-level failure with a fast homepage means the
      problem is on product, article or search pages. Diagnose the template
      that fails, not the one everyone has already optimised.
- [ ] Mobile or desktop? They are assessed separately and usually differ.
- [ ] Deploy RUM before making changes, so a baseline exists and improvement
      can be shown inside the 28 day CrUX window.
- [ ] Record current p75 for LCP, INP and CLS.
- [ ] Set expectations: field data moves over about four weeks. A client
      checking the day after a deploy will see nothing.

## LCP

- [ ] Confirm which element is the LCP element. It is often not the one
      everyone assumes.
- [ ] Get the four-phase breakdown. Do not proceed without it.
- [ ] TTFB dominant? Hosting, caching, database, redirect chains, a blocking
      third party. Nothing about images will help.
- [ ] Load delay dominant? Check for `loading="lazy"` on the hero, a CSS
      background image as the LCP element, or JavaScript-injected content.
      Add `fetchpriority="high"`.
- [ ] Load duration dominant? Format, dimensions, compression, `srcset`.
- [ ] Render delay dominant? Render-blocking CSS and JS, client-side
      rendering, long tasks.

## INP

- [ ] Field data or a throttled manual pass. Lighthouse cannot measure this.
- [ ] Throttle CPU 4x or 6x. An unthrottled machine passes almost anything.
- [ ] Test the interactions that actually fail: mobile menu, add to cart,
      filter and sort, search-as-you-type, accordions, consent dismissal.
- [ ] Get the three-phase breakdown per interaction.
- [ ] Input delay dominant? Audit third-party tags first. Remove what nobody
      uses. Break up long tasks.
- [ ] Processing dominant? Visible response first, everything else after the
      paint. Check for layout thrashing.
- [ ] Presentation dominant? Too much DOM changed at once, or expensive
      layout.

## CLS

- [ ] Test on a mobile viewport. It is consistently worse there.
- [ ] Every image has `width` and `height`. This alone fixes most of it.
- [ ] Ads, embeds and iframes have reserved space matching their real size.
- [ ] Fonts use `font-display` and metric-matched fallbacks.
- [ ] Banners and consent notices are server-rendered, or overlay rather than
      push.
- [ ] Animations use `transform` and `opacity`, not `top`, `left`, `width`,
      `height` or `margin`.
- [ ] Skeletons match the dimensions of what replaces them.

## Third parties, worth its own pass

- [ ] List every third-party script actually loading in production.
- [ ] For each: who asked for it, what does it do, is it still used?
- [ ] Remove tags for cancelled tools. Tag manager containers accumulate
      these and nobody looks.
- [ ] Anything not needed for first render: `defer`, `async`, or load on
      interaction.
- [ ] Check what fires on consent acceptance. A cascade of scripts all
      initialising at once is invisible in a lab run and affects nearly every
      visitor.

## Before handover

- [ ] Re-measure in the field, filtered to post-deploy visits.
- [ ] Document what changed and why, per metric.
- [ ] Note the regression risks: images added without dimensions, new banners,
      new tags.
- [ ] If the client has CI, add a Lighthouse budget. If not, put the rules in
      the handover document.
- [ ] Remind them the CrUX report will take about four weeks to reflect the
      work.

## What not to do

- [ ] Do not optimise for the Lighthouse score. It is a lab proxy and it
      cannot measure INP at all.
- [ ] Do not chase averages. Assessment is at p75, driven by the slower
      quarter of visits.
- [ ] Do not install a performance plugin and call it a diagnosis. Caching
      plugins help TTFB and do nothing for INP or CLS.
- [ ] Do not report Total Blocking Time as if it were INP, and never report it
      as an accessibility finding.
