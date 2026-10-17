/* ---------------------------------------------------------------------------
   rules/cls.mjs

   Rules that report layout shift findings.

   Almost every one of them is the same shape: something occupies no space
   until it arrives, and then it arrives. The interesting part is the
   stylesheet question, which is whether anything actually reserves the
   space, and that is why these rules go through selectors.mjs rather than
   asking whether the property appears somewhere in the file.
   --------------------------------------------------------------------------- */

import { isSizedByStylesheet, elementClasses } from '../selectors.mjs';

const SIZING = ['aspect-ratio', 'min-height', 'height'];
const LAYOUT_PROPERTIES = /\b(width|height|top|left|right|bottom|margin|margin-top|margin-bottom|margin-left|margin-right|padding|inset|flex-basis)\b/;
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong'
]);
const CONTAINERS = new Set(['div', 'section', 'aside', 'ins', 'figure', 'article', 'footer', 'header']);
const SLOT_NAME = /(^|[-_])(ad|ads|advert|advertisement|banner|slot|embed|widget|promo)([-_]|$)/i;

function normalise(family) {
  return (family ?? '').replace(/['"]/g, '').trim().toLowerCase();
}

function hasBothDimensions(element) {
  return element.attrs.width !== undefined && element.attrs.height !== undefined;
}

export const rules = [
  {
    id: 'image-dimensions',
    emits: ['cls-image-without-dimensions'],
    run(doc) {
      return doc.inBody('img')
        .filter((img) => !hasBothDimensions(img))
        .filter((img) => !isSizedByStylesheet(doc, img, SIZING))
        .map((img) => ({
          id: 'cls-image-without-dimensions',
          evidence: `${img.attrs.src ?? '(no src)'} has no reserved space`
        }));
    }
  },

  {
    id: 'iframe-dimensions',
    emits: ['cls-iframe-without-dimensions'],
    run(doc) {
      return doc.all('iframe')
        .filter((frame) => frame.attrs.height === undefined)
        .filter((frame) => !isSizedByStylesheet(doc, frame, SIZING))
        .map((frame) => ({
          id: 'cls-iframe-without-dimensions',
          evidence: `iframe ${frame.attrs.src ?? '(no src)'} has no reserved height`
        }));
    }
  },

  {
    id: 'video-dimensions',
    emits: ['cls-video-without-dimensions'],
    run(doc) {
      return doc.all('video')
        .filter((video) => !hasBothDimensions(video) && video.attrs.poster === undefined)
        .filter((video) => !isSizedByStylesheet(doc, video, SIZING))
        .map((video) => ({
          id: 'cls-video-without-dimensions',
          evidence: 'a video has neither dimensions, a poster, nor a size in the stylesheet'
        }));
    }
  },

  {
    id: 'injection-above-content',
    emits: ['cls-injected-above-existing-content'],
    run(doc) {
      const patterns = [
        [/insertAdjacentHTML\s*\(\s*['"]afterbegin['"]/, 'insertAdjacentHTML at afterbegin'],
        [/\.\s*prepend\s*\(/, 'prepend'],
        [/insertBefore\s*\(/, 'insertBefore']
      ];
      for (const [pattern, name] of patterns) {
        if (pattern.test(doc.inlineJs)) {
          return [{ id: 'cls-injected-above-existing-content', evidence: `a script calls ${name}` }];
        }
      }
      return [];
    }
  },

  {
    id: 'font-swap-metrics',
    emits: ['cls-font-swap-unmatched'],
    run(doc) {
      /* The metric overrides almost never sit on the swapping face itself.
         The idiomatic fix declares a second, local-only face carrying
         size-adjust and the override descriptors and names it immediately
         after the web font in the stack, so the text is laid out at the web
         font's metrics before the web font arrives.

         An earlier version of this rule looked for overrides on the
         swapping face and therefore reported the corrected example in this
         repository as a defect. A face is matched when a stack names it and
         then names an adjusted face after it. */
      const adjusted = new Set(doc.fontFaces
        .filter((f) => f.metricOverrides.length > 0)
        .map((f) => normalise(f.family)));

      const matched = new Set();
      for (const rule of doc.cssRules) {
        const value = rule.declarations['font-family'];
        if (value === undefined) continue;
        const stack = value.split(',').map(normalise);
        for (let i = 0; i < stack.length; i += 1) {
          if (stack.slice(i + 1).some((later) => adjusted.has(later))) matched.add(stack[i]);
        }
      }

      return doc.fontFaces
        .filter((f) => f.hasNetworkSource)
        .filter((f) => ['swap', 'fallback', 'optional'].includes((f.display ?? '').toLowerCase()))
        .filter((f) => f.metricOverrides.length === 0)
        .filter((f) => !matched.has(normalise(f.family)))
        .map((f) => ({
          id: 'cls-font-swap-unmatched',
          evidence: `${f.family ?? '(unnamed family)'} swaps in with nothing to match its metrics`
        }));
    }
  },

  {
    id: 'font-stack-fallback',
    emits: ['cls-font-stack-without-fallback'],
    run(doc) {
      const faces = new Set(doc.fontFaces.map((f) => normalise(f.family)).filter(Boolean));
      if (faces.size === 0) return [];

      const out = [];
      for (const rule of doc.cssRules) {
        const value = rule.declarations['font-family'];
        if (value === undefined) continue;
        const families = value.split(',').map(normalise);
        if (families.length > 1) continue;
        if (!faces.has(families[0])) continue;
        if (GENERIC_FAMILIES.has(families[0])) continue;
        out.push({
          id: 'cls-font-stack-without-fallback',
          evidence: `${rule.selector} names ${families[0]} with nothing to fall back to`
        });
      }
      return out;
    }
  },

  {
    id: 'animated-layout-property',
    emits: ['cls-layout-property-animated'],
    run(doc) {
      const out = [];
      for (const rule of doc.cssRules) {
        for (const property of ['transition', 'transition-property', 'animation']) {
          const value = rule.declarations[property];
          if (value === undefined) continue;
          /* `transition: all` animates layout properties too, and it is the
             declaration most likely to be written without noticing that. */
          if (!LAYOUT_PROPERTIES.test(value) && !/\ball\b/.test(value)) continue;
          out.push({
            id: 'cls-layout-property-animated',
            evidence: `${rule.selector} declares ${property}: ${value}`
          });
          break;
        }
      }
      return out;
    }
  },

  {
    id: 'reserved-slot',
    emits: ['cls-reserved-slot-missing'],
    run(doc) {
      /* Container elements only. The name test on its own reported a
         button labelled with a time and carrying the class `slot`, which is
         a control with text in it rather than an empty box waiting on a
         third party. A slot that shifts the page is a container. */
      const named = doc.elements.filter((el) => {
        if (el.region !== 'body') return false;
        if (!CONTAINERS.has(el.name)) return false;
        const names = [...elementClasses(el), el.attrs.id ?? ''].filter(Boolean);
        return names.some((n) => SLOT_NAME.test(n));
      });

      return named
        .filter((el) => !isSizedByStylesheet(doc, el, SIZING))
        .map((el) => ({
          id: 'cls-reserved-slot-missing',
          evidence: `${el.name}${el.attrs.id ? `#${el.attrs.id}` : ''}${elementClasses(el).map((c) => `.${c}`).join('')} has no reserved height`
        }));
    }
  },

  {
    id: 'font-optional-preload',
    emits: ['cls-font-display-optional-without-preload'],
    run(doc) {
      const optional = doc.fontFaces.filter((f) =>
        f.hasNetworkSource && (f.display ?? '').toLowerCase() === 'optional');
      if (optional.length === 0) return [];
      const preloadsFont = doc.links('preload')
        .some((l) => (l.attrs.as ?? '').toLowerCase() === 'font');
      if (preloadsFont) return [];
      return optional.map((f) => ({
        id: 'cls-font-display-optional-without-preload',
        evidence: `${f.family ?? '(unnamed family)'} is optional and never preloaded`
      }));
    }
  },

  {
    id: 'lazy-and-unsized-hero',
    emits: ['cls-lazy-loaded-above-the-fold'],
    run(doc) {
      const hero = doc.inBody('img')[0];
      if (!hero) return [];
      if ((hero.attrs.loading ?? '').toLowerCase() !== 'lazy') return [];
      if (hasBothDimensions(hero)) return [];
      if (isSizedByStylesheet(doc, hero, SIZING)) return [];
      return [{
        id: 'cls-lazy-loaded-above-the-fold',
        evidence: 'the first image is both deprioritised and unsized'
      }];
    }
  }
];
