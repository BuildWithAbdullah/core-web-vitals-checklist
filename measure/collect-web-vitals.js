/* ---------------------------------------------------------------------------
   collect-web-vitals.js

   Field measurement with attribution. This is the file that turns "LCP is
   4.2s" into "LCP is 4.2s and 2.8s of it is resource load delay caused by a
   lazy-loaded hero image", which is the difference between guessing and
   fixing.

   Uses the web-vitals attribution build. The standard build gives you a
   number; the attribution build gives you the element, the URL, and the
   breakdown of where the time went.

     <script type="module">
       import './collect-web-vitals.js';
     </script>

   Or bundle it. It has one dependency.

   ---------------------------------------------------------------------------
   Why field data and not Lighthouse

   Lighthouse is a lab tool. It loads the page once, on one simulated device,
   on one simulated network, with a cold cache and no browser extensions, and
   it cannot measure INP at all because there is no user to interact with the
   page.

   Core Web Vitals as Google assesses them are field metrics: the 75th
   percentile of real visits over 28 days. A site can score 100 in Lighthouse
   and fail its Core Web Vitals assessment, and this happens constantly. The
   usual causes are a real user base on slower devices than the simulation, an
   interaction cost that only exists when someone interacts, and layout shifts
   triggered by consent banners or personalisation that never fire in a lab
   run.

   Measure the field. Use the lab to reproduce what the field tells you.
   --------------------------------------------------------------------------- */

import {
  onLCP, onINP, onCLS, onTTFB, onFCP
} from 'https://unpkg.com/web-vitals@4?module';

import {
  rate, lcpPhases, inpPhases, formatBreakdown
} from './attribution.mjs';

/* Where to send the data. A real deployment posts to an analytics endpoint.
   The default here logs a readable table so the file is useful immediately,
   with no backend, on any site you are diagnosing. */
const ENDPOINT = null;

function send(metric) {
  const body = {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    // Rated from the shared threshold table rather than the library's own
    // field, so the report and the transported record can never disagree.
    rating: rate(metric.name, metric.value),
    navigationType: metric.navigationType,
    attribution: metric.attribution,
    url: location.pathname,
    // Connection and device hints. Field data without these is hard to act
    // on, because a p75 that is bad only on slow Android is a different
    // problem from one that is bad everywhere.
    effectiveType: navigator.connection?.effectiveType,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency
  };

  if (!ENDPOINT) {
    console.log(`[CWV] ${body.name} ${body.value} (${body.rating})`, body.attribution);
    return;
  }

  // sendBeacon survives the page being unloaded, which is when these callbacks
  // usually fire. fetch with keepalive is the fallback.
  const payload = JSON.stringify(body);
  if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, payload);
  else fetch(ENDPOINT, { body: payload, method: 'POST', keepalive: true });
}

/* LCP attribution splits the metric into four consecutive phases. Each phase
   has a different fix, and knowing which one dominates is the entire
   diagnosis. See docs/02-lcp.md. */
onLCP((metric) => {
  console.log(formatBreakdown('LCP', metric.value, lcpPhases(metric.attribution)));
  console.log('  element  ', metric.attribution.target);
  console.log('  url      ', metric.attribution.url);
  send(metric);
});

/* INP attribution names the element and splits the interaction into input
   delay, processing time and presentation delay. Again, three different
   fixes. See docs/03-inp.md. */
onINP((metric) => {
  console.log(formatBreakdown('INP', metric.value, inpPhases(metric.attribution)));
  console.log('  element  ', metric.attribution.interactionTarget);
  console.log('  type     ', metric.attribution.interactionType);
  console.log('  frames   ', metric.attribution.longAnimationFrameEntries);
  send(metric);
});

/* CLS has no phases. Attribution names the largest shift source instead,
   which is almost always enough to find it. See docs/04-cls.md. */
onCLS((metric) => {
  const a = metric.attribution;
  console.groupCollapsed(`[CWV] CLS ${metric.value.toFixed(3)} (${rate('CLS', metric.value)})`);
  console.log('largest shift  ', a.largestShiftTarget);
  console.log('shift value    ', a.largestShiftValue?.toFixed(4));
  console.log('at             ', Math.round(a.largestShiftTime), 'ms');
  console.groupEnd();
  send(metric);
});

onTTFB(send);
onFCP(send);
