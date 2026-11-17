const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['scripts/build-android.cjs']);
const root = 'android/app/src/main/assets/www';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.doesNotMatch(html, /usage-analytics\.js|visitor-counter\.js|https:\/\/cdn/);
assert.match(html, /connect-src 'none'/);
assert.match(html, /native-bridge\.js/);
assert.match(html, /android-ui\/landscape\.css/);
assert.match(html, /android-ui\/landscape\.js/);
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const file = match[1].split('?')[0];
    if (file.startsWith('http')) continue;
    assert.ok(fs.existsSync(path.join(root, file)), 'Bundled asset missing: ' + file);
}
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert.doesNotMatch(manifest, /<uses-permission/);
assert.match(manifest, /android:screenOrientation="sensorLandscape"/);
assert.match(manifest, /android:exported="false" android:grantUriPermissions="true"/);
const before = fs.readFileSync(path.join(root, 'script.js'));
execFileSync(process.execPath, ['scripts/build-android.cjs']);
assert.deepEqual(fs.readFileSync(path.join(root, 'script.js')), before, 'Build must be deterministic');
console.log('PASS: deterministic offline package, complete local assets, no trackers, no runtime permissions.');
