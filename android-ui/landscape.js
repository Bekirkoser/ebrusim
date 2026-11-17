'use strict';
// Android-only layout adapter: no shared iPhone or website UI is changed.
(() => {
    document.documentElement.classList.add('ebru-android-landscape');
    const tr = () => window.EbruI18n.language === 'tr';
    const words = {
        en: { settings: 'Settings', close: 'Close settings', size: 'Drop size', flow: 'Flow', swirl: 'Swirl', quality: 'Quality', balanced: 'Balanced', detail: 'Detailed', light: 'Battery saver', paused: 'Pause water', clear: 'New canvas', clearPrompt: 'Clear the canvas? Save your current artwork first.', colors: 'Edit palette', about: 'About & privacy', record: 'Record', rotate: 'Turn your phone sideways', rotateHint: 'Ebrusim is designed for landscape painting.' },
        tr: { settings: 'Ayarlar', close: 'Ayarları kapat', size: 'Damla boyutu', flow: 'Akış', swirl: 'Girdap', quality: 'Kalite', balanced: 'Dengeli', detail: 'Detaylı', light: 'Pil tasarrufu', paused: 'Suyu duraklat', clear: 'Yeni tuval', clearPrompt: 'Tuval temizlensin mi? Önce mevcut çalışmanı kaydet.', colors: 'Paleti düzenle', about: 'Hakkında ve gizlilik', record: 'Kayıt', rotate: 'Telefonunu yatay çevir', rotateHint: 'Ebrusim yatay ekranda boyamak için tasarlandı.' }
    };
    const text = key => words[tr() ? 'tr' : 'en'][key];
    const icons = {
        gallery: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
        save: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
        share: '<path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9"/>',
        record: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
        settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
        colors: '<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15Z"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>'
    };
    const svg = key => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[key] + '</svg>';
    const button = (label, icon) => {
        const el = document.createElement('button'); el.type = 'button';
        el.setAttribute('aria-label', label); el.title = label;
        el.innerHTML = svg(icon); return el;
    };
    // Start on the canvas. Instructions remain one tap away.
    const help = document.querySelector('.ebru-info-overlay');
    const language = document.querySelector('.ebru-language');
    help.classList.remove('is-open'); help.setAttribute('aria-hidden', 'true');
    document.querySelector('.ebru-info-button').setAttribute('aria-expanded', 'false');
    document.body.insertBefore(language, help);

    const toolbar = document.querySelector('.ebru-app-toolbar');
    const decorate = el => {
        const key = el.dataset.mobileKey;
        if (!icons[key]) return;
        const label = el.textContent;
        el.setAttribute('aria-label', label); el.title = label;
        const icon = document.createElement('span'); icon.className = 'android-action-icon'; icon.innerHTML = svg(key);
        const caption = document.createElement('span'); caption.className = 'android-action-label'; caption.textContent = key === 'gallery' ? (tr() ? 'Galeri' : 'Gallery') : label;
        el.replaceChildren(icon, caption);
    };
    if (toolbar) {
        toolbar.querySelectorAll('button').forEach(decorate);
        new MutationObserver(records => {
            const buttons = new Set(records.map(record => record.target.closest?.('button')).filter(Boolean));
            buttons.forEach(el => { if (!el.querySelector('.android-action-label')) decorate(el); });
        }).observe(toolbar, { childList: true, subtree: true, characterData: true });
    }

    const settingsButton = button(text('settings'), 'settings'); settingsButton.className = 'android-settings-toggle';
    settingsButton.setAttribute('aria-expanded', 'false'); settingsButton.setAttribute('aria-controls', 'android-settings');
    const panel = document.createElement('aside'); panel.className = 'android-settings'; panel.id = 'android-settings'; panel.hidden = true;
    panel.setAttribute('aria-label', text('settings'));
    document.body.append(settingsButton, panel);
    let settingInputs = [];
    const closeSettings = () => { panel.hidden = true; settingsButton.setAttribute('aria-expanded', 'false'); };
    settingsButton.addEventListener('click', () => { panel.hidden = !panel.hidden; settingsButton.setAttribute('aria-expanded', String(!panel.hidden)); });
    function renderSettings() {
        panel.replaceChildren(); settingInputs = [];
        const header = document.createElement('header'); const heading = document.createElement('h2'); heading.textContent = text('settings');
        const close = button(text('close'), 'close'); close.addEventListener('click', closeSettings); header.append(heading, close); panel.append(header);
        if (window.EbruStudio) {
            const range = (label, property, min, max, step) => {
                const row = document.createElement('label'); const name = document.createElement('span'); const output = document.createElement('output');
                name.textContent = text(label); const input = document.createElement('input');
                input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = config[property];
                input.setAttribute('aria-label', text(label)); output.textContent = input.value;
                input.addEventListener('input', () => { config[property] = Number(input.value); output.textContent = input.value; });
                const title = document.createElement('div'); title.append(name, output); row.append(title, input); panel.append(row); settingInputs.push(input);
            };
            range('size', 'DROP_SIZE', 25, 200, 5);
            range('flow', 'VELOCITY_DISSIPATION', 0, 4, 0.1);
            range('swirl', 'CURL', 0, 50, 1);
            const paperLabel = document.createElement('label'); paperLabel.className = 'android-paper';
            paperLabel.textContent = tr() ? 'Kağıt rengi' : 'Paper color';
            const paper = document.createElement('input'); paper.type = 'color';
            paper.value = '#' + ['r','g','b'].map(key => Math.round(config.BACK_COLOR[key]).toString(16).padStart(2,'0')).join('');
            paper.setAttribute('aria-label', paperLabel.textContent);
            paper.addEventListener('input', () => { const value = parseInt(paper.value.slice(1),16); config.BACK_COLOR = { r:(value>>16)&255, g:(value>>8)&255, b:value&255 }; });
            paperLabel.append(paper); panel.append(paperLabel);
            const qualityLabel = document.createElement('label'); qualityLabel.textContent = text('quality');
            const quality = document.createElement('select'); quality.setAttribute('aria-label', text('quality'));
            [[256,'light'],[512,'balanced'],[1024,'detail']].forEach(([value,key]) => { const option = document.createElement('option'); option.value = value; option.textContent = text(key); quality.append(option); });
            quality.value = config.DYE_RESOLUTION;
            quality.addEventListener('change', () => { config.DYE_RESOLUTION = Number(quality.value); initFramebuffers(); });
            qualityLabel.append(quality); panel.append(qualityLabel);
            const pauseLabel = document.createElement('label'); pauseLabel.className = 'android-pause'; pauseLabel.textContent = text('paused');
            const pause = document.createElement('input'); pause.type = 'checkbox'; pause.checked = config.PAUSED;
            pause.addEventListener('change', () => { config.PAUSED = pause.checked; }); pauseLabel.append(pause); panel.append(pauseLabel);
            const clear = document.createElement('button'); clear.textContent = text('clear'); clear.className = 'android-new-canvas';
            clear.addEventListener('click', () => { if (confirm(text('clearPrompt'))) { EbruStudio.clear(); closeSettings(); } }); panel.append(clear);
        }
        const about = document.createElement('button'); about.textContent = text('about'); about.className = 'android-about-link';
        about.addEventListener('click', () => { closeSettings(); document.querySelector('.ebru-app-about').click(); }); panel.append(about);
    }
    renderSettings();

    const palette = document.querySelector('.ebru-color-palette');
    if (palette) {
        const edit = button(text('colors'), 'colors'); edit.className = 'android-palette-edit'; edit.setAttribute('aria-expanded', 'false');
        palette.querySelector('.ebru-palette-row').append(edit);
        edit.addEventListener('click', () => {
            const open = palette.classList.toggle('android-editing-colors');
            edit.setAttribute('aria-expanded', String(open));
        });
        document.querySelector('body > canvas')?.addEventListener('pointerdown', () => {
            closeSettings(); palette.classList.remove('android-editing-colors'); edit.setAttribute('aria-expanded', 'false');
        }, { passive: true });
    }
    const dialog = document.querySelector('.ebru-app-dialog');
    if (dialog) {
        new MutationObserver(() => {
            const video = dialog.querySelector(':scope > video');
            dialog.classList.toggle('android-video-dialog', !!dialog.querySelector('video'));
            const credits = dialog.querySelector('.ebru-credits'); if (credits?.textContent.includes('Ebrusim 1.0.0')) credits.textContent = credits.textContent.replace('Ebrusim 1.0.0', 'Ebrusim 1.1.0');
            if (!video) return;
            const layout = document.createElement('div'); layout.className = 'android-video-layout';
            const preview = document.createElement('div'); preview.className = 'android-video-surface'; preview.append(video);
            const actions = document.createElement('section'); actions.className = 'android-video-actions';
            Array.from(dialog.children).filter(el => el.tagName !== 'HEADER').forEach(el => actions.append(el));
            layout.append(preview, actions); dialog.append(layout);
        }).observe(dialog, { childList: true });
        new MutationObserver(() => { if (dialog.open) closeSettings(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
    // Preserve Android's Back behavior for the redesigned settings panel.
    const originalBack = window.EbruNative.closeOverlay;
    window.EbruNative.closeOverlay = () => { if (!panel.hidden) { closeSettings(); return true; } return originalBack?.() || false; };
    window.addEventListener('ebru-language-change', () => {
        settingsButton.setAttribute('aria-label', text('settings')); settingsButton.title = text('settings');
        panel.setAttribute('aria-label', text('settings')); renderSettings();
        const edit = document.querySelector('.android-palette-edit'); if (edit) edit.setAttribute('aria-label', text('colors'));
    });
})();
