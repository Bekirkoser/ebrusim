'use strict';

window.EbruPointCursor = class EbruPointCursor {
    constructor(className) {
        this.element = document.createElement('div');
        this.element.className = 'ebru-point-cursor ' + className;
        this.element.setAttribute('aria-hidden', 'true');
        this.element.innerHTML = '<span class="ebru-cursor-ring"><span class="ebru-cursor-dot"></span></span><span class="ebru-cursor-ripple"></span>';
        document.body.appendChild(this.element);
        this.ring = this.element.querySelector('.ebru-cursor-ring');
        this.ripple = this.element.querySelector('.ebru-cursor-ripple');
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.animations = [];
        this.hideTimer = null;
        this.pulseTimer = null;
        window.addEventListener('blur', () => this.hide());
        window.addEventListener('resize', () => this.hide());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.hide();
        });
    }

    show(x, y, mode = 'tracking') {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.element.style.display = 'block';
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
        this.element.classList.toggle('active', mode !== 'tracking');
        this.element.classList.toggle('drop-mode', mode === 'drop');
        this.element.classList.toggle('pinching', mode === 'move');
    }

    stopPulse() {
        this.animations.forEach(animation => animation.cancel());
        this.animations = [];
        clearTimeout(this.pulseTimer);
        this.pulseTimer = null;
        this.ripple.style.opacity = '';
    }

    pulse() {
        this.stopPulse();
        if (this.reducedMotion.matches || !this.ripple.animate) {
            this.ripple.style.opacity = '.6';
            this.pulseTimer = setTimeout(() => { this.ripple.style.opacity = ''; }, 140);
            return;
        }
        this.animations.push(this.ripple.animate([
            { width: '16px', height: '16px', opacity: .85 },
            { width: '68px', height: '68px', opacity: 0 }
        ], { duration: 520, easing: 'ease-out' }));
        this.animations.push(this.ring.animate([
            { transform: 'translate(-50%, -50%) scale(.82)' },
            { transform: 'translate(-50%, -50%) scale(1)' }
        ], { duration: 180, easing: 'ease-out' }));
    }

    flash(x, y) {
        this.show(x, y, 'drop');
        this.pulse();
        this.hideTimer = setTimeout(() => this.hide(), this.reducedMotion.matches ? 180 : 560);
    }

    hide() {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.stopPulse();
        this.element.style.display = 'none';
        this.element.classList.remove('active', 'drop-mode', 'pinching');
    }
};
