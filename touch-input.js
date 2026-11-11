'use strict';

// Keep tap/drag recognition separate from rendering and from desktop mouse input.
window.EbruTouchInput = class EbruTouchInput {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.contacts = new Set();
        this.gesture = null;
        this.lastContact = -Infinity;
        this.multitouch = false;
        canvas.addEventListener('pointerdown', event => this.down(event));
        canvas.addEventListener('pointermove', event => this.move(event));
        window.addEventListener('pointerup', event => this.up(event));
        window.addEventListener('pointercancel', event => this.up(event, true));
        canvas.addEventListener('lostpointercapture', event => {
            if (this.gesture?.id === event.pointerId) this.cancel(false);
        });
        window.addEventListener('blur', () => this.cancel());
        window.addEventListener('resize', () => this.cancel());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.cancel();
        });
    }

    get dragging() { return !!this.gesture?.dragging; }
    get suppressesMouse() { return this.contacts.size > 0 || Date.now() - this.lastContact < 750; }
    isTouch(event) { return event.pointerType === 'touch' || event.pointerType === 'pen'; }
    point(event) { return { x: event.clientX, y: event.clientY }; }

    down(event) {
        if (!this.isTouch(event) || event.button !== 0) return;
        event.preventDefault();
        this.lastContact = Date.now();
        this.contacts.add(event.pointerId);
        if (this.contacts.size > 1 || this.multitouch) {
            this.multitouch = true;
            this.cancel(false);
            return;
        }
        const start = this.point(event);
        this.callbacks.onContact(start);
        this.gesture = { id: event.pointerId, start, started: Date.now(), dragging: false };
        this.canvas.setPointerCapture(event.pointerId);
    }

    move(event) {
        const gesture = this.gesture;
        if (!gesture || gesture.id !== event.pointerId) return;
        event.preventDefault();
        const point = this.point(event);
        if (!gesture.dragging && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > 8) {
            gesture.dragging = true;
            this.callbacks.onDragStart(gesture.start);
        }
        if (gesture.dragging) this.callbacks.onDragMove(point);
    }

    up(event, cancelled = false) {
        if (!this.isTouch(event)) return;
        this.lastContact = Date.now();
        const gesture = this.gesture;
        if (gesture?.id === event.pointerId) {
            let tapped = false;
            if (!cancelled) this.move(event); // A quick flick can finish between frames.
            this.gesture = null;
            if (gesture.dragging) this.callbacks.onDragEnd(cancelled);
            else if (!cancelled && !this.multitouch && Date.now() - gesture.started <= 400) {
                const rect = this.canvas.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right
                    && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    this.callbacks.onTap(this.point(event));
                    tapped = true;
                }
            }
            this.callbacks.onRelease?.(tapped);
            if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
        }
        this.contacts.delete(event.pointerId);
        if (this.contacts.size === 0) this.multitouch = false;
    }

    cancel(clearContacts = true) {
        const gesture = this.gesture;
        this.gesture = null;
        if (gesture) {
            if (gesture.dragging) this.callbacks.onDragEnd(true);
            this.callbacks.onRelease?.(false);
            if (this.canvas.hasPointerCapture(gesture.id)) this.canvas.releasePointerCapture(gesture.id);
        }
        if (clearContacts) {
            this.contacts.clear();
            this.multitouch = false;
        }
    }
};
