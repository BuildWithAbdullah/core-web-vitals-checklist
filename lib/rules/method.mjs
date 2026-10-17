/* ---------------------------------------------------------------------------
   rules/method.mjs

   Two rules about whether the page can answer the question at all.

   They are last on purpose. Every other finding in this repository is a
   hypothesis about a page, and the only thing that turns a hypothesis into a
   number is field data with attribution. A page with no collection on it can
   be audited all afternoon and the result is a list of things that might be
   costing something.
   --------------------------------------------------------------------------- */

const COLLECTORS = /web-vitals|onLCP|onINP|onCLS|largest-contentful-paint|layout-shift|event-timing/;
const ATTRIBUTION_BUILD = /web-vitals\.attribution|web-vitals\/attribution|attribution\.js/;

export const rules = [
  {
    id: 'field-measurement-present',
    emits: ['method-no-field-measurement'],
    run(doc) {
      const sources = doc.scripts.map((s) => `${s.src ?? ''} ${s.text}`).join('\n');
      if (COLLECTORS.test(sources)) return [];
      return [{ id: 'method-no-field-measurement', evidence: 'no script on the page reports a field metric' }];
    }
  },

  {
    id: 'attribution-build',
    emits: ['method-standard-build-of-web-vitals'],
    run(doc) {
      const sources = doc.scripts.map((s) => `${s.src ?? ''} ${s.text}`).join('\n');
      if (!/web-vitals/.test(sources)) return [];
      if (ATTRIBUTION_BUILD.test(sources)) return [];
      return [{
        id: 'method-standard-build-of-web-vitals',
        evidence: 'web-vitals is loaded without the attribution build'
      }];
    }
  }
];
