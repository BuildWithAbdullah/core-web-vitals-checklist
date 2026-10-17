/* ---------------------------------------------------------------------------
   audit.mjs

   Collect once, run every rule, return findings.

   The order of the result is the catalogue order rather than the order the
   rules happen to be registered in, so a report is comparable between runs
   and between pages. Duplicate ids from one page are collapsed, keeping the
   first piece of evidence, because a page with nine unsized images has one
   finding and nine examples of it.
   --------------------------------------------------------------------------- */

import { collect } from './collect.mjs';
import { byId, ids as catalogueIds } from './catalogue.mjs';

import { rules as lcpRules } from './rules/lcp.mjs';
import { rules as clsRules } from './rules/cls.mjs';
import { rules as inpRules } from './rules/inp.mjs';
import { rules as methodRules } from './rules/method.mjs';

export const rules = [...lcpRules, ...clsRules, ...inpRules, ...methodRules];

const order = new Map(catalogueIds.map((id, i) => [id, i]));

export function auditDocument(doc) {
  const raw = [];
  for (const rule of rules) {
    for (const found of rule.run(doc)) {
      if (!byId.has(found.id)) {
        throw new Error(`Rule ${rule.id} emitted ${found.id}, which is not in the catalogue`);
      }
      if (!rule.emits.includes(found.id)) {
        throw new Error(`Rule ${rule.id} emitted ${found.id}, which it does not declare`);
      }
      raw.push({ ...found, rule: rule.id, occurrences: 1 });
    }
  }

  const collapsed = new Map();
  for (const found of raw) {
    const existing = collapsed.get(found.id);
    if (existing) existing.occurrences += 1;
    else collapsed.set(found.id, { ...found, ...byId.get(found.id) });
  }

  return [...collapsed.values()].sort((a, b) => order.get(a.id) - order.get(b.id));
}

export function audit(html) {
  return auditDocument(collect(html));
}

export function findingIds(html) {
  return audit(html).map((f) => f.id);
}
