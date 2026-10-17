/* ---------------------------------------------------------------------------
   collect.mjs

   The collector. It reads a document and reports what is in it. It decides
   nothing.

   This split is the reason the rules in lib/rules are testable without a
   browser and without a page. Everything that has to look at raw text lives
   here and returns a plain object; everything that has an opinion lives in a
   rule and takes that object as its only input. The verifier asserts the
   split by failing if any rule file touches a regular expression against raw
   HTML or reaches for `document`.

   It is a scanner, not a parser. It finds tags, attributes, style blocks,
   script blocks and brace-matched bodies, which is enough for the fixtures
   and examples here, all of which are small and well formed on purpose. It
   is not enough for arbitrary pages, and lib/catalogue.mjs says so against
   every finding that depends on it.
   --------------------------------------------------------------------------- */

import { attr, braceBody, blockBodiesAfter, atRuleBlocks } from '../tools/html.mjs';

const VOID_OR_OPEN = /<([a-zA-Z][a-zA-Z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/* Attributes present with no value are collected as the empty string, which
   is what the HTML specification says they mean, so `defer` and `defer=""`
   are the same thing to every rule. Absent is null. The distinction matters:
   `loading=""` is not `loading="lazy"`, and a rule that used truthiness
   would read both as absent. */
function attributesOf(raw) {
  /* The attribute region is everything after the tag name and before the
     closing bracket. It is walked with a tokeniser rather than searched,
     because a search for name-shaped words finds them inside quoted values
     too: the first version of this function read alt="Harvest table set for
     a tasting" as five attributes named harvest, table, set, for and a. A
     tokeniser cannot do that, because it consumes the quoted value as part
     of the attribute it belongs to. */
  const open = /^<[a-zA-Z][a-zA-Z0-9-]*/.exec(raw);
  if (!open) return {};
  let region = raw.slice(open[0].length, raw.endsWith('/>') ? -2 : -1);
  const token = /\s*([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?/y;
  const out = {};
  token.lastIndex = 0;
  let m;
  while ((m = token.exec(region)) !== null) {
    if (m[0].trim() === '') break;
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (!(name in out)) out[name] = value;
  }
  return out;
}

function regionOf(index, bodyStart) {
  if (bodyStart === -1) return 'body';
  return index < bodyStart ? 'head' : 'body';
}

/* @font-face blocks, read into the descriptors a rule actually asks about.
   `hasNetworkSource` is the one that decides whether font-display has
   anything to govern: a face whose only source is local() resolves with no
   request and cannot block on a font file. */
function fontFaces(cssText) {
  return atRuleBlocks(cssText, 'font-face').map((body) => {
    const descriptor = (name) => {
      const m = new RegExp(`${name}\\s*:\\s*([^;}]+)`, 'i').exec(body);
      return m ? m[1].trim() : null;
    };
    return {
      body,
      family: descriptor('font-family'),
      display: descriptor('font-display'),
      src: descriptor('src'),
      hasNetworkSource: /src\s*:[^;}]*url\(/i.test(body),
      metricOverrides: ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']
        .filter((d) => new RegExp(`${d}\\s*:`, 'i').test(body))
    };
  });
}

/* Declaration blocks keyed by selector.

   This is a recursive walk rather than a scan for `selector {`, because a
   scan finds the inside of at-rules too. The first version of this function
   read every `@font-face { font-family: 'Gazette'; ... }` block as an
   ordinary style rule with the selector `font-face`, which made two rules
   report findings against a declaration that is not a style declaration at
   all. At-rules that contain style rules are descended into and the
   condition is recorded; at-rules that contain descriptors or keyframe
   steps are skipped. */
const CONDITIONAL_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'scope']);

function declarationsOf(body) {
  const out = {};
  let depth = 0;
  let current = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  for (const part of parts) {
    const text = part.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!text) continue;
    const colon = text.indexOf(':');
    if (colon === -1) continue;
    const prop = text.slice(0, colon).trim().toLowerCase();
    if (!prop || /[{}]/.test(prop)) continue;
    out[prop] = text.slice(colon + 1).trim();
  }
  return out;
}

function ruleBlocks(cssText, conditions = []) {
  const out = [];
  let i = 0;
  while (i < cssText.length) {
    const open = cssText.indexOf('{', i);
    if (open === -1) break;
    const prelude = cssText.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const body = braceBody(cssText, open);
    if (body === null) break;
    const after = open + body.length + 2;

    if (prelude.startsWith('@')) {
      const name = (/^@([-\w]+)/.exec(prelude) || [])[1]?.toLowerCase() ?? '';
      if (CONDITIONAL_AT_RULES.has(name)) {
        out.push(...ruleBlocks(body, [...conditions, prelude]));
      }
      /* @font-face, @keyframes, @page, @property and the rest hold
         descriptors or steps rather than style rules, and the collector
         surfaces the ones that matter through their own accessors. */
    } else if (prelude && !body.includes('{')) {
      out.push({
        selector: prelude,
        conditions,
        declarations: declarationsOf(body),
        body
      });
    }

    i = after;
  }
  return out;
}

export function collect(html) {
  const bodyOpen = /<body\b/i.exec(html);
  const bodyStart = bodyOpen ? bodyOpen.index : -1;

  const elements = [];
  VOID_OR_OPEN.lastIndex = 0;
  let m;
  while ((m = VOID_OR_OPEN.exec(html)) !== null) {
    const name = m[1].toLowerCase();
    if (name === '!doctype') continue;
    elements.push({
      name,
      raw: m[0],
      at: m.index,
      region: regionOf(m.index, bodyStart),
      attrs: attributesOf(m[0])
    });
  }

  const styles = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html)) !== null) styles.push({ text: m[1], at: m.index });
  const cssText = styles.map((s) => s.text).join('\n');

  const scripts = [];
  const scriptRe = /<script\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = attributesOf(`<script${m[1]}>`);
    scripts.push({
      attrs,
      src: attrs.src ?? null,
      text: attrs.src === undefined ? m[2] : '',
      at: m.index,
      region: regionOf(m.index, bodyStart)
    });
  }

  const inlineJs = scripts.filter((s) => s.src === null).map((s) => s.text).join('\n;\n');

  return {
    html,
    css: cssText,
    styles,
    elements,
    scripts,
    inlineJs,
    fontFaces: fontFaces(cssText),
    cssRules: ruleBlocks(cssText),
    /* Convenience accessors. Every rule goes through these rather than
       scanning raw text, which is what keeps the rules free of HTML. */
    all(name) {
      return elements.filter((e) => e.name === name);
    },
    inHead(name) {
      return elements.filter((e) => e.name === name && e.region === 'head');
    },
    inBody(name) {
      return elements.filter((e) => e.name === name && e.region === 'body');
    },
    links(rel) {
      return elements.filter((e) => e.name === 'link'
        && (e.attrs.rel || '').toLowerCase().split(/\s+/).includes(rel));
    },
    declares(property) {
      return this.cssRules.filter((r) => property in r.declarations);
    },
    /* Every addEventListener call with its own handler body and its own
       options argument.

       The bodies and the events were separate lists in the first version,
       paired by position. They desynchronise the moment a listener is
       registered with a named callback, because a named callback has no
       brace to match and the body list is one shorter than the event list
       from that point on. Every later event then reads the body of the one
       before it. Here the body is found from the call it belongs to, and a
       listener with no inline body reports an empty one. */
    listeners() {
      const out = [];
      const re = /addEventListener\s*\(\s*(['"])([^'"]+)\1\s*,/g;
      let m;
      while ((m = re.exec(inlineJs)) !== null) {
        const after = m.index + m[0].length;
        const rest = inlineJs.slice(after);
        const preamble = /^\s*(?:async\s+)?(?:function\s*[\w$]*\s*\([^)]*\)|\([^)]*\)\s*=>|[\w$]+\s*=>)\s*\{/.exec(rest);
        if (!preamble) {
          out.push({ event: m[2], body: '', options: rest.slice(0, 200), inline: false });
          continue;
        }
        const open = after + preamble[0].length - 1;
        const body = braceBody(inlineJs, open) ?? '';
        const close = open + body.length + 1;
        out.push({
          event: m[2],
          body,
          options: inlineJs.slice(close, close + 200),
          inline: true
        });
      }
      return out;
    },

    handlerBodies() {
      return this.listeners().map((l) => l.body).filter(Boolean);
    },
    loopBodies() {
      return blockBodiesAfter(inlineJs, /\b(for|while)\s*\(|\.forEach\s*\(/);
    }
  };
}
