/* ---------------------------------------------------------------------------
   rules/lcp.mjs

   Rules that report findings against largest contentful paint, grouped by
   the phase of the metric they belong to.

   Every rule declares the exact set of finding ids it can emit. The verifier
   asserts that set against what the rule actually emits over the fixtures,
   in both directions, so a rule cannot quietly stop firing and a finding
   cannot sit in the catalogue having never been observed.
   --------------------------------------------------------------------------- */

import { declarationsFor } from '../selectors.mjs';

const LEGACY = /\.(jpe?g|png|gif)(\?|$)/i;
const MODERN = /\.(avif|webp)(\?|$)/i;
const IMAGE_URL = /\.(avif|webp|jpe?g|png|gif|svg)(\?|$)/i;

function origin(url) {
  const m = /^(https?:)?\/\/([^/]+)/i.exec(url || '');
  return m ? m[2].toLowerCase() : null;
}

function heroImage(doc) {
  return doc.inBody('img')[0] ?? null;
}

export const rules = [
  {
    id: 'client-side-redirect',
    emits: ['lcp-client-side-redirect'],
    run(doc) {
      const meta = doc.inHead('meta').find((e) =>
        (e.attrs['http-equiv'] || '').toLowerCase() === 'refresh');
      if (meta) {
        return [{ id: 'lcp-client-side-redirect', evidence: `meta refresh, content ${meta.attrs.content ?? ''}` }];
      }
      const inHeadScript = doc.scripts.find((s) => s.region === 'head' && s.src === null
        && /location\s*(\.\s*(replace|assign|href)\s*(\(|=))/.test(s.text));
      if (inHeadScript) {
        return [{ id: 'lcp-client-side-redirect', evidence: 'a script in the head assigns location' }];
      }
      return [];
    }
  },

  {
    id: 'hero-discovery',
    emits: ['lcp-hero-lazy', 'lcp-hero-no-fetchpriority'],
    run(doc) {
      const hero = heroImage(doc);
      if (!hero) return [];
      const out = [];
      if ((hero.attrs.loading || '').toLowerCase() === 'lazy') {
        out.push({ id: 'lcp-hero-lazy', evidence: hero.raw.slice(0, 140) });
      }
      if ((hero.attrs.fetchpriority || '').toLowerCase() !== 'high') {
        out.push({ id: 'lcp-hero-no-fetchpriority', evidence: `first body image: ${hero.attrs.src ?? '(no src)'}` });
      }
      return out;
    }
  },

  {
    id: 'hero-bytes',
    emits: ['lcp-hero-no-srcset', 'lcp-hero-legacy-format-only'],
    run(doc) {
      const hero = heroImage(doc);
      if (!hero) return [];
      const out = [];
      const sources = doc.all('source');
      const anySrcset = hero.attrs.srcset !== undefined
        || sources.some((s) => s.attrs.srcset !== undefined);
      if (!anySrcset) {
        out.push({ id: 'lcp-hero-no-srcset', evidence: `one candidate only: ${hero.attrs.src ?? ''}` });
      }
      const candidates = [hero.attrs.src ?? '', hero.attrs.srcset ?? '',
        ...sources.map((s) => `${s.attrs.srcset ?? ''} ${s.attrs.type ?? ''}`)].join(' ');
      if (LEGACY.test(hero.attrs.src ?? '') && !MODERN.test(candidates) && !/image\/(avif|webp)/i.test(candidates)) {
        out.push({ id: 'lcp-hero-legacy-format-only', evidence: `only ${hero.attrs.src} is offered` });
      }
      return out;
    }
  },

  {
    id: 'background-candidate',
    emits: ['lcp-background-image-candidate'],
    run(doc) {
      /* Reported only when the body has no image element at all. A page with
         both has a candidate the preload scanner can see, and deciding which
         of the two paints largest is a measurement rather than a reading. */
      if (doc.inBody('img').length > 0) return [];
      const rule = doc.cssRules.find((r) =>
        ['background', 'background-image'].some((p) =>
          p in r.declarations && /url\(/i.test(r.declarations[p])));
      if (!rule) return [];
      return [{ id: 'lcp-background-image-candidate', evidence: `${rule.selector} sets a background image` }];
    }
  },

  {
    id: 'script-assigned-source',
    emits: ['lcp-image-source-set-by-script'],
    run(doc) {
      /* Narrowed to image sources. Reading every `.src =` assignment as an
         image reported the corrected page of example 11, which assigns a
         src to a script element it has just created in order to load a chat
         widget late, which is the fix rather than the defect. An assignment
         counts when the value is an image URL, or when the receiver was
         made as an image. */
      const makesImage = /new\s+Image\s*\(|createElement\s*\(\s*['"]img['"]/i.test(doc.inlineJs);
      const assignments = [
        ...doc.inlineJs.matchAll(/\.\s*src\s*=\s*(['"`])([^'"`]*)\1/g),
        ...doc.inlineJs.matchAll(/setAttribute\s*\(\s*['"]src['"]\s*,\s*(['"`])([^'"`]*)\1/g)
      ].map((m) => m[2]);

      const imageLike = assignments.find((url) => IMAGE_URL.test(url));
      if (imageLike) {
        return [{ id: 'lcp-image-source-set-by-script', evidence: `a script assigns ${imageLike}` }];
      }
      if (makesImage && assignments.length > 0) {
        return [{ id: 'lcp-image-source-set-by-script', evidence: 'a script creates an image and assigns its source' }];
      }
      return [];
    }
  },

  {
    id: 'preload-hints',
    emits: ['lcp-preload-without-as', 'lcp-font-preload-without-crossorigin'],
    run(doc) {
      const out = [];
      for (const link of doc.links('preload')) {
        const as = (link.attrs.as ?? '').toLowerCase();
        if (as === '') {
          out.push({ id: 'lcp-preload-without-as', evidence: `preload of ${link.attrs.href ?? '(no href)'}` });
          continue;
        }
        if (as === 'font' && link.attrs.crossorigin === undefined) {
          out.push({
            id: 'lcp-font-preload-without-crossorigin',
            evidence: `font preload of ${link.attrs.href ?? '(no href)'}`
          });
        }
      }
      return out;
    }
  },

  {
    id: 'third-party-origins',
    emits: ['lcp-third-party-origin-without-preconnect'],
    run(doc) {
      const hinted = new Set([...doc.links('preconnect'), ...doc.links('dns-prefetch')]
        .map((l) => origin(l.attrs.href))
        .filter(Boolean));

      const blocking = [
        ...doc.links('stylesheet').map((l) => l.attrs.href),
        ...doc.scripts.filter((s) => s.region === 'head' && s.src
          && s.attrs.defer === undefined && s.attrs.async === undefined
          && (s.attrs.type ?? '').toLowerCase() !== 'module').map((s) => s.src),
        ...doc.fontFaces.flatMap((f) => [...(f.src ?? '').matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]))
      ];

      const missing = [...new Set(blocking.map(origin).filter(Boolean))]
        .filter((o) => !hinted.has(o));

      return missing.map((o) => ({
        id: 'lcp-third-party-origin-without-preconnect',
        evidence: `render blocking resource from ${o} with no connection hint`
      }));
    }
  },

  {
    id: 'srcset-sizes',
    emits: ['lcp-srcset-widths-without-sizes'],
    run(doc) {
      const out = [];
      for (const el of [...doc.all('img'), ...doc.all('source')]) {
        const srcset = el.attrs.srcset;
        if (srcset === undefined) continue;
        if (!/\d+w(\s*,|\s*$)/.test(srcset)) continue;
        if (el.attrs.sizes !== undefined) continue;
        out.push({ id: 'lcp-srcset-widths-without-sizes', evidence: `${el.name} with width descriptors and no sizes` });
      }
      return out;
    }
  },

  {
    id: 'import-chain',
    emits: ['lcp-import-chain'],
    run(doc) {
      const m = /@import\b[^;]*/i.exec(doc.css);
      if (!m) return [];
      return [{ id: 'lcp-import-chain', evidence: m[0].trim().slice(0, 120) }];
    }
  },

  {
    id: 'font-display',
    emits: ['lcp-font-display-missing'],
    run(doc) {
      /* A face whose only source is local() resolves without a network
         request, so it cannot block on a font file and font-display has
         nothing to govern. Reporting those would be noise. */
      return doc.fontFaces
        .filter((f) => f.hasNetworkSource && f.display === null)
        .map((f) => ({
          id: 'lcp-font-display-missing',
          evidence: `@font-face for ${f.family ?? '(unnamed family)'} has no font-display`
        }));
    }
  },

  {
    id: 'blocking-script-in-head',
    emits: ['lcp-blocking-script-in-head'],
    run(doc) {
      return doc.scripts
        .filter((s) => s.region === 'head' && s.src !== null)
        .filter((s) => s.attrs.defer === undefined && s.attrs.async === undefined)
        .filter((s) => (s.attrs.type ?? '').toLowerCase() !== 'module')
        .map((s) => ({ id: 'lcp-blocking-script-in-head', evidence: `blocking script ${s.src}` }));
    }
  },

  {
    id: 'stylesheet-medium',
    emits: ['lcp-blocking-stylesheet-for-another-medium'],
    run(doc) {
      return doc.links('stylesheet')
        .filter((l) => /print/i.test(l.attrs.href ?? ''))
        .filter((l) => {
          const media = (l.attrs.media ?? '').toLowerCase().trim();
          return media === '' || media === 'all';
        })
        .map((l) => ({
          id: 'lcp-blocking-stylesheet-for-another-medium',
          evidence: `${l.attrs.href} blocks rendering with no media attribute`
        }));
    }
  },

  {
    id: 'anti-flicker',
    emits: ['lcp-content-hidden-until-script-runs'],
    run(doc) {
      const hiding = doc.cssRules.find((r) => {
        const opacity = r.declarations.opacity;
        const visibility = r.declarations.visibility;
        return (opacity !== undefined && Number(opacity) === 0)
          || (visibility !== undefined && visibility.trim() === 'hidden');
      });
      if (!hiding) return [];
      const revealed = /style\s*\.\s*(opacity|visibility)|classList\s*\.\s*remove|\.\s*className\s*=/.test(doc.inlineJs);
      if (!revealed) return [];
      return [{
        id: 'lcp-content-hidden-until-script-runs',
        evidence: `${hiding.selector} is hidden until a script clears it`
      }];
    }
  }
];
