'use strict';
window.EbruMobile = (() => {
    const messages = {
        tr: {
            save: 'Kaydet', share: 'Paylaş', gallery: 'Çalışmalarım', close: 'Kapat',
            saved: 'Çalışma galerine kaydedildi.', working: 'Hazırlanıyor…',
            failed: 'İşlem tamamlanamadı. Depolama alanını kontrol edip tekrar dene.',
            empty: 'İlk ebrunu oluştur', emptyBody: 'Kaydet düğmesine dokunduğunda çalışmanın bir görüntüsü burada saklanır.',
            galleryHint: 'Görüntüler bu cihazda saklanır. Uygulamayı kaldırmadan önce dışa aktar.',
            export: 'Cihaza kaydet', delete: 'Sil', deleteConfirm: 'Bu kayıtlı görüntü silinsin mi?',
            clearConfirm: 'Tuval temizlensin mi? Kaydetmediğin çalışma kaybolacak.', cancel: 'Vazgeç',
            privacy: 'Gizlilik ve bilgiler', privacyTitle: 'Ebrusim hakkında',
            privacyBody: 'Ebrusim çevrimdışı çalışır. Hesap, reklam ve kullanım takibi yoktur. Eserlerin ve renk tercihlerin cihazında saklanır. Paylaşmayı seçtiğinde görüntü veya video yalnızca seçtiğin uygulamaya iletilir. Uygulama kaldırıldığında yerel çalışmaların silinir. Bu sürümde kamera ve mikrofon kullanılmaz. Kaydedilen eserler düzenlenebilir proje değil, görüntüdür.',
            credits: 'Muhammed Bekir Köse · Ebrusim 1.0.0\nAkış simülasyonu: Pavel Dobryakov (MIT).',
            graphicsError: 'Grafik motoru başlatılamadı. Android System WebView uygulamasını güncelleyip tekrar dene.',
            retry: 'Yeniden aç', record: 'Video', stop: 'Durdur', videoReady: 'Sessiz video · en çok 45 saniye · 720p',
            videoUnsupported: 'Bu cihaz video kaydını desteklemiyor. Görüntü kaydetmeyi kullanabilirsin.',
            cancelExport: 'Kayıt iptal edildi.', exported: 'Dosya kaydedildi.', image: 'Ebru çalışması',
            shareReady: 'Video hazır', shareVideo: 'Videoyu paylaş', discard: 'Videoyu kapat', videoHint: 'Paylaş veya cihaza kaydet; bu video galeriye otomatik eklenmez.'
        },
        en: {
            save: 'Save', share: 'Share', gallery: 'My works', close: 'Close',
            saved: 'Artwork saved to your gallery.', working: 'Preparing…',
            failed: 'Could not finish. Check available storage and try again.',
            empty: 'Create your first ebru', emptyBody: 'Tap Save to keep a snapshot of your artwork here.',
            galleryHint: 'Images stay on this device. Export before uninstalling the app.',
            export: 'Save to device', delete: 'Delete', deleteConfirm: 'Delete this saved image?',
            clearConfirm: 'Clear the canvas? Any unsaved artwork will be lost.', cancel: 'Cancel',
            privacy: 'Privacy and about', privacyTitle: 'About Ebrusim',
            privacyBody: 'Ebrusim works offline. No accounts, ads or usage tracking. Artworks and color preferences stay on your device. When you choose to share, only your selected image or video is passed to your chosen app. Uninstalling removes local artworks. This version does not use the camera or microphone. Saved works are image snapshots, not editable projects.',
            credits: 'Muhammed Bekir Köse · Ebrusim 1.0.0\nFluid simulation: Pavel Dobryakov (MIT).',
            graphicsError: 'Could not start the graphics engine. Update Android System WebView and try again.',
            retry: 'Reload', record: 'Video', stop: 'Stop', videoReady: 'Silent video · up to 45 seconds · 720p',
            videoUnsupported: 'This device does not support video recording. You can still save images.',
            cancelExport: 'Save cancelled.', exported: 'File saved.', image: 'Ebru artwork',
            shareReady: 'Video ready', shareVideo: 'Share video', discard: 'Close video', videoHint: 'Share or save to device; videos are not automatically added to the gallery.'
        }
    };
    const t = key => messages[window.EbruI18n?.language || 'en'][key] || key;
    let toolbar, dialog, toast, toastTimer, busy = false, galleryUrls = [], videoBlob;
    function notify(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
    }
    function element(tag, text, className) {
        const el = document.createElement(tag);
        if (text) el.textContent = text;
        if (className) el.className = className;
        return el;
    }
    function button(key, action) {
        const el = element('button', t(key));
        el.type = 'button';
        el.dataset.mobileKey = key;
        el.addEventListener('click', action);
        return el;
    }
    async function run(action) {
        if (busy) return;
        busy = true;
        toolbar?.setAttribute('aria-busy', 'true');
        toolbar?.querySelectorAll('button').forEach(el => { el.disabled = true; });
        try { await action(); }
        catch (error) { notify(t(error.message === 'cancelled' ? 'cancelExport' : 'failed')); console.warn('Artwork operation:', error.message); }
        finally {
            busy = false;
            toolbar?.removeAttribute('aria-busy');
            toolbar?.querySelectorAll('button').forEach(el => { el.disabled = false; });
        }
    }
    function dataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    function filename(blob) {
        const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : 'png';
        return 'ebrusim-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
    }
    async function exportBlob(blob, action = 'share') {
        if (window.EbruNative.available) {
            if (blob.size > 24 * 1024 * 1024) throw Error('File too large');
            const result = await EbruNative.request(action === 'share' ? 'shareFile' : 'saveFile', {
                data: await dataUrl(blob), name: filename(blob), mime: blob.type.split(';')[0]
            });
            if (result?.cancelled) notify(t('cancelExport'));
            else if (action !== 'share') notify(t('exported'));
            return;
        }
        const file = new File([blob], filename(blob), { type: blob.type });
        if (action === 'share' && navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'Ebrusim' }); }
            catch (error) { if (error.name !== 'AbortError') throw error; }
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = element('a'); link.href = url; link.download = file.name;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function snapshot() {
        const uri = window.EbruStudio.capture();
        // No fetch: the Android app deliberately has no network access.
        const raw = atob(uri.split(',')[1]);
        const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
        return new Blob([bytes], { type: 'image/png' });
    }
    async function save() {
        const blob = await snapshot();
        await EbruGallery.save(blob);
        notify(t('saved'));
    }
    function releaseUrls() { galleryUrls.forEach(url => URL.revokeObjectURL(url)); galleryUrls = []; }
    function closeDialog() {
        if (!dialog?.open) return false;
        dialog.close(); releaseUrls(); videoBlob = null;
        window.dispatchEvent(new CustomEvent('ebru-modal', { detail: false }));
        return true;
    }
    function openDialog(titleKey) {
        if (dialog.open) dialog.close();
        releaseUrls(); dialog.replaceChildren();
        const header = element('header');
        header.append(element('h2', t(titleKey)), button('close', closeDialog));
        dialog.append(header);
        dialog.showModal();
        window.dispatchEvent(new CustomEvent('ebru-modal', { detail: true }));
    }
    async function gallery() {
        const items = await EbruGallery.list();
        openDialog('gallery');
        dialog.append(element('p', t('galleryHint'), 'ebru-gallery-hint'));
        if (!items.length) {
            const empty = element('section', '', 'ebru-gallery-empty');
            empty.append(element('h3', t('empty')), element('p', t('emptyBody')));
            dialog.append(empty); return;
        }
        const grid = element('div', '', 'ebru-gallery-grid');
        for (const item of items) {
            const card = element('article');
            const img = element('img');
            img.src = URL.createObjectURL(item.blob); galleryUrls.push(img.src);
            img.alt = t('image'); img.loading = 'lazy';
            const date = new Date(item.createdAt).toLocaleString(EbruI18n.language === 'tr' ? 'tr-TR' : 'en-US');
            card.append(img, element('p', date));
            const actions = element('div', '', 'ebru-gallery-actions');
            actions.append(button('share', () => run(() => exportBlob(item.blob))),
                button('export', () => run(() => exportBlob(item.blob, 'save'))),
                button('delete', () => run(async () => {
                    if (!confirm(t('deleteConfirm'))) return;
                    await EbruGallery.remove(item.id); await gallery();
                })));
            card.append(actions); grid.append(card);
        }
        dialog.append(grid);
    }
    function about() {
        openDialog('privacyTitle');
        dialog.append(element('p', t('privacyBody')), element('p', t('credits'), 'ebru-credits'));
        const license = element('details');
        license.append(element('summary', 'MIT License — Pavel Dobryakov'), element('pre', window.EbruStudio?.license || 'See script.js for the full MIT License.'));
        dialog.append(license);
    }
    function showVideo(blob) {
        openDialog('shareReady'); videoBlob = blob;
        const video = element('video'); video.controls = true; video.playsInline = true;
        video.src = URL.createObjectURL(blob); galleryUrls.push(video.src);
        dialog.append(video, element('p', t('videoHint')), button('shareVideo', () => run(() => exportBlob(videoBlob))),
            button('export', () => run(() => exportBlob(videoBlob, 'save'))));
    }
    function mount() {
        toolbar = element('nav', '', 'ebru-app-toolbar');
        toolbar.setAttribute('aria-label', 'Ebrusim');
        toolbar.append(button('gallery', () => run(gallery)), button('save', () => run(save)),
            button('share', () => run(async () => exportBlob(await snapshot()))),
            button('record', () => {
                if (!window.EbruStudio.recorder.supported) { notify(t('videoUnsupported')); return; }
                const recorder = window.EbruStudio.recorder;
                if (recorder.state === 'recording') recorder.stop(); else recorder.start();
            }));
        if (!window.EbruStudio) toolbar.querySelectorAll('button:not([data-mobile-key="gallery"])').forEach(el => { el.disabled = true; });
        document.body.append(toolbar);
        const aboutButton = button('privacy', about); aboutButton.className = 'ebru-app-about'; document.body.append(aboutButton);
        dialog = element('dialog', '', 'ebru-app-dialog');
        dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
        document.body.append(dialog);
        toast = element('div', '', 'ebru-app-toast'); toast.hidden = true; toast.setAttribute('role', 'status'); document.body.append(toast);
        const videoButton = toolbar.querySelector('[data-mobile-key="record"]');
        if (window.EbruStudio) {
            const recorder = window.EbruStudio.recorder;
            const prior = recorder.onStateChange;
            recorder.onStateChange = () => {
                prior();
                const active = recorder.state === 'recording';
                videoButton.textContent = active ? t('stop') + ' · ' + recorder.elapsedSeconds + 's' : t('record');
                videoButton.setAttribute('aria-pressed', String(active));
                videoButton.disabled = !recorder.supported || recorder.state === 'stopping';
                if (recorder.errorKey) notify(EbruI18n.t(recorder.errorKey));
            };
            recorder.onStateChange();
        }
        window.addEventListener('ebru-language-change', () => {
            closeDialog();
            document.querySelectorAll('[data-mobile-key]').forEach(el => { el.textContent = t(el.dataset.mobileKey); });
            window.EbruStudio?.recorder.onStateChange();
        });
        window.addEventListener('ebru-app-active', event => {
            if (!event.detail && window.EbruStudio?.recorder.state === 'recording') window.EbruStudio.recorder.stop();
        });
        window.EbruNative.closeOverlay = () => {
            if (closeDialog()) return true;
            const help = document.querySelector('.ebru-info-overlay.is-open');
            if (help) { document.querySelector('.ebru-info-close').click(); return true; }
            return false;
        };
    }
    function graphicsError() {
        document.addEventListener('DOMContentLoaded', () => {
            const error = element('section', '', 'ebru-graphics-error');
            error.append(element('p', t('graphicsError')), button('gallery', () => run(gallery)), button('retry', () => location.reload()));
            document.body.append(error);
        }, { once: true });
    }
    window.addEventListener('error', event => { if (event.filename?.includes('script.js')) graphicsError(); });
    return { mount, save, notify, showVideo, exportBlob, t };
})();
