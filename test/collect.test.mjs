import { test } from 'node:test';
import assert from 'node:assert/strict';

import { collect } from '../lib/collect.mjs';
import { reservesSpace, selectorCouldMatch } from '../lib/selectors.mjs';

/* Three of these are regression tests for defects the collector shipped
   with while it was being written, and each one made a rule report the
   wrong thing rather than fail loudly. They are the reason the collector is
   a separate module with its own tests instead of a few helpers inside the
   rules. */

test('attribute values are not read as attribute names', () => {
  const doc = collect('<body><img src="/a.png" alt="Harvest table set for a tasting" loading="lazy"></body>');
  const img = doc.all('img')[0];
  assert.deepEqual(Object.keys(img.attrs).sort(), ['alt', 'loading', 'src']);
  assert.equal(img.attrs.alt, 'Harvest table set for a tasting');
  /* Scanning for name-shaped words found five of them inside that alt text. */
  assert.equal(img.attrs.table, undefined);
  assert.equal(img.attrs.for, undefined);
});

test('a valueless attribute is the empty string and an absent one is undefined', () => {
  const doc = collect('<head><script src="/a.js" defer></script></head>');
  const script = doc.scripts[0];
  assert.equal(script.attrs.defer, '');
  assert.equal(script.attrs.async, undefined);
});

test('an at-rule is not read as a style rule', () => {
  const doc = collect(`<style>
    @font-face { font-family: 'Gazette'; src: url('/g.woff2'); font-display: swap; }
    body { font-family: 'Gazette', Georgia, serif; }
  </style>`);
  assert.deepEqual(doc.cssRules.map((r) => r.selector), ['body']);
  assert.equal(doc.fontFaces.length, 1);
  assert.equal(doc.fontFaces[0].display, 'swap');
  assert.equal(doc.fontFaces[0].hasNetworkSource, true);
});

test('style rules inside a media query are collected with their condition', () => {
  const doc = collect(`<style>
    @media (min-width: 40em) { .hero { min-height: 400px; } }
  </style>`);
  assert.equal(doc.cssRules.length, 1);
  assert.equal(doc.cssRules[0].selector, '.hero');
  assert.equal(doc.cssRules[0].conditions.length, 1);
  assert.ok(doc.cssRules[0].conditions[0].includes('min-width'));
});

test('a declaration value containing a function is not split on its semicolons', () => {
  const doc = collect('<style>.a { background: url("/x.png?a=1&b=2"); height: calc(100% - 2rem); }</style>');
  assert.equal(doc.cssRules[0].declarations.height, 'calc(100% - 2rem)');
});

test('a listener keeps its own handler body when an earlier one is named', () => {
  /* Paired by position, the named wheel listener has no body, so the scroll
     listener below it read the wheel listener's place in the body list and
     every assertion about its contents was about the wrong function. */
  const doc = collect(`<body><script>
    document.addEventListener('wheel', cancelZoom);
    window.addEventListener('scroll', function () { requestAnimationFrame(paint); });
  </script></body>`);
  const listeners = doc.listeners();
  assert.deepEqual(listeners.map((l) => l.event), ['wheel', 'scroll']);
  assert.equal(listeners[0].inline, false);
  assert.equal(listeners[0].body, '');
  assert.ok(listeners[1].body.includes('requestAnimationFrame'));
});

test('the options argument is read from after the handler body', () => {
  const doc = collect(`<body><script>
    el.addEventListener('touchstart', function (e) { log('passive: true'); }, { passive: true });
  </script></body>`);
  const [listener] = doc.listeners();
  assert.ok(/passive\s*:\s*true/.test(listener.options));
});

test('head and body are told apart by position', () => {
  const doc = collect('<head><script src="/a.js"></script></head><body><script src="/b.js"></script></body>');
  assert.deepEqual(doc.scripts.map((s) => s.region), ['head', 'body']);
});

test('a definite size reserves space and an indefinite one does not', () => {
  assert.equal(reservesSpace('height', 'auto'), false);
  assert.equal(reservesSpace('height', '0'), false);
  assert.equal(reservesSpace('min-height', '0px'), false);
  assert.equal(reservesSpace('height', '320px'), true);
  assert.equal(reservesSpace('min-height', '50vh'), true);
  assert.equal(reservesSpace('height', 'calc(100vh - 4rem)'), true);
  assert.equal(reservesSpace('height', '240px !important'), true);
  assert.equal(reservesSpace('aspect-ratio', '16 / 9'), true);
  assert.equal(reservesSpace('aspect-ratio', 'auto'), false);
  assert.equal(reservesSpace('height', 'fit-content'), false);
  assert.equal(reservesSpace('height', 'max-content'), false);
});

test('a selector matches an element only when a compound could name it', () => {
  const doc = collect('<body><img class="card__image wide" id="hero" src="/a.png"></body>');
  const img = doc.all('img')[0];
  assert.equal(selectorCouldMatch('.card__image', img), true);
  assert.equal(selectorCouldMatch('img', img), true);
  assert.equal(selectorCouldMatch('#hero', img), true);
  assert.equal(selectorCouldMatch('.card__image.wide', img), true);
  assert.equal(selectorCouldMatch('.card__image.narrow', img), false);
  assert.equal(selectorCouldMatch('figure .promo', img), false);
  assert.equal(selectorCouldMatch('video', img), false);
  assert.equal(selectorCouldMatch('*', img), true);
});
