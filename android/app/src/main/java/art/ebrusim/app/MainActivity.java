package art.ebrusim.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Offline Android host. Only bundled assets can execute code or call the bridge. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int SAVE_FILE = 41;
    private static final int MAX_BYTES = 24 * 1024 * 1024;
    private WebView web;
    private FrameLayout root;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String pendingId;
    private File pendingFile;
    private boolean ready;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(21, 21, 21));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        createStudio();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::handleBack);
        io.execute(this::cleanExports);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createStudio() {
        ready = false;
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(), "EbruAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri)) return blocked();
                String path = uri.getPath().substring("/assets/".length());
                try {
                    String ext = MimeTypeMap.getFileExtensionFromUrl(path);
                    String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                    if (path.endsWith(".js")) mime = "text/javascript";
                    if (mime == null) mime = "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open(path));
                } catch (IOException error) { return blocked(); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                ready = START.equals(url);
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                ready = false; root.removeView(view); view.destroy();
                new AlertDialog.Builder(MainActivity.this).setMessage(R.string.renderer_message)
                    .setCancelable(false).setPositiveButton(R.string.reload, (d, which) -> createStudio()).show();
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(START);
    }
    private boolean isLocal(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443)
            && path != null && path.startsWith("/assets/www/") && !path.contains("..") && !path.contains("\\");
    }
    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private final class Bridge {
        @JavascriptInterface public void postMessage(String raw) {
            if (raw == null || raw.length() > MAX_BYTES * 4 / 3 + 2048) return;
            io.execute(() -> {
                String id = "";
                try {
                    JSONObject message = new JSONObject(raw);
                    id = message.getString("id");
                    if (!id.matches("[0-9]{1,12}")) return;
                    String action = message.getString("action");
                    if (!action.equals("shareFile") && !action.equals("saveFile")) throw new IOException("Unsupported operation");
                    String mime = message.getString("mime");
                    String extension = mime.equals("image/png") ? "png" : mime.equals("video/mp4") ? "mp4" : mime.equals("video/webm") ? "webm" : null;
                    if (extension == null) throw new IOException("Unsupported file type");
                    String data = message.getString("data");
                    int comma = data.indexOf(',');
                    if (comma < 0 || !data.substring(0, comma).contains(";base64")) throw new IOException("Invalid file data");
                    byte[] bytes = Base64.decode(data.substring(comma + 1), Base64.DEFAULT);
                    if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("File is too large");
                    File directory = new File(getCacheDir(), "exports");
                    if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Storage unavailable");
                    File file = new File(directory, "ebrusim-" + UUID.randomUUID() + "." + extension);
                    try (FileOutputStream stream = new FileOutputStream(file)) { stream.write(bytes); }
                    String requestId = id;
                    runOnUiThread(() -> {
                        try {
                            if (action.equals("shareFile")) share(requestId, file, mime);
                            else save(requestId, file, mime);
                        } catch (Exception error) { reply(requestId, null, "Could not open Android file action"); }
                    });
                } catch (Exception error) { reply(id, null, "Could not prepare file. Check free storage."); }
            });
        }
    }
    private void share(String id, File file, String mime) {
        Uri uri = Uri.parse("content://" + getPackageName() + ".artworks/" + file.getName());
        Intent intent = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri);
        intent.setClipData(ClipData.newRawUri("Ebrusim", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(intent, getString(R.string.share_title)));
        reply(id, new JSONObject(), null);
    }
    private void save(String id, File file, String mime) {
        if (pendingId != null) { reply(id, null, "Another export is already open"); return; }
        pendingId = id; pendingFile = file;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
            .putExtra(Intent.EXTRA_TITLE, file.getName());
        try { startActivityForResult(intent, SAVE_FILE); }
        catch (Exception error) { pendingId = null; pendingFile = null; reply(id, null, "Android file picker unavailable"); }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode != SAVE_FILE || pendingId == null) return;
        String id = pendingId; File source = pendingFile;
        pendingId = null; pendingFile = null;
        if (resultCode != RESULT_OK || result == null || result.getData() == null) {
            JSONObject cancelled = new JSONObject();
            try { cancelled.put("cancelled", true); } catch (Exception ignored) { }
            reply(id, cancelled, null); return;
        }
        Uri target = result.getData();
        io.execute(() -> {
            try (FileInputStream input = new FileInputStream(source); OutputStream output = getContentResolver().openOutputStream(target, "w")) {
                if (output == null) throw new IOException("Destination unavailable");
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                reply(id, new JSONObject(), null);
            } catch (Exception error) { reply(id, null, "Could not save file. Check available storage."); }
        });
    }
    private void reply(String id, JSONObject result, String error) {
        try {
            JSONObject message = new JSONObject().put("id", id);
            if (error != null) message.put("error", error); else message.put("result", result);
            String script = "window.EbruNative && window.EbruNative.receive(" + message + ")";
            runOnUiThread(() -> { if (!isDestroyed() && web != null) web.evaluateJavascript(script, null); });
        } catch (Exception ignored) { }
    }
    private void cleanExports() {
        File[] files = new File(getCacheDir(), "exports").listFiles();
        if (files == null) return;
        for (File file : files) if (System.currentTimeMillis() - file.lastModified() > 24 * 60 * 60 * 1000L) file.delete();
    }
    private void handleBack() {
        if (!ready) { moveTaskToBack(true); return; }
        web.evaluateJavascript("Boolean(window.EbruNative && window.EbruNative.closeOverlay && window.EbruNative.closeOverlay())", consumed -> {
            if ("true".equals(consumed)) return;
            new AlertDialog.Builder(this).setTitle(R.string.leave_title).setMessage(R.string.leave_message)
                .setNegativeButton(R.string.stay, null).setPositiveButton(R.string.leave, (d, which) -> moveTaskToBack(true)).show();
        });
    }
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onPause() {
        if (web != null) { web.evaluateJavascript("window.dispatchEvent(new CustomEvent('ebru-app-active',{detail:false}))", null); web.onPause(); }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new CustomEvent('ebru-app-active',{detail:true}))", null); }
    }
    @Override protected void onDestroy() {
        ready = false;
        if (web != null) { root.removeView(web); web.removeJavascriptInterface("EbruAndroid"); web.destroy(); web = null; }
        io.shutdown(); super.onDestroy();
    }
}
