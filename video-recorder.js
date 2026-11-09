'use strict';

// Record a fixed-size copy immediately after WebGL renders, before its buffer clears.
window.EbruVideoRecorder = class EbruVideoRecorder {
    constructor(canvas, getBackground) {
        this.canvas = canvas;
        this.getBackground = getBackground;
        this.session = null;
        this.state = 'idle';
        this.errorKey = '';
        this.onStateChange = () => {};
        window.addEventListener('pagehide', () => this.dispose());
    }

    get supported() {
        return typeof window.MediaRecorder === 'function' &&
            typeof HTMLCanvasElement.prototype.captureStream === 'function';
    }

    get elapsedSeconds() {
        return this.session ? Math.floor((performance.now() - this.session.startedAt) / 1000) : 0;
    }

    start() {
        if (this.session) return;
        if (!this.supported) {
            this.errorKey = 'videoUnsupported';
            this.onStateChange();
            return;
        }
        let session;
        try {
            const surface = document.createElement('canvas');
            const scale = Math.min(1, 1920 / this.canvas.width, 1080 / this.canvas.height);
            surface.width = Math.max(2, Math.floor(this.canvas.width * scale / 2) * 2);
            surface.height = Math.max(2, Math.floor(this.canvas.height * scale / 2) * 2);
            const context = surface.getContext('2d', { alpha: false });
            if (!context) throw new Error('Recording canvas unavailable');
            let stream = surface.captureStream(0);
            let track = stream.getVideoTracks()[0];
            if (typeof track.requestFrame !== 'function') {
                stream.getTracks().forEach(track => track.stop());
                stream = surface.captureStream(30);
                track = stream.getVideoTracks()[0];
            }
            session = { surface, context, stream, track, chunks: [], started: false, startedAt: performance.now(), lastFrame: -Infinity, failed: false };
            this.session = session;
            const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
            for (const mimeType of candidates) {
                if (!MediaRecorder.isTypeSupported || !MediaRecorder.isTypeSupported(mimeType)) continue;
                try {
                    session.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
                    break;
                } catch { /* Try the next encoder when a supported format cannot start. */ }
            }
            session.recorder ||= new MediaRecorder(stream, { videoBitsPerSecond: 6000000 });
            session.recorder.ondataavailable = event => {
                if (!session.failed && event.data.size) session.chunks.push(event.data);
            };
            session.recorder.onerror = () => this.fail(session, 'videoError');
            session.recorder.onstop = () => this.finish(session);
            this.errorKey = '';
            this.state = 'recording';
            session.timer = setInterval(() => this.onStateChange(), 1000);
            this.onStateChange();
        } catch {
            this.fail(session, 'videoError');
        }
    }

    captureFrame() {
        const session = this.session;
        if (!session || this.state !== 'recording') return;
        const now = performance.now();
        if (now - session.lastFrame < 1000 / 30) return;
        if (!this.canvas.width || !this.canvas.height) return;
        session.lastFrame = now;
        try {
            const { surface, context } = session;
            const bg = this.getBackground();
            context.fillStyle = `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
            context.fillRect(0, 0, surface.width, surface.height);
            const scale = Math.min(surface.width / this.canvas.width, surface.height / this.canvas.height);
            const width = this.canvas.width * scale;
            const height = this.canvas.height * scale;
            context.drawImage(this.canvas, (surface.width - width) / 2, (surface.height - height) / 2, width, height);
            // Start only once a rendered frame exists, avoiding an initial black frame.
            if (!session.started) {
                session.recorder.start(1000);
                session.started = true;
            }
            if (typeof session.track.requestFrame === 'function') session.track.requestFrame();
        } catch {
            this.fail(session, 'videoError');
        }
    }

    stop() {
        const session = this.session;
        if (!session || this.state !== 'recording') return;
        if (!session.started) {
            this.errorKey = 'videoEmpty';
            this.cleanup(session);
            this.onStateChange();
            return;
        }
        this.state = 'stopping';
        clearInterval(session.timer);
        this.onStateChange();
        try {
            session.recorder.stop();
        } catch {
            this.fail(session, 'videoError');
        }
    }

    finish(session) {
        if (this.session !== session || session.failed) return;
        try {
            if (!session.chunks.length) throw new Error('Empty recording');
            const mimeType = session.recorder.mimeType || session.chunks[0].type || 'video/webm';
            const blob = new Blob(session.chunks, { type: mimeType });
            const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
            const filename = 'ebrusim-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + extension;
            this.download(blob, filename);
            this.errorKey = '';
        } catch {
            this.errorKey = session.chunks.length ? 'videoError' : 'videoEmpty';
        }
        this.cleanup(session);
        this.onStateChange();
    }

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        try {
            document.body.appendChild(link);
            link.click();
        } finally {
            link.remove();
            // Keep the URL alive until the browser has started the download.
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    }

    cleanup(session) {
        if (session) {
            clearInterval(session.timer);
            session.stream.getTracks().forEach(track => track.stop());
            session.chunks.length = 0;
        }
        if (!session || this.session === session) {
            this.session = null;
            this.state = 'idle';
        }
    }

    fail(session, key) {
        if (session) {
            session.failed = true;
            if (session.recorder && session.recorder.state !== 'inactive') {
                try { session.recorder.stop(); } catch { /* Already stopped. */ }
            }
        }
        this.cleanup(session);
        this.errorKey = key;
        this.onStateChange();
    }

    dispose() {
        if (this.session) this.fail(this.session, '');
    }
};
