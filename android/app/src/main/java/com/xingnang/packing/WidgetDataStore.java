package com.xingnang.packing;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public final class WidgetDataStore {
    private static final String PREFS = "xingnang_widget_v1";
    private static final String SUMMARY_KEY = "summary";
    private static final String PAGE_PREFIX = "page_";
    private static final Class<?>[] PROVIDERS = {
        Widget4SoftProvider.class,
        Widget4FrostProvider.class,
        Widget5SoftProvider.class,
        Widget5FrostProvider.class
    };

    private WidgetDataStore() {
    }

    public static void save(Context context, String json) {
        Context app = context.getApplicationContext();
        String payload = json == null || json.trim().isEmpty() ? "{}" : json;
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(SUMMARY_KEY, payload)
            .commit();
        updateAll(app);
    }

    public static String load(Context context) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.getString(SUMMARY_KEY, "{}");
    }

    public static int getPage(Context context, int appWidgetId) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int page = prefs.getInt(PAGE_PREFIX + appWidgetId, 0);
        return page < 0 ? 0 : page;
    }

    public static void setPage(Context context, int appWidgetId, int page) {
        context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(PAGE_PREFIX + appWidgetId, page)
            .commit();
    }

    public static void clearPage(Context context, int appWidgetId) {
        context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(PAGE_PREFIX + appWidgetId)
            .commit();
    }

    public static void updateAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        for (Class<?> provider : PROVIDERS) {
            ComponentName component = new ComponentName(app, provider);
            int[] ids = manager.getAppWidgetIds(component);
            if (ids == null || ids.length == 0) {
                continue;
            }
            Intent update = new Intent(app, provider);
            update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            update.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            app.sendBroadcast(update);
        }
    }
}
