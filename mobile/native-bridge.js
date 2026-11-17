'use strict';
// This file is included only in the packaged app, never on the production website.
window.EbruNative = (() => {
    const available = typeof window.EbruAndroid?.postMessage === 'function';
    const pending = new Map();
    let nextId = 0;
    function request(action, payload = {}) {
        if (!available) return Promise.reject(new Error('Native Android bridge unavailable'));
        return new Promise((resolve, reject) => {
            const id = String(++nextId);
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error('The Android operation timed out. Please try again.'));
            }, action === 'saveFile' ? 300000 : 60000);
            pending.set(id, { resolve, reject, timer });
            try { window.EbruAndroid.postMessage(JSON.stringify({ id, action, ...payload })); }
            catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
        });
    }
    function receive(message) {
        const task = pending.get(String(message.id));
        if (!task) return;
        clearTimeout(task.timer);
        pending.delete(String(message.id));
        if (message.error) task.reject(new Error(message.error));
        else task.resolve(message.result);
    }
    document.documentElement.classList.add('ebru-app');
    return { available, request, receive };
})();
