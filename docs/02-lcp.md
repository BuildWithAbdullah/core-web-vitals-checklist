# LCP: Largest Contentful Paint

Time until the largest text block or image in the viewport is rendered.
Good is 2.5s or less at p75.

## Diagnose before you fix

LCP is one number covering four consecutive phases. Each phase has a different
fix, and applying the wrong one is the usual reason a performance engagement
produces no movement.

Get the breakdown from the attribution build, which
[`collect-web-vitals.js`](../measure/collect-web-vitals.js) already logs, or
from the Chrome DevTools Performance panel.

| Phase | What it is | Typical share |
|---|---|---|
| Time to first byte | Server and network before any HTML arrives | 40% |
| Resource load delay | Gap between TTFB and the browser starting to fetch the LCP resource | 0 to 25% |
| Resource load duration | Downloading the LCP resource | 0 to 30% |
| Element render delay | Resource downloaded, not yet painted | 0 to 30% |

Whichever phase dominates is the only one worth working on.

## If TTFB dominates

The server is slow or far away. Nothing you do to images will help.

- Check hosting and database query time. On WordPress and WooCommerce this is
  usually plugin count, an uncached query on the template, or a shared host.
- Add full-page caching. On a cached site TTFB should be well under 200ms.
- Put a CDN in front. Distance is latency.
- Look for redirect chains. Each hop is a full round trip, and
  `http://example.com` to `https://example.com` to `https://www.example.com` is
  two before the page starts.
- Check for a slow third party in the critical path, such as a personalisation
  or A/B testing service that blocks the response.

## If resource load delay dominates

The browser found out about the LCP resource too late. This is the most
common LCP problem on modern sites, and also the cheapest to fix.

**The hero image is lazy loaded.** `loading="lazy"` on the LCP element delays
its discovery until layout runs. Never lazy load anything above the fold.

```html
<!-- Wrong: the browser waits for layout before it even asks for this -->
<img src="hero.jpg" loading="lazy">

<!-- Right -->
<img src="hero.jpg" loading="eager" fetchpriority="high">
```

**The image is a CSS background.** The preload scanner reads HTML, not CSS. A
background image is not discovered until the stylesheet has downloaded and
parsed. Use `<img>` for the LCP element, or preload it.

**It is injected by JavaScript.** A carousel or hero component that renders
client side cannot be discovered until the bundle has downloaded, parsed and
executed. Server-render the first slide.

**Preload it** when the element is genuinely late-discovered and cannot be
restructured:

```html
<link rel="preload" as="image" href="hero.avif" fetchpriority="high">
```

`fetchpriority="high"` on the image itself is usually enough and is less
fragile than a preload that can drift out of sync with the markup.

## If resource load duration dominates

The resource is too big, or served badly.

- **Format.** AVIF, then WebP, then JPEG. AVIF is typically 30 to 50 percent
  smaller than JPEG at equivalent quality.
- **Dimensions.** The most common single waste on a commerce site is a 3000px
  hero served to a 390px phone. Use `srcset` and `sizes`.
- **Compression.** Quality 75 to 80 is visually indistinguishable from 100 for
  photographic content and is often less than half the bytes.
- **Fonts, when the LCP element is text.** A web font that blocks rendering
  delays paint. Use `font-display: swap` or `optional`, preload the one font
  file used above the fold, and subset it.

## If element render delay dominates

The resource arrived and the browser could not paint it.

- **Render-blocking CSS.** Every stylesheet in the head blocks first paint.
  Inline the critical rules and load the rest asynchronously.
- **Render-blocking JavaScript.** A synchronous script in the head stops HTML
  parsing. Add `defer`, or `async` where order does not matter.
- **Client-side rendering.** If the LCP element only exists after hydration,
  its render delay is the entire bundle cost. Server-render it.
- **A long task on the main thread.** Something is busy when the paint should
  have happened. Find it in the Performance panel.

## The check that resolves most arguments

Confirm which element is actually the LCP element before optimising anything.
It is frequently not what people assume. A common surprise on commerce sites is
that the LCP element is the announcement bar text or a heading, not the hero
image everybody has been compressing.

DevTools Performance panel, or the `target` property in the LCP attribution.
