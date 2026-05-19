"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface VINResult {
  year: string;
  make: string;
  model: string;
  bodyClass: string;
  engine: string;
  fuel: string;
  drive: string;
  country: string;
}

async function decodeVIN(vin: string): Promise<VINResult | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`
    );
    const json = await res.json();
    const get = (name: string) =>
      json.Results?.find((r: any) => r.Variable === name)?.Value ?? "";
    return {
      year:      get("Model Year"),
      make:      get("Make"),
      model:     get("Model"),
      bodyClass: get("Body Class"),
      engine:    `${get("Displacement (L)")}L ${get("Engine Cylinder Configuration")} ${get("Engine Number of Cylinders")} cyl`,
      fuel:      get("Fuel Type - Primary"),
      drive:     get("Drive Type"),
      country:   get("Plant Country"),
    };
  } catch { return null; }
}

export default function VINPage() {
  const [vin, setVin]               = useState("");
  const [result, setResult]         = useState<VINResult | null>(null);
  const [parts, setParts]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  async function handleDecode() {
    if (vin.trim().length !== 17) { setError("رمز VIN يجب أن يكون 17 خانة"); return; }
    setLoading(true); setError(""); setResult(null); setParts([]);

    const decoded = await decodeVIN(vin);
    if (!decoded || !decoded.year) { setError("تعذّر فك رمز VIN — تحقق من الرقم"); setLoading(false); return; }
    setResult(decoded);

    // Find matching car models + compatible parts
    const { data: models } = await supabase
      .from("car_models")
      .select("id, name, name_ar, car_brands(name, name_ar)")
      .ilike("name", `%${decoded.model}%`);

    if (models?.length) {
      const modelIds = models.map((m) => m.id);
      const yearN    = parseInt(decoded.year);
      let q = supabase
        .from("part_compatibility")
        .select("parts(id, part_number, name, name_ar, price_retail, condition, part_categories(name_ar)), year_from, year_to, engine_code")
        .in("car_model_id", modelIds);
      if (!isNaN(yearN)) q = q.lte("year_from", yearN).gte("year_to", yearN);
      const { data: compat } = await q.limit(40);
      const unique: any[] = [];
      const seen = new Set();
      (compat ?? []).forEach((c: any) => {
        if (c.parts && !seen.has(c.parts.id)) { seen.add(c.parts.id); unique.push(c); }
      });
      setParts(unique);
    }
    setLoading(false);
  }

  const vinSamples = ["1HGCM82633A004352", "JN1AZ4EH5FM730837", "WDD2050011A123456"];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="mb-6">
        <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          فك رمز VIN
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
          أدخل رقم الهيكل للتعرف على السيارة وعرض القطع المتوافقة
        </p>
      </div>

      {/* Search card */}
      <div
        className="card p-6 mb-6 relative overflow-hidden"
        style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-32 geo-pattern opacity-40 pointer-events-none" />
        <div className="relative">
          <label className="block font-arabic text-sm font-semibold mb-2" style={{ color: "var(--color-ink-2)" }}>
            رقم الهيكل (VIN) — 17 خانة
          </label>
          <div className="flex gap-3">
            <input
              className="input flex-1 font-mono text-lg tracking-widest"
              style={{ textTransform: "uppercase", direction: "ltr", letterSpacing: "0.15em" }}
              placeholder="1HGCM82633A004352"
              maxLength={17}
              value={vin}
              onChange={(e) => { setVin(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleDecode()}
            />
            <button
              className="btn btn-gold"
              style={{ padding: "0 28px", fontSize: 15 }}
              onClick={handleDecode}
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
              )}
              <span className="font-arabic font-bold">فك الرمز</span>
            </button>
          </div>

          {/* VIN position indicator */}
          {vin.length > 0 && (
            <div className="flex gap-0.5 mt-2">
              {Array.from({ length: 17 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full"
                  style={{ background: i < vin.length ? "var(--color-gold)" : "var(--color-border)" }}
                />
              ))}
            </div>
          )}
          <p className="text-xs mt-1.5" style={{ color: "var(--color-ink-faint)" }}>
            {vin.length}/17 خانة
            {vin.length === 0 && (
              <span> · مثال: {vinSamples[0]}</span>
            )}
          </p>

          {error && (
            <p className="font-arabic text-sm mt-2" style={{ color: "var(--color-red)" }}>{error}</p>
          )}
        </div>
      </div>

      {/* VIN Result */}
      {result && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
              style={{ background: "var(--color-gold-dim)" }}
            >
              🚗
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--color-ink)" }}>
                {result.year} {result.make} {result.model}
              </p>
              <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>{result.bodyClass}</p>
            </div>
            <div
              className="mr-auto badge"
              style={{ background: "var(--color-green-bg)", color: "var(--color-green)", padding: "6px 14px" }}
            >
              تم التعرف
            </div>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[
              ["سنة الصنع", result.year],
              ["المحرك", result.engine],
              ["الوقود", result.fuel],
              ["نظام الدفع", result.drive],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
                <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{label}</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: "var(--color-ink-2)" }}>{value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compatible parts */}
      {result && (
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-border-light)" }}
          >
            <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              القطع المتوافقة
              <span className="mr-2 text-sm font-normal" style={{ color: "var(--color-ink-muted)" }}>
                ({parts.length} قطعة)
              </span>
            </h2>
          </div>

          {parts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-5xl opacity-20">🔍</span>
              <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>
                لا توجد قطع مسجلة لهذا الموديل
              </p>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-faint)" }}>
                جرب البحث يدوياً في صفحة التوافق
              </p>
              <Link href="/compatibility" className="btn btn-outline">
                <span className="font-arabic">بحث التوافق</span>
              </Link>
            </div>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>رقم القطعة</th>
                  <th>الاسم</th>
                  <th>الفئة</th>
                  <th>الحالة</th>
                  <th>سنوات التوافق</th>
                  <th>سعر البيع</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parts.map((c: any) => (
                  <tr key={c.parts.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        {c.parts.part_number}
                      </span>
                    </td>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{c.parts.name_ar}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{c.parts.name}</p>
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {c.parts.part_categories?.name_ar ?? "—"}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: c.parts.condition === "new" ? "var(--color-green-bg)" : "var(--color-amber-bg)",
                          color: c.parts.condition === "new" ? "var(--color-green)" : "var(--color-amber)",
                        }}
                      >
                        {c.parts.condition === "new" ? "جديد" : c.parts.condition}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {c.year_from && c.year_to ? `${c.year_from} – ${c.year_to}` : "—"}
                    </td>
                    <td className="font-mono font-semibold" style={{ direction: "ltr" }}>
                      {c.parts.price_retail?.toLocaleString("ar-SA")} ر.س
                    </td>
                    <td>
                      <Link href={`/catalog/${c.parts.id}`} className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }}>
                        <span className="font-arabic">تفاصيل</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
