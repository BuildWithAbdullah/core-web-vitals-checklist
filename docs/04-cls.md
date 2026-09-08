# CLS: Cumulative Layout Shift

A score for how much visible content moved unexpectedly. Good is 0.1 or less
at p75.

CLS is usually the easiest of the three to fix and the easiest to regress.
Almost every cause is something that occupies no space until it loads, and then
suddenly does.

## Diagnose

`collect-web-vitals.js` logs `largestShiftTarget`, which names the element
responsible for the biggest single shift. That is normally enough.

In DevTools: Performance panel, record a load, look at the Layout Shifts track.
Rendering panel, tick "Layout Shift Regions" to see them flash as they happen.

Test on mobile viewports specifically. CLS is consistently worse on narrow
screens because there is less room to absorb a shift, and because mobile
layouts stack rather than sit side by side.

## The causes, in order of how often they are the answer

### 1. Images without dimensions

The browser cannot reserve space for an image whose size it does not know, so
everything below jumps when it arrives.

```html
<!-- Wrong -->
<img src="product.jpg" alt="...">

<!-- Right: width and height let the browser compute the aspect ratio and
     reserve the box before the file arrives. CSS can still make it fluid. -->
<img src="product.jpg" alt="..." width="1200" height="800">
```

```css
img { max-width: 100%; height: auto; }
```

This is a two-attribute fix and it resolves the majority of CLS on most content
sites.

### 2. Ads, embeds and iframes

Same problem, bigger boxes. Reserve the space:

```css
.ad-slot { min-height: 250px; }
```

Reserve the size the slot will actually be. A slot that reserves 90px and fills
with 250px has shifted 160px.

### 3. Web fonts

A fallback font renders, the web font arrives, and every line of text reflows.

- `font-display: swap` shows fallback text immediately and swaps. `optional`
  avoids the swap entirely on slow connections, at the cost of sometimes not
  using your font.
- Preload the font used above the fold.
- Match the fallback metrics so the swap does not change line heights.
  `size-adjust`, `ascent-override` and `descent-override` on an `@font-face`
  for the fallback make the swap nearly invisible.

### 4. Content injected above existing content

Cookie banners, announcement bars, promo strips, "you are on the wrong regional
store" notices, GDPR consent.

If it can be server-rendered, server-render it. If it must be injected, either
reserve its space or position it over the content rather than pushing content
down. A banner injected at the top of the DOM after paint shifts the entire
page, and it is the largest single shift on a very large number of sites.

### 5. Animating the wrong properties

Animating `top`, `left`, `width`, `height` or `margin` causes layout on every
frame and counts as a shift.

Animate `transform` and `opacity` instead. Both are composited, neither
triggers layout, and neither contributes to CLS.

```css
/* Causes layout shift */
.card:hover { margin-top: -8px; }

/* Does not */
.card:hover { transform: translateY(-8px); }
```

### 6. Late-loading skeletons

A skeleton that is a different size from the content it stands in for shifts
twice: once when it appears, once when it is replaced. Match the dimensions.

## What does not count

Shifts within 500ms of a user interaction are excluded. Opening an accordion,
expanding a menu, revealing a filter panel: all fine.

This exclusion is often misread as "any shift after an interaction is fine".
It is a 500ms window. A shift caused by a network response that arrives 900ms
after the click does count.

## Where CLS regresses

CLS is the metric that comes back. Every new marketing banner, every new
third-party tag, every new image inserted without dimensions is a fresh
regression, and the site was passing when you handed it over.

If the client has a CI pipeline, a Lighthouse budget on CLS in CI is the
cheapest guard available. If they do not, put it in the handover: any new image
needs width and height, any new banner needs reserved space.
