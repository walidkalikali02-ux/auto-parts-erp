"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const DEFAULT_TENANT = "d0000000-0000-0000-0000-000000000001";

const REQUIRED_COLS = ["part_number", "name", "name_ar", "price_cost", "price_retail"];
const ALL_COLS = [...REQUIRED_COLS, "oem_number", "barcode", "brand", "condition", "unit", "weight_kg", "price_wholesale", "tax_rate", "description_ar"];

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [done, setDone] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const p = parseCSV(text);
      setParsed(p);
      validate(p);
    };
    reader.readAsText(file);
  }

  function validate(p: { headers: string[]; rows: Record<string, string>[] }) {
    const errs: string[] = [];
    const missing = REQUIRED_COLS.filter((c) => !p.headers.includes(c));
    if (missing.length) errs.push(`أعمدة مفقودة: ${missing.join(", ")}`);

    const rowErrors: string[] = [];
    p.rows.slice(0, 5).forEach((row, i) => {
      if (!row.part_number) rowErrors.push(`صف ${i + 2}: رقم القطعة مفقود`);
      if (!row.name_ar) rowErrors.push(`صف ${i + 2}: الاسم بالعربي مفقود`);
      if (isNaN(parseFloat(row.price_retail))) rowErrors.push(`صف ${i + 2}: سعر البيع غير صحيح`);
    });
    setErrors([...errs, ...rowErrors]);

    // preview first 5 rows
    setPreview(p.rows.slice(0, 5));
    setDone(false);
    setImported(0);
  }

  async function handleImport() {
    if (!parsed || errors.length > 0) return;
    setImporting(true);
    let count = 0;
    const BATCH = 50;

    for (let i = 0; i < parsed.rows.length; i += BATCH) {
      const batch = parsed.rows.slice(i, i + BATCH).map((row) => ({
        tenant_id: DEFAULT_TENANT,
        part_number: row.part_number,
        oem_number: row.oem_number || null,
        barcode: row.barcode || null,
        name: row.name || row.name_ar,
        name_ar: row.name_ar,
        description_ar: row.description_ar || null,
        brand: row.brand || null,
        condition: row.condition || "new",
        unit: row.unit || "piece",
        weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
        price_cost: parseFloat(row.price_cost) || 0,
        price_retail: parseFloat(row.price_retail) || 0,
        price_wholesale: row.price_wholesale ? parseFloat(row.price_wholesale) : null,
        tax_rate: row.tax_rate ? parseFloat(row.tax_rate) : 15,
      }));
      await supabase.from("parts").upsert(batch, { onConflict: "tenant_id,part_number" });
      count += batch.length;
      setImported(count);
    }
    setDone(true);
    setImporting(false);
  }

  const canImport = parsed && errors.length === 0 && parsed.rows.length > 0;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>استيراد القطع</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>رفع ملف CSV لإضافة قطع بالجملة</p>
        </div>
        <Link href="/catalog" className="btn btn-outline">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          <span className="font-arabic">الكتالوج</span>
        </Link>
      </div>

      {/* Template */}
      <div className="card p-5 mb-6" style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-arabic font-semibold mb-1" style={{ color: "var(--color-ink)" }}>صيغة الملف المطلوبة (CSV)</p>
            <p className="font-arabic text-sm mb-3" style={{ color: "var(--color-ink-muted)" }}>
              يجب أن يحتوي الملف على الأعمدة التالية بالترتيب:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_COLS.map((c) => (
                <span key={c}
                  className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{
                    background: REQUIRED_COLS.includes(c) ? "var(--color-ink)" : "rgba(0,0,0,0.06)",
                    color: REQUIRED_COLS.includes(c) ? "#fff" : "var(--color-ink-muted)",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="font-arabic text-xs mt-2" style={{ color: "var(--color-ink-faint)" }}>
              الأعمدة الداكنة إلزامية · الباقي اختياري
            </p>
          </div>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(ALL_COLS.join(",") + "\nBRK-001,Brake Pad Front,تيل فرامل أمامي,45,90,04465-06190,,Bosch,new,piece,,75,15,")}`}
            download="parts_template.csv"
            className="btn btn-outline text-sm"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="font-arabic">تحميل النموذج</span>
          </a>
        </div>
      </div>

      {/* Upload */}
      <div
        className="card p-8 mb-6 flex flex-col items-center gap-4 cursor-pointer transition-all"
        style={{ border: "2px dashed var(--color-border)", textAlign: "center" }}
        onClick={() => fileRef.current?.click()}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-gold)"; (e.currentTarget as HTMLElement).style.background = "var(--color-gold-bg)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
      >
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--color-gold)" strokeWidth={1.5}>
          <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div>
          <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>انقر لرفع ملف CSV</p>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>أو اسحب الملف وأفلته هنا</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="card p-4 mb-4" style={{ background: "var(--color-red-bg)", border: "1px solid rgba(192,57,43,0.2)" }}>
          <p className="font-arabic font-semibold mb-2" style={{ color: "var(--color-red)" }}>أخطاء في الملف</p>
          {errors.map((e, i) => <p key={i} className="font-arabic text-sm" style={{ color: "var(--color-red)" }}>• {e}</p>)}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              معاينة · {parsed?.rows.length ?? 0} صف
            </h3>
            {canImport && !done && (
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>
                    <span className="font-arabic">جارٍ الاستيراد ({imported}/{parsed?.rows.length})...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="font-arabic">استيراد {parsed?.rows.length} قطعة</span>
                  </>
                )}
              </button>
            )}
            {done && (
              <span className="badge" style={{ background: "var(--color-green-bg)", color: "var(--color-green)", padding: "6px 14px" }}>
                ✅ تم استيراد {imported} قطعة
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  {REQUIRED_COLS.map((c) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {REQUIRED_COLS.map((c) => (
                      <td key={c} className={c.includes("name") ? "font-arabic" : "font-mono"} style={{ fontSize: 12 }}>
                        {row[c] || <span style={{ color: "var(--color-ink-faint)" }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(parsed?.rows.length ?? 0) > 5 && (
            <p className="px-5 py-2 text-xs font-arabic" style={{ color: "var(--color-ink-faint)", borderTop: "1px solid var(--color-border-light)" }}>
              يعرض أول 5 صفوف من {parsed?.rows.length} صف
            </p>
          )}
        </div>
      )}
    </div>
  );
}
