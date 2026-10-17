/* ---------------------------------------------------------------------------
   selectors.mjs

   Does this stylesheet rule plausibly apply to this element?

   Plausibly is the honest word. Matching a selector properly needs the tree,
   the cascade and the specificity order, and this repository has a scanner
   rather than a parser. What it does is narrower and stated: it compares the
   compound selectors in a rule against the element's own tag, classes and
   id, and it reports a match when one of them could name it.

   The point of having it at all is that the first version of several of
   these rules asked whether aspect-ratio appeared anywhere in the
   stylesheet. On a page with one sized image and one unsized one, that
   question answers yes and the unsized image is never reported.
   --------------------------------------------------------------------------- */

const UNIVERSAL = new Set(['*', 'html', 'body']);

function compounds(selector) {
  return selector
    .split(',')
    .map((s) => s.trim())
    .flatMap((s) => s.split(/[\s>+~]+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function partsOf(compound) {
  const tag = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(compound);
  return {
    tag: tag ? tag[0].toLowerCase() : null,
    classes: [...compound.matchAll(/\.([-\w]+)/g)].map((m) => m[1]),
    id: (/#([-\w]+)/.exec(compound) || [])[1] ?? null
  };
}

export function elementClasses(element) {
  return (element.attrs.class || '').split(/\s+/).filter(Boolean);
}

/* True when some compound in the selector could name this element. A
   compound naming only a pseudo-class, an attribute or the universal
   selector counts, because those apply to anything. */
export function selectorCouldMatch(selector, element) {
  const classes = elementClasses(element);
  const id = element.attrs.id ?? null;

  for (const compound of compounds(selector)) {
    const bare = compound.replace(/::?[-\w()]+/g, '').replace(/\[[^\]]*\]/g, '');
    if (bare === '' || UNIVERSAL.has(bare)) return true;
    const p = partsOf(bare);
    if (p.tag && p.tag !== element.name) continue;
    if (p.id && p.id !== id) continue;
    if (p.classes.length && !p.classes.every((c) => classes.includes(c))) continue;
    if (!p.tag && !p.id && !p.classes.length) continue;
    return true;
  }
  return false;
}

/* Every declaration of `property` from a rule that could name this element,
   in source order. Empty when nothing sizes it. */
export function declarationsFor(doc, element, property) {
  return doc.cssRules
    .filter((r) => property in r.declarations)
    .filter((r) => selectorCouldMatch(r.selector, element))
    .map((r) => ({ selector: r.selector, value: r.declarations[property] }));
}

/* A declaration reserves space only when it resolves to a definite size
   before the content arrives.

   `height: auto` is a declaration of height and it reserves nothing, which
   is the whole reason an unsized image inside `width: 100%; height: auto` is
   the most common layout shift on the web. The first version of
   isSizedByStylesheet asked whether the property was declared at all, so it
   read that rule as reserved space and reported nothing on the example in
   this repository whose own comment names `height: auto` as the cause.

   min-height: 0 is the same mistake written differently, and the content
   keywords resolve against the content that has not arrived yet. */
const INDEFINITE = new Set([
  'auto', 'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'none', 'normal',
  'fit-content', 'max-content', 'min-content'
]);

const DEFINITE_LENGTH = /^-?\d*\.?\d+(px|r?em|v[hwib]|vmin|vmax|%|ch|ex|cm|mm|q|in|pt|pc)$/i;
const FUNCTIONAL = /^(calc|clamp|min|max|minmax)\s*\(/i;

export function reservesSpace(property, rawValue) {
  const value = String(rawValue).replace(/\s*!important\s*$/i, '').trim().toLowerCase();
  if (value === '' || INDEFINITE.has(value)) return false;

  if (property === 'aspect-ratio') return true;

  if (FUNCTIONAL.test(value)) return true;
  if (DEFINITE_LENGTH.test(value)) return Number.parseFloat(value) > 0;
  if (/^-?\d*\.?\d+$/.test(value)) return Number.parseFloat(value) > 0;
  return false;
}

export function isSizedByStylesheet(doc, element, properties) {
  return properties.some((property) => declarationsFor(doc, element, property)
    .some((d) => reservesSpace(property, d.value)));
}
