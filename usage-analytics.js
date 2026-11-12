'use strict';

// Aggregate use only: no cookies, durable visitor IDs, coordinates, colors,
// camera frames, names, referrers or browsing history are collected.
window.EbruUsageAnalytics = class EbruUsageAnalytics {
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.enabled = ['ebrusim.art', 'www.ebrusim.art', 'bekirkoser.github.io'].includes(location.hostname)
            && navigator.globalPrivacyControl !== true
            && navigator.doNotTrack !== '1' && window.doNotTrack !== '1'
            && !!window.crypto?.getRandomValues;
        this.metrics = { active_ms: 0, paint_drops: 0, drag_starts: 0, camera_starts: 0, image_saves: 0, video_saves: 0 };
        this.events = { paint_drop: 'paint_drops', drag_start: 'drag_starts', camera_start: 'camera_starts', image_save: 'image_saves', video_save: 'video_saves' };
        this.ready = false;
        this.started = false;
        this.registration = null;
        this.inFlight = null;
        this.lastSent = '';
    }

    start() {
        if (!this.enabled || this.started) return;
        this.started = true;
        const random = new Uint8Array(32);
        crypto.getRandomValues(random);
        this.key = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
        this.id = crypto.randomUUID();
        this.device = window.EbruDevice?.touch ? 'mobile' : 'desktop';
        this.lastTick = this.lastActivity = performance.now();
        this.visible = !document.hidden;
        this.focused = document.hasFocus();
        for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel'])
            window.addEventListener(event, () => this.activity(), { passive: true });
        document.addEventListener('visibilitychange', () => {
            this.tick();
            this.visible = !document.hidden;
            if (this.visible) this.lastActivity = performance.now();
            else void this.flush(true);
        });
        window.addEventListener('blur', () => { this.tick(); this.focused = false; void this.flush(true); });
        window.addEventListener('focus', () => { this.tick(); this.focused = true; this.lastActivity = performance.now(); });
        window.addEventListener('pagehide', () => { this.tick(); this.visible = false; void this.flush(true); });
        window.addEventListener('pageshow', () => {
            this.visible = !document.hidden;
            this.focused = document.hasFocus();
            this.lastTick = this.lastActivity = performance.now();
        });
        this.tickTimer = setInterval(() => this.tick(), 5000);
        this.flushTimer = setInterval(() => { void this.flush(); }, 15000);
        void this.register();
    }

    activity() {
        if (!this.enabled || !this.started || !this.visible) return;
        const now = performance.now();
        // Do not turn a long idle gap into active time when activity resumes.
        if (now - this.lastActivity > 60000) this.tick();
        this.lastActivity = now;
    }

    tick() {
        if (!this.enabled || !this.started) return;
        const now = performance.now();
        if (this.visible && this.focused) {
            const elapsed = Math.max(0, Math.min(now, this.lastActivity + 60000) - this.lastTick);
            this.metrics.active_ms = Math.min(8 * 3600000, this.metrics.active_ms + elapsed);
        }
        this.lastTick = now;
    }

    track(event) {
        if (!this.enabled || !this.started || !this.events[event]) return;
        this.activity();
        const name = this.events[event];
        this.metrics[name] = Math.min(100000, this.metrics[name] + 1);
    }

    async post(path, data) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            return await fetch(this.endpoint + path, {
                method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
                referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify(data), signal: controller.signal
            });
        } finally { clearTimeout(timeout); }
    }

    async register() {
        if (!this.enabled || this.ready) return this.ready;
        if (this.registration) return this.registration;
        this.registration = this.post('/api/session', { id: this.id, key: this.key, device: this.device })
            .then(response => { this.ready = response.ok; return this.ready; })
            .catch(() => false).finally(() => { this.registration = null; });
        return this.registration;
    }

    async flush(final = false) {
        if (!this.enabled || !this.started) return;
        this.tick();
        if (!this.ready && !await this.register()) return;
        if (this.inFlight && !final) return;
        const snapshot = JSON.stringify({ ...this.metrics, active_ms: Math.floor(this.metrics.active_ms) });
        if (snapshot === this.lastSent) return;
        const task = this.post('/api/collect', { id: this.id, key: this.key, ...JSON.parse(snapshot) })
            .then(response => {
                if (response.ok) this.lastSent = snapshot;
                if (response.status === 401) {
                    this.enabled = false;
                    clearInterval(this.tickTimer);
                    clearInterval(this.flushTimer);
                }
            }).catch(() => {}).finally(() => { if (this.inFlight === task) this.inFlight = null; });
        this.inFlight = task;
        return task;
    }
};

window.ebruAnalytics = new EbruUsageAnalytics('https://ebrusim-analytics.sagealto16.chatgpt.site');
window.ebruAnalytics.start();
