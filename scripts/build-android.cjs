// Deterministic, dependency-free offline bundle. Never copy analytics or camera assets.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'android/app/src/main/assets/www');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const assets = ['device.js', 'dat.gui.min.js', 'i18n.js', 'touch-input.js', 'point-cursor.js',
    'video-recorder.js', 'script.js', 'ui-theme.css', 'LDR_LLL1_0.png', 'iconfont.ttf'];
for (const name of assets) fs.copyFileSync(path.join(root, name), path.join(output, name));
fs.cpSync(path.join(root, 'mobile'), path.join(output, 'mobile'), { recursive: true });
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/\s*<script src="\.\/(?:usage-analytics|visitor-counter)\.js[^\"]*"><\/script>/g, '');
html = html.replace('<title>Digital Ebru</title>', '<title>Ebrusim</title>');
html = html.replace('<script src="./device.js', '<script src="./mobile/native-bridge.js"></script>\n        <script src="./device.js');
html = html.replace('</head>', '<link rel="stylesheet" href="./mobile/mobile.css">\n    </head>');
html = html.replace('<script src="./script.js', '<script src="./mobile/gallery-store.js"></script>\n        <script src="./mobile/studio.js"></script>\n        <script src="./script.js');
html = html.replace('</body>', '<script>window.EbruMobile.mount();</script>\n    </body>');
// Local-only origin. No remote scripts, camera downloads, analytics or inline network access.
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; media-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'">`);
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.copyFileSync(path.join(root, 'mobile/privacy.html'), path.join(output, 'privacy.html'));
console.log('Android offline assets prepared:', output);
