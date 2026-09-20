/* ---------------------------------------------------------------------------
   checks.mjs

   One check per example pair. Each check is a static detector for a defect
   that costs Core Web Vitals, written so that it fires on examples/<id>/fail.html
   and does not fire on examples/<id>/pass.html.

   Every check carries two sentences that matter more than the code: what
   finding it proves, and what it does not. A detector that flags
   loading="lazy" on a hero has found a real problem. It has not measured
   anything, and it cannot tell you whether that image is the LCP element on
   a real visit, which only field data decides.
   --------------------------------------------------------------------------- */

import {
  openingTags, attr, section, css, inlineScripts,
  atRuleBlocks, blockBodiesAfter, firstLineContaining
} from './html.mjs';

const LAYOUT_READS = /offsetHeight|offsetWidth|offsetTop|offsetLeft|clientHeight|clientWidth|scrollHeight|scrollWidth|getBoundingClientRect|getComputedStyle/;
const STYLE_WRITES = /\.style\.|\.classList\.|\.setAttribute\(\s*['"]style/;
const YIELDS = /await\b|scheduler\s*\.\s*yield|setTimeout|requestIdleCallback|requestAnimationFrame/;

export const checks = [
  {
    id: '01-lazy-hero',
    metric: 'LCP',
    phase: 'load delay',
    title: 'The hero image is lazy loaded',
    proves: 'The browser is told not to prioritise the first image on the page, so it is discovered late no matter how small it is.',
    doesNotProve: 'That this image is the LCP element. Only field attribution decides that, and on a text-heavy template it often is not.',
    detect(html) {
      const body = section(html, 'body') || html;
      const first = openingTags(body, 'img')[0];
      if (!first) return { found: false };
      const loading = attr(first, 'loading');
      if (loading && loading.toLowerCase() === 'lazy') {
        return { found: true, evidence: first.slice(0, 160) };
      }
      return { found: false };
    }
  },
  {
    id: '02-css-background-hero',
    metric: 'LCP',
    phase: 'load delay',
    title: 'The hero is a CSS background image',
    proves: 'The preload scanner cannot see the image. It is discovered only once the stylesheet has arrived and been applied, which adds the whole CSS round trip to load delay.',
    doesNotProve: 'That the background is the LCP element. A background image is an LCP candidate only when it is the largest painted element.',
    detect(html) {
      const sheet = css(html);
      const hasBackground = /background(-image)?\s*:\s*[^;]*url\(/i.test(sheet);
      const hasImg = openingTags(section(html, 'body') || html, 'img').length > 0;
      if (hasBackground && !hasImg) {
        return { found: true, evidence: firstLineContaining(sheet, 'url(') };
      }
      return { found: false };
    }
  },
  {
    id: '03-css-import-chain',
    metric: 'LCP',
    phase: 'render delay',
    title: 'Stylesheets are chained with @import',
    proves: 'The second stylesheet is not requested until the first has arrived and been parsed, so two render blocking round trips happen one after the other instead of together.',
    doesNotProve: 'How much time this costs. On a fast connection with warm DNS it can be tens of milliseconds, and on a slow mobile connection it can be a second.',
    detect(html) {
      const sheet = css(html);
      if (/@import\b/i.test(sheet)) {
        return { found: true, evidence: firstLineContaining(sheet, '@import') };
      }
      return { found: false };
    }
  },
  {
    id: '04-font-display-block',
    metric: 'LCP',
    phase: 'render delay',
    title: 'A web font blocks text rendering',
    proves: 'With no font-display descriptor the browser hides the text for up to three seconds waiting for the font file, and text is frequently the LCP element.',
    doesNotProve: 'That switching to swap is free. It is not: swapping fonts with different metrics is a CLS source, which is what example 08 is about.',
    detect(html) {
      const blocks = atRuleBlocks(css(html), 'font-face');
      // A face whose only source is local() resolves without a network
      // request, so it cannot block on a font file and font-display has
      // nothing to govern. Flagging those would be noise.
      const networkFaces = blocks.filter((b) => /src\s*:[^;]*url\(/i.test(b));
      const blocking = networkFaces.find((b) => !/font-display\s*:/i.test(b));
      if (blocking) {
        return { found: true, evidence: `@font-face with no font-display: ${blocking.trim().split('\n')[0].trim()}` };
      }
      return { found: false };
    }
  },
  {
    id: '05-unsized-image',
    metric: 'CLS',
    phase: 'layout shift',
    title: 'An image reserves no space before it loads',
    proves: 'The image occupies zero height until its bytes arrive, then everything below it moves. This is the single most common CLS source.',
    doesNotProve: 'That the shift is large enough to matter. A shift below the fold that nobody has scrolled to does not count towards CLS.',
    detect(html) {
      const sheet = css(html);
      if (/aspect-ratio\s*:/i.test(sheet)) return { found: false };
      const unsized = openingTags(section(html, 'body') || html, 'img')
        .find((t) => attr(t, 'width') === null || attr(t, 'height') === null);
      if (unsized) return { found: true, evidence: unsized.slice(0, 160) };
      return { found: false };
    }
  },
  {
    id: '06-unreserved-embed',
    metric: 'CLS',
    phase: 'layout shift',
    title: 'A third party embed has no reserved space',
    proves: 'The slot is empty until a network response arrives from a server you do not control, and then it pushes the page down at an unpredictable moment.',
    doesNotProve: 'What size to reserve. An ad slot that fills variably is a design decision, not a code fix, and reserving the wrong height trades a shift for a gap.',
    detect(html) {
      const sheet = css(html);
      if (/min-height\s*:/i.test(sheet) || /aspect-ratio\s*:/i.test(sheet)) return { found: false };
      const loose = openingTags(html, 'iframe').find((t) => attr(t, 'height') === null);
      if (loose) return { found: true, evidence: loose.slice(0, 160) };
      return { found: false };
    }
  },
  {
    id: '07-injected-banner',
    metric: 'CLS',
    phase: 'layout shift',
    title: 'A banner is injected at the top of the page after load',
    proves: 'Content is inserted above content the user is already reading, which moves the whole page. Consent banners and promotion bars are the usual owners.',
    doesNotProve: 'That the banner is the largest shift. A CLS score is a sum of session windows, and a single dramatic shift can still score below a series of small ones.',
    detect(html) {
      for (const js of inlineScripts(html)) {
        if (/insertBefore\s*\(|\.prepend\s*\(|insertAdjacentHTML\s*\(\s*['"]afterbegin/i.test(js)) {
          return { found: true, evidence: firstLineContaining(js, js.includes('prepend') ? 'prepend' : 'insert') };
        }
      }
      return { found: false };
    }
  },
  {
    id: '08-font-metric-mismatch',
    metric: 'CLS',
    phase: 'layout shift',
    title: 'A font swaps into different metrics',
    proves: 'The fallback font and the web font take different amounts of space, so every line of text reflows at the moment of the swap. This is the CLS that appears after somebody fixes example 04.',
    doesNotProve: 'The size of the shift. That depends on how far apart the two fonts actually are, which you measure rather than assume.',
    detect(html) {
      const sheet = css(html);
      const swaps = /font-display\s*:\s*(swap|optional|fallback)/i.test(sheet);
      const adjusted = /size-adjust\s*:|ascent-override\s*:|descent-override\s*:|line-gap-override\s*:/i.test(sheet);
      if (swaps && !adjusted) {
        return { found: true, evidence: firstLineContaining(sheet, 'font-display') };
      }
      return { found: false };
    }
  },
  {
    id: '09-long-task-handler',
    metric: 'INP',
    phase: 'processing',
    title: 'An event handler runs to completion without yielding',
    proves: 'The handler holds the main thread for the whole of its work, so the browser cannot paint a response until it finishes. INP measures exactly that wait.',
    doesNotProve: 'That the handler is slow. A loop over ten items is fine. The detector flags the shape, and the field data says whether the shape costs anything here.',
    detect(html) {
      for (const js of inlineScripts(html)) {
        for (const body of blockBodiesAfter(js, /addEventListener\s*\([^)]*,/)) {
          const loops = /\bfor\s*\(|\bwhile\s*\(|\.forEach\s*\(|\.map\s*\(/.test(body);
          if (loops && !YIELDS.test(body)) {
            return { found: true, evidence: 'handler contains a loop and never yields to the main thread' };
          }
        }
      }
      return { found: false };
    }
  },
  {
    id: '10-layout-thrash',
    metric: 'INP',
    phase: 'presentation',
    title: 'Layout is read and written in the same loop',
    proves: 'Each read forces the browser to flush the writes from the previous iteration, so a loop over n elements causes n synchronous layouts instead of one.',
    doesNotProve: 'That splitting the loop is enough. If the write itself changes layout for the whole page, batching moves the cost rather than removing it.',
    detect(html) {
      for (const js of inlineScripts(html)) {
        for (const body of blockBodiesAfter(js, /\b(for|while)\s*\(|\.forEach\s*\(/)) {
          if (LAYOUT_READS.test(body) && STYLE_WRITES.test(body)) {
            return { found: true, evidence: 'a loop body both reads layout and writes style' };
          }
        }
      }
      return { found: false };
    }
  },
  {
    id: '11-blocking-third-party',
    metric: 'INP',
    phase: 'input delay',
    title: 'A third party script blocks parsing in the head',
    proves: 'Parsing stops until the script has been fetched, parsed and executed. That delays first paint, and the execution occupies the main thread while the user is trying to interact.',
    doesNotProve: 'That defer is the right fix. A tag manager that must run before consent, or an anti-flicker snippet, has a reason to be where it is, and the fix is to argue about the requirement rather than the attribute.',
    detect(html) {
      const head = section(html, 'head');
      const blocking = openingTags(head, 'script').find((t) => {
        if (attr(t, 'src') === null) return false;
        if (attr(t, 'defer') !== null || attr(t, 'async') !== null) return false;
        const type = attr(t, 'type');
        return !(type && type.toLowerCase() === 'module');
      });
      if (blocking) return { found: true, evidence: blocking.slice(0, 160) };
      return { found: false };
    }
  }
];

export function checkById(id) {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`No check with id ${id}`);
  return found;
}
