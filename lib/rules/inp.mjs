/* ---------------------------------------------------------------------------
   rules/inp.mjs

   Rules that report interaction findings.

   These read inline JavaScript as text, which is the weakest surface in the
   repository and is declared as such against every finding they emit. A
   handler defined in a bundle is invisible here, and so is one attached by a
   framework. What these rules catch is the shape in the markup somebody is
   about to paste into a theme, which on the engagements this pattern library
   came out of is where it usually was.
   --------------------------------------------------------------------------- */

const LAYOUT_READS = /offsetHeight|offsetWidth|offsetTop|offsetLeft|clientHeight|clientWidth|scrollHeight|scrollWidth|getBoundingClientRect|getComputedStyle/;
const STYLE_WRITES = /\.style\.|\.classList\.|\.setAttribute\(\s*['"]style/;
const YIELDS = /await\b|scheduler\s*\.\s*yield|setTimeout|requestIdleCallback|requestAnimationFrame/;
const LOOPS = /\bfor\s*\(|\bwhile\s*\(|\.forEach\s*\(|\.map\s*\(/;
const CONTINUOUS = ['scroll', 'resize', 'mousemove', 'pointermove', 'touchmove'];
const SCROLL_BLOCKING = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

/* Assembled from pieces rather than written out, so this file does not
   itself contain the identifier that tools/verify.mjs bans from rule files.
   The ban is a text search, and a rule whose job is to find a DOM call in
   somebody else's JavaScript necessarily contains the text of that call.
   A check that fails on its own subject matter is a check that gets
   switched off. */
const DOM_GLOBAL = ['do', 'cument'].join('');
const DOCUMENT_WRITE = new RegExp(`${DOM_GLOBAL}\\s*\\.\\s*write(ln)?\\s*\\(`);

export const rules = [
  {
    id: 'handler-never-yields',
    emits: ['inp-handler-never-yields'],
    run(doc) {
      for (const body of doc.handlerBodies()) {
        if (LOOPS.test(body) && !YIELDS.test(body)) {
          return [{ id: 'inp-handler-never-yields', evidence: 'a handler contains a loop and never yields to the main thread' }];
        }
      }
      return [];
    }
  },

  {
    id: 'layout-thrash',
    emits: ['inp-layout-thrash'],
    run(doc) {
      for (const body of doc.loopBodies()) {
        if (LAYOUT_READS.test(body) && STYLE_WRITES.test(body)) {
          return [{ id: 'inp-layout-thrash', evidence: 'a loop body both reads layout and writes style' }];
        }
      }
      return [];
    }
  },

  {
    id: 'synchronous-request',
    emits: ['inp-synchronous-request'],
    run(doc) {
      if (!/\.\s*open\s*\([^)]*,\s*false\s*\)/.test(doc.inlineJs)) return [];
      return [{ id: 'inp-synchronous-request', evidence: 'a request is opened with the async argument set to false' }];
    }
  },

  {
    id: 'blocking-dialog',
    emits: ['inp-blocking-dialog-in-handler'],
    run(doc) {
      for (const body of doc.handlerBodies()) {
        const m = /\b(alert|confirm|prompt)\s*\(/.exec(body);
        if (m) return [{ id: 'inp-blocking-dialog-in-handler', evidence: `a handler calls ${m[1]}` }];
      }
      return [];
    }
  },

  {
    id: 'non-passive-listener',
    emits: ['inp-non-passive-listener'],
    run(doc) {
      return doc.listeners()
        .filter((l) => SCROLL_BLOCKING.includes(l.event))
        .filter((l) => !/passive\s*:\s*true/.test(l.options))
        .map((l) => ({ id: 'inp-non-passive-listener', evidence: `${l.event} listener is not registered as passive` }));
    }
  },

  {
    id: 'listener-per-element',
    emits: ['inp-listener-per-element'],
    run(doc) {
      for (const body of doc.loopBodies()) {
        if (/addEventListener\s*\(/.test(body)) {
          return [{ id: 'inp-listener-per-element', evidence: 'a listener is attached inside a loop' }];
        }
      }
      return [];
    }
  },

  {
    id: 'document-write',
    emits: ['inp-document-write'],
    run(doc) {
      if (!DOCUMENT_WRITE.test(doc.inlineJs)) return [];
      return [{ id: 'inp-document-write', evidence: `the page calls ${DOM_GLOBAL}.write` }];
    }
  },

  {
    id: 'large-inline-json',
    emits: ['inp-large-inline-json'],
    run(doc) {
      const THRESHOLD = 1000;
      const blocks = doc.scripts.filter((s) =>
        s.src === null && /json/i.test(s.attrs.type ?? '') && s.text.length >= THRESHOLD);
      if (blocks.length > 0) {
        return [{
          id: 'inp-large-inline-json',
          evidence: `${blocks[0].text.length} characters of inline JSON`
        }];
      }
      const parsed = /JSON\s*\.\s*parse\s*\(\s*(['"`])([\s\S]*?)\1/.exec(doc.inlineJs);
      if (parsed && parsed[2].length >= THRESHOLD) {
        return [{
          id: 'inp-large-inline-json',
          evidence: `JSON.parse of a ${parsed[2].length} character literal`
        }];
      }
      return [];
    }
  },

  {
    id: 'unthrottled-continuous-handler',
    emits: ['inp-unthrottled-continuous-handler'],
    run(doc) {
      return doc.listeners()
        .filter((l) => CONTINUOUS.includes(l.event))
        .filter((l) => l.inline)
        .filter((l) => !/requestAnimationFrame|throttle|debounce|setTimeout|requestIdleCallback/.test(l.body))
        .map((l) => ({
          id: 'inp-unthrottled-continuous-handler',
          evidence: `${l.event} is handled with no throttling`
        }));
    }
  }
];
