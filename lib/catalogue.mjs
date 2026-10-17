/* ---------------------------------------------------------------------------
   catalogue.mjs

   Every finding this repository can report, in one place, with what each one
   proves and what it does not.

   The second half of each entry is the half that matters. A static check
   reads markup and finds a shape. It has not measured anything, it has not
   loaded the page, and it cannot tell you whether the shape it found is
   costing a single millisecond on a real visit. Every entry here therefore
   carries `doesNotProve`, and tools/verify.mjs fails if any entry leaves it
   short.

   `phase` is the phase of the metric the finding would move if it is costing
   anything. It is a claim about where to look, not a prediction: the whole
   argument of this repository is that the static finding does not determine
   the field outcome, and test/gap.test.mjs asserts exactly that rather than
   leaving it as a sentence.
   --------------------------------------------------------------------------- */

export const METRICS = ['LCP', 'CLS', 'INP', 'METHOD'];

export const PHASES = {
  LCP: ['ttfb', 'load delay', 'load duration', 'render delay'],
  INP: ['input delay', 'processing', 'presentation'],
  CLS: ['layout shift'],
  METHOD: ['measurement']
};

const F = [
  /* --- LCP: time to first byte ----------------------------------------- */
  {
    id: 'lcp-client-side-redirect',
    metric: 'LCP', phase: 'ttfb',
    title: 'The page redirects on the client',
    proves: 'A meta refresh or a location assignment in the head makes the browser load one document in order to be told to load another, and the whole first request is added to time to first byte.',
    doesNotProve: 'That removing it is in your gift. A client side redirect is often the only tool somebody had, and the fix is a server rule that may belong to another team.'
  },

  /* --- LCP: load delay, which is discovery ------------------------------ */
  {
    id: 'lcp-hero-lazy',
    metric: 'LCP', phase: 'load delay',
    title: 'The first image in the body is lazy loaded',
    proves: 'The browser is told to deprioritise the first image on the page, so it is discovered late no matter how small it is.',
    doesNotProve: 'That this image is the LCP element. Only field attribution decides that, and on a text-heavy template it often is not.'
  },
  {
    id: 'lcp-hero-no-fetchpriority',
    metric: 'LCP', phase: 'load delay',
    title: 'The first image in the body does not claim high priority',
    proves: 'Nothing tells the browser this image matters more than the others it found, so it is fetched in document order behind whatever came first.',
    doesNotProve: 'That adding fetchpriority is worth anything here. On a page with one image and no competition for bandwidth it changes nothing, and marking several images high is the same as marking none.'
  },
  {
    id: 'lcp-background-image-candidate',
    metric: 'LCP', phase: 'load delay',
    title: 'The largest visual element is a CSS background image',
    proves: 'The preload scanner cannot see the image. It is discovered only once the stylesheet has arrived and been applied, which adds the whole CSS round trip to load delay.',
    doesNotProve: 'That the background is the LCP element. A background image is an LCP candidate only when it is the largest painted element, and a heading above it frequently is.'
  },
  {
    id: 'lcp-image-source-set-by-script',
    metric: 'LCP', phase: 'load delay',
    title: 'An image source is assigned by JavaScript',
    proves: 'The image does not exist in the markup, so the preload scanner cannot request it. It is discovered after the script has downloaded, parsed and run.',
    doesNotProve: 'That the script is removable. Consent-gated media and personalised heroes have reasons to be late, and the fix is usually a placeholder with reserved space rather than deleting the script.'
  },
  {
    id: 'lcp-preload-without-as',
    metric: 'LCP', phase: 'load delay',
    title: 'A preload hint has no as attribute',
    proves: 'Without as the browser cannot know the request priority or the accept header, so it either fetches at the wrong priority or fetches twice. A preload that downloads the resource a second time is worse than no preload.',
    doesNotProve: 'That the preload is otherwise correct. A hint with the right as and the wrong href is still a wasted request, and only the network panel shows that.'
  },
  {
    id: 'lcp-font-preload-without-crossorigin',
    metric: 'LCP', phase: 'load delay',
    title: 'A font preload has no crossorigin attribute',
    proves: 'Fonts are fetched in anonymous CORS mode whatever their origin. A preload without crossorigin is a different request from the one the stylesheet will make, so the file is downloaded twice and the preload has slowed the page down.',
    doesNotProve: 'That the font is on the critical path at all. Preloading a font used only in a footer spends priority on something nobody is waiting for.'
  },
  {
    id: 'lcp-third-party-origin-without-preconnect',
    metric: 'LCP', phase: 'load delay',
    title: 'A render blocking resource comes from an origin with no preconnect',
    proves: 'DNS, TCP and TLS to that origin all happen after the browser has parsed the tag, and on a mobile connection that is commonly three hundred milliseconds before the first byte of the resource.',
    doesNotProve: 'That preconnect is free. Each one holds a connection open, and more than a handful of them competes with the connections the page actually needs.'
  },

  /* --- LCP: load duration, which is the bytes --------------------------- */
  {
    id: 'lcp-hero-no-srcset',
    metric: 'LCP', phase: 'load duration',
    title: 'The first image offers one size to every device',
    proves: 'A phone downloads the desktop file. The bytes that arrive are the bytes the widest layout needs, and the decode cost scales with them too.',
    doesNotProve: 'How much is wasted. That is the difference between the intrinsic size and the displayed size on a real device, which markup does not contain.'
  },
  {
    id: 'lcp-srcset-widths-without-sizes',
    metric: 'LCP', phase: 'load duration',
    title: 'A srcset with width descriptors has no sizes attribute',
    proves: 'Without sizes the browser assumes the image is the full width of the viewport and picks the candidate for that, which on a half-width image is reliably one step too large.',
    doesNotProve: 'That the right sizes value is obvious. It describes the rendered width at each breakpoint, so it is a layout fact rather than an image fact and it goes stale when the layout changes.'
  },
  {
    id: 'lcp-hero-legacy-format-only',
    metric: 'LCP', phase: 'load duration',
    title: 'The first image is offered only in a legacy format',
    proves: 'No AVIF or WebP candidate is declared anywhere for this image, so every browser gets the JPEG or PNG regardless of what it supports.',
    doesNotProve: 'The saving. A well compressed JPEG can beat a careless WebP, and on a photographic hero the honest answer comes from encoding both and comparing.'
  },

  /* --- LCP: render delay ------------------------------------------------ */
  {
    id: 'lcp-import-chain',
    metric: 'LCP', phase: 'render delay',
    title: 'Stylesheets are chained with an at-rule import',
    proves: 'The second stylesheet is not requested until the first has arrived and been parsed, so two render blocking round trips happen one after the other instead of together.',
    doesNotProve: 'How much time this costs. On a fast connection with warm DNS it can be tens of milliseconds, and on a slow mobile connection it can be a second.'
  },
  {
    id: 'lcp-font-display-missing',
    metric: 'LCP', phase: 'render delay',
    title: 'A web font with a network source blocks text rendering',
    proves: 'With no font-display descriptor the browser hides the text for up to three seconds waiting for the font file, and text is frequently the LCP element.',
    doesNotProve: 'That switching to swap is free. It is not: swapping fonts with different metrics is a layout shift source, which is the finding cls-font-swap-unmatched below.'
  },
  {
    id: 'lcp-blocking-script-in-head',
    metric: 'LCP', phase: 'render delay',
    title: 'A script in the head blocks parsing',
    proves: 'Parsing stops until the script has been fetched, parsed and executed. Nothing after it in the document is discovered until that finishes.',
    doesNotProve: 'That defer is the right fix. A tag manager that must run before consent, or an anti-flicker snippet, has a reason to be where it is, and the fix is to argue about the requirement rather than the attribute.'
  },
  {
    id: 'lcp-blocking-stylesheet-for-another-medium',
    metric: 'LCP', phase: 'render delay',
    title: 'A stylesheet for another medium blocks rendering',
    proves: 'A stylesheet with no media attribute blocks the first paint even when every rule in it is wrapped in a print query, because the browser cannot know that until it has downloaded and parsed the file.',
    doesNotProve: 'That the media attribute is the whole fix. Moving a print stylesheet off the critical path saves a round trip and nothing else.'
  },
  {
    id: 'lcp-content-hidden-until-script-runs',
    metric: 'LCP', phase: 'render delay',
    title: 'The page is hidden until a script reveals it',
    proves: 'An anti-flicker rule that sets the body to zero opacity makes the largest contentful paint wait for the script that clears it, whatever else the page has already finished doing.',
    doesNotProve: 'That removing it is safe. These snippets exist to stop an experiment flashing the original content, and deleting one trades a measurement problem for a visible one.'
  },

  /* --- CLS -------------------------------------------------------------- */
  {
    id: 'cls-image-without-dimensions',
    metric: 'CLS', phase: 'layout shift',
    title: 'An image reserves no space before it loads',
    proves: 'The image occupies zero height until its bytes arrive, and then everything below it moves. This is the single most common layout shift source on the web.',
    doesNotProve: 'That the shift is large enough to matter. A shift below the fold that nobody has scrolled to does not count towards the score at all.'
  },
  {
    id: 'cls-iframe-without-dimensions',
    metric: 'CLS', phase: 'layout shift',
    title: 'An iframe reserves no space before it loads',
    proves: 'The slot is empty until a response arrives from a server you do not control, and then it pushes the page down at an unpredictable moment.',
    doesNotProve: 'What size to reserve. An ad slot that fills variably is a design decision, not a code fix, and reserving the wrong height trades a shift for a gap.'
  },
  {
    id: 'cls-video-without-dimensions',
    metric: 'CLS', phase: 'layout shift',
    title: 'A video element reserves no space before it loads',
    proves: 'A video with neither dimensions nor a poster collapses to nothing until metadata arrives, which is a network round trip after the layout around it has settled.',
    doesNotProve: 'That the poster alone fixes it. A poster with different proportions from the video shifts again at the moment playback starts.'
  },
  {
    id: 'cls-injected-above-existing-content',
    metric: 'CLS', phase: 'layout shift',
    title: 'Content is inserted at the top of the page after load',
    proves: 'Something is inserted above content the user is already reading, which moves the whole page. Consent banners and promotion bars are the usual owners.',
    doesNotProve: 'That the banner is the largest shift. The score is a sum of session windows, so one dramatic shift can score below a series of small ones.'
  },
  {
    id: 'cls-font-swap-unmatched',
    metric: 'CLS', phase: 'layout shift',
    title: 'A font swaps in without matched metrics',
    proves: 'The fallback font and the web font take different amounts of space, so every line of text reflows at the moment of the swap. This is the shift that appears the day after somebody fixes lcp-font-display-missing.',
    doesNotProve: 'The size of the shift. That depends on how far apart the two fonts actually are, which is measured rather than assumed.'
  },
  {
    id: 'cls-font-stack-without-fallback',
    metric: 'CLS', phase: 'layout shift',
    title: 'A font family is declared with no fallback',
    proves: 'There is nothing to render in while the web font loads, so the browser uses its own default, which is the font least likely to match the metrics of the one being loaded.',
    doesNotProve: 'That naming a fallback is enough. A fallback with the wrong metrics shifts exactly as much as the browser default did.'
  },
  {
    id: 'cls-layout-property-animated',
    metric: 'CLS', phase: 'layout shift',
    title: 'A transition or animation runs on a layout property',
    proves: 'Animating width, height, top, left or a margin makes the browser lay the page out again on every frame, and the elements around it move with it.',
    doesNotProve: 'That the shift counts. Layout shifts within five hundred milliseconds of a user interaction are excluded from the score, so an animation on a click may cost the user something the metric never sees.'
  },
  {
    id: 'cls-reserved-slot-missing',
    metric: 'CLS', phase: 'layout shift',
    title: 'An element named as an advertisement or embed slot has no reserved height',
    proves: 'Nothing in the stylesheet gives this container a size, so it is zero high until its contents arrive from a third party.',
    doesNotProve: 'That the name means what it looks like. This rule reads class and id names, which is a heuristic, and a container called banner may be a static image that was never going to shift.'
  },
  {
    id: 'cls-font-display-optional-without-preload',
    metric: 'CLS', phase: 'layout shift',
    title: 'A font is declared optional and is not preloaded',
    proves: 'The optional descriptor gives the font a hundred millisecond window and then abandons it for the whole navigation, so on most first visits the web font is downloaded, not used, and applied only on the next page.',
    doesNotProve: 'That preloading it is the right trade. Optional exists to protect the layout, and preloading restores the font at the cost of the bandwidth it was avoiding.'
  },
  {
    id: 'cls-lazy-loaded-above-the-fold',
    metric: 'CLS', phase: 'layout shift',
    title: 'The first image is both lazy loaded and unsized',
    proves: 'The two defects compound. The image is fetched late and it occupies no space while it waits, so the shift happens later than it otherwise would and more of the page has been read by then.',
    doesNotProve: 'That either fix alone is enough. Dimensions stop the shift and leave the image late; eager loading fetches it early and leaves the shift if the dimensions are still missing.'
  },

  /* --- INP -------------------------------------------------------------- */
  {
    id: 'inp-handler-never-yields',
    metric: 'INP', phase: 'processing',
    title: 'An event handler runs to completion without yielding',
    proves: 'The handler holds the main thread for the whole of its work, so the browser cannot paint a response until it finishes. The metric measures exactly that wait.',
    doesNotProve: 'That the handler is slow. A loop over ten items is fine. The rule flags the shape, and the field data says whether the shape costs anything here.'
  },
  {
    id: 'inp-layout-thrash',
    metric: 'INP', phase: 'presentation',
    title: 'Layout is read and written in the same loop',
    proves: 'Each read forces the browser to flush the writes from the previous iteration, so a loop over n elements causes n synchronous layouts instead of one.',
    doesNotProve: 'That splitting the loop is enough. If the write itself changes layout for the whole page, batching moves the cost rather than removing it.'
  },
  {
    id: 'inp-synchronous-request',
    metric: 'INP', phase: 'processing',
    title: 'A synchronous network request runs on the main thread',
    proves: 'The thread stops until the response arrives. Nothing paints, nothing scrolls, and the duration is a network round trip rather than a computation.',
    doesNotProve: 'That it ever runs. Synchronous requests are often in a legacy path that fires on one rarely used control, and the metric only records interactions that happen.'
  },
  {
    id: 'inp-blocking-dialog-in-handler',
    metric: 'INP', phase: 'processing',
    title: 'A handler opens a blocking dialog',
    proves: 'An alert, confirm or prompt stops the main thread until the user answers it, and the time they spend reading it is recorded as the time your page took to respond.',
    doesNotProve: 'That the interaction was the worst one. The metric reports the 98th percentile interaction on the page, so a single dialog on a rare path may never be the one reported.'
  },
  {
    id: 'inp-non-passive-listener',
    metric: 'INP', phase: 'input delay',
    title: 'A scroll-blocking listener is not registered as passive',
    proves: 'The browser has to wait to find out whether the handler will cancel the gesture, so it cannot start scrolling until the handler has run.',
    doesNotProve: 'That passive is safe here. A handler that genuinely calls preventDefault on a wheel or touch event will throw once it is passive, and the behaviour it was protecting disappears.'
  },
  {
    id: 'inp-listener-per-element',
    metric: 'INP', phase: 'input delay',
    title: 'A listener is attached inside a loop rather than delegated',
    proves: 'One listener per element, attached during load, which is main thread work before the page is interactive and memory held for the life of the document.',
    doesNotProve: 'That delegation is better here. For a handful of elements the difference is nothing, and delegation moves the cost into every event that bubbles.'
  },
  {
    id: 'inp-document-write',
    metric: 'INP', phase: 'input delay',
    title: 'The page calls document.write',
    proves: 'The parser stops, the string is parsed as it arrives, and on a slow connection the browser may abandon the speculative parse it had already done for the rest of the document.',
    doesNotProve: 'Who called it. The usual owner is a third party tag inside another third party tag, and the only way to find it is the network panel on a real load.'
  },
  {
    id: 'inp-large-inline-json',
    metric: 'INP', phase: 'input delay',
    title: 'A large JSON payload is parsed inline during load',
    proves: 'The parse is synchronous and happens while the page is loading, which is the moment the main thread is most contended and the moment a user is most likely to tap something.',
    doesNotProve: 'That the parse is the cost. JSON.parse on a string the browser already has is fast, and the expense is usually what the code does with the result.'
  },
  {
    id: 'inp-unthrottled-continuous-handler',
    metric: 'INP', phase: 'presentation',
    title: 'A continuously firing event is handled without throttling',
    proves: 'Scroll, resize, mousemove and pointermove fire many times a second, and a handler that does work on every one of them competes with the interaction the user is actually waiting on.',
    doesNotProve: 'That a frame is being dropped. A cheap handler on a fast device keeps up, and this rule cannot tell a cheap one from an expensive one.'
  },

  /* --- Method ----------------------------------------------------------- */
  {
    id: 'method-no-field-measurement',
    metric: 'METHOD', phase: 'measurement',
    title: 'The page collects no field data',
    proves: 'Nothing on this page reports what real visits experienced, so every finding above is a hypothesis and the effect of any fix will be invisible for the twenty eight days the public dataset takes to move.',
    doesNotProve: 'That no measurement exists. Collection may live in a tag manager, a bundled analytics script or an edge worker, none of which this rule can see.'
  },
  {
    id: 'method-standard-build-of-web-vitals',
    metric: 'METHOD', phase: 'measurement',
    title: 'Field data is collected without attribution',
    proves: 'The standard build reports the value and nothing else, so the data says the metric is bad and cannot say which phase of it is bad, which is the only part that tells you what to do.',
    doesNotProve: 'That the attribution build is affordable here. It is larger, and on a site whose whole budget argument is script weight that is a real trade.'
  }
];

export const findings = F.map((f) => Object.freeze(f));

export const byId = new Map(findings.map((f) => [f.id, f]));

export function finding(id) {
  const f = byId.get(id);
  if (!f) throw new Error(`No finding with id ${id}`);
  return f;
}

export const ids = findings.map((f) => f.id);
