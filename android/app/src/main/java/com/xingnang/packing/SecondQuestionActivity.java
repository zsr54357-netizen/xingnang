package com.xingnang.packing;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * The fourth 行囊 module: the self-contained 第二问 app.
 *
 * It is kept in its own Activity and WebView so its encrypted IndexedDB vault,
 * API key and single-conversation state stay isolated from 行囊's data.
 */
public class SecondQuestionActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 2001;
    private static final String LIGHT_BACKGROUND = "#F3EFE6";
    private static final String DARK_BACKGROUND = "#171614";

    private WebView webView;
    private LocalServer server;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            server = new LocalServer(getAssets());
            server.start();
        } catch (IOException error) {
            Toast.makeText(this, "第二问本地服务启动失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        boolean systemDark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        applySystemBars(systemDark);

        WebView.setWebContentsDebuggingEnabled(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor(systemDark ? DARK_BACKGROUND : LIGHT_BACKGROUND));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 21) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new FileChooserClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(webView);
        webView.loadUrl("http://127.0.0.1:" + server.getPort() + "/");
    }

    private final class FileChooserClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
            WebView view,
            ValueCallback<Uri[]> callback,
            FileChooserParams params
        ) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;
            try {
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            } catch (Exception error) {
                filePathCallback = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    result = new Uri[clipData.getItemCount()];
                    for (int index = 0; index < clipData.getItemCount(); index += 1) {
                        result[index] = clipData.getItemAt(index).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[] { data.getData() };
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean systemDark = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
        applySystemBars(systemDark);
        if (webView != null) {
            webView.setBackgroundColor(Color.parseColor(systemDark ? DARK_BACKGROUND : LIGHT_BACKGROUND));
        }
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop();
            server = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void applySystemBars(boolean dark) {
        Window window = getWindow();
        int color = Color.parseColor(dark ? DARK_BACKGROUND : LIGHT_BACKGROUND);
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
        window.setNavigationBarDividerColor(color);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        int flags = window.getDecorView().getSystemUiVisibility();
        int lightFlags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        flags = dark ? (flags & ~lightFlags) : (flags | lightFlags);
        window.getDecorView().setSystemUiVisibility(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : appearance, appearance);
            }
        }
    }

    /** Export/import bridge used by 第二问's settings and weekly export. */
    private final class Bridge {
        @JavascriptInterface
        public String saveText(String filename, String text) {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                String mime = filename.endsWith(".json") ? "application/json" : "text/markdown";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IOException("insert failed");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IOException("open failed");
                        out.write(bytes);
                    }
                } else {
                    File directory = downloadDir();
                    try (FileOutputStream out = new FileOutputStream(new File(directory, filename))) {
                        out.write(bytes);
                    }
                }
                return filename;
            } catch (Exception error) {
                toast("保存失败：" + error.getMessage());
                return null;
            }
        }

        @JavascriptInterface
        public String readText(String filename) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    String[] projection = { MediaStore.MediaColumns._ID };
                    String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=?";
                    try (Cursor cursor = getContentResolver().query(
                        collection,
                        projection,
                        selection,
                        new String[] { filename },
                        null
                    )) {
                        if (cursor != null && cursor.moveToFirst()) {
                            Uri uri = ContentUris.withAppendedId(collection, cursor.getLong(0));
                            try (InputStream in = getContentResolver().openInputStream(uri)) {
                                return in == null ? null : readAll(in);
                            }
                        }
                    }
                    return null;
                }
                File file = new File(downloadDir(), filename);
                if (!file.exists()) return null;
                try (InputStream in = new FileInputStream(file)) {
                    return readAll(in);
                }
            } catch (Exception error) {
                return null;
            }
        }

        private String readAll(InputStream input) throws IOException {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) > 0) {
                out.write(buffer, 0, read);
            }
            return out.toString("UTF-8");
        }

        private void toast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(SecondQuestionActivity.this, message, Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    private File downloadDir() {
        File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return directory != null ? directory : getFilesDir();
    }
}
