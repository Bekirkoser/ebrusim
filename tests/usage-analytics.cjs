const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../usage-analytics.js'), 'utf8');
function setup(privacy = false) {
  let now = 0;
  const events = {}, requests = [];
  const context = { location: { hostname: 'localhost' }, navigator: { globalPrivacyControl: privacy }, crypto: webcrypto,
    document: { hidden: false, hasFocus: () => true, addEventListener: (name, fn) => events[name] = fn },
    performance: { now: () => now }, AbortController, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {}, addEventListener: (name, fn) => events[name] = fn,
    fetch: async (url, options) => { requests.push({ url, options, data: JSON.parse(options.body) }); return { ok: true, status: 204 }; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(requests.length, 0, 'Local previews must not generate real analytics');
  context.location.hostname = 'ebrusim.art';
  const analytics = new context.EbruUsageAnalytics('https://collector.test');
  analytics.start();
  return { context, analytics, requests, events, time: value => { now = value; } };
}
(async () => {
  const t = setup();
  await t.analytics.registration;
  assert.equal(t.requests.length, 1);
  t.time(30000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 30000);
  t.time(120000); t.analytics.activity();
  assert.equal(t.analytics.metrics.active_ms, 60000, 'Long idle gaps are excluded');
  t.time(130000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 70000);
  t.context.document.hidden = true; t.events.visibilitychange();
  t.time(190000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 70000, 'Hidden tabs do not accumulate active time');
  t.context.document.hidden = false; t.events.visibilitychange();
  t.time(200000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 80000);
  t.events.blur(); t.time(300000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 80000, 'Unfocused windows do not count');
  t.events.focus(); t.time(305000); t.analytics.tick();
  assert.equal(t.analytics.metrics.active_ms, 85000);
  t.analytics.track('paint_drop'); t.analytics.track('drag_start'); t.analytics.track('not-allowed');
  await t.analytics.flush(true);
  const sent = t.requests.at(-1);
  assert.equal(sent.data.paint_drops, 1);
  assert.equal(sent.data.drag_starts, 1);
  assert.equal(sent.data.active_ms, 85000);
  assert.equal(sent.options.credentials, 'omit');
  assert.equal(sent.options.referrerPolicy, 'no-referrer');
  assert.equal(sent.options.keepalive, true);
  assert.deepEqual(Object.keys(sent.data).sort(), ['active_ms','camera_starts','drag_starts','id','image_saves','key','paint_drops','video_saves']);
  const disabled = setup(true);
  disabled.analytics.track('paint_drop');
  await disabled.analytics.flush();
  assert.equal(disabled.requests.length, 0, 'Global Privacy Control disables usage collection');
  console.log('PASS: production-only collection, idle/hidden/focus time, queued metrics, privacy controls, minimal payload and keepalive flushing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
