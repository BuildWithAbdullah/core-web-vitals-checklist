/* ---------------------------------------------------------------------------
   fixtures/index.mjs

   Pages written to reach the findings the eleven example pairs do not.

   This is the part of the repository that exists because of a lesson learned
   on a sibling one. A catalogue whose entries are only ever exercised by the
   examples written alongside them is a catalogue in which most entries have
   never fired, and a rule that has never fired is a rule nobody has checked.
   Four of the defects found while building this file were in rules that the
   example pairs never reach.

   Each entry declares the complete finding set for its page, asserted as a
   set in both directions, so a rule that starts reporting something new here
   is as loud as one that stops.
   --------------------------------------------------------------------------- */

const MEASURE = 'method-no-field-measurement';

export const fixtures = [
  {
    file: 'redirect-and-hints.html',
    about: 'A client side redirect and two resource hints that cost more than they save.',
    expect: ['lcp-client-side-redirect', 'lcp-preload-without-as',
      'lcp-font-preload-without-crossorigin', MEASURE],
    note: 'The stylesheet comes from a third party origin and is not reported, because that origin is preconnected. The negative is the point: the hint rule has to be able to not fire.'
  },
  {
    file: 'responsive-images.html',
    about: 'Width descriptors with no sizes attribute, and one format for everybody.',
    expect: ['lcp-srcset-widths-without-sizes', 'lcp-hero-legacy-format-only', MEASURE],
    note: 'The image is sized by aspect-ratio in the stylesheet and claims high priority, so neither the dimensions finding nor the priority finding fires here.'
  },
  {
    file: 'print-stylesheet.html',
    about: 'A stylesheet for another medium on the critical path, and an anti-flicker snippet.',
    expect: ['lcp-blocking-stylesheet-for-another-medium',
      'lcp-content-hidden-until-script-runs', MEASURE]
  },
  {
    file: 'media-elements.html',
    about: 'Four things that occupy no space until they arrive.',
    expect: ['lcp-hero-lazy', 'lcp-hero-no-fetchpriority', 'lcp-hero-no-srcset',
      'lcp-hero-legacy-format-only', 'cls-image-without-dimensions',
      'cls-video-without-dimensions', 'cls-reserved-slot-missing',
      'cls-lazy-loaded-above-the-fold', MEASURE],
    note: 'The densest page here on purpose. It is the one that would catch a rule that started reporting against every element rather than the ones it names.'
  },
  {
    file: 'typography.html',
    about: 'A font declared optional, named with no fallback, and never preloaded.',
    expect: ['cls-font-swap-unmatched', 'cls-font-stack-without-fallback',
      'cls-font-display-optional-without-preload', MEASURE],
    note: 'Optional counts as a swapping descriptor, so the unmatched metrics finding fires here too. That is correct: the font does eventually apply, and when it does the line boxes change.'
  },
  {
    file: 'animation.html',
    about: 'A disclosure panel animated on height.',
    expect: ['cls-layout-property-animated', MEASURE]
  },
  {
    file: 'interaction.html',
    about: 'Seven interaction findings on one booking page.',
    expect: ['inp-synchronous-request', 'inp-blocking-dialog-in-handler',
      'inp-non-passive-listener', 'inp-listener-per-element', 'inp-document-write',
      'inp-large-inline-json', 'inp-unthrottled-continuous-handler', MEASURE]
  },
  {
    file: 'named-handlers.html',
    about: 'A regression fixture for listeners registered with a named callback.',
    expect: ['inp-non-passive-listener', MEASURE],
    note: 'The scroll handler here is throttled to a frame and must not be reported. While events and handler bodies were paired by position it was, because the named wheel listener above it has no body and every later listener read the body of the one before it.'
  },
  {
    file: 'script-hero.html',
    about: 'An image whose source the preload scanner cannot see.',
    expect: ['lcp-image-source-set-by-script', MEASURE]
  },
  {
    file: 'measurement.html',
    about: 'A page that does measure, with the build that cannot say which phase.',
    expect: ['method-standard-build-of-web-vitals'],
    note: 'The only page in the repository that does not report method-no-field-measurement, which is what proves that rule can decline to fire.'
  }
];
