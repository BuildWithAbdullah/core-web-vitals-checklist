/* ---------------------------------------------------------------------------
   report.mjs

   Everything collect-web-vitals.js does, with nothing it needs a browser
   for.

   The entry point used to hold the formatting, the rating, the payload
   shape and the transport choice, and it imports the web-vitals library
   from a URL, so none of it could be imported in Node and the whole file
   was covered by a syntax check. A syntax check is not a check: it proves
   the braces match. It does not notice that the layout shift value is sent
   unscaled, or that the fallback transport is never reached.

   So the dependencies are arguments now. createReporter takes a console, a
   navigator, a location and an endpoint, and the tests pass stubs for all
   four and read what came out.
   --------------------------------------------------------------------------- */

import { rate, lcpPhases, inpPhases, formatBreakdown } from './attribution.mjs';

/* Layout shift is reported as a unitless number near zero. Analytics
   backends that store metric values as integers round it to nought, so it
   is multiplied before transport and only before transport. The console
   block and the rating both use the real value. */
export const CLS_TRANSPORT_SCALE = 1000;

export function payloadFor(metric, env) {
  const { navigator = {}, location = {} } = env;
  return {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * CLS_TRANSPORT_SCALE : metric.value),
    /* Rated from the shared threshold table rather than the library's own
       field, so the console block and the transported record can never
       disagree about the same number. */
    rating: rate(metric.name, metric.value),
    navigationType: metric.navigationType,
    attribution: metric.attribution,
    url: location.pathname,
    /* Connection and device hints. Field data without these is hard to act
       on, because a 75th percentile that is bad only on slow Android is a
       different problem from one that is bad everywhere. */
    effectiveType: navigator.connection?.effectiveType,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency
  };
}

export function createReporter(env = {}) {
  const {
    console: out = globalThis.console,
    navigator = {},
    location = {},
    endpoint = null,
    fetch: fetchImpl = null
  } = env;

  function send(metric) {
    const body = payloadFor(metric, { navigator, location });

    if (!endpoint) {
      out.log(`[CWV] ${body.name} ${body.value} (${body.rating})`, body.attribution);
      return { transport: 'console', body };
    }

    const serialised = JSON.stringify(body);
    /* sendBeacon survives the page being unloaded, which is when these
       callbacks usually fire. A browser that has it can still refuse the
       payload, by queue limit or by size, and it says so by returning
       false. The first version of this treated the method existing as the
       send succeeding, so a refused beacon was silently lost. */
    if (typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(endpoint, serialised)) return { transport: 'beacon', body };
    }
    if (typeof fetchImpl === 'function') {
      fetchImpl(endpoint, { body: serialised, method: 'POST', keepalive: true });
      return { transport: 'fetch', body };
    }
    return { transport: 'dropped', body };
  }

  function reportLCP(metric) {
    out.log(formatBreakdown('LCP', metric.value, lcpPhases(metric.attribution)));
    /* Version 4 of the library calls this field element. Version 5 renamed
       it to target, so the import in the entry point and this line move
       together or neither moves. */
    out.log('  element  ', metric.attribution.element);
    out.log('  url      ', metric.attribution.url);
    return send(metric);
  }

  function reportINP(metric) {
    out.log(formatBreakdown('INP', metric.value, inpPhases(metric.attribution)));
    out.log('  element  ', metric.attribution.interactionTarget);
    out.log('  type     ', metric.attribution.interactionType);
    return send(metric);
  }

  function reportCLS(metric) {
    const a = metric.attribution;
    out.log(`[CWV] CLS ${metric.value.toFixed(3)} (${rate('CLS', metric.value)})`);
    out.log('  largest shift  ', a.largestShiftTarget);
    out.log('  shift value    ', a.largestShiftValue?.toFixed(4));
    out.log('  at             ', Math.round(a.largestShiftTime), 'ms');
    return send(metric);
  }

  return { send, reportLCP, reportINP, reportCLS };
}
