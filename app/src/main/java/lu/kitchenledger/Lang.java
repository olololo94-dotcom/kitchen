package lu.kitchenledger;

import android.content.Context;

import java.util.HashMap;
import java.util.Map;

/** Texts shown by the Android side (notifications, scanner, system messages) in the app's language. */
final class Lang {
    private Lang() { }

    private static final Map<String, String[]> T = new HashMap<>();
    // key -> { English, Deutsch, Français }
    static {
        T.put("scan_prompt", new String[]{"Point the camera at a barcode", "Halte die Kamera auf einen Barcode", "Visez un code-barres avec l'appareil photo"});
        T.put("camera_needed", new String[]{"Camera permission is needed to take photos. You can allow it in Settings > Apps > Kitchen Ledger.",
                "Für Fotos braucht die App Zugriff auf die Kamera. Du kannst ihn unter Einstellungen > Apps > Kitchen Ledger erlauben.",
                "L'accès à l'appareil photo est nécessaire. Vous pouvez l'autoriser dans Paramètres > Applications > Kitchen Ledger."});
        T.put("file_failed", new String[]{"Couldn't open that file.", "Die Datei konnte nicht geöffnet werden.", "Impossible d'ouvrir ce fichier."});
        T.put("camera_failed", new String[]{"Couldn't open the camera.", "Die Kamera konnte nicht geöffnet werden.", "Impossible d'ouvrir l'appareil photo."});
        T.put("picture_failed", new String[]{"Couldn't use that picture.", "Dieses Bild konnte nicht verwendet werden.", "Impossible d'utiliser cette image."});
        T.put("export_failed", new String[]{"Couldn't export the file.", "Die Datei konnte nicht exportiert werden.", "Impossible d'exporter le fichier."});
        T.put("saved_downloads", new String[]{"Saved to Downloads: ", "In Downloads gespeichert: ", "Enregistré dans Téléchargements : "});
        T.put("save_or_send", new String[]{"Save or send ", "Speichern oder senden: ", "Enregistrer ou envoyer "});
        T.put("receipt_failed", new String[]{"Couldn't read the receipt.", "Der Kassenzettel konnte nicht gelesen werden.", "Impossible de lire le ticket."});
        T.put("receipt_light", new String[]{"Couldn't read the receipt. Try again in better light.", "Der Kassenzettel konnte nicht gelesen werden. Versuch es bei besserem Licht.", "Impossible de lire le ticket. Réessayez avec une meilleure lumière."});
        T.put("picture_open_failed", new String[]{"Couldn't open that picture.", "Dieses Bild konnte nicht geöffnet werden.", "Impossible d'ouvrir cette image."});
        T.put("channel_name", new String[]{"Expiry reminders", "Ablauf-Erinnerungen", "Rappels de péremption"});
        T.put("channel_desc", new String[]{"Daily reminder about food that expires soon", "Tägliche Erinnerung an Lebensmittel, die bald ablaufen", "Rappel quotidien des aliments qui périment bientôt"});
        T.put("today", new String[]{"today", "heute", "aujourd'hui"});
        T.put("tomorrow", new String[]{"tomorrow", "morgen", "demain"});
        T.put("in_days", new String[]{"%d days", "%d Tage", "%d jours"});
        T.put("expired", new String[]{"Expired: ", "Abgelaufen: ", "Périmés : "});
        T.put("n_expired", new String[]{"%d expired items", "%d abgelaufene Artikel", "%d articles périmés"});
        T.put("one_expired", new String[]{"1 expired item", "1 abgelaufener Artikel", "1 article périmé"});
        T.put("n_soon", new String[]{"%d items to use soon", "%d Artikel bald verbrauchen", "%d articles à consommer bientôt"});
        T.put("one_soon", new String[]{"1 item to use soon", "1 Artikel bald verbrauchen", "1 article à consommer bientôt"});
        T.put("all_good", new String[]{"Reminders are on. Nothing expires in the next %d days.", "Erinnerungen sind an. In den nächsten %d Tagen läuft nichts ab.", "Les rappels sont activés. Rien ne périme dans les %d prochains jours."});
    }

    static void set(Context ctx, String lang) {
        ctx.getSharedPreferences(Reminders.PREFS, Context.MODE_PRIVATE).edit().putString("lang", lang).apply();
    }

    static int index(Context ctx) {
        String l = ctx.getSharedPreferences(Reminders.PREFS, Context.MODE_PRIVATE).getString("lang", null);
        if (l == null) l = java.util.Locale.getDefault().getLanguage();
        if (l.startsWith("de") || l.startsWith("lb")) return 1;
        if (l.startsWith("fr")) return 2;
        return 0;
    }

    static String t(Context ctx, String key) {
        String[] v = T.get(key);
        return v == null ? key : v[index(ctx)];
    }

    static String f(Context ctx, String key, int n) {
        return String.format(java.util.Locale.ROOT, t(ctx, key), n);
    }
}
