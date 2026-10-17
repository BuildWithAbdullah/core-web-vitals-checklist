import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReporter, payloadFor, CLS_TRANSPORT_SCALE } from '../measure/report.mjs';

/* The browser entry point is five lines of wiring and everything worth
   getting wrong is in here, which is the point of the split. These tests
   drive it with stubs for the console, the navigator and the location, so
   the behaviour is executed rather than parsed. */

function stubConsole() {
  const lines = [];
  return { lines, log: (...args) => lines.push(args.map(String).join(' ')) };
}

const ENV = {
  navigator: { connection: { effectiveType: '4g' }, deviceMemory: 4, hardwareConcurrency: 8 },
  location: { pathname: '/menu' }
};

const LCP_METRIC = {
  name: 'LCP',
  value: 3820,
  navigationType: 'navigate',
  attribution: {
    timeToFirstByte: 210,
    resourceLoadDelay: 2640,
    resourceLoadDuration: 740,
    elementRenderDelay: 230,
    element: 'img.hero__image',
    url: '/media/hero-1600.webp'
  }
};

const CLS_METRIC = {
  name: 'CLS',
  value: 0.184,
  navigationType: 'navigate',
  attribution: {
    largestShiftTarget: 'div.promo',
    largestShiftValue: 0.1236,
    largestShiftTime: 2410
  }
};

test('with no endpoint the reporter logs and transports nothing', () => {
  const out = stubConsole();
  const reporter = createReporter({ ...ENV, console: out, endpoint: null });
  const result = reporter.reportLCP(LCP_METRIC);

  assert.equal(result.transport, 'console');
  assert.ok(out.lines.some((l) => l.includes('load delay')));
  assert.ok(out.lines.some((l) => l.includes('img.hero__image')));
});

test('a layout shift value is scaled for transport and rated unscaled', () => {
  const body = payloadFor(CLS_METRIC, ENV);
  assert.equal(body.value, Math.round(0.184 * CLS_TRANSPORT_SCALE));
  /* 0.184 is above the good boundary of 0.1 and below the poor boundary of
     0.25. Rating the scaled value instead would read 184 and report poor. */
  assert.equal(body.rating, 'needs-improvement');
});

test('the payload carries the connection and device hints', () => {
  const body = payloadFor(LCP_METRIC, ENV);
  assert.equal(body.effectiveType, '4g');
  assert.equal(body.deviceMemory, 4);
  assert.equal(body.hardwareConcurrency, 8);
  assert.equal(body.url, '/menu');
  assert.equal(body.navigationType, 'navigate');
});

test('a navigator with no connection field does not throw', () => {
  const body = payloadFor(LCP_METRIC, { navigator: {}, location: {} });
  assert.equal(body.effectiveType, undefined);
});

test('a successful beacon is the transport', () => {
  const sent = [];
  const reporter = createReporter({
    ...ENV,
    console: stubConsole(),
    endpoint: '/collect',
    navigator: { ...ENV.navigator, sendBeacon: (url, body) => { sent.push([url, body]); return true; } }
  });

  assert.equal(reporter.send(LCP_METRIC).transport, 'beacon');
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], '/collect');
  assert.equal(JSON.parse(sent[0][1]).name, 'LCP');
});

test('a refused beacon falls through to fetch rather than being dropped', () => {
  /* sendBeacon returns false when the user agent refuses the payload, by
     queue limit or by size. Treating the method existing as the send
     succeeding loses exactly the records from the slowest sessions, which
     are the ones the 75th percentile is made of. */
  const calls = [];
  const reporter = createReporter({
    ...ENV,
    console: stubConsole(),
    endpoint: '/collect',
    navigator: { ...ENV.navigator, sendBeacon: () => false },
    fetch: (url, options) => { calls.push([url, options]); }
  });

  assert.equal(reporter.send(LCP_METRIC).transport, 'fetch');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].keepalive, true);
});

test('with no beacon and no fetch the record is reported as dropped', () => {
  const reporter = createReporter({
    ...ENV, console: stubConsole(), endpoint: '/collect', navigator: {}, fetch: null
  });
  assert.equal(reporter.send(LCP_METRIC).transport, 'dropped');
});

test('the interaction report names the element and the interaction type', () => {
  const out = stubConsole();
  const reporter = createReporter({ ...ENV, console: out, endpoint: null });
  reporter.reportINP({
    name: 'INP',
    value: 540,
    attribution: {
      inputDelay: 40, processingDuration: 420, presentationDelay: 80,
      interactionTarget: 'button.slot', interactionType: 'pointer'
    }
  });
  assert.ok(out.lines.some((l) => l.includes('button.slot')));
  assert.ok(out.lines.some((l) => l.includes('pointer')));
  assert.ok(out.lines.some((l) => l.includes('processing')));
});

test('the layout shift report names the largest shift source', () => {
  const out = stubConsole();
  const reporter = createReporter({ ...ENV, console: out, endpoint: null });
  reporter.reportCLS(CLS_METRIC);
  assert.ok(out.lines.some((l) => l.includes('div.promo')));
  assert.ok(out.lines.some((l) => l.includes('0.1236')));
  assert.ok(out.lines.some((l) => l.includes('(needs-improvement)')));
});
