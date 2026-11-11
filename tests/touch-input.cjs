// Gesture regression checks without a browser or a GPU.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

class Target {
    constructor() { this.listeners = {}; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    emit(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); }
}

let now = 1000;
const window = new Target();
const document = new Target();
const canvas = new Target();
const captures = new Set();
canvas.setPointerCapture = id => captures.add(id);
canvas.hasPointerCapture = id => captures.has(id);
canvas.releasePointerCapture = id => captures.delete(id);
canvas.getBoundingClientRect = () => ({ left: 20, top: 30, right: 320, bottom: 530 });
const context = vm.createContext({ window, document, Date: { now: () => now } });
vm.runInContext(fs.readFileSync(path.join(root, 'touch-input.js'), 'utf8'), context);
let actions = [];
let releases = [];
const input = new window.EbruTouchInput(canvas, {
    onContact: () => actions.push('contact'),
    onTap: point => actions.push(['tap', point.x, point.y]),
    onDragStart: point => actions.push(['start', point.x, point.y]),
    onDragMove: point => actions.push(['move', point.x, point.y]),
    onDragEnd: cancelled => actions.push(['end', cancelled]),
    onRelease: tapped => releases.push(tapped)
});
function emit(name, x = 100, y = 100, id = 1, type = 'touch') {
    const event = { pointerId: id, pointerType: type, button: 0, clientX: x, clientY: y, preventDefault() {} };
    (name === 'pointerup' || name === 'pointercancel' ? window : canvas).emit(name, event);
}
const taps = () => actions.filter(action => action[0] === 'tap');
const reset = () => { input.cancel(); actions = []; releases = []; now += 1000; };

emit('pointerdown');
assert.equal(taps().length, 0, 'Touch-down must not add paint before intent is known');
emit('pointermove', 104, 102);
emit('pointerup', 104, 102);
assert.equal(taps().length, 1, 'A tap with small finger jitter adds exactly one drop');
assert.deepEqual(releases, [true], 'A completed tap keeps its brief drop feedback');
assert.equal(captures.size, 0);
assert.equal(input.suppressesMouse, true, 'Compatibility mouse events must be suppressed');
now += 751;
assert.equal(input.suppressesMouse, false);

reset();
emit('pointerdown');
emit('pointermove', 160, 130);
emit('pointermove', 100, 100);
emit('pointerup');
assert.equal(taps().length, 0, 'Dragging back to the start must not become a tap');
assert.equal(actions.filter(action => action[0] === 'start').length, 1);
assert.deepEqual(actions.at(-1), ['end', false]);

reset();
emit('pointerdown');
emit('pointerup', 150, 100);
assert.equal(taps().length, 0, 'A fast flick ending before a move event is still a drag');
assert.deepEqual(actions.at(-1), ['end', false]);

reset();
emit('pointerdown');
emit('pointercancel');
assert.equal(taps().length, 0, 'Cancelled touches must not add paint');
assert.deepEqual(releases, [false], 'Cancellation dismisses pending touch feedback');

reset();
emit('pointerdown');
canvas.emit('lostpointercapture', { pointerId: 1 });
emit('pointerup');
assert.deepEqual(releases, [false], 'Lost pointer capture dismisses feedback exactly once');
assert.equal(taps().length, 0);

reset();
emit('pointerdown');
emit('pointermove', 150, 100);
emit('pointerdown', 200, 200, 2);
assert.deepEqual(actions.at(-1), ['end', true], 'A second finger cancels the active drag');
emit('pointerup', 500, 100, 1);
emit('pointerup', 200, 200, 2);
assert.equal(taps().length, 0);
emit('pointerdown', 100, 100, 3);
emit('pointerup', 100, 100, 3);
assert.equal(taps().length, 1, 'Input recovers after multitouch and an outside release');

reset();
emit('pointerdown');
now += 600;
emit('pointerup');
assert.equal(taps().length, 0, 'A long press is not a tap');

reset();
emit('pointerdown', 319, 100);
emit('pointerup', 321, 100);
assert.equal(taps().length, 0, 'Lifting outside the canvas does not add paint');

for (const interruption of ['blur', 'resize', 'visibilitychange']) {
    reset();
    emit('pointerdown');
    emit('pointermove', 150, 100);
    if (interruption === 'visibilitychange') { document.hidden = true; document.emit(interruption); document.hidden = false; }
    else window.emit(interruption);
    emit('pointerup', 150, 100);
    assert.deepEqual(actions.at(-1), ['end', true]);
    assert.equal(input.gesture, null);
    assert.equal(input.contacts.size, 0);
}

reset();
emit('pointerdown', 100, 100, 1, 'mouse');
emit('pointerup', 100, 100, 1, 'mouse');
assert.equal(actions.length, 0, 'Desktop mouse input remains with the existing handler');

reset();
emit('pointerdown', 100, 100, 1, 'pen');
emit('pointerup', 100, 100, 1, 'pen');
assert.equal(taps().length, 1, 'Pen taps use the same touch interaction');

console.log('PASS: tap, jitter, drag, quick flick, cancellation, multitouch, outside release, interruptions, mouse suppression and pen input.');
