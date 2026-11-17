// Isolated layout fixture for environments without a WebGL context. This file is
// never copied into an APK: the Android build regenerates www from the app source.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'android/app/src/main/assets/www');
let html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const palette = source.match(/palette\.innerHTML = `([\s\S]*?)`;/)[1].replace('${EBRU_PALETTE[0].hex}', '#c94b3c');
const inlineTheme = source.match(/cursorStyle\.textContent = `([\s\S]*?)`;/)[1];
html = html.replace('</head>', '<style>' + inlineTheme + '\nbody > canvas { background: #fafaf7; }\n</style></head>');
const colors = [...source.matchAll(/hex: '(#[0-9a-f]{6})'/g)].map(x => x[1]);
const eye = source.match(/uiToggle\.innerHTML = `([\s\S]*?)`;/)[1];
const fixture = `
window.config = { DROP_SIZE: 100, SPLAT_RADIUS: .25, VELOCITY_DISSIPATION: .2, CURL: 30, DYE_RESOLUTION: 512, PAUSED: false, BACK_COLOR: { r:255, g:255, b:255 } };
window.initFramebuffers = () => {};
window.EbruStudio = { clear() {}, recorder: { state: 'idle', supported: true, errorKey: '', elapsedSeconds: 0, onStateChange() {}, start() { window.EbruMobile.showVideo(new Blob([], {type:'video/mp4'})); }, stop() {} } };
const palette = document.createElement('div'); palette.className = 'ebru-color-palette';
palette.innerHTML = ${JSON.stringify(palette)}; document.body.append(palette);
const swatches = palette.querySelector('.ebru-palette-swatches');
${JSON.stringify(colors)}.forEach((hex,i) => { const button=document.createElement('button'); button.className='ebru-color-swatch'+(!i?' selected':''); button.style.background=hex; button.setAttribute('aria-label',hex); swatches.append(button); });
EbruI18n.apply(palette);
const input = document.createElement('div');input.className='ebru-input-controls';input.innerHTML=${JSON.stringify('<button class="ebru-ui-toggle" aria-label="Hide all panels" aria-pressed="false">'+eye+'</button>')};document.body.append(input);const uiToggle=input.querySelector('button');uiToggle.addEventListener('click',()=>{const hide=document.body.classList.toggle('ebru-ui-hidden');uiToggle.setAttribute('aria-label',hide?'Show all panels':'Hide all panels');uiToggle.setAttribute('aria-pressed',String(hide));});
`;
html = html.replace(/<script src="\.\/script\.js[^\"]*"><\/script>/, '<script>' + fixture + '</script>');
fs.writeFileSync(path.join(output, '_layout-fixture.html'), html);
fs.writeFileSync(path.join(output, '_layout-preview.html'), `<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#34373a;color:#eee;font:14px system-ui;display:grid;justify-content:center;gap:16px;padding:20px}iframe{border:8px solid #151515;border-radius:25px;box-shadow:0 16px 50px #0005;width:844px;height:360px}p{margin:0;color:#bbb}</style><p>Android yatay arayüz kontrolü · 844 × 360 · yalnızca yerleşim, grafik motoru çalıştırılmaz</p><iframe src="_layout-fixture.html" title="Android landscape layout"></iframe></html>`);
console.log('Generated isolated Android layout fixture');

fs.writeFileSync(path.join(output, '_layout-small.html'), fs.readFileSync(path.join(output, '_layout-preview.html'),'utf8').replace('844 × 360','568 × 280').replace('width:844px;height:360px','width:568px;height:280px'));
