/* ---------------------------------------------------------------------------
   pairs.mjs

   What each example pair is for, and what is still true about the corrected
   page afterwards.

   `onFail` and `onPass` are the complete finding sets, asserted as sets in
   both directions. The second one is the one worth having. Asserting that a
   corrected page is clean is easy and slightly dishonest, because it is only
   clean under the rules that were written for it. Declaring the exact
   residual set says what the repair does not reach, and it goes red the day
   a rule starts or stops reporting one of them.

   Every corrected page here still reports method-no-field-measurement, which
   is not an oversight. None of these pages measures anything, so none of
   them can tell you whether the defect that was repaired was costing
   anything. That is the argument of the repository, standing in its own
   assertions.
   --------------------------------------------------------------------------- */

const MEASURE = 'method-no-field-measurement';

export const pairs = [
  {
    id: '01-lazy-hero',
    primary: 'lcp-hero-lazy',
    onFail: ['lcp-hero-lazy', 'lcp-hero-no-fetchpriority', 'lcp-hero-no-srcset', MEASURE],
    onPass: ['lcp-hero-no-srcset', MEASURE],
    note: 'The corrected page still offers one candidate to every device, which is a different finding and a different afternoon.'
  },
  {
    id: '02-css-background-hero',
    primary: 'lcp-background-image-candidate',
    onFail: ['lcp-background-image-candidate', MEASURE],
    onPass: ['lcp-hero-no-srcset', MEASURE],
    note: 'Moving the hero out of the stylesheet and into an image element is what makes the srcset finding reportable at all. The failing page has no image for a rule about images to look at.'
  },
  {
    id: '03-css-import-chain',
    primary: 'lcp-import-chain',
    onFail: ['lcp-import-chain', MEASURE],
    onPass: [MEASURE]
  },
  {
    id: '04-font-display-block',
    primary: 'lcp-font-display-missing',
    onFail: ['lcp-font-display-missing', MEASURE],
    onPass: [MEASURE],
    note: 'The corrected page swaps, which would normally report cls-font-swap-unmatched. It does not, because it also declares the adjusted fallback face that example 08 is about. Fix both or neither.'
  },
  {
    id: '05-unsized-image',
    primary: 'cls-image-without-dimensions',
    onFail: ['lcp-hero-no-fetchpriority', 'lcp-hero-no-srcset', 'cls-image-without-dimensions', MEASURE],
    onPass: ['lcp-hero-no-fetchpriority', 'lcp-hero-no-srcset', MEASURE]
  },
  {
    id: '06-unreserved-embed',
    primary: 'cls-iframe-without-dimensions',
    onFail: ['cls-iframe-without-dimensions', MEASURE],
    onPass: [MEASURE]
  },
  {
    id: '07-injected-banner',
    primary: 'cls-injected-above-existing-content',
    onFail: ['cls-injected-above-existing-content', MEASURE],
    onPass: [MEASURE]
  },
  {
    id: '08-font-metric-mismatch',
    primary: 'cls-font-swap-unmatched',
    onFail: ['cls-font-swap-unmatched', MEASURE],
    onPass: [MEASURE]
  },
  {
    id: '09-long-task-handler',
    primary: 'inp-handler-never-yields',
    onFail: ['inp-handler-never-yields', MEASURE],
    onPass: [MEASURE]
  },
  {
    id: '10-layout-thrash',
    primary: 'inp-layout-thrash',
    onFail: ['inp-handler-never-yields', 'inp-layout-thrash', MEASURE],
    onPass: [MEASURE],
    note: 'The failing page reports two findings rather than one, because a loop that thrashes layout inside a handler is also a loop inside a handler that never yields. They are separate fixes and the page needs both.'
  },
  {
    id: '11-blocking-third-party',
    primary: 'lcp-blocking-script-in-head',
    onFail: ['lcp-third-party-origin-without-preconnect', 'lcp-blocking-script-in-head', MEASURE],
    onPass: [MEASURE]
  }
];

export const pairById = new Map(pairs.map((p) => [p.id, p]));
