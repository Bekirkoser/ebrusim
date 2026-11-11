const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function load({ coarse = false, compact = false, userAgent = 'Desktop', platform = 'Linux', maxTouchPoints = 0 } = {}) {
    const events = {};
    const classes = new Set();
    const media = {};
    const context = {
        Event,
        navigator: { userAgent, platform, maxTouchPoints },
        localStorage: { getItem: () => null, setItem() {} },
        document: { documentElement: { classList: { toggle: (name, value) => value ? classes.add(name) : classes.delete(name) } },
            querySelectorAll: () => [], querySelector: () => null },
        matchMedia(query) {
            return media[query] = { matches: query.includes('coarse') ? coarse : compact,
                addEventListener: (name, callback) => { media[query].change = callback; } };
        },
        addEventListener(name, callback) { (events[name] ||= []).push(callback); },
        dispatchEvent(event) { for (const callback of events[event.type] || []) callback(event); }
    };
    context.window = context;
    vm.createContext(context);
    for (const name of ['device.js', 'i18n.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
    return { ...context, media, classes };
}

const phone = load({ coarse: true, compact: true, userAgent: 'iPhone', maxTouchPoints: 5 });
assert.equal(phone.EbruDevice.touch, true);
assert.match(phone.EbruI18n.t('dropHelp'), /tap/);
assert.doesNotMatch(phone.EbruI18n.t('dropHelp'), /Right-click/);
phone.EbruI18n.setLanguage('tr');
assert.match(phone.EbruI18n.t('dropHelp'), /dokun/);
assert.match(phone.EbruI18n.t('moveHelp'), /Sürükleme yeni boya eklemez/);
assert.equal(phone.EbruI18n.t('makeEbru'), 'Nasıl Kullanılır?');

const ipad = load({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 });
assert.equal(ipad.EbruDevice.touch, true, 'Desktop-style iPad user agents get the touch guide');
const desktop = load({ compact: true, maxTouchPoints: 10 });
assert.equal(desktop.EbruDevice.touch, false, 'A narrow mouse-first laptop keeps desktop instructions');
assert.equal(desktop.EbruDevice.compact, true);
assert.match(desktop.EbruI18n.t('dropHelp'), /Right-click/);
desktop.EbruI18n.setLanguage('tr');
const pointer = desktop.media['(pointer: coarse)'];
pointer.matches = true;
pointer.change();
assert.equal(desktop.EbruI18n.language, 'tr', 'Changing input mode keeps the selected language');
assert.match(desktop.EbruI18n.t('dropHelp'), /dokun/);
assert.equal(desktop.classes.has('ebru-touch'), true);
console.log('PASS: phone/tablet detection, narrow desktop, EN/TR touch instructions and live input-mode changes.');
