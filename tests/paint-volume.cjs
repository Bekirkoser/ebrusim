// Real WebGL regression test; no packages required.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ebrusim-volume-'));

// Appended to the simulation so the test can measure actual GPU dye buffers.
const test = `
try {
    const check = (ok, message) => { if (!ok) throw Error(message); };
    if (new URL(location.href).searchParams.get('filter') === 'manual')
        check(!ext.supportLinearFiltering, 'Manual filtering must be enabled for this test');
    config.DYE_RESOLUTION = 127; // Odd dimensions exercise reduction padding.
    config.SIM_RESOLUTION = 128;
    initFramebuffers();
    clearPaint();
    const read = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dye.read.fbo);
        const pixels = new Float32Array(dye.width * dye.height * 4);
        gl.readPixels(0, 0, dye.width, dye.height, gl.RGBA, gl.FLOAT, pixels);
        check(gl.getError() === gl.NO_ERROR, 'GPU readback failed');
        return pixels;
    };
    const mass = pixels => {
        const total = [0, 0, 0, 0];
        for (let i = 0; i < pixels.length; i += 4)
            for (let c = 0; c < 4; c++) total[c] += pixels[i + c];
        return total;
    };
    const reports = [];
    const verify = (before, label) => {
        const after = mass(read());
        const drift = after.map((value, i) => before[i] === 0 ? value : value / before[i] - 1);
        check(drift.every(value => Number.isFinite(value) && Math.abs(value) < 0.005),
            label + ': pigment drift ' + drift);
        reports.push({ case: label, drift });
    };
    splat(.45, .5, 0, 0, { r: .95, g: .2, b: .4 }, { addVelocity: false, radiusScale: 2.6 });
    const initialPixels = read();
    const initial = mass(initialPixels);
    for (let i = 0; i < 120; i++) {
        const t = i / 120 * Math.PI * 4;
        splat(.5 + .14 * Math.cos(t), .5 + .12 * Math.sin(t),
            -20 * Math.sin(t), 20 * Math.cos(t), {}, { addDye: false, radiusScale: .9 });
        step(1 / 60);
    }
    verify(initial, 'drag at odd resolution');
    const finalPixels = read();
    let changed = 0;
    for (let i = 0; i < finalPixels.length; i += 4)
        changed += Math.abs(finalPixels[i] - initialPixels[i]);
    check(changed > initial[0] * .1, 'Paint must continue moving');

    const previous = mass(finalPixels);
    render(null); // A dye write must not inherit display blending.
    splat(.7, .35, 0, 0, { r: 0, g: .95, b: 0 }, { addVelocity: false, radiusScale: 2.6 });
    let before = mass(read());
    check(before[1] > previous[1] + 100, 'A new drop must increase pigment');
    check(Math.abs(before[0] / previous[0] - 1) < .001, 'A green drop must not duplicate existing red');
    for (let i = 0; i < 90; i++) {
        splat(.95, .5, 0, 25, {}, { addDye: false });
        step(1 / 60);
    }
    verify(before, 'second color and edge dragging');

    config.DYE_RESOLUTION = 1024;
    initFramebuffers();
    before = mass(read());
    for (let i = 0; i < 30; i++) step(1 / 60);
    verify(before, 'resize to high quality');

    clearPaint();
    for (let i = 0; i < 10; i++) step(1 / 60);
    check(mass(read()).every(value => value === 0), 'Clear must stay empty');
    splat(.5, .5, 0, 0, { r: .95, g: 0, b: 0 }, { addVelocity: false, radiusScale: 2.6 });
    before = mass(read());
    for (let i = 0; i < 30; i++) step(1 / 60);
    verify(before, 'idle pure color');

    config.DYE_RESOLUTION = 128;
    config.SHADING = false;
    config.TRANSPARENT = true;
    initFramebuffers();
    updateKeywords();
    const pixelTarget = createFBO(1, 1, ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST);
    const swatches = [...document.querySelectorAll('.ebru-color-swatch')];
    check(swatches.length === 11, 'All traditional swatches are available');
    for (const language of ['tr', 'en']) {
        EbruI18n.setLanguage(language);
        check(swatches.every(swatch => swatch.title && swatch.title !== swatch.dataset.i18nTitle), 'Swatch names are translated');
    }
    // Exercise the actual preset and opaque display, not only the custom picker.
    clearPaint();
    document.querySelector('[data-i18n-aria="sootBlack"]').click();
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, buttons: 2,
        clientX: canvas.clientWidth / 2, clientY: canvas.clientHeight / 2 }));
    config.TRANSPARENT = false;
    config.SHADING = true;
    updateKeywords();
    step(1 / 60);
    render(pixelTarget);
    const blackPixel = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pixelTarget.fbo);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, blackPixel);
    check(blackPixel.slice(0, 3).every(value => value < .35), 'Black preset must visibly darken the opaque canvas');
    config.TRANSPARENT = true;
    config.SHADING = false;
    updateKeywords();
    for (const hex of [...EBRU_PALETTE.map(p => p.hex), '#000000', '#ffffff', '#153253']) {
        clearPaint();
        const input = document.querySelector('.ebru-custom-color');
        input.value = hex;
        input.dispatchEvent(new Event('change'));
        canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, buttons: 2,
            clientX: canvas.clientWidth / 2, clientY: canvas.clientHeight / 2 }));
        render(pixelTarget);
        const pixel = new Float32Array(4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, pixelTarget.fbo);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
        check(pixel[3] > .75, hex + ': black and light colors must have visible coverage');
        const value = parseInt(hex.slice(1), 16);
        const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
        check(rgb.every((component, i) => Math.abs(pixel[i] / pixel[3] - component / 255) < .003),
            hex + ': rendered color must match the selected sRGB shade');
    }
    clearPaint();
    splat(.5, .5, 0, 0, paintColorFromHex('#000000'), { addVelocity: false, radiusScale: 2.6 });
    before = mass(read());
    check(before[3] > 0 && before.slice(0, 3).every(value => value === 0), 'Black has mass without RGB energy');
    for (let i = 0; i < 90; i++) {
        splat(.5, .5, 15, 8, {}, { addDye: false });
        step(1 / 60);
    }
    verify(before, 'black pigment conservation');
    reports.push({ case: '11 swatches, custom black/white/dark shades, EN/TR labels', status: 'PASS' });
    render(null);
    check(gl.getError() === gl.NO_ERROR, 'Rendering must not cause a WebGL error');
    document.body.dataset.verdict = JSON.stringify({ status: 'PASS', reports });
} catch (error) {
    document.body.dataset.verdict = JSON.stringify({ status: 'FAIL', error: error.message });
}
`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
        let data = fs.readFileSync(file);
        if (file.endsWith('index.html')) {
            let html = data.toString().replace(/<script src="https:\/\/cdn.jsdelivr.net[^>]*><\/script>/g, '');
            html = html.replace(/src="\.\/script\.js(?:\?[^"]*)?"/,
                'src="./script.js?filter=' + url.searchParams.get('filter') + '"');
            data = Buffer.from(html);
        }
        if (file.endsWith('script.js')) {
            // Run deterministic frames, without startup drops or the RAF loop.
            let source = data.toString().replace(/^multipleSplats\(parseInt.*$/m, '').replace(/^update\(\);/m, '');
            if (url.searchParams.get('filter') === 'manual')
                source = source.replace('const { gl, ext } = getWebGLContext(canvas);',
                    'const { gl, ext } = getWebGLContext(canvas); ext.supportLinearFiltering = false;');
            data = Buffer.from(source + '\n' + test);
        }
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    } catch { res.writeHead(404); res.end(); }
});

async function run(filter) {
    const args = ['--headless', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + path.join(output, filter), '--window-size=800,650', '--dump-dom',
        '--virtual-time-budget=500', 'http://127.0.0.1:' + server.address().port + '/?filter=' + filter];
    const dom = await new Promise((resolve, reject) => {
        const child = spawn(chrome, args, { windowsHide: true });
        let stdout = '';
        child.stdout.on('data', chunk => stdout += chunk);
        child.stderr.resume();
        const timer = setTimeout(() => { child.kill(); reject(Error('Chrome timed out')); }, 55000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', () => { clearTimeout(timer); resolve(stdout); });
    });
    const verdict = dom.match(/data-verdict="([^"]+)/)?.[1]?.replaceAll('&quot;', '"');
    if (!verdict) throw Error('No WebGL test result from Chrome');
    const report = JSON.parse(verdict);
    console.log(filter + ': ' + JSON.stringify(report));
    if (report.status !== 'PASS') throw Error(report.error);
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await run('native'); await run('manual'); }
    finally { server.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
