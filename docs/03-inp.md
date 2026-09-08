# INP: Interaction to Next Paint

The worst interaction latency a user experienced, from input to the next frame
being painted. Good is 200ms or less at p75.

INP replaced First Input Delay in March 2024, and it is much harder to pass.
FID measured only the delay before an event handler started, on the first
interaction only. INP measures the whole interaction, including the handler and
the resulting paint, across every interaction on the page, and reports the
worst.

Sites that comfortably passed FID routinely fail INP. It is the metric most
likely to be the reason a site is failing its assessment today.

## Diagnose before you fix

Three phases, three different fixes.

| Phase | What it is | Usual cause |
|---|---|---|
| Input delay | Time before the handler can start | Main thread busy with something else |
| Processing duration | The handler running | Expensive work in the handler |
| Presentation delay | Handler finished, frame not yet painted | Large synchronous DOM or layout work |

`collect-web-vitals.js` logs all three plus the element that was interacted
with. Chrome DevTools Performance panel, with the Interactions track enabled,
gives the same breakdown with a call stack attached.

## If input delay dominates

Something else was occupying the main thread when the user acted. The handler
itself may be trivial.

Usual suspects, in the order they are usually found:

- **Third-party tags.** Tag managers, analytics, chat widgets, heatmap
  recorders, A/B testing. These are frequently the whole problem. Audit what is
  loading and remove what nobody uses. A surprising share of tag manager
  containers on live sites contain tags for tools the client cancelled.
- **Hydration.** A framework hydrating the whole page blocks input for as long
  as it runs. Reach for partial or lazy hydration.
- **Long tasks at load.** If the interaction happens early, the page is
  probably still initialising. Defer non-essential work until after first
  interaction, or until idle.

Break up long tasks so the browser can respond between chunks:

```js
// Yields to the browser so pending input can be handled between items.
async function processInChunks(items, work) {
  for (const item of items) {
    work(item);
    if (navigator.scheduling?.isInputPending?.()) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}
```

`scheduler.yield()` is the modern form of this where it is available.

## If processing duration dominates

The handler is doing too much.

- **Do the visible part first.** Update the UI immediately, then do the
  bookkeeping. A user who sees the menu open does not care that analytics has
  not fired yet.
- **Move the rest off the critical path.** Anything not needed for the next
  frame goes in `requestIdleCallback` or after a `yield`.
- **Look for accidental synchronous work.** Reading `offsetHeight`,
  `getBoundingClientRect` or `getComputedStyle` immediately after a DOM write
  forces a synchronous layout. In a loop, this is layout thrashing and it is a
  classic INP killer. Batch reads, then batch writes.
- **Debounce input handlers.** A `keyup` handler that filters a thousand-item
  list on every keystroke will fail INP on any device.

```js
button.addEventListener('click', () => {
  // Visible response first.
  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');

  // Everything else after the paint.
  requestIdleCallback(() => {
    analytics.track('panel_opened');
    prefetchPanelContent();
  });
});
```

## If presentation delay dominates

The handler finished quickly and the browser still could not paint.

- **Too much DOM changed at once.** Rendering 500 rows synchronously is one
  enormous layout. Virtualise, or render in chunks.
- **Expensive layout.** Deeply nested flex and grid, or an unconstrained
  reflow, over a large DOM.
- **`content-visibility: auto`** on long off-screen sections lets the browser
  skip rendering work for content nobody is looking at yet.

## Where INP failures cluster in practice

On commerce and content sites, in rough order of frequency:

1. Mobile menu open and close, because it usually triggers hydration.
2. Add to cart, because it is a network call plus a drawer plus analytics on
   the same tick.
3. Filter and sort on collection pages, re-rendering a large grid.
4. Search-as-you-type with no debounce.
5. Accordion and tab controls on pages with a very large DOM.
6. Consent banner dismissal, which often triggers a cascade of newly permitted
   third-party scripts all initialising at once.

Number six is worth checking early. It is invisible in a lab run, it affects
essentially every visitor, and it is frequently the single worst interaction on
the site.

## Testing INP honestly

Lighthouse cannot measure it. You need either field data, or manual
interaction with the Performance panel recording, on a throttled CPU. Use 4x or
6x CPU throttling; an unthrottled development machine will pass almost
anything.
