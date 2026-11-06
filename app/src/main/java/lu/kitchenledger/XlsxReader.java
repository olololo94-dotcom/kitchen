package lu.kitchenledger;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

/** Minimal .xlsx reader: first worksheet -> CSV text. Formulas are kept as "=FORMULA(...)". */
public final class XlsxReader {
    private XlsxReader() { }

    public static boolean isZip(byte[] data) {
        return data != null && data.length > 4 && data[0] == 'P' && data[1] == 'K' && data[2] == 3 && data[3] == 4;
    }

    public static String toCsv(byte[] xlsx) throws Exception {
        Map<String, byte[]> files = new HashMap<>();
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(xlsx))) {
            ZipEntry e;
            while ((e = zin.getNextEntry()) != null) {
                String n = e.getName();
                if (n.equals("xl/sharedStrings.xml") || n.equals("xl/workbook.xml") || n.equals("xl/_rels/workbook.xml.rels") || n.startsWith("xl/worksheets/sheet")) {
                    files.put(n, readAll(zin));
                }
            }
        }
        List<String> shared = new ArrayList<>();
        if (files.containsKey("xl/sharedStrings.xml")) {
            Document d = parse(files.get("xl/sharedStrings.xml"));
            NodeList sis = d.getElementsByTagName("si");
            for (int i = 0; i < sis.getLength(); i++) shared.add(textOf((Element) sis.item(i)));
        }
        String sheetPath = firstSheetPath(files);
        if (sheetPath == null) throw new IOException("No worksheet found");
        Document sheet = parse(files.get(sheetPath));

        TreeMap<Integer, TreeMap<Integer, String>> grid = new TreeMap<>();
        NodeList rows = sheet.getElementsByTagName("row");
        int maxCol = 0;
        for (int i = 0; i < rows.getLength(); i++) {
            Element row = (Element) rows.item(i);
            int rIdx = parseIntOr(row.getAttribute("r"), i + 1);
            TreeMap<Integer, String> cells = new TreeMap<>();
            NodeList cs = row.getElementsByTagName("c");
            int auto = 0;
            for (int j = 0; j < cs.getLength(); j++) {
                Element c = (Element) cs.item(j);
                int col = colIndex(c.getAttribute("r"));
                if (col < 0) col = auto;
                auto = col + 1;
                String v = cellValue(c, shared);
                if (v != null && !v.isEmpty()) { cells.put(col, v); maxCol = Math.max(maxCol, col); }
            }
            if (!cells.isEmpty()) grid.put(rIdx, cells);
        }
        StringBuilder sb = new StringBuilder();
        for (TreeMap<Integer, String> cells : grid.values()) {
            for (int c = 0; c <= maxCol; c++) {
                if (c > 0) sb.append(',');
                String v = cells.get(c);
                if (v != null) sb.append(quote(v));
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }

    private static String firstSheetPath(Map<String, byte[]> files) throws Exception {
        // Follow workbook.xml -> first <sheet r:id> -> rels target
        try {
            if (files.containsKey("xl/workbook.xml") && files.containsKey("xl/_rels/workbook.xml.rels")) {
                Document wb = parse(files.get("xl/workbook.xml"));
                NodeList sheets = wb.getElementsByTagName("sheet");
                if (sheets.getLength() > 0) {
                    String rid = ((Element) sheets.item(0)).getAttribute("r:id");
                    Document rels = parse(files.get("xl/_rels/workbook.xml.rels"));
                    NodeList rs = rels.getElementsByTagName("Relationship");
                    for (int i = 0; i < rs.getLength(); i++) {
                        Element r = (Element) rs.item(i);
                        if (rid.equals(r.getAttribute("Id"))) {
                            String t = r.getAttribute("Target");
                            if (t.startsWith("/")) t = t.substring(1); else t = "xl/" + t;
                            if (files.containsKey(t)) return t;
                        }
                    }
                }
            }
        } catch (Exception ignored) { }
        if (files.containsKey("xl/worksheets/sheet1.xml")) return "xl/worksheets/sheet1.xml";
        for (String k : files.keySet()) if (k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml")) return k;
        return null;
    }

    private static String cellValue(Element c, List<String> shared) {
        String t = c.getAttribute("t");
        String f = childText(c, "f");
        String v = childText(c, "v");
        if (f != null && !f.isEmpty() && ("e".equals(t) || f.toUpperCase().startsWith("IMAGE(") || f.toUpperCase().startsWith("HYPERLINK("))) {
            return "=" + f;
        }
        if ("s".equals(t)) {
            try { int i = Integer.parseInt(v == null ? "" : v.trim()); return i >= 0 && i < shared.size() ? shared.get(i) : ""; }
            catch (NumberFormatException e) { return ""; }
        }
        if ("inlineStr".equals(t)) {
            NodeList is = c.getElementsByTagName("is");
            return is.getLength() > 0 ? textOf((Element) is.item(0)) : "";
        }
        if ("b".equals(t)) return "1".equals(v) ? "TRUE" : "FALSE";
        if ("e".equals(t)) return "";
        return v == null ? "" : v;
    }

    private static String childText(Element e, String tag) {
        for (Node n = e.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n.getNodeType() == Node.ELEMENT_NODE && tag.equals(localName(n))) return n.getTextContent();
        }
        return null;
    }

    /** Concatenate all <t> runs (rich text), skipping phonetic <rPh> runs. */
    private static String textOf(Element si) {
        StringBuilder sb = new StringBuilder();
        NodeList ts = si.getElementsByTagName("t");
        for (int i = 0; i < ts.getLength(); i++) {
            Node t = ts.item(i);
            Node p = t.getParentNode();
            if (p != null && "rPh".equals(localName(p))) continue;
            sb.append(t.getTextContent());
        }
        return sb.toString();
    }

    private static String localName(Node n) {
        String s = n.getNodeName();
        int i = s.indexOf(':');
        return i >= 0 ? s.substring(i + 1) : s;
    }

    private static int colIndex(String ref) {
        if (ref == null || ref.isEmpty()) return -1;
        int col = 0, i = 0;
        while (i < ref.length() && Character.isLetter(ref.charAt(i))) {
            col = col * 26 + (Character.toUpperCase(ref.charAt(i)) - 'A' + 1);
            i++;
        }
        return i == 0 ? -1 : col - 1;
    }

    private static int parseIntOr(String s, int def) {
        try { return Integer.parseInt(s); } catch (Exception e) { return def; }
    }

    private static String quote(String v) {
        if (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0 || v.indexOf(';') >= 0) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static Document parse(byte[] xml) throws Exception {
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(false);
        f.setExpandEntityReferences(false);
        try { f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); } catch (Exception ignored) { }
        DocumentBuilder b = f.newDocumentBuilder();
        return b.parse(new ByteArrayInputStream(xml));
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }
}
