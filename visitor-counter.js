'use strict';

// Background visitor counting; local storage prevents counting this browser twice.
window.EbruVisitorCounter = class EbruVisitorCounter {
    constructor(onChange = () => {}) {
        this.onChange = onChange;
        this.key = 'ebrusim-art-visitors-72860256b50144dab8f9ef3815be91a6';
        this.storageKey = 'ebru-counted-' + this.key;
        this.count = null;
        this.error = false;
        this.counted = false;
        this.inFlight = null;
        this.onVisible = () => {
            if (!document.hidden) this.load(false);
        };
    }

    hasVisited() {
        if (this.counted) return true;
        for (const storageName of ['localStorage', 'sessionStorage']) {
            try { if (window[storageName].getItem(this.storageKey) === '1') return true; }
            catch { /* Try session storage if persistent storage is blocked. */ }
        }
        return false;
    }

    rememberVisit() {
        this.counted = true;
        for (const storageName of ['localStorage', 'sessionStorage']) {
            try { window[storageName].setItem(this.storageKey, '1'); }
            catch { /* The current page still remembers this visit in memory. */ }
        }
    }

    async request(shouldCount) {
        const production = ['ebrusim.art', 'www.ebrusim.art', 'bekirkoser.github.io'].includes(location.hostname);
        const increment = production && shouldCount && !this.hasVisited();
        const operation = increment ? 'hit' : 'get';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch('https://countapi.mileshilliard.com/api/v1/' + operation + '/' + this.key, {
                mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal
            });
            if (!response.ok) throw new Error('Counter unavailable');
            const result = await response.json();
            const count = Number(result.value);
            if (!/^[0-9]+$/.test(String(result.value)) || !Number.isSafeInteger(count)) throw new Error('Invalid counter');
            if (increment) this.rememberVisit();
            this.count = count;
            this.error = false;
        } catch {
            this.error = true;
        } finally {
            clearTimeout(timeout);
            this.onChange();
        }
    }

    load(shouldCount = true) {
        if (this.inFlight) return this.inFlight;
        // Serialize first visits across tabs when Web Locks is available.
        const task = navigator.locks && shouldCount
            ? navigator.locks.request(this.storageKey, () => this.request(shouldCount))
            : this.request(shouldCount);
        this.inFlight = Promise.resolve(task).catch(() => {
            this.error = true;
            this.onChange();
        }).finally(() => { this.inFlight = null; });
        return this.inFlight;
    }

    start() {
        document.addEventListener('visibilitychange', this.onVisible);
        return this.load();
    }
};

// Start independently of dat.GUI and WebGL so hiding the UI never stops counting.
window.ebruVisitorCounter = new EbruVisitorCounter();
window.ebruVisitorCounter.start();
