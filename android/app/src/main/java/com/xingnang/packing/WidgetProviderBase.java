package com.xingnang.packing;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

public abstract class WidgetProviderBase extends AppWidgetProvider {
    public static final String ACTION_NEXT = "com.xingnang.packing.action.WIDGET_NEXT";
    private static final int PAGE_COUNT = 4;
    private static final String[] DOTS = {
        "● ○ ○ ○",
        "○ ● ○ ○",
        "○ ○ ● ○",
        "○ ○ ○ ●"
    };

    protected abstract int getLayoutRes();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        if (appWidgetIds == null) {
            return;
        }
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, manager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_NEXT.equals(intent.getAction())) {
            int appWidgetId = intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            );
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                int nextPage = (WidgetDataStore.getPage(context, appWidgetId) + 1) % PAGE_COUNT;
                WidgetDataStore.setPage(context, appWidgetId, nextPage);
                AppWidgetManager manager = AppWidgetManager.getInstance(context);
                if (manager.getAppWidgetInfo(appWidgetId) != null) {
                    updateWidget(context, manager, appWidgetId);
                }
                return;
            }
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        if (appWidgetIds != null) {
            for (int appWidgetId : appWidgetIds) {
                WidgetDataStore.clearPage(context, appWidgetId);
            }
        }
        super.onDeleted(context, appWidgetIds);
    }

    private void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        int page = WidgetDataStore.getPage(context, appWidgetId) % PAGE_COUNT;
        JSONObject data = loadData(context);
        PageContent content = buildContent(data, page);

        RemoteViews views = new RemoteViews(context.getPackageName(), getLayoutRes());
        views.setTextViewText(R.id.widgetLabel, content.label);
        views.setTextViewText(R.id.widgetValue, content.value);
        views.setTextViewText(R.id.widgetSub, content.sub);
        views.setTextViewText(R.id.widgetDots, DOTS[page]);

        Intent next = new Intent(context, getClass());
        next.setAction(ACTION_NEXT);
        next.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            next,
            flags
        );
        views.setOnClickPendingIntent(R.id.widgetRoot, pendingIntent);
        manager.updateAppWidget(appWidgetId, views);
    }

    private JSONObject loadData(Context context) {
        try {
            return new JSONObject(WidgetDataStore.load(context));
        } catch (JSONException error) {
            return new JSONObject();
        }
    }

    private PageContent buildContent(JSONObject data, int page) {
        boolean tripActive = data.optBoolean("tripActive", false);
        int tripDays = data.optInt("tripDays", 0);
        String tripRange = data.optString("tripRange", "");
        double totalCny = data.optDouble("totalCny", 0);
        double allowanceCny = data.optDouble("allowanceCny", 0);
        double expenseCny = data.optDouble("expenseCny", 0);
        int packTotal = data.optInt("packTotal", 0);
        int packDone = data.optInt("packDone", 0);
        int packRemaining = data.optInt("packRemaining", 0);
        int packPercent = data.optInt("packPercent", 0);
        int todoTotal = data.optInt("todoTotal", 0);
        int todoDone = data.optInt("todoDone", 0);
        int todoRemaining = data.optInt("todoRemaining", 0);
        int todoListCount = data.optInt("todoListCount", 0);

        switch (page) {
            case 0:
                return new PageContent(
                    "出差总天数",
                    tripDays + " 天",
                    tripActive
                        ? (tripRange.isEmpty() ? "本次出差进行中" : tripRange)
                        : "还没有进行中的出差"
                );
            case 1:
                return new PageContent(
                    "应报销总额",
                    money(totalCny),
                    tripActive
                        ? "补贴 " + money(allowanceCny) + " · 支出 " + money(expenseCny)
                        : "去行囊开始一趟出差"
                );
            case 2:
                if (packTotal <= 0) {
                    return new PageContent("打包清单", "还没有物品", "去行囊建一个包裹");
                }
                return new PageContent(
                    "打包清单",
                    packRemaining > 0 ? "还差 " + packRemaining + " 件" : "全部带齐",
                    "已带 " + packDone + " / " + packTotal + " 件 · " + packPercent + "%"
                );
            case 3:
            default:
                if (todoTotal <= 0) {
                    return new PageContent("待办清单", "还没有待办", "去行囊新建一份清单");
                }
                return new PageContent(
                    "待办清单",
                    todoRemaining > 0 ? "还剩 " + todoRemaining + " 项" : "全部完成",
                    "共 " + todoListCount + " 份清单 · 已完成 " + todoDone + " 项"
                );
        }
    }

    private String money(double value) {
        return String.format(Locale.CHINA, "¥ %,.2f", value);
    }

    private static final class PageContent {
        final String label;
        final String value;
        final String sub;

        PageContent(String label, String value, String sub) {
            this.label = label;
            this.value = value;
            this.sub = sub;
        }
    }
}
