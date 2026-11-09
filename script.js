/*
MIT License

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';

// Digital sRGB interpretations of traditional ebru pigments (see EBRU_TUNING.md).
const EBRU_PALETTE = [
    { hex: '#c94b3c', name: 'oxideRed' },
    { hex: '#e3ad35', name: 'oxideYellow' },
    { hex: '#244d80', name: 'lahor' },
    { hex: '#365fc4', name: 'ultramarine' },
    { hex: '#3d965b', name: 'sapGreen' },
    { hex: '#913968', name: 'lac' },
    { hex: '#e44845', name: 'flowerRed' },
    { hex: '#7eb7d8', name: 'lightIndigo' },
    { hex: '#996535', name: 'camlica' },
    { hex: '#242329', name: 'sootBlack' },
    { hex: '#fffaf0', name: 'pigmentWhite' }
];

function paintColorFromHex(hex, amount = 0.95) {
    const value = parseInt(hex.slice(1), 16);
    // Premultiplied color + independent pigment amount preserve light/dark
    // shades, including pure black, without changing the size of a paint drop.
    return {
        r: ((value >> 16) & 255) / 255 * amount,
        g: ((value >> 8) & 255) / 255 * amount,
        b: (value & 255) / 255 * amount,
        a: amount
    };
}

// Simulation section

const canvas = document.getElementsByTagName('canvas')[0];
resizeCanvas();

let config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512,
    // Ebru paint remains on the surface; disable time-based color fading.
    DENSITY_DISSIPATION: 0.0,
    VELOCITY_DISSIPATION: 0.2,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.25,
    DROP_SIZE: 100,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 10,
    PAUSED: false,
    // White background at startup.
    BACK_COLOR: { r: 255, g: 255, b: 255 },
    TRANSPARENT: false,
    BLOOM: false,
    BLOOM_ITERATIONS: 8,
    BLOOM_RESOLUTION: 256,
    BLOOM_INTENSITY: 0.8,
    BLOOM_THRESHOLD: 0.6,
    BLOOM_SOFT_KNEE: 0.7,
    SUNRAYS: false,
    SUNRAYS_RESOLUTION: 196,
    SUNRAYS_WEIGHT: 1.0,
}

function pointerPrototype () {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = [30, 0, 300];
    // Each input uses the shared ebru preset below.
    this.forceScale = 1.0;
    this.radiusScale = 1.0;
    this.maxDelta = Infinity;
    this.addDye = true;
}

let pointers = [];

function createEbruPointer(id) {
    const pointer = new pointerPrototype();
    pointer.id = id;
    pointer.forceScale = 0.32;
    pointer.radiusScale = 0.90;
    pointer.maxDelta = 0.015;
    pointer.addDye = false;
    pointers.push(pointer);
    return pointer;
}

function smoothContactPoint(rawX, rawY, prevX, prevY) {
    const movement = prevX < 0 ? 0 : Math.hypot(rawX - prevX, rawY - prevY);
    const smooth = Math.min(0.50, 0.22 + movement / 100);
    const x = prevX < 0 ? rawX : prevX + (rawX - prevX) * smooth;
    const y = prevY < 0 ? rawY : prevY + (rawY - prevY) * smooth;
    return prevX >= 0 && Math.hypot(x - prevX, y - prevY) < 0.4
        ? { x: prevX, y: prevY } : { x, y };
}

const { gl, ext } = getWebGLContext(canvas);

if (isMobile()) {
    config.DYE_RESOLUTION = 512;
}
if (!ext.supportLinearFiltering) {
    config.DYE_RESOLUTION = 512;
    config.SHADING = false;
    config.BLOOM = false;
    config.SUNRAYS = false;
}

startGUI();

function getWebGLContext (canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2)
        gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2)
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    }
    else
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return {
        gl,
        ext: {
            formatRGBA,
            formatRG,
            formatR,
            halfFloatTexType,
            supportLinearFiltering
        }
    };
}

function getSupportedFormat (gl, internalFormat, format, type)
{
    if (!supportRenderTextureFormat(gl, internalFormat, format, type))
    {
        switch (internalFormat)
        {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }

    return {
        internalFormat,
        format
    }
}

function supportRenderTextureFormat (gl, internalFormat, format, type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status == gl.FRAMEBUFFER_COMPLETE;
}

function startGUI () {
    var gui = new dat.GUI({ width: 300 });
    const translatedControls = [];
    function labelControl(controller, key) {
        translatedControls.push({ controller, key });
        return controller;
    }
    const quality = labelControl(gui.add(config, 'DYE_RESOLUTION', { 'high': 1024, 'medium': 512, 'low': 256, 'very low': 128 }), 'quality').onFinishChange(initFramebuffers);
    labelControl(gui.add(config, 'SIM_RESOLUTION', { '32': 32, '64': 64, '128': 128, '256': 256 }), 'resolution').onFinishChange(initFramebuffers);
    labelControl(gui.add(config, 'VELOCITY_DISSIPATION', 0, 4.0), 'diffusion');
    labelControl(gui.add(config, 'PRESSURE', 0.0, 1.0), 'pressure');
    labelControl(gui.add(config, 'CURL', 0, 50), 'vorticity').step(1);
    labelControl(gui.add(config, 'SPLAT_RADIUS', 0.01, 1.0), 'radius');
    labelControl(gui.add(config, 'DROP_SIZE', 25, 200).step(5), 'dropSize');
    labelControl(gui.add(config, 'SHADING'), 'shading').onFinishChange(updateKeywords);
    labelControl(gui.add(config, 'COLORFUL'), 'colorful');
    labelControl(gui.add(config, 'PAUSED'), 'paused').listen();
    labelControl(gui.add({ fun: clearPaint }, 'fun'), 'clear');

    let captureFolder = gui.addFolder('Capture');
    labelControl(captureFolder.addColor(config, 'BACK_COLOR'), 'background');
    labelControl(captureFolder.add(config, 'TRANSPARENT'), 'transparent');
    labelControl(captureFolder.add({ fun: captureScreenshot }, 'fun'), 'screenshot');

    function translateControls() {
        const t = EbruI18n.t;
        translatedControls.forEach(({ controller, key }) => {
            controller.name(t(key));
            controller.domElement.querySelectorAll('input, select').forEach(input => input.setAttribute('aria-label', t(key)));
        });
        const qualityKeys = { 1024: 'high', 512: 'medium', 256: 'low', 128: 'veryLow' };
        quality.domElement.querySelectorAll('option').forEach(option => {
            option.textContent = t(qualityKeys[option.value]);
        });
        captureFolder.name = t('capture');
        dat.GUI.TEXT_OPEN = t('openControls');
        dat.GUI.TEXT_CLOSED = t('closeControls');
        gui.__closeButton.textContent = t(gui.closed ? 'openControls' : 'closeControls');
    }
    window.addEventListener('ebru-language-change', translateControls);
    translateControls();

    if (isMobile())
        gui.close();
}

function isMobile () {
    return /Mobi|Android/i.test(navigator.userAgent);
}

function captureScreenshot () {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(res.width, res.height, ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST);
    render(target);

    let texture = framebufferToTexture(target);
    texture = normalizeTexture(texture, target.width, target.height);

    let captureCanvas = textureToCanvas(texture, target.width, target.height);
    let datauri = captureCanvas.toDataURL();
    downloadURI('fluid.png', datauri);
    URL.revokeObjectURL(datauri);
}

function framebufferToTexture (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    let length = target.width * target.height * 4;
    let texture = new Float32Array(length);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
    return texture;
}

function normalizeTexture (texture, width, height) {
    let result = new Uint8Array(texture.length);
    let id = 0;
    for (let i = height - 1; i >= 0; i--) {
        for (let j = 0; j < width; j++) {
            let nid = i * width * 4 + j * 4;
            result[nid + 0] = clamp01(texture[id + 0]) * 255;
            result[nid + 1] = clamp01(texture[id + 1]) * 255;
            result[nid + 2] = clamp01(texture[id + 2]) * 255;
            result[nid + 3] = clamp01(texture[id + 3]) * 255;
            id += 4;
        }
    }
    return result;
}

function clamp01 (input) {
    return Math.min(Math.max(input, 0), 1);
}

function textureToCanvas (texture, width, height) {
    let captureCanvas = document.createElement('canvas');
    let ctx = captureCanvas.getContext('2d');
    captureCanvas.width = width;
    captureCanvas.height = height;

    let imageData = ctx.createImageData(width, height);
    imageData.data.set(texture);
    ctx.putImageData(imageData, 0, 0);

    return captureCanvas;
}

function downloadURI (filename, uri) {
    let link = document.createElement('a');
    link.download = filename;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

class Material {
    constructor (vertexShader, fragmentShaderSource) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = [];
        this.activeProgram = null;
        this.uniforms = [];
    }

    setKeywords (keywords) {
        let hash = 0;
        for (let i = 0; i < keywords.length; i++)
            hash += hashCode(keywords[i]);

        let program = this.programs[hash];
        if (program == null)
        {
            let fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
            program = createProgram(this.vertexShader, fragmentShader);
            this.programs[hash] = program;
        }

        if (program == this.activeProgram) return;

        this.uniforms = getUniforms(program);
        this.activeProgram = program;
    }

    bind () {
        gl.useProgram(this.activeProgram);
    }
}

class Program {
    constructor (vertexShader, fragmentShader) {
        this.uniforms = {};
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }

    bind () {
        gl.useProgram(this.program);
    }
}

function createProgram (vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        console.trace(gl.getProgramInfoLog(program));

    return program;
}

function getUniforms (program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}

function compileShader (type, source, keywords) {
    source = addKeywords(source, keywords);

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        console.trace(gl.getShaderInfoLog(shader));

    return shader;
};

function addKeywords (source, keywords) {
    if (keywords == null) return source;
    let keywordsString = '';
    keywords.forEach(keyword => {
        keywordsString += '#define ' + keyword + '\n';
    });
    return keywordsString + source;
}

const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`);

const blurVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - texelSize * offset;
        vR = vUv + texelSize * offset;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`);

const blurShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
        sum += texture2D(uTexture, vL) * 0.35294117;
        sum += texture2D(uTexture, vR) * 0.35294117;
        gl_FragColor = sum;
    }
`);

const copyShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`);

const clearShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`);

const colorShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;

    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`);

const checkerboardShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float aspectRatio;

    #define SCALE 25.0

    void main () {
        vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
        float v = mod(uv.x + uv.y, 2.0);
        v = v * 0.1 + 0.8;
        gl_FragColor = vec4(vec3(v), 1.0);
    }
`);

const displayShaderSource = `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uBloom;
    uniform sampler2D uSunrays;
    uniform sampler2D uDithering;
    uniform vec2 ditherScale;
    uniform vec2 texelSize;

    vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
    }

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float shading = 1.0;

    #ifdef SHADING
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;

        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);

        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);

        shading = clamp(dot(n, l) + 0.7, 0.7, 1.0);
    #endif

    #ifdef BLOOM
        vec3 bloom = texture2D(uBloom, vUv).rgb;
    #endif

    #ifdef SUNRAYS
        float sunrays = texture2D(uSunrays, vUv).r;
        c *= sunrays;
    #ifdef BLOOM
        bloom *= sunrays;
    #endif
    #endif

    #ifdef BLOOM
        float noise = texture2D(uDithering, vUv * ditherScale).r;
        noise = noise * 2.0 - 1.0;
        bloom += noise / 255.0;
        bloom = linearToGamma(bloom);
        c += bloom;
    #endif

        // Pigment amount is independent of color: black has mass too, and
        // white should remain white rather than being capped at gray.
        float density = texture2D(uTexture, vUv).a;
        vec3 hue = clamp(c / max(density, 1.0e-10), 0.0, 1.0);
        // Coverage follows concentration: stretching paint makes a thinner
        // film, rather than boosting faint traces into extra visible paint.
        float a = 1.0 - exp(-density * 1.8 * shading);
        c = hue * a;
        gl_FragColor = vec4(c, a);
    }
`;

const bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec3 curve;
    uniform float threshold;

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - curve.x, 0.0, curve.y);
        rq = curve.z * rq * rq;
        c *= max(rq, br - threshold) / max(br, 0.0001);
        gl_FragColor = vec4(c, 0.0);
    }
`);

const bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum;
    }
`);

const bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform float intensity;

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(uTexture, vL);
        sum += texture2D(uTexture, vR);
        sum += texture2D(uTexture, vT);
        sum += texture2D(uTexture, vB);
        sum *= 0.25;
        gl_FragColor = sum * intensity;
    }
`);

const sunraysMaskShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        vec4 c = texture2D(uTexture, vUv);
        float br = max(c.r, max(c.g, c.b));
        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
        gl_FragColor = c;
    }
`);

const sunraysShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;

    #define ITERATIONS 16

    void main () {
        float Density = 0.3;
        float Decay = 0.95;
        float Exposure = 0.7;

        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;

        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;

        float color = texture2D(uTexture, vUv).a;

        for (int i = 0; i < ITERATIONS; i++)
        {
            coord -= dir;
            float col = texture2D(uTexture, coord).a;
            color += col * illuminationDecay * weight;
            illuminationDecay *= Decay;
        }

        gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
    }
`);

const splatShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform float pigmentAmount;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec4 splat = exp(-dot(p, p) / radius) * vec4(color, pigmentAmount);
        gl_FragColor = texture2D(uTarget, vUv) + splat;
    }
`);

const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
    #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
    #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }`,
    ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']
);

// Reduce pigment on the GPU. Zero padding gives every source texel the
// same weight, including odd-sized textures and one-pixel-wide levels.
const dyeMassShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    uniform sampler2D uTexture;
    uniform vec2 sourceSize;

    vec4 samplePigment(vec2 pixel) {
        if (pixel.x >= sourceSize.x || pixel.y >= sourceSize.y)
            return vec4(0.0);
        return texture2D(uTexture, (pixel + 0.5) / sourceSize);
    }

    void main () {
        vec2 p = floor(gl_FragCoord.xy) * 2.0;
        vec4 mass = samplePigment(p) + samplePigment(p + vec2(1.0, 0.0))
            + samplePigment(p + vec2(0.0, 1.0)) + samplePigment(p + vec2(1.0));
        gl_FragColor = mass * 0.25;
    }
`);

const conserveDyeShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform sampler2D uTargetMass;
    uniform sampler2D uCurrentMass;

    void main () {
        vec4 target = texture2D(uTargetMass, vec2(0.5));
        vec4 current = texture2D(uCurrentMass, vec2(0.5));
        vec4 scale = target / max(current, vec4(1.0e-10));
        gl_FragColor = texture2D(uTexture, vUv) * scale;
    }
`);

const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;

        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }

        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`);

const curlShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`);

const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;

        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);

const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`);

const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`);

const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return (target, clear = false) => {
        if (target == null)
        {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        else
        {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear)
        {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        // CHECK_FRAMEBUFFER_STATUS();
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
})();

function CHECK_FRAMEBUFFER_STATUS () {
    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE)
        console.trace("Framebuffer error: " + status);
}

let dye;
let dyeMassLevels = [];
let dyeTargetMass;
let dyeMassDirty = true;
let velocity;
let divergence;
let curl;
let pressure;
let bloom;
let bloomFramebuffers = [];
let sunrays;
let sunraysTemp;

let ditheringTexture = createTextureAsync('LDR_LLL1_0.png');

const blurProgram            = new Program(blurVertexShader, blurShader);
const copyProgram            = new Program(baseVertexShader, copyShader);
const clearProgram           = new Program(baseVertexShader, clearShader);
const colorProgram           = new Program(baseVertexShader, colorShader);
const checkerboardProgram    = new Program(baseVertexShader, checkerboardShader);
const bloomPrefilterProgram  = new Program(baseVertexShader, bloomPrefilterShader);
const bloomBlurProgram       = new Program(baseVertexShader, bloomBlurShader);
const bloomFinalProgram      = new Program(baseVertexShader, bloomFinalShader);
const sunraysMaskProgram     = new Program(baseVertexShader, sunraysMaskShader);
const sunraysProgram         = new Program(baseVertexShader, sunraysShader);
const splatProgram           = new Program(baseVertexShader, splatShader);
const advectionProgram       = new Program(baseVertexShader, advectionShader);
const dyeMassProgram         = new Program(baseVertexShader, dyeMassShader);
const conserveDyeProgram     = new Program(baseVertexShader, conserveDyeShader);
const divergenceProgram      = new Program(baseVertexShader, divergenceShader);
const curlProgram            = new Program(baseVertexShader, curlShader);
const vorticityProgram       = new Program(baseVertexShader, vorticityShader);
const pressureProgram        = new Program(baseVertexShader, pressureShader);
const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);

const displayMaterial = new Material(baseVertexShader, displayShaderSource);

function initFramebuffers () {
    let simRes = getResolution(config.SIM_RESOLUTION);
    let dyeRes = getResolution(config.DYE_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba    = ext.formatRGBA;
    const rg      = ext.formatRG;
    const r       = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    if (dye == null)
        dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    else
        dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);

    dyeMassDirty = true;
    initDyeMassFramebuffers();

    if (velocity == null)
        velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    else
        velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);

    divergence = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    curl       = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    pressure   = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

    initBloomFramebuffers();
    initSunraysFramebuffers();
}

function initDyeMassFramebuffers () {
    const first = dyeMassLevels[0];
    if (first && first.width === Math.ceil(dye.width / 2)
        && first.height === Math.ceil(dye.height / 2)) return;

    for (const level of dyeMassLevels) {
        gl.deleteTexture(level.texture);
        gl.deleteFramebuffer(level.fbo);
    }
    dyeMassLevels = [];
    const rgba = ext.formatRGBA;
    let width = dye.width, height = dye.height;
    do {
        width = Math.max(1, Math.ceil(width / 2));
        height = Math.max(1, Math.ceil(height / 2));
        dyeMassLevels.push(createFBO(width, height, rgba.internalFormat,
            rgba.format, ext.halfFloatTexType, gl.NEAREST));
    } while (width > 1 || height > 1);
    if (!dyeTargetMass)
        dyeTargetMass = createFBO(1, 1, rgba.internalFormat, rgba.format, ext.halfFloatTexType, gl.NEAREST);
    dyeMassDirty = true;
}

function measureDyeMass () {
    dyeMassProgram.bind();
    let source = dye.read;
    for (const level of dyeMassLevels) {
        gl.uniform1i(dyeMassProgram.uniforms.uTexture, source.attach(0));
        gl.uniform2f(dyeMassProgram.uniforms.sourceSize, source.width, source.height);
        blit(level);
        source = level;
    }
    return source;
}

function rememberDyeMass () {
    const mass = measureDyeMass();
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, mass.attach(0));
    blit(dyeTargetMass);
    dyeMassDirty = false;
}

function conserveDyeMass () {
    const mass = measureDyeMass();
    conserveDyeProgram.bind();
    gl.uniform1i(conserveDyeProgram.uniforms.uTexture, dye.read.attach(0));
    gl.uniform1i(conserveDyeProgram.uniforms.uTargetMass, dyeTargetMass.attach(1));
    gl.uniform1i(conserveDyeProgram.uniforms.uCurrentMass, mass.attach(2));
    blit(dye.write);
    dye.swap();
}

function initBloomFramebuffers () {
    let res = getResolution(config.BLOOM_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);

    bloomFramebuffers.length = 0;
    for (let i = 0; i < config.BLOOM_ITERATIONS; i++)
    {
        let width = res.width >> (i + 1);
        let height = res.height >> (i + 1);

        if (width < 2 || height < 2) break;

        let fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
        bloomFramebuffers.push(fbo);
    }
}

function initSunraysFramebuffers () {
    let res = getResolution(config.SUNRAYS_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    sunrays     = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
    sunraysTemp = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
}

function createFBO (w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let texelSizeX = 1.0 / w;
    let texelSizeY = 1.0 / h;

    return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };
}

function createDoubleFBO (w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read () {
            return fbo1;
        },
        set read (value) {
            fbo1 = value;
        },
        get write () {
            return fbo2;
        },
        set write (value) {
            fbo2 = value;
        },
        swap () {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}

function resizeFBO (target, w, h, internalFormat, format, type, param) {
    let newFBO = createFBO(w, h, internalFormat, format, type, param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
}

function resizeDoubleFBO (target, w, h, internalFormat, format, type, param) {
    if (target.width == w && target.height == h)
        return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
}

function createTextureAsync (url) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj = {
        texture,
        width: 1,
        height: 1,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };

    let image = new Image();
    image.onload = () => {
        obj.width = image.width;
        obj.height = image.height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}

function updateKeywords () {
    let displayKeywords = [];
    if (config.SHADING) displayKeywords.push("SHADING");
    displayMaterial.setKeywords(displayKeywords);
}

updateKeywords();
initFramebuffers();
multipleSplats(parseInt(Math.random() * 20) + 5);

let lastUpdateTime = Date.now();
let colorUpdateTimer = 0.0;
update();

function update () {
    const dt = calcDeltaTime();
    if (resizeCanvas())
        initFramebuffers();
    updateColors(dt);
    applyInputs();
    if (!config.PAUSED)
        step(dt);
    render(null);
    requestAnimationFrame(update);
}

function calcDeltaTime () {
    let now = Date.now();
    let dt = (now - lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastUpdateTime = now;
    return dt;
}

function resizeCanvas () {
    let width = scaleByPixelRatio(canvas.clientWidth);
    let height = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }
    return false;
}

function updateColors (dt) {
    if (!config.COLORFUL) return;

    colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach(p => {
            p.color = generateColor();
        });
    }
}

function applyInputs () {
    pointers.forEach(p => {
        if (p.updateInput) p.updateInput();
        if (p.moved) {
            p.moved = false;
            splatPointer(p);
        }
    });
}

function clearPaint () {
    dyeMassDirty = true;
    // Clear residual flow and pressure together with the paint so new drops
    // added to a clean tray are not affected by old motion.
    const targets = [
        dye.read, dye.write,
        velocity.read, velocity.write,
        pressure.read, pressure.write,
        divergence, curl
    ];

    gl.disable(gl.BLEND);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    targets.forEach(target => {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    pointers.forEach(pointer => {
        pointer.moved = false;
        pointer.deltaX = 0;
        pointer.deltaY = 0;
    });
}

function step (dt) {
    gl.disable(gl.BLEND);
    // Only a new drop, a clear, or a resolution change resets the budget.
    // Reuse it between frames to avoid accumulating half-float rounding drift.
    if (dyeMassDirty) rememberDyeMass();

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
    }

    gradienSubtractProgram.bind();
    gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    let velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    // Hard-lock dye dissipation to zero. UI/config changes cannot fade paint.
    gl.uniform1f(advectionProgram.uniforms.dissipation, 0.0);
    blit(dye.write);
    dye.swap();
    // Semi-Lagrangian sampling can grow/shrink pigment under deformation.
    // Correct its total per color channel without modifying fluid velocity.
    conserveDyeMass();
}

function render (target) {
    if (target == null || !config.TRANSPARENT) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
    }
    else {
        gl.disable(gl.BLEND);
    }

    if (!config.TRANSPARENT)
        drawColor(target, normalizeColor(config.BACK_COLOR));
    if (target == null && config.TRANSPARENT)
        drawCheckerboard(target);
    drawDisplay(target);
}

function drawColor (target, color) {
    colorProgram.bind();
    gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
    blit(target);
}

function drawCheckerboard (target) {
    checkerboardProgram.bind();
    gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    blit(target);
}

function drawDisplay (target) {
    let width = target == null ? gl.drawingBufferWidth : target.width;
    let height = target == null ? gl.drawingBufferHeight : target.height;

    displayMaterial.bind();
    if (config.SHADING)
        gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(target);
}

function applyBloom (source, destination) {
    if (bloomFramebuffers.length < 2)
        return;

    let last = destination;

    gl.disable(gl.BLEND);
    bloomPrefilterProgram.bind();
    let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
    let curve0 = config.BLOOM_THRESHOLD - knee;
    let curve1 = knee * 2;
    let curve2 = 0.25 / knee;
    gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
    gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
    gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
    blit(last);

    bloomBlurProgram.bind();
    for (let i = 0; i < bloomFramebuffers.length; i++) {
        let dest = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(dest);
        last = dest;
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);

    for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
        let baseTex = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        gl.viewport(0, 0, baseTex.width, baseTex.height);
        blit(baseTex);
        last = baseTex;
    }

    gl.disable(gl.BLEND);
    bloomFinalProgram.bind();
    gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
    gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
    gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
    blit(destination);
}

function applySunrays (source, mask, destination) {
    gl.disable(gl.BLEND);
    sunraysMaskProgram.bind();
    gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
    blit(mask);

    sunraysProgram.bind();
    gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
    gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
    blit(destination);
}

function blur (target, temp, iterations) {
    blurProgram.bind();
    for (let i = 0; i < iterations; i++) {
        gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp);

        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target);
    }
}

function splatPointer (pointer) {
    let deltaX = pointer.deltaX;
    let deltaY = pointer.deltaY;
    const deltaLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Limit large movements from either input without changing their direction.
    if (deltaLength > pointer.maxDelta) {
        const scale = pointer.maxDelta / deltaLength;
        deltaX *= scale;
        deltaY *= scale;
    }

    let dx = deltaX * config.SPLAT_FORCE * pointer.forceScale;
    let dy = deltaY * config.SPLAT_FORCE * pointer.forceScale;
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color, {
        radiusScale: pointer.radiusScale,
        addDye: pointer.addDye
    });
}

function multipleSplats (amount) {
    for (let i = 0; i < amount; i++) {
        const color = generateColor();
        color.r *= 3.0;
        color.g *= 3.0;
        color.b *= 3.0;
        color.a *= 3.0;
        const x = Math.random();
        const y = Math.random();
        const dx = 1000 * (Math.random() - 0.5);
        const dy = 1000 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
    }
}

function splat (x, y, dx, dy, color, options = {}) {
    // Dye alpha stores mass, so these simulation writes must never blend.
    gl.disable(gl.BLEND);
    const radiusScale = options.radiusScale == null ? 1.0 : options.radiusScale;
    const radius = correctRadius(config.SPLAT_RADIUS * radiusScale / 100.0);

    if (options.addVelocity !== false) {
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x, y);
        gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
        gl.uniform1f(splatProgram.uniforms.pigmentAmount, 0.0);
        gl.uniform1f(splatProgram.uniforms.radius, radius);
        blit(velocity.write);
        velocity.swap();
    }

    // A traditional ebru awl/combs move the existing floating paint film;
    // they do not deposit a fresh blob of pigment on every movement.
    if (options.addDye === false) return;
    dyeMassDirty = true;

    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    gl.uniform1f(splatProgram.uniforms.pigmentAmount,
        color.a == null ? Math.max(color.r, color.g, color.b) : color.a);
    gl.uniform1f(splatProgram.uniforms.radius, radius);
    blit(dye.write);
    dye.swap();
}

function correctRadius (radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1)
        radius *= aspectRatio;
    return radius;
}

// Painting inputs share the ebru dynamics; P pauses the simulation.
window.addEventListener('keydown', e => {
    if (e.code === 'KeyP')
        config.PAUSED = !config.PAUSED;
});

function updatePointerDownData (pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
}

function updatePointerMoveData (pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData (pointer) {
    pointer.down = false;
    pointer.moved = false;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
}

function correctDeltaX (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
}

function correctDeltaY (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
}

function generateColor () {
    const pigment = EBRU_PALETTE[Math.floor(Math.random() * EBRU_PALETTE.length)];
    return paintColorFromHex(pigment.hex, 0.35);
}

function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r,
        g,
        b
    };
}

function normalizeColor (input) {
    let output = {
        r: input.r / 255,
        g: input.g / 255,
        b: input.b / 255
    };
    return output;
}

function wrap (value, min, max) {
    let range = max - min;
    if (range == 0) return min;
    return (value - min) % range + min;
}

function getResolution (resolution) {
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1)
        aspectRatio = 1.0 / aspectRatio;

    let min = Math.round(resolution);
    let max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
    else
        return { width: min, height: max };
}

function getTextureScale (texture, width, height) {
    return {
        x: width / texture.width,
        y: height / texture.height
    };
}

function scaleByPixelRatio (input) {
    let pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
}

function hashCode (s) {
    if (s.length == 0) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
// ============================================================
// MEDIAPIPE HAND TRACKING — pinch gesture controls
// ============================================================

(function initHandTracking() {

    // Create the camera video element.
    const video = document.createElement('video');
    video.style.display = 'none';
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    document.body.appendChild(video);

    // Keep mouse feedback, camera status and the camera button in one stack.
    const inputControls = document.createElement('div');
    inputControls.className = 'ebru-input-controls';
    document.body.appendChild(inputControls);

    // UI: kamera butonu
    const btn = document.createElement('button');
    btn.className = 'ebru-camera-button';
    EbruI18n.bind(btn, 'camera');
    btn.style.cssText = [
        'position:relative',
        'padding:10px 20px', 'background:rgba(0,0,0,0.6)',
        'color:#fff', 'border:1px solid rgba(255,255,255,0.3)',
        'border-radius:24px', 'font-size:14px', 'cursor:pointer',
        'z-index:999', 'backdrop-filter:blur(6px)',
        'transition:all 0.2s', 'letter-spacing:0.05em'
    ].join(';');
    inputControls.appendChild(btn);

    // UI: durum etiketi
    const label = document.createElement('div');
    label.className = 'ebru-camera-status';
    label.setAttribute('role', 'status');
    label.style.cssText = [
        'position:relative',
        'padding:5px 14px', 'background:rgba(0,0,0,0.55)',
        'color:rgba(255,255,255,0.5)', 'border-radius:16px',
        'font-size:11px', 'letter-spacing:0.15em',
        'text-transform:uppercase', 'z-index:999',
        'font-family:sans-serif', 'display:none'
    ].join(';');
    inputControls.insertBefore(label, btn);

    // Mouse button feedback is visual only and never intercepts canvas input.
    const mouseIndicator = document.createElement('div');
    mouseIndicator.className = 'ebru-mouse-indicator';
    mouseIndicator.setAttribute('aria-hidden', 'true');
    mouseIndicator.innerHTML = `
        <svg width="34" height="50" viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect class="ebru-mouse-body" x="2" y="2" width="36" height="56" rx="18"/>
            <path class="ebru-mouse-left" d="M20 2C10.06 2 2 10.06 2 20V27H20V2Z"/>
            <path class="ebru-mouse-right" d="M20 2C29.94 2 38 10.06 38 20V27H20V2Z"/>
            <rect class="ebru-mouse-outline" x="2" y="2" width="36" height="56" rx="18"/>
            <path class="ebru-mouse-outline" d="M2 27H38M20 2V27"/>
            <rect class="ebru-mouse-wheel" x="18" y="11" width="4" height="9" rx="2"/>
        </svg>`;
    inputControls.insertBefore(mouseIndicator, label);

    function setMouseButtons(buttons) {
        mouseIndicator.classList.toggle('is-left-pressed', (buttons & 1) !== 0);
        mouseIndicator.classList.toggle('is-right-pressed', (buttons & 2) !== 0);
    }
    const syncMouseButtons = event => setMouseButtons(event.buttons);
    window.addEventListener('mousedown', syncMouseButtons, true);
    window.addEventListener('mouseup', syncMouseButtons, true);
    // Recover the held state when returning to the page after an outside release.
    window.addEventListener('mousemove', syncMouseButtons, true);
    window.addEventListener('mouseout', event => {
        if (!event.relatedTarget) setMouseButtons(0);
    });
    window.addEventListener('blur', () => setMouseButtons(0));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) setMouseButtons(0);
    });


    // The supplied hand images share a hotspot at the paint contact point.
    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = `
        .ebru-input-controls {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            max-width: calc(100vw - 40px);
            pointer-events: none;
        }
        .ebru-input-controls .ebru-camera-button { pointer-events: auto; }
        .ebru-input-controls .ebru-camera-status { max-width: 100%; }
        .ebru-mouse-indicator {
            display: flex;
            color: var(--ebru-ink, #c2ccc8);
            pointer-events: none;
        }
        .ebru-mouse-body { fill: var(--ebru-paper, #26241b); fill-opacity: .97; }
        .ebru-mouse-left, .ebru-mouse-right {
            fill: currentColor;
            fill-opacity: .12;
            transition: fill 100ms ease, fill-opacity 100ms ease;
        }
        .ebru-mouse-outline { stroke: currentColor; stroke-width: 1.8; }
        .ebru-mouse-wheel { fill: currentColor; }
        .is-left-pressed .ebru-mouse-left,
        .is-right-pressed .ebru-mouse-right {
            fill: var(--ebru-madder, #ce8069);
            fill-opacity: 1;
            transition: none;
        }
        @media (hover: none) and (pointer: coarse) {
            .ebru-mouse-indicator { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
            .ebru-mouse-left, .ebru-mouse-right { transition: none; }
        }
        .ebru-hand-cursor {
            position: fixed;
            left: 0;
            top: 0;
            width: 0;
            height: 0;
            display: none;
            pointer-events: none;
            z-index: 1000;
            opacity: 0.92;
            transition: opacity 100ms ease;
        }
        .ebru-hand-cursor img {
            position: absolute;
            left: 0;
            top: 0;
            width: 112px;
            height: auto;
            max-width: none;
            user-select: none;
            transition: opacity 120ms ease;
        }
        .ebru-hand-point {
            transform: translate(-30.6%, -15.6%);
            opacity: 1;
        }
        .ebru-hand-pinch {
            transform: translate(-29.3%, -46.9%);
            opacity: 0;
        }
        .ebru-hand-cursor.active { opacity: 1; }
        .ebru-hand-cursor.pinching .ebru-hand-point { opacity: 0; }
        .ebru-hand-cursor.pinching .ebru-hand-pinch { opacity: 1; }
        .ebru-hand-visual { transform-origin: 0 0; }
        .ebru-hand-cursor.pinching .ebru-hand-visual {
            animation: ebru-hand-close 180ms ease-out;
        }
        @keyframes ebru-hand-close {
            0% { transform: scale(1); }
            45% { transform: scale(0.96); }
            100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
            .ebru-hand-cursor, .ebru-hand-cursor img { transition: none; }
            .ebru-hand-cursor.pinching .ebru-hand-visual { animation: none; }
        }
        .ebru-color-palette {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 1001;
            width: 230px;
            padding: 12px;
            box-sizing: border-box;
            border-radius: 10px;
            border: 1px solid rgba(63, 48, 35, 0.28);
            background: rgba(244, 238, 224, 0.94);
            color: #342c25;
            font-family: Arial, sans-serif;
            user-select: none;
        }
        .ebru-palette-title {
            margin-bottom: 9px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
        }
        .ebru-palette-row {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            align-items: center;
            justify-items: center;
            gap: 7px;
        }
        .ebru-color-swatch {
            width: 24px;
            height: 24px;
            padding: 0;
            border-radius: 50%;
            border: 2px solid rgba(52, 44, 37, 0.28);
            cursor: pointer;
        }
        .ebru-color-swatch.selected, .ebru-custom-color.selected {
            border-color: #2f2822;
            outline: 2px solid #f5efe3;
            outline-offset: -4px;
        }
        .ebru-custom-color-picker {
            position: relative;
            grid-column: 1 / -1;
            justify-self: stretch;
            height: 30px;
            margin-top: 3px;
            cursor: pointer;
        }
        .ebru-custom-color-picker .ebru-custom-color {
            position: absolute;
            inset: 0;
            z-index: 1;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            opacity: 0;
            cursor: pointer;
        }
        .ebru-custom-color-label {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 100%;
            box-sizing: border-box;
            border: 1px solid currentColor;
            border-radius: 4px;
            color: inherit;
            font-size: 12px;
            font-weight: 500;
            line-height: 1;
        }
        .ebru-custom-color-label svg { flex: none; }
        .ebru-custom-color-picker:hover .ebru-custom-color-label {
            background: rgba(127, 127, 127, .12);
        }
        .ebru-custom-color.selected + .ebru-custom-color-label {
            background: rgba(127, 127, 127, .18);
        }
        .ebru-custom-color:focus-visible + .ebru-custom-color-label {
            outline: 2px solid currentColor;
            outline-offset: 3px;
        }
    `;
    document.head.appendChild(cursorStyle);

    const toolCursor = document.createElement('div');
    toolCursor.className = 'ebru-hand-cursor';
    toolCursor.setAttribute('aria-hidden', 'true');
    toolCursor.innerHTML = `
        <div class="ebru-hand-visual">
            <img class="ebru-hand-point" src="assets/hand-point.png" alt="" draggable="false" width="1536" height="1024">
            <img class="ebru-hand-pinch" src="assets/hand-pinch.png" alt="" draggable="false" width="1536" height="1024">
        </div>`;
    document.body.appendChild(toolCursor);
    const mouseCursor = toolCursor.cloneNode(true);
    mouseCursor.classList.add('ebru-mouse-cursor');
    document.body.appendChild(mouseCursor);

    // Paint palette independent from the main dat.GUI panel.
    const palette = document.createElement('div');
    palette.className = 'ebru-color-palette';
    palette.innerHTML = `
        <div class="ebru-palette-title" data-i18n="palette">PAINT COLOR</div>
        <div class="ebru-palette-row">
            ${EBRU_PALETTE.map((pigment, index) => `<button class="ebru-color-swatch${index === 0 ? ' selected' : ''}" type="button" data-color="${pigment.hex}" data-i18n-aria="${pigment.name}" data-i18n-title="${pigment.name}" style="background:${pigment.hex}"></button>`).join('')}
            <label class="ebru-custom-color-picker" data-i18n-title="customColor">
                <input class="ebru-custom-color" type="color" value="${EBRU_PALETTE[0].hex}" data-i18n-aria="customColor" aria-label="Custom paint color">
                <span class="ebru-custom-color-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M12 8v8M8 12h8"></path>
                    </svg>
                    <span data-i18n="customColorAction">Custom color</span>
                </span>
            </label>
        </div>
    `;
    document.body.appendChild(palette);
    EbruI18n.apply(palette);

    let selectedPaintHex = EBRU_PALETTE[0].hex;
    let selectedPaintColor = paintColorFromHex(selectedPaintHex);
    const customColorInput = palette.querySelector('.ebru-custom-color');
    const colorSwatches = Array.from(palette.querySelectorAll('.ebru-color-swatch'));

    function selectPaintColor(hex, selectedSwatch) {
        selectedPaintHex = hex;
        selectedPaintColor = paintColorFromHex(hex);
        toolCursor.style.setProperty('--paint-color', hex);
        colorSwatches.forEach(swatch => swatch.classList.toggle('selected', swatch === selectedSwatch));
        customColorInput.classList.toggle('selected', selectedSwatch === null);
    }

    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => selectPaintColor(swatch.dataset.color, swatch));
    });
    // Keep the custom swatch independent of presets and apply both live and
    // committed picker changes. Clicking it also reselects its existing color.
    const selectCustomColor = () => selectPaintColor(customColorInput.value, null);
    customColorInput.addEventListener('input', selectCustomColor);
    customColorInput.addEventListener('change', selectCustomColor);
    customColorInput.addEventListener('click', selectCustomColor);
    toolCursor.style.setProperty('--paint-color', selectedPaintHex);

    // Both inputs use the same force, radius, movement cap and dye behavior.
    const HAND_POINTER_ID = 99;
    const handPointer = createEbruPointer(HAND_POINTER_ID);
    const mousePointer = createEbruPointer(-1);
    let mouseTarget = null;
    let mouseX = -1, mouseY = -1;
    canvas.style.cursor = 'none';

    function mousePosition(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function mouseCanvasPosition(x, y) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.floor(Math.max(0, Math.min(1, x / rect.width)) * canvas.width),
            y: Math.floor(Math.max(0, Math.min(1, y / rect.height)) * canvas.height)
        };
    }

    function stopMouseDrag() {
        updatePointerUpData(mousePointer);
        mouseTarget = null;
        mouseX = mouseY = -1;
        mouseCursor.classList.remove('active', 'drop-mode', 'pinching');
    }

    function hideMouseCursor() {
        stopMouseDrag();
        mouseCursor.style.display = 'none';
    }

    // Sample the latest mouse position once per simulation frame so high-rate
    // mouse events cannot overwrite an unconsumed movement delta.
    mousePointer.updateInput = () => {
        if (!mousePointer.down || !mouseTarget) return;
        const point = smoothContactPoint(mouseTarget.x, mouseTarget.y, mouseX, mouseY);
        mouseX = point.x;
        mouseY = point.y;
        const position = mouseCanvasPosition(mouseX, mouseY);
        updatePointerMoveData(mousePointer, position.x, position.y);
        const rect = canvas.getBoundingClientRect();
        updateToolCursor(mouseX + rect.left, mouseY + rect.top, 'move', mouseCursor);
    };

    canvas.addEventListener('mouseenter', event => {
        updateToolCursor(event.clientX, event.clientY, 'tracking', mouseCursor);
    });
    canvas.addEventListener('mousedown', event => {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        if ((event.buttons & 3) === 3) {
            stopMouseDrag();
            return;
        }
        const point = mousePosition(event);
        const position = mouseCanvasPosition(point.x, point.y);
        if (event.button === 2) {
            stopMouseDrag();
            addPaintDrop(position.x, position.y);
            updateToolCursor(event.clientX, event.clientY, 'drop', mouseCursor);
        } else {
            mouseTarget = point;
            mouseX = point.x;
            mouseY = point.y;
            updatePointerDownData(mousePointer, -1, position.x, position.y);
            updateToolCursor(event.clientX, event.clientY, 'move', mouseCursor);
        }
    });

    canvas.addEventListener('mousemove', event => {
        if (!mousePointer.down) {
            updateToolCursor(event.clientX, event.clientY, 'tracking', mouseCursor);
            return;
        }
        if ((event.buttons & 3) !== 1) {
            stopMouseDrag();
            updateToolCursor(event.clientX, event.clientY, 'tracking', mouseCursor);
            return;
        }
        mouseTarget = mousePosition(event);
    });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('mouseleave', hideMouseCursor);
    window.addEventListener('mouseup', event => {
        if (event.button === 0 || event.button === 2) stopMouseDrag();
    });
    window.addEventListener('blur', hideMouseCursor);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) hideMouseCursor();
    });

    // Smoothing and independent gesture states.
    let prevX = -1, prevY = -1;
    let isMovingPaint = false;
    let isDroppingPaint = false;
    let camStarted = false;
    let cameraSession = 0;
    let handsInstance = null;
    let cameraInstance = null;
    let mediaStream = null;
    const PINCH_START_RATIO = 0.34;
    const PINCH_RELEASE_RATIO = 0.46;
    const PINCH_START_DISTANCE = 0.055;
    const PINCH_RELEASE_DISTANCE = 0.075;

    function setLabel(key, active) {
        label.style.display = 'block';
        if (label.dataset.i18n !== key) EbruI18n.bind(label, key);
        label.style.color = active ? '#e0b083' : 'rgba(255,255,255,0.55)';
    }

    function updateToolCursor(x, y, mode, cursor = toolCursor) {
        cursor.style.display = 'block';
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.classList.toggle('active', mode !== 'tracking');
        cursor.classList.toggle('drop-mode', mode === 'drop');
        cursor.classList.toggle('pinching', mode === 'move');
    }

    function distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function detectPinch(pinchDistance, handScale, wasActive) {
        const ratioLimit = wasActive ? PINCH_RELEASE_RATIO : PINCH_START_RATIO;
        const distanceLimit = wasActive ? PINCH_RELEASE_DISTANCE : PINCH_START_DISTANCE;
        return pinchDistance / handScale < ratioLimit || pinchDistance < distanceLimit;
    }

    function addPaintDrop(posX, posY) {
        const x = Math.min(1, Math.max(0, posX / canvas.width));
        const y = Math.min(1, Math.max(0, 1.0 - posY / canvas.height));
        splat(x, y, 0, 0, selectedPaintColor, {
            // The Gaussian radius parameter scales with area; square the
            // size percentage so the visible diameter follows the slider.
            radiusScale: 2.6 * Math.pow(config.DROP_SIZE / 100, 2),
            addVelocity: false,
            addDye: true
        });
    }

    function onHandResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const lm = results.multiHandLandmarks[0];
            const thumbTip = lm[4];
            const indexTip = lm[8];
            const middleTip = lm[12];
            const handScale = Math.max(distance(lm[5], lm[17]), 0.0001);

            // Landmarks 4+8 only move paint; landmarks 4+12 only add paint.
            const indexDistance = distance(thumbTip, indexTip);
            const middleDistance = distance(thumbTip, middleTip);
            const indexCandidate = detectPinch(indexDistance, handScale, isMovingPaint);
            const middleCandidate = detectPinch(middleDistance, handScale, isDroppingPaint);

            // Lock interaction if both pinches appear at the same time.
            const moveGesture = indexCandidate && !middleCandidate;
            const dropGesture = middleCandidate && !indexCandidate;
            const activeTip = dropGesture ? middleTip : indexTip;
            const contactX = (thumbTip.x + activeTip.x) * 0.5;
            const contactY = (thumbTip.y + activeTip.y) * 0.5;
            const rawX = (1.0 - contactX) * window.innerWidth;
            const rawY = contactY * window.innerHeight;

            const { x: sx, y: sy } = smoothContactPoint(rawX, rawY, prevX, prevY);

            const posX = scaleByPixelRatio(sx);
            const posY = scaleByPixelRatio(sy);
            const cursorMode = dropGesture ? 'drop' : (moveGesture ? 'move' : 'tracking');
            updateToolCursor(sx, sy, cursorMode);

            if (moveGesture) {
                if (!isMovingPaint) {
                    updatePointerDownData(handPointer, HAND_POINTER_ID, posX, posY);
                    isMovingPaint = true;
                } else {
                    updatePointerMoveData(handPointer, posX, posY);
                }
            } else if (isMovingPaint) {
                updatePointerUpData(handPointer);
                isMovingPaint = false;
            }

            // Add only one drop for each middle-finger pinch closure.
            if (dropGesture && !isDroppingPaint) {
                addPaintDrop(posX, posY);
                isDroppingPaint = true;
            } else if (!middleCandidate) {
                isDroppingPaint = false;
            }

            if (moveGesture) {
                setLabel('movePaint', true);
            } else if (dropGesture) {
                setLabel('paintDrop', true);
            } else if (indexCandidate && middleCandidate) {
                setLabel('separateFingers', false);
            } else {
                setLabel('tracking', false);
            }

            prevX = sx;
            prevY = sy;
        } else {
            if (isMovingPaint) updatePointerUpData(handPointer);
            isMovingPaint = false;
            isDroppingPaint = false;
            prevX = -1;
            prevY = -1;
            toolCursor.style.display = 'none';
            toolCursor.classList.remove('active', 'drop-mode', 'pinching');
            setLabel('showHand', false);
        }
    }

    function resetHandInteraction() {
        if (isMovingPaint) updatePointerUpData(handPointer);
        isMovingPaint = false;
        isDroppingPaint = false;
        prevX = -1;
        prevY = -1;
        toolCursor.style.display = 'none';
        toolCursor.classList.remove('active', 'drop-mode', 'pinching');
    }

    async function stopCamera(showStatus = true) {
        cameraSession++;
        camStarted = false;

        if (cameraInstance) {
            cameraInstance.stop();
            cameraInstance = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        video.pause();
        video.srcObject = null;

        if (handsInstance) {
            const oldHands = handsInstance;
            handsInstance = null;
            try {
                await oldHands.close();
            } catch (err) {
                console.warn('MediaPipe close warning:', err);
            }
        }

        resetHandInteraction();
        EbruI18n.bind(btn, 'camera');
        btn.style.opacity = '1';
        btn.style.borderColor = 'rgba(255,255,255,0.3)';
        btn.style.color = '#fff';
        if (showStatus) setLabel('cameraOff', false);
    }

    async function startCamera() {
        if (camStarted) return;
        const session = ++cameraSession;
        camStarted = true;
        EbruI18n.bind(btn, 'loading');
        btn.style.opacity = '0.6';
        setLabel('loadingTracking', false);

        try {
            // MediaPipe Hands
            const hands = new Hands({
                locateFile: (file) =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
            });
            handsInstance = hands;

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.75,
                minTrackingConfidence: 0.65,
            });

            hands.onResults(onHandResults);

            // Camera stream.
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            if (session !== cameraSession || !camStarted) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            mediaStream = stream;
            video.srcObject = stream;
            await video.play();

            // Send frames with the MediaPipe Camera utility.
            const camera = new Camera(video, {
                onFrame: async () => {
                    if (camStarted && session === cameraSession)
                        await hands.send({ image: video });
                },
                width: 640,
                height: 480,
            });
            cameraInstance = camera;
            camera.start();

            EbruI18n.bind(btn, 'cameraOn');
            btn.style.opacity = '1';
            btn.style.borderColor = 'rgba(165,248,211,0.6)';
            btn.style.color = '#e0b083';
            setLabel('showHand', false);

        } catch (err) {
            await stopCamera(false);
            const errorKeys = {
                NotAllowedError: 'cameraPermission', SecurityError: 'cameraPermission',
                NotFoundError: 'cameraMissing', NotReadableError: 'cameraBusy'
            };
            setLabel(errorKeys[err.name] || 'cameraError', false);
            console.error('Hand tracking error:', err);
        }
    }

    btn.addEventListener('click', async () => {
        if (camStarted)
            await stopCamera();
        else
            await startCamera();
    });

})();
