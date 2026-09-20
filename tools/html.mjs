/* ---------------------------------------------------------------------------
   html.mjs

   A very small HTML and JavaScript scanner, so the checks in checks.mjs can
   run with no dependencies at all. It is a scanner, not a parser: it finds
   tags, attributes, style blocks, script blocks and brace-matched bodies.

   That is enough for the examples in this repository, which are small and
   well formed on purpose. It is not enough for arbitrary pages, and the
   checks say so in their own limits.
   --------------------------------------------------------------------------- */

export function openingTags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

export function attr(tag, name) {
  const quoted = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  if (quoted) return quoted[2] !== undefined ? quoted[2] : quoted[3];
  const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i').exec(tag);
  if (bare) return bare[1];
  if (new RegExp(`\\b${name}\\b`, 'i').test(tag)) return '';
  return null;
}

export function hasAttr(tag, name) {
  return attr(tag, name) !== null;
}

export function section(html, name) {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(html);
  return m ? m[1] : '';
}

export function styleBlocks(html) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

export function css(html) {
  return styleBlocks(html).join('\n');
}

export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}

/* Every at-rule block of the given name, returned as the text between its
   braces. Used for @font-face, where the question is which descriptors a
   particular block does and does not carry. */
export function atRuleBlocks(cssText, ruleName) {
  const out = [];
  const re = new RegExp(`@${ruleName}\\b[^{]*\\{`, 'gi');
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const body = braceBody(cssText, m.index + m[0].length - 1);
    if (body !== null) out.push(body);
  }
  return out;
}

/* The text inside the braces that open at openIndex, respecting nesting.
   Returns null when the braces never close. */
export function braceBody(source, openIndex) {
  if (source[openIndex] !== '{') return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

/* The bodies of every block whose header matches the pattern. The pattern
   must end where the opening brace begins, for example /for\s*\(/ for loops
   or /addEventListener\s*\(/ for handlers. */
export function blockBodiesAfter(source, headerPattern) {
  const out = [];
  const re = new RegExp(headerPattern.source, headerPattern.flags.includes('g')
    ? headerPattern.flags
    : `${headerPattern.flags}g`);
  let m;
  while ((m = re.exec(source)) !== null) {
    const open = source.indexOf('{', m.index + m[0].length - 1);
    if (open === -1) continue;
    const body = braceBody(source, open);
    if (body !== null) out.push(body);
  }
  return out;
}

export function firstLineContaining(text, needle) {
  const line = text.split('\n').find((l) => l.includes(needle));
  return line ? line.trim() : needle;
}
