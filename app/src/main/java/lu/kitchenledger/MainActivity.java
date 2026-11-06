package lu.kitchenledger;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import androidx.webkit.WebViewAssetLoader;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final String APP_HOST = "appassets.androidplatform.net";

    private WebView web;
    private final ExecutorService io = Executors.newFixedThreadPool(4);

    /** "photo" (product picture) or "ocr" (receipt) — which JS callback an image result goes to. */
    private String imageTarget = "photo";
    private Uri photoUri;

    private final ActivityResultLauncher<ScanOptions> scanLauncher =
            registerForActivityResult(new ScanContract(), result ->
                    send("barcode", result.getContents() == null ? "" : result.getContents()));

    private final ActivityResultLauncher<Uri> takePicture =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), ok -> {
                if (Boolean.TRUE.equals(ok) && photoUri != null) handleImage(photoUri);
                else send(imageTarget, "");
            });

    private final ActivityResultLauncher<String> pickImage =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) handleImage(uri);
                else send(imageTarget, "");
            });

    private final ActivityResultLauncher<String> cameraPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (Boolean.TRUE.equals(granted)) launchCamera();
                else {
                    toast("Camera permission is needed to take photos. You can allow it in Settings > Apps > Kitchen Ledger.");
                    send(imageTarget, "");
                }
            });

    private final ActivityResultLauncher<String[]> openCsv =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (uri == null) { send("csv", ""); return; }
                io.execute(() -> {
                    try { send("csv", readText(uri)); }
                    catch (IOException e) { toast("Couldn't open that file."); send("csv", ""); }
                });
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(false);
        ws.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (APP_HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        if (web.getUrl() == null) web.loadUrl(START_URL);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("(window.onBack && window.onBack()) ? '1' : '0'", value -> {
                    if (!"\"1\"".equals(value)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        super.onDestroy();
    }

    /* ---------- JS <-> native ---------- */

    private void send(String type, String payload) {
        final String js = "window.onNative && window.onNative(" + JSONObject.quote(type) + "," + JSONObject.quote(payload == null ? "" : payload) + ")";
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    private class Bridge {
        @JavascriptInterface
        public boolean isNative() { return true; }

        @JavascriptInterface
        public void scanBarcode() {
            runOnUiThread(() -> {
                ScanOptions o = new ScanOptions();
                o.setDesiredBarcodeFormats(ScanOptions.PRODUCT_CODE_TYPES);
                o.setPrompt("Point the camera at a barcode");
                o.setBeepEnabled(true);
                o.setOrientationLocked(false);
                scanLauncher.launch(o);
            });
        }

        @JavascriptInterface
        public void takePhoto(String source) { startImage("photo", source); }

        @JavascriptInterface
        public void readReceipt(String source) { startImage("ocr", source); }

        @JavascriptInterface
        public void pickCsv() {
            runOnUiThread(() -> openCsv.launch(new String[]{"*/*"}));
        }

        @JavascriptInterface
        public void saveFile(String name, String content) {
            io.execute(() -> saveToDownloads(name, content));
        }

        @JavascriptInterface
        public void shareFile(String name, String content) {
            io.execute(() -> shareAsFile(name, content));
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, title));
            });
        }

        /** GET a URL without browser CORS limits; answers via onNative("http:"+id, body or "ERR:..."). */
        @JavascriptInterface
        public void httpGet(String id, String url) {
            io.execute(() -> {
                HttpURLConnection c = null;
                try {
                    URL u = new URL(url);
                    if (!"https".equals(u.getProtocol())) throw new IOException("https only");
                    c = (HttpURLConnection) u.openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(20000);
                    c.setRequestProperty("User-Agent", "KitchenLedger/1.0 (Android; personal kitchen inventory app)");
                    c.setRequestProperty("Accept", "application/json");
                    int code = c.getResponseCode();
                    if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
                    try (InputStream in = c.getInputStream()) {
                        send("http:" + id, new String(readAll(in), StandardCharsets.UTF_8));
                    }
                } catch (Exception e) {
                    send("http:" + id, "ERR:" + e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
            });
        }
    }

    /* ---------- images ---------- */

    private void startImage(String target, String source) {
        runOnUiThread(() -> {
            imageTarget = target;
            if ("gallery".equals(source)) {
                pickImage.launch("image/*");
            } else if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchCamera();
            } else {
                cameraPermission.launch(Manifest.permission.CAMERA);
            }
        });
    }

    private void launchCamera() {
        try {
            File dir = new File(getCacheDir(), "shots");
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("no cache dir");
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
                f.delete();
            File f = new File(dir, "shot_" + System.currentTimeMillis() + ".jpg");
            photoUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            takePicture.launch(photoUri);
        } catch (Exception e) {
            toast("Couldn't open the camera.");
            send(imageTarget, "");
        }
    }

    private void handleImage(Uri uri) {
        final String target = imageTarget;
        if ("ocr".equals(target)) {
            try {
                InputImage image = InputImage.fromFilePath(this, uri);
                TextRecognizer rec = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                rec.process(image)
                        .addOnSuccessListener(text -> {
                            try {
                                JSONArray arr = new JSONArray();
                                for (Text.TextBlock b : text.getTextBlocks()) {
                                    for (Text.Line l : b.getLines()) {
                                        Rect r = l.getBoundingBox();
                                        JSONObject o = new JSONObject();
                                        o.put("text", l.getText());
                                        o.put("top", r != null ? r.top : 0);
                                        o.put("bottom", r != null ? r.bottom : 0);
                                        o.put("left", r != null ? r.left : 0);
                                        arr.put(o);
                                    }
                                }
                                send("ocr", arr.toString());
                            } catch (Exception e) {
                                send("ocr", "ERR:Couldn't read the receipt.");
                            }
                            rec.close();
                        })
                        .addOnFailureListener(e -> {
                            send("ocr", "ERR:Couldn't read the receipt. Try again in better light.");
                            rec.close();
                        });
            } catch (IOException e) {
                send("ocr", "ERR:Couldn't open that picture.");
            }
        } else {
            io.execute(() -> {
                try { send("photo", makeThumb(uri)); }
                catch (Exception e) { toast("Couldn't use that picture."); send("photo", ""); }
            });
        }
    }

    /** Square, EXIF-rotated 240px JPEG as a data: URL. */
    private String makeThumb(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        int sample = 1;
        while (Math.min(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 480) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            bmp = BitmapFactory.decodeStream(in, null, opts);
        }
        if (bmp == null) throw new IOException("unreadable image");
        int rotation = 0;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in != null) rotation = new ExifInterface(in).getRotationDegrees();
        } catch (Exception ignored) { }
        int side = Math.min(bmp.getWidth(), bmp.getHeight());
        Matrix m = new Matrix();
        float scale = 240f / side;
        m.postScale(scale, scale);
        if (rotation != 0) m.postRotate(rotation);
        Bitmap crop = Bitmap.createBitmap(bmp, (bmp.getWidth() - side) / 2, (bmp.getHeight() - side) / 2, side, side, m, true);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        crop.compress(Bitmap.CompressFormat.JPEG, 78, bos);
        if (crop != bmp) crop.recycle();
        bmp.recycle();
        return "data:image/jpeg;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
    }

    /* ---------- files ---------- */

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }

    /** UTF-8 if valid, otherwise Windows-1252 (Excel on Windows). */
    private String readText(Uri uri) throws IOException {
        byte[] data;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("no stream");
            data = readAll(in);
        }
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(data)).toString();
        } catch (CharacterCodingException e) {
            return new String(data, Charset.forName("windows-1252"));
        }
    }

    private void saveToDownloads(String name, String content) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) { shareAsFile(name, content); return; }
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, "text/csv");
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new IOException("insert failed");
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IOException("no output");
                out.write(("﻿" + content).getBytes(StandardCharsets.UTF_8));
            }
            send("toast", "Saved to Downloads: " + name);
        } catch (Exception e) {
            shareAsFile(name, content);
        }
    }

    private void shareAsFile(String name, String content) {
        try {
            File dir = new File(getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("no cache dir");
            File f = new File(dir, name);
            try (OutputStream out = new FileOutputStream(f)) {
                out.write(("﻿" + content).getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/csv");
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.putExtra(Intent.EXTRA_SUBJECT, name);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, "Save or send CSV")));
        } catch (Exception e) {
            toast("Couldn't export the file.");
        }
    }
}
