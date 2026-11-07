package app.vercel.kebs_mobile_app.twa;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Local notifications for KEBS: one channel per category (so people can mute a category in Android settings),
 * grouped under the app like a stack, tapping opens the screen the notification is about.
 * Scheduled reminders use AlarmManager and fire even when the app is closed.
 */
public final class Notifier {
    static final String GROUP = "kebs.group";
    private static final int SUMMARY_ID = 1;
    private static final String PREFS = "kebs.notify";

    private static final String[][] CHANNELS = {
        {"approvals", "Approvals", "Requests waiting on you and decisions on yours"},
        {"expenses", "Expenses", "Receipts read, claims submitted, paid and rejected"},
        {"chat", "Chat & mentions", "Replies and @mentions in project and deal chats"},
        {"tasks", "Tasks & projects", "Tasks assigned to you and due dates"},
        {"crm", "Sales & CRM", "Meetings, follow-ups and deal updates"},
        {"reminders", "Reminders", "Clock in, timesheets and other nudges"},
        {"general", "General", "Announcements and everything else"},
    };

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        for (String[] c : CHANNELS) {
            int importance = "general".equals(c[0]) ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel ch = new NotificationChannel(c[0], c[1], importance);
            ch.setDescription(c[2]);
            ch.enableLights(true);
            ch.setLightColor(Color.parseColor("#F56D43"));
            nm.createNotificationChannel(ch);
        }
    }

    private static String channel(String c) {
        for (String[] x : CHANNELS) if (x[0].equals(c)) return c;
        return "general";
    }

    static PendingIntent openIntent(Context ctx, int id, String route) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction("kebs.open." + id)
            .putExtra("route", route == null ? "" : route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void show(Context ctx, int id, String cat, String title, String body, String route) {
        ensureChannels(ctx);
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        String ch = channel(cat);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ch)
            .setSmallIcon(R.drawable.ic_stat_kebs)
            .setLargeIcon(BitmapFactory.decodeResource(ctx.getResources(), R.mipmap.ic_launcher))
            .setColor(Color.parseColor("#F56D43"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setGroup(GROUP)
            .setCategory("chat".equals(ch) ? NotificationCompat.CATEGORY_MESSAGE : "reminders".equals(ch) || "crm".equals(ch) ? NotificationCompat.CATEGORY_REMINDER : NotificationCompat.CATEGORY_STATUS)
            .setPriority("general".equals(ch) ? NotificationCompat.PRIORITY_DEFAULT : NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openIntent(ctx, id, route));
        try {
            nm.notify(id, b.build());
            // the stack header ("KEBS · 3 more notifications")
            NotificationCompat.Builder sum = new NotificationCompat.Builder(ctx, ch)
                .setSmallIcon(R.drawable.ic_stat_kebs)
                .setColor(Color.parseColor("#F56D43"))
                .setStyle(new NotificationCompat.InboxStyle().setSummaryText("KEBS"))
                .setGroup(GROUP).setGroupSummary(true).setAutoCancel(true)
                .setContentIntent(openIntent(ctx, SUMMARY_ID, "#/notifs"));
            nm.notify(SUMMARY_ID, sum.build());
        } catch (SecurityException ignored) { /* permission was revoked */ }
    }

    // ── scheduled reminders ──
    private static PendingIntent alarmIntent(Context ctx, int id, String cat, String title, String body, String route) {
        Intent i = new Intent(ctx, NotifyReceiver.class)
            .setAction("kebs.remind." + id)
            .putExtra("id", id).putExtra("cat", cat).putExtra("title", title).putExtra("body", body).putExtra("route", route);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Replaces every scheduled reminder with this list: [{id, cat, title, body, route, at}] (at = epoch ms). */
    static void syncSchedule(Context ctx, String json) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString("scheduled", "[]"));
            for (int k = 0; k < old.length(); k++) am.cancel(alarmIntent(ctx, old.getInt(k), "", "", "", ""));
        } catch (Exception ignored) {}
        JSONArray ids = new JSONArray();
        try {
            JSONArray list = new JSONArray(json);
            long now = System.currentTimeMillis();
            for (int k = 0; k < list.length(); k++) {
                JSONObject r = list.getJSONObject(k);
                long at = r.getLong("at");
                if (at <= now) continue;
                int id = r.getInt("id");
                PendingIntent pi = alarmIntent(ctx, id, r.optString("cat"), r.optString("title"), r.optString("body"), r.optString("route"));
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                ids.put(id);
            }
        } catch (Exception ignored) {}
        p.edit().putString("scheduled", ids.toString()).apply();
    }
}
