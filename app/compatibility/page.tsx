"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Brand { id: string; name: string; name_ar: string | null; }
interface Model { id: string; brand_id: string; name: string; name_ar: string | null; year_start: number | null; year_end: number | null; }

export default function CompatibilityPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase.from("car_brands").select("id,name,name_ar").eq("is_active", true).order("name_ar").then(({ data }) => {
      setBrands(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!selectedBrand) { setModels([]); setSelectedModel(""); return; }
    supabase.from("car_models").select("id,brand_id,name,name_ar,year_start,year_end")
      .eq("brand_id", selectedBrand).eq("is_active", true).order("name")
      .then(({ data }) => { setModels(data ?? []); setSelectedModel(""); });
  }, [selectedBrand]);

  async function search() {
    if (!selectedModel) return;
    setLoading(true);
    setSearched(true);

    let q = supabase
      .from("part_compatibility")
      .select(`
        id, year_from, year_to, engine_code, notes,
        parts(id, part_number, oem_number, name, name_ar, price_retail, condition,
          part_categories(name_ar))
      `)
      .eq("car_model_id", selectedModel);

    if (year) {
      q = q.lte("year_from", parseInt(year)).gte("year_to", parseInt(year));
    }

    const { data } = await q;
    setResults(data ?? []);
    setLoading(false);
  }

  const conditionAr: Record<string, string> = { new: "جديد", used: "مستعمل", refurbished: "مجدد" };

  const yearOptions = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="mb-8">
        <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
          التوافق مع الموديلات
        </h1>
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          ابحث عن القطع المتوافقة مع موديل سيارة محدد
        </p>
      </div>

      {/* Search Card */}
      <div
        className="card p-6 mb-8 relative overflow-hidden"
        style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}
      >
        {/* Arabic geometric accent */}
        <div className="absolute left-0 top-0 bottom-0 w-40 geo-pattern opacity-60 pointer-events-none" />

        <div className="relative flex flex-wrap gap-4 items-end">
          <div className="flex-1" style={{ minWidth: 160 }}>
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
              ماركة السيارة
            </label>
            <select
              className="input"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">اختر الماركة</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar ?? b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" style={{ minWidth: 160 }}>
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
              الموديل
            </label>
            <select
              className="input"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!selectedBrand}
            >
              <option value="">اختر الموديل</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 130 }}>
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
              سنة الصنع
            </label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">كل السنوات</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-gold"
            onClick={search}
            disabled={!selectedModel || loading}
            style={{ height: 42 }}
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            )}
            <span className="font-arabic">بحث</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-border-light)" }}
          >
            <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              القطع المتوافقة
              <span className="mr-2 text-sm font-normal" style={{ color: "var(--color-ink-muted)" }}>
                ({results.length} نتيجة)
              </span>
            </h2>
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-5xl opacity-20">🔍</span>
              <p className="font-arabic text-base font-medium" style={{ color: "var(--color-ink-muted)" }}>
                لا توجد قطع متوافقة
              </p>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-faint)" }}>
                جرب موديلاً أو سنة مختلفة
              </p>
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
                  <th>كود المحرك</th>
                  <th>سعر البيع</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        {r.parts?.part_number}
                      </span>
                      {r.parts?.oem_number && (
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                          {r.parts.oem_number}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                        {r.parts?.name_ar}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{r.parts?.name}</p>
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {r.parts?.part_categories?.name_ar ?? "—"}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: r.parts?.condition === "new" ? "var(--color-green-bg)" : "var(--color-amber-bg)",
                          color: r.parts?.condition === "new" ? "var(--color-green)" : "var(--color-amber)",
                        }}
                      >
                        {conditionAr[r.parts?.condition] ?? r.parts?.condition}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {r.year_from && r.year_to ? `${r.year_from} – ${r.year_to}` : "—"}
                    </td>
                    <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {r.engine_code ?? "—"}
                    </td>
                    <td className="font-mono font-semibold" style={{ direction: "ltr" }}>
                      {r.parts?.price_retail?.toLocaleString("ar-SA")}{" "}
                      <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                    </td>
                    <td>
                      <Link
                        href={`/catalog/${r.parts?.id}`}
                        className="btn btn-ghost text-xs"
                        style={{ padding: "5px 12px" }}
                      >
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
