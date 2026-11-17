// Deterministic Xcode project; no CocoaPods, Capacitor, npm packages or XcodeGen.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const id = name => crypto.createHash('sha1').update('Ebrusim:' + name).digest('hex').slice(0, 24).toUpperCase();
const q = value => JSON.stringify(value);
const objects = [];
function object(name, value) { objects.push(`${id(name)} = { ${value} };`); return id(name); }
const appSources = ['AppDelegate.swift', 'GalleryStore.swift', 'StudioViewController.swift'];
const resources = ['Assets.xcassets', 'PrivacyInfo.xcprivacy', 'www'];
const ref = (file, type, group = 'Ebrusim') => object(group + '/' + file, `isa = PBXFileReference; lastKnownFileType = ${type}; path = ${q(file)}; sourceTree = "<group>";`);
appSources.forEach(file => ref(file, 'sourcecode.swift'));
ref('Info.plist', 'text.plist.xml');
ref('Assets.xcassets', 'folder.assetcatalog'); ref('PrivacyInfo.xcprivacy', 'text.xml'); ref('www', 'folder');
ref('GalleryStoreTests.swift', 'sourcecode.swift', 'EbrusimTests');
ref('StudioUITests.swift', 'sourcecode.swift', 'EbrusimUITests');
const product = (name, type) => object(name + '-product', `isa = PBXFileReference; explicitFileType = ${type}; includeInIndex = 0; path = ${q(name + (type === 'wrapper.application' ? '.app' : '.xctest'))}; sourceTree = BUILT_PRODUCTS_DIR;`);
product('Ebrusim', 'wrapper.application'); product('EbrusimTests', 'wrapper.cfbundle'); product('EbrusimUITests', 'wrapper.cfbundle');
for (const [group, files] of [['Ebrusim', [...appSources, 'Info.plist', ...resources]], ['EbrusimTests', ['GalleryStoreTests.swift']], ['EbrusimUITests', ['StudioUITests.swift']]])
    object(group + '-group', `isa = PBXGroup; children = (${files.map(file => id(group + '/' + file)).join(',')}); path = ${group}; sourceTree = "<group>";`);
object('products', `isa = PBXGroup; children = (${['Ebrusim', 'EbrusimTests', 'EbrusimUITests'].map(name => id(name + '-product')).join(',')}); name = Products; sourceTree = "<group>";`);
object('main-group', `isa = PBXGroup; children = (${['Ebrusim-group','EbrusimTests-group','EbrusimUITests-group','products'].map(id).join(',')}); sourceTree = "<group>";`);
function build(name, refName) { return object(name, `isa = PBXBuildFile; fileRef = ${id(refName)};`); }
const sourceFiles = appSources.map(file => build(file + '-build', 'Ebrusim/' + file));
const resourceFiles = resources.map(file => build(file + '-build', 'Ebrusim/' + file));
function phase(name, type, files = []) { return object(name, `isa = ${type}; buildActionMask = 2147483647; files = (${files.join(',')}); runOnlyForDeploymentPostprocessing = 0;`); }
phase('app-sources', 'PBXSourcesBuildPhase', sourceFiles); phase('app-resources', 'PBXResourcesBuildPhase', resourceFiles); phase('app-frameworks', 'PBXFrameworksBuildPhase');
const script = 'set -eu\ncd "$SRCROOT/.."\nif command -v node >/dev/null 2>&1; then\n  node scripts/build-android.cjs ios\nelif [ ! -f ios/Ebrusim/www/index.html ]; then\n  echo "error: Node.js 18+ is required to prepare Ebrusim assets. Install Node.js, then run npm run build:ios."\n  exit 1\nfi\n';
object('prepare-assets', `isa = PBXShellScriptBuildPhase; alwaysOutOfDate = 1; buildActionMask = 2147483647; files = (); inputPaths = (); outputPaths = (); name = "Prepare offline assets"; runOnlyForDeploymentPostprocessing = 0; shellPath = /bin/sh; shellScript = ${q(script)};`);
for(const name of ['EbrusimTests','EbrusimUITests']) {
    const file = name === 'EbrusimTests' ? 'GalleryStoreTests.swift' : 'StudioUITests.swift';
    phase(name + '-sources', 'PBXSourcesBuildPhase', [build(name + '-build', name + '/' + file)]);
    phase(name + '-frameworks', 'PBXFrameworksBuildPhase'); phase(name + '-resources', 'PBXResourcesBuildPhase');
    object(name + '-proxy', `isa = PBXContainerItemProxy; containerPortal = ${id('project')}; proxyType = 1; remoteGlobalIDString = ${id('app')}; remoteInfo = Ebrusim;`);
    object(name + '-dependency', `isa = PBXTargetDependency; target = ${id('app')}; targetProxy = ${id(name + '-proxy')};`);
}
function configList(name, settings) {
    for(const mode of ['Debug','Release']) {
        const extra = mode === 'Debug' ? 'SWIFT_OPTIMIZATION_LEVEL = "-Onone"; ENABLE_TESTABILITY = YES; DEBUG_INFORMATION_FORMAT = dwarf; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;' : 'SWIFT_COMPILATION_MODE = wholemodule; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";';
        object(name + '-' + mode, `isa = XCBuildConfiguration; buildSettings = { ${settings} ${extra} }; name = ${mode};`);
    }
    object(name + '-configs', `isa = XCConfigurationList; buildConfigurations = (${id(name+'-Debug')},${id(name+'-Release')}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;`);
}
const common = 'CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0; IPHONEOS_DEPLOYMENT_TARGET = 16.0; SDKROOT = iphoneos; TARGETED_DEVICE_FAMILY = "1,2"; CODE_SIGN_STYLE = Automatic; ENABLE_USER_SCRIPT_SANDBOXING = NO;';
configList('project', common + ' CLANG_ENABLE_OBJC_ARC = YES;');
configList('app', common + ' PRODUCT_NAME = Ebrusim; PRODUCT_BUNDLE_IDENTIFIER = art.ebrusim.app; INFOPLIST_FILE = Ebrusim/Info.plist; MARKETING_VERSION = 1.0.0; CURRENT_PROJECT_VERSION = 1; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)","@executable_path/Frameworks");');
configList('EbrusimTests', common + ' PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = art.ebrusim.app.tests; GENERATE_INFOPLIST_FILE = YES; TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Ebrusim.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Ebrusim"; BUNDLE_LOADER = "$(TEST_HOST)";');
configList('EbrusimUITests', common + ' PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = art.ebrusim.app.uitests; GENERATE_INFOPLIST_FILE = YES; TEST_TARGET_NAME = Ebrusim;');
object('app', `isa = PBXNativeTarget; buildConfigurationList = ${id('app-configs')}; buildPhases = (${['prepare-assets','app-sources','app-frameworks','app-resources'].map(id).join(',')}); buildRules = (); dependencies = (); name = Ebrusim; productName = Ebrusim; productReference = ${id('Ebrusim-product')}; productType = "com.apple.product-type.application";`);
for(const name of ['EbrusimTests','EbrusimUITests'])
    object(name, `isa = PBXNativeTarget; buildConfigurationList = ${id(name+'-configs')}; buildPhases = (${['sources','frameworks','resources'].map(x=>id(name+'-'+x)).join(',')}); buildRules = (); dependencies = (${id(name+'-dependency')}); name = ${name}; productName = ${name}; productReference = ${id(name+'-product')}; productType = "com.apple.product-type.bundle.${name==='EbrusimTests'?'unit-test':'ui-testing'}";`);
object('project', `isa = PBXProject; attributes = { BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; TargetAttributes = { ${id('app')} = { CreatedOnToolsVersion = 26.0; }; ${id('EbrusimTests')} = { CreatedOnToolsVersion = 26.0; TestTargetID = ${id('app')}; }; ${id('EbrusimUITests')} = { CreatedOnToolsVersion = 26.0; TestTargetID = ${id('app')}; }; }; }; buildConfigurationList = ${id('project-configs')}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,tr,Base); mainGroup = ${id('main-group')}; productRefGroup = ${id('products')}; projectDirPath = ""; projectRoot = ""; targets = (${['app','EbrusimTests','EbrusimUITests'].map(id).join(',')});`);
const base = path.resolve(__dirname, '../ios/Ebrusim.xcodeproj');
fs.mkdirSync(path.join(base,'xcshareddata/xcschemes'), {recursive:true});
fs.writeFileSync(path.join(base,'project.pbxproj'), '// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+objects.join('\n')+'\n}; rootObject = '+id('project')+'; }\n');
const entry = name => `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id(name==='Ebrusim'?'app':name)}" BuildableName="${name}.${name==='Ebrusim'?'app':'xctest'}" BlueprintName="${name}" ReferencedContainer="container:Ebrusim.xcodeproj"/>`;
fs.writeFileSync(path.join(base,'xcshareddata/xcschemes/Ebrusim.xcscheme'), `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${entry('Ebrusim')}</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables>${['EbrusimTests','EbrusimUITests'].map(n=>'<TestableReference skipped="NO">'+entry(n)+'</TestableReference>').join('')}</Testables></TestAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${entry('Ebrusim')}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${entry('Ebrusim')}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>`);
console.log('Generated Ebrusim.xcodeproj');
