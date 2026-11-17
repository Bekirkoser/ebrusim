const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(native = true) {
    const sent = [], timers = new Map(); let serial = 0;
    const context = {
        document: { documentElement: { classList: { add() {} } } },
        setTimeout(fn) { timers.set(++serial, fn); return serial; },
        clearTimeout(id) { timers.delete(id); },
        EbruAndroid: native ? { postMessage(raw) { sent.push(JSON.parse(raw)); } } : undefined
    };
    context.window = context; vm.createContext(context);
    vm.runInContext(fs.readFileSync('mobile/native-bridge.js', 'utf8'), context);
    return { bridge: context.EbruNative, sent, timers };
}
(async () => {
    const { bridge, sent, timers } = load();
    const first = bridge.request('shareFile', { data: 'abc' });
    const second = bridge.request('saveFile');
    assert.equal(sent.length, 2);
    assert.notEqual(sent[0].id, sent[1].id);
    bridge.receive({ id: sent[1].id, result: { cancelled: true } });
    assert.equal((await second).cancelled, true);
    bridge.receive({ id: sent[0].id, result: { ok: true } });
    assert.equal((await first).ok, true);
    assert.equal(timers.size, 0);
    const denied = bridge.request('shareFile');
    bridge.receive({ id: sent.at(-1).id, error: 'disk full' });
    await assert.rejects(denied, /disk full/);
    const timeout = bridge.request('shareFile');
    const callback = [...timers.values()][0]; callback();
    await assert.rejects(timeout, /timed out/);
    bridge.receive({ id: 'unknown', result: {} });
    await assert.rejects(load(false).bridge.request('shareFile'), /unavailable/);
    console.log('PASS: concurrent Android responses, cancellation, native errors, timeouts and preview fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
