import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findings, ids, byId, finding, METRICS, PHASES } from '../lib/catalogue.mjs';
import { rules } from '../lib/audit.mjs';

const PREFIX = { LCP: 'lcp-', CLS: 'cls-', INP: 'inp-', METHOD: 'method-' };

test('every finding id is unique and names its metric', () => {
  assert.equal(new Set(ids).size, ids.length);
  for (const f of findings) {
    assert.ok(METRICS.includes(f.metric), `${f.id} has an unknown metric`);
    assert.ok(f.id.startsWith(PREFIX[f.metric]), `${f.id} does not name its metric`);
    assert.match(f.id, /^[a-z][a-z0-9-]*[a-z0-9]$/);
  }
});

test('every finding says what it proves and what it does not', () => {
  for (const f of findings) {
    assert.ok(f.title.length > 10, `${f.id} has no title`);
    assert.ok(f.proves.length > 60, `${f.id} says too little about what it proves`);
    assert.ok(f.doesNotProve.length > 60, `${f.id} says too little about its limits`);
    /* The limits sentence is the one that gets skipped. It has to be a
       different sentence, not the first one rephrased. */
    assert.notEqual(f.proves, f.doesNotProve);
  }
});

test('every finding names a phase its metric has', () => {
  for (const f of findings) {
    assert.ok(PHASES[f.metric].includes(f.phase), `${f.id}: ${f.metric} has no phase ${f.phase}`);
  }
});

test('every rule declares only findings that exist', () => {
  for (const rule of rules) {
    assert.ok(rule.emits.length > 0, `${rule.id} declares no findings`);
    for (const id of rule.emits) {
      assert.ok(byId.has(id), `${rule.id} declares ${id}, which is not in the catalogue`);
    }
  }
});

test('every finding is declared by exactly one rule', () => {
  const declared = new Map();
  for (const rule of rules) {
    for (const id of rule.emits) {
      declared.set(id, [...(declared.get(id) ?? []), rule.id]);
    }
  }
  for (const id of ids) {
    const owners = declared.get(id) ?? [];
    assert.equal(owners.length, 1, `${id} is declared by ${owners.length} rules: ${owners.join(', ')}`);
  }
  assert.equal(declared.size, ids.length);
});

test('rule ids are unique', () => {
  const ruleIds = rules.map((r) => r.id);
  assert.equal(new Set(ruleIds).size, ruleIds.length);
});

test('looking up an unknown finding throws', () => {
  assert.throws(() => finding('lcp-not-a-finding'), /No finding with id/);
  assert.equal(finding('lcp-hero-lazy').metric, 'LCP');
});
