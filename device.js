'use strict';

// Capability detection also covers tablets that identify themselves as Macs.
window.EbruDevice = (() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 760px), (max-height: 500px)');
    const mobileAgent = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const device = {
        get touch() { return coarse.matches || mobileAgent; },
        get compact() { return compact.matches; }
    };
    function refresh() {
        document.documentElement.classList.toggle('ebru-touch', device.touch);
        window.dispatchEvent(new Event('ebru-device-change'));
    }
    coarse.addEventListener('change', refresh);
    compact.addEventListener('change', refresh);
    refresh();
    return device;
})();
