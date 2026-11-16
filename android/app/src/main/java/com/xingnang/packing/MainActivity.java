package com.xingnang.packing;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.Configuration;
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

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String APP_URL = "file:///android_asset/index.html";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String LIGHT_BACKGROUND = "#F6F2EB";
    private static final String DARK_BACKGROUND = "#100F0D";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean darkSystemBars;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        boolean systemDark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
        applySystemBars(systemDark);

        WebView.setWebContentsDebuggingEnabled(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor(systemDark ? DARK_BACKGROUND : LIGHT_BACKGROUND));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setTextZoom(100);

        WebView.setWebContentsDebuggingEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new FileChooserClient());
        webView.addJavascriptInterface(new BackupBridge(this), "AndroidBridge");
        setContentView(webView);
        webView.loadUrl(APP_URL);
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
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            applySystemBars(darkSystemBars);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public static final class BackupBridge {
        private final MainActivity activity;

        BackupBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public String saveBackup(String fileName, String content) {
            return activity.saveBackupToDownloads(fileName, content);
        }

        @JavascriptInterface
        public void updateWidgetData(String json) {
            activity.runOnUiThread(() -> WidgetDataStore.save(activity, json));
        }

        @JavascriptInterface
        public void setTheme(String theme) {
            activity.runOnUiThread(() -> activity.applySystemBars("dark".equals(theme)));
        }

        @JavascriptInterface
        public void openSecondQuestion() {
            activity.runOnUiThread(() -> activity.startActivity(
                new Intent(activity, SecondQuestionActivity.class)
            ));
        }
    }

    private void applySystemBars(boolean dark) {
        darkSystemBars = dark;
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

    private String saveBackupToDownloads(String fileName, String content) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return "";
        }
        String safeName = sanitizeBackupName(fileName);
        String safeContent = content == null ? "" : content;
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = null;
        try {
            uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                return "";
            }
            try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                if (stream == null) {
                    getContentResolver().delete(uri, null, null);
                    return "";
                }
                stream.write(safeContent.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            }
            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContentResolver().update(uri, published, null, null);
            return "下载/" + safeName;
        } catch (Exception error) {
            if (uri != null) {
                try {
                    getContentResolver().delete(uri, null, null);
                } catch (Exception ignored) {
                    // Ignore cleanup errors.
                }
            }
            runOnUiThread(() -> Toast.makeText(
                this,
                "备份保存失败，请检查存储空间",
                Toast.LENGTH_LONG
            ).show());
            return "";
        }
    }

    private String sanitizeBackupName(String fileName) {
        String safe = fileName == null ? "" : fileName.trim();
        safe = safe.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (safe.isEmpty()) {
            safe = "行囊备份.json";
        }
        if (!safe.toLowerCase(Locale.ROOT).endsWith(".json")) {
            safe = safe + ".json";
        }
        if (safe.length() > 80) {
            safe = safe.substring(safe.length() - 80);
        }
        return safe;
    }
}
