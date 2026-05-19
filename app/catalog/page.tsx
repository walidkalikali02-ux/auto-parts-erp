"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Part, PartCategory } from "@/lib/types";

const conditionLabel: Record<string, string> = {
  new: "جديد",
  used: "مستعمل",
  refurbished: "مجدد",
};

const conditionColor: Record<string, { bg: string; color: string }> = {
  new:         { bg: "var(--color-green-bg)",  color: "var(--color-green)" },
  used:        { bg: "var(--color-amber-bg)",  color: "var(--color-amber)" },
  refurbished: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)"  },
};

export default function CatalogPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("parts")
      .select("*, part_categories(id,name,name_ar)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      q = q.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%,part_number.ilike.%${search}%,oem_number.ilike.%${search}%`);
    }
    if (category) q = q.eq("category_id", category);
    if (condition) q = q.eq("condition", condition);

    const { data } = await q;
    setParts(data ?? []);
    setLoading(false);
  }, [search, category, condition]);

  useEffect(() => {
    supabase.from("part_categories").select("*").order("name_ar").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            كتالوج القطع
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "جارٍ التحميل..." : `${parts.length} قطعة`}
          </p>
        </div>
        <Link href="/catalog/new" className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">إضافة قطعة</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 items-center flex-wrap">
        <div className="flex-1 relative" style={{ minWidth: 200 }}>
          <svg
            width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute"
            style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="input"
            style={{ paddingRight: 36 }}
            placeholder="بحث برقم القطعة، الاسم، رقم OEM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: "auto", minWidth: 160 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">كل الفئات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: "auto", minWidth: 130 }}
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="new">جديد</option>
          <option value="used">مستعمل</option>
          <option value="refurbished">مجدد</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>جارٍ التحميل...</p>
            </div>
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">⚙️</span>
            <p className="font-arabic text-base font-medium" style={{ color: "var(--color-ink-muted)" }}>
              لا توجد قطع
            </p>
            <p className="text-sm" style={{ color: "var(--color-ink-faint)" }}>
              ابدأ بإضافة قطع الغيار إلى الكتالوج
            </p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>رقم القطعة</th>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>الماركة</th>
                <th>الحالة</th>
                <th>سعر التكلفة</th>
                <th>سعر البيع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const cond = conditionColor[p.condition] ?? conditionColor.new;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        {p.part_number}
                      </span>
                      {p.oem_number && (
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                          OEM: {p.oem_number}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{p.name_ar}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{p.name}</p>
                    </td>
                    <td>
                      <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                        {(p as any).part_categories?.name_ar ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm" style={{ color: "var(--color-ink-2)" }}>{p.brand ?? "—"}</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: cond.bg, color: cond.color }}>
                        {conditionLabel[p.condition]}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-sm" style={{ direction: "ltr", display: "inline-block" }}>
                        {p.price_cost.toLocaleString("ar-SA")} <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr", display: "inline-block" }}>
                        {p.price_retail.toLocaleString("ar-SA")} <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/catalog/${p.id}`}
                        className="btn btn-ghost text-xs"
                        style={{ padding: "5px 12px" }}
                      >
                        <span className="font-arabic">تفاصيل</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
