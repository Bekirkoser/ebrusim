'use strict';

// Keep language changes separate from simulation and camera state.
window.EbruI18n = (() => {
    const messages = {
        en: {
            pageTitle: 'Digital Ebru',
            description: 'Make digital ebru with mouse controls or camera hand tracking.',
            language: 'Language', openHelp: 'Open instructions', closeHelp: 'Close instructions',
            howTo: 'HOW TO', makeEbru: 'Make Ebru',
            helpLead: 'Use your mouse or turn on Camera',
            moveTitle: 'Move the Paint',
            moveHelp: 'Hold the left mouse button and drag. With Camera, pinch thumb + index finger and move.',
            dropTitle: 'Drop Paint',
            dropHelp: 'Right-click once to add a drop in your selected color. With Camera, pinch thumb + middle finger.',
            colorTitle: 'Pick a Color',
            colorHelp: 'Choose a swatch or make a custom color in the Paint Color palette.',
            customizeTitle: 'Customize',
            customizeHelp: 'Use the panel on the right to tune the flow, background, and capture.',
            quality: 'quality', high: 'high', medium: 'medium', low: 'low', veryLow: 'very low',
            resolution: 'sim resolution', diffusion: 'velocity diffusion', pressure: 'pressure',
            vorticity: 'vorticity', radius: 'splat radius', shading: 'shading', colorful: 'colorful',
            paused: 'paused', clear: 'Clear Paint', capture: 'Capture', background: 'background color',
            transparent: 'transparent', screenshot: 'take screenshot',
            openControls: 'Open Controls', closeControls: 'Close Controls',
            palette: 'PAINT COLOR', oxideRed: 'Red ochre · Gülbahar', oxideYellow: 'Yellow ochre',
            lahor: 'Lahor indigo', ultramarine: 'Ultramarine blue', sapGreen: 'Sap green',
            lac: 'Lac crimson', flowerRed: 'Floral red', lightIndigo: 'Light indigo',
            camlica: 'Çamlıca earth', sootBlack: 'Soot black', pigmentWhite: 'Pigment white', customColor: 'Custom paint color',
            camera: '👁 Camera', cameraOn: '👁 Camera On · Turn Off', loading: '⏳ Loading…',
            loadingTracking: 'LOADING HAND TRACKING…', movePaint: 'MOVE PAINT', paintDrop: 'PAINT DROP',
            separateFingers: 'SEPARATE FINGERS', tracking: 'HAND TRACKING', showHand: 'SHOW YOUR HAND',
            cameraOff: 'CAMERA OFF', cameraPermission: 'Allow camera access to use hand tracking.',
            cameraMissing: 'No camera found. Connect a camera and try again.',
            cameraBusy: 'Camera unavailable. Close other apps using it and try again.',
            cameraError: 'Could not start the camera. Check your connection and try again.'
        },
        tr: {
            pageTitle: 'Dijital Ebru',
            description: 'Fareyle veya kameradan el takibiyle dijital ebru yapın.',
            language: 'Dil', openHelp: 'Yönergeleri aç', closeHelp: 'Yönergeleri kapat',
            howTo: 'NASIL YAPILIR', makeEbru: 'Ebru Yap',
            helpLead: 'Fareyi kullan veya kamerayı aç',
            moveTitle: 'Boyayı Hareket Ettir',
            moveHelp: 'Sol fare tuşunu basılı tutup sürükle. Kamerayla kullanırken başparmağınla işaret parmağını birleştir ve elini hareket ettir.',
            dropTitle: 'Boya Damlat',
            dropHelp: 'Seçtiğin renkte bir damla eklemek için bir kez sağ tıkla. Kamerayla kullanırken başparmağınla orta parmağını birleştir.',
            colorTitle: 'Renk Seç',
            colorHelp: 'Boya Rengi paletinden bir renk seç veya kendi rengini oluştur.',
            customizeTitle: 'Özelleştir',
            customizeHelp: 'Akışı, arka planı ve görüntü kaydını sağdaki panelden ayarla.',
            quality: 'kalite', high: 'yüksek', medium: 'orta', low: 'düşük', veryLow: 'çok düşük',
            resolution: 'simülasyon çözünürlüğü', diffusion: 'hız sönümlemesi', pressure: 'basınç',
            vorticity: 'girdap', radius: 'damla yarıçapı', shading: 'gölgelendirme', colorful: 'çok renkli',
            paused: 'duraklat', clear: 'Boyayı Temizle', capture: 'Görüntü Kaydı', background: 'arka plan rengi',
            transparent: 'saydam arka plan', screenshot: 'görüntüyü kaydet',
            openControls: 'Ayarları Aç', closeControls: 'Ayarları Kapat',
            palette: 'BOYA RENGİ', oxideRed: 'Aşı kırmızısı · Gülbahar', oxideYellow: 'Oksit sarı',
            lahor: 'Lahor çividi', ultramarine: 'Çamaşır çividi', sapGreen: 'Sap yeşili',
            lac: 'Lök · Vişneçürüğü', flowerRed: 'Çiçek kırmızısı', lightIndigo: 'Açık çivit mavisi',
            camlica: 'Çamlıca toprağı', sootBlack: 'İs siyahı', pigmentWhite: 'Üstübeç beyazı', customColor: 'Özel boya rengi',
            camera: '👁 Kamera', cameraOn: '👁 Kamera Açık · Kapat', loading: '⏳ Yükleniyor…',
            loadingTracking: 'EL TAKİBİ YÜKLENİYOR…', movePaint: 'BOYAYI HAREKET ETTİR', paintDrop: 'BOYA DAMLASI',
            separateFingers: 'PARMAKLARINI AYIR', tracking: 'EL TAKİBİ', showHand: 'ELİNİ GÖSTER',
            cameraOff: 'KAMERA KAPALI', cameraPermission: 'El takibi için kameraya erişim izni ver.',
            cameraMissing: 'Kamera bulunamadı. Bir kamera bağlayıp tekrar dene.',
            cameraBusy: 'Kamera kullanılamıyor. Kamerayı kullanan diğer uygulamaları kapatıp tekrar dene.',
            cameraError: 'Kamera başlatılamadı. Bağlantını kontrol edip tekrar dene.'
        }
    };
    const storageKey = 'ebru-language';
    let language = 'en';
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved === 'en' || saved === 'tr') language = saved;
    } catch { /* Language selection still works when storage is unavailable. */ }

    const t = key => messages[language][key] || messages.en[key] || key;
    function apply(root = document) {
        const targets = [
            ['data-i18n', null], ['data-i18n-aria', 'aria-label'],
            ['data-i18n-title', 'title'], ['data-i18n-badge', 'data-badge']
        ];
        for (const [source, attribute] of targets) {
            const elements = [...root.querySelectorAll('[' + source + ']')];
            if (root.matches && root.matches('[' + source + ']')) elements.unshift(root);
            for (const element of elements) {
                const text = t(element.getAttribute(source));
                if (attribute) element.setAttribute(attribute, text);
                else element.textContent = text;
            }
        }
    }
    function bind(element, key) {
        element.dataset.i18n = key;
        element.textContent = t(key);
    }
    function refresh() {
        document.documentElement.lang = language;
        document.title = t('pageTitle');
        for (const selector of ['meta[name="description"]', 'meta[property="og:description"]'])
            document.querySelector(selector)?.setAttribute('content', t('description'));
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', t('pageTitle'));
        apply();
        document.querySelectorAll('[data-language]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.language === language));
        });
        window.dispatchEvent(new Event('ebru-language-change'));
    }
    function setLanguage(next) {
        if (next !== 'en' && next !== 'tr') return;
        language = next;
        try { localStorage.setItem(storageKey, language); } catch { /* Optional persistence. */ }
        refresh();
    }
    document.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.language));
    });
    refresh();
    return { t, apply, bind, setLanguage, get language() { return language; } };
})();
