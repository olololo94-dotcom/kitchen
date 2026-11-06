package lu.kitchenledger;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Daily "use soon" reminder. The web app sends its settings and item expiry dates via setConfig(). */
public class Reminders extends BroadcastReceiver {
    static final String PREFS = "reminders";
    static final String CHANNEL = "expiry";
    static final int NOTIF_ID = 1001;

    static void setConfig(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("config", json).apply();
        schedule(ctx);
    }

    static JSONObject config(Context ctx) {
        try { return new JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("config", "{}")); }
        catch (Exception e) { return new JSONObject(); }
    }

    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, Reminders.class).setAction("lu.kitchenledger.REMIND");
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        JSONObject c = config(ctx);
        if (!c.optBoolean("enabled", false)) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, c.optInt("hour", 18));
        cal.set(Calendar.MINUTE, c.optInt("minute", 0));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis() + 30_000) cal.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { schedule(ctx); return; }
        notifyNow(ctx, false);
    }

    /** Posts the reminder. With force=true a test message is shown even when nothing expires. */
    static void notifyNow(Context ctx, boolean force) {
        JSONObject c = config(ctx);
        if (!force && !c.optBoolean("enabled", false)) return;
        int warn = c.optInt("warnDays", 3);
        JSONArray items = c.optJSONArray("items");
        List<String> expired = new ArrayList<>(), soon = new ArrayList<>();
        Calendar today = Calendar.getInstance();
        today.set(Calendar.HOUR_OF_DAY, 0); today.set(Calendar.MINUTE, 0); today.set(Calendar.SECOND, 0); today.set(Calendar.MILLISECOND, 0);
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                try {
                    Date d = f.parse(it.optString("e"));
                    if (d == null) continue;
                    long days = Math.round((d.getTime() - today.getTimeInMillis()) / 86_400_000.0);
                    String n = it.optString("n");
                    if (days < 0) expired.add(n);
                    else if (days == 0) soon.add(n + " (today)");
                    else if (days == 1) soon.add(n + " (tomorrow)");
                    else if (days <= warn) soon.add(n + " (" + days + " days)");
                } catch (Exception ignored) { }
            }
        }
        String title, text;
        if (soon.isEmpty() && expired.isEmpty()) {
            if (!force) return;
            title = "Kitchen Ledger";
            text = "Reminders are on. Nothing expires in the next " + warn + " days.";
        } else {
            title = soon.isEmpty() ? expired.size() + " expired item" + (expired.size() == 1 ? "" : "s")
                    : soon.size() + " item" + (soon.size() == 1 ? "" : "s") + " to use soon";
            StringBuilder sb = new StringBuilder();
            if (!soon.isEmpty()) sb.append(String.join(", ", soon));
            if (!expired.isEmpty()) { if (sb.length() > 0) sb.append(". "); sb.append("Expired: ").append(String.join(", ", expired)); }
            text = sb.toString();
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Expiry reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Daily reminder about food that expires soon");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("open", "soon");
        PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try { NotificationManagerCompat.from(ctx).notify(NOTIF_ID, b.build()); } catch (SecurityException ignored) { }
    }
}
