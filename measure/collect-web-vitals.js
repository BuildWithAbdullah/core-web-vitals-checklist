/* ---------------------------------------------------------------------------
   collect-web-vitals.js

   Field measurement with attribution. This is the file that turns "LCP is
   4.2s" into "LCP is 4.2s and 2.8s of it is resource load delay caused by a
   lazy loaded hero image", which is the difference between guessing and
   fixing.

     <script type="module">
       import './collect-web-vitals.js';
     </script>

   This file is wiring and nothing else. Everything it would be worth
   getting wrong lives in report.mjs and attribution.mjs, which import no
   browser and are driven by tests with stubs. tools/check-entry.mjs asserts
   that it stays that way, because the moment a calculation moves back in
   here it stops being checked by anything but a syntax parse.

   ---------------------------------------------------------------------------
   Why field data and not Lighthouse

   Lighthouse is a lab tool. It loads the page once, on one simulated device,
   on one simulated network, with a cold cache and no browser extensions, and
   it cannot measure INP at all because there is no user to interact with the
   page.

   Core Web Vitals as Google assesses them are field metrics: the 75th
   percentile of real visits over 28 days. A site can score 100 in Lighthouse
   and fail its assessment, and this happens constantly. The usual causes are
   a real user base on slower devices than the simulation, an interaction
   cost that only exists when someone interacts, and layout shifts triggered
   by consent banners or personalisation that never fire in a lab run.

   Measure the field. Use the lab to reproduce what the field tells you.
   --------------------------------------------------------------------------- */

/* The attribution build has to be named by its file. The bare package URL,
   web-vitals@4?module, resolves to the standard build, which reports the
   value and nothing else: metric.attribution is undefined there, so the
   first LCP callback would throw before logging anything. Self-host this
   file in production rather than relying on a public CDN. */
import {
  onLCP, onINP, onCLS, onTTFB, onFCP
} from 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.js?module';

import { createReporter } from './report.mjs';

/* Where to send the data. A real deployment posts to an analytics endpoint.
   With no endpoint the reporter logs a readable breakdown instead, so the
   file is useful immediately, with no backend, on any site you are
   diagnosing. */
const ENDPOINT = null;

const reporter = createReporter({
  console,
  navigator,
  location,
  endpoint: ENDPOINT,
  fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null
});

onLCP(reporter.reportLCP);
onINP(reporter.reportINP);
onCLS(reporter.reportCLS);
onTTFB(reporter.send);
onFCP(reporter.send);
