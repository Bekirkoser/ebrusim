const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['scripts/build-android.cjs', 'ios']);
const root = 'ios/Ebrusim/www';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.doesNotMatch(html, /usage-analytics\.js|visitor-counter\.js/);
assert.match(html, /connect-src 'none'/);
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const file = match[1].split('?')[0];
    if (file.startsWith('http')) continue;
    assert.ok(fs.existsSync(path.join(root, file)), 'Missing iOS asset: ' + file);
}
const project = fs.readFileSync('ios/Ebrusim.xcodeproj/project.pbxproj', 'utf8');
assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 16.0/);
assert.match(project, /art\.ebrusim\.app/);
assert.match(project, /GalleryStoreTests\.swift/);
const info = fs.readFileSync('ios/Ebrusim/Info.plist', 'utf8');
assert.doesNotMatch(info, /NSCameraUsageDescription|NSMicrophoneUsageDescription|NSAllowsArbitraryLoads/);
console.log('PASS: complete offline iOS bundle, no trackers or camera permissions, checked-in Xcode project.');
