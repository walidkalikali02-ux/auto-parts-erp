"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("inventory")
      .select(`
        id, quantity, quantity_reserved, reorder_point, reorder_qty, location_code,
        parts(id, part_number, name, name_ar, price_retail, image_url, part_categories(name_ar)),
        warehouses(name, name_ar, city)
      `)
      .order("quantity", { ascending: true })
      .limit(150);

    if (search) {
      q = q.or(`parts.name.ilike.%${search}%,parts.name_ar.ilike.%${search}%,parts.part_number.ilike.%${search}%`);
    }
    if (filter === "out") q = q.eq("quantity", 0);
    if (filter === "low") q = q.gt("quantity", 0).lt("quantity", 10);

    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const totalItems = items.length;
  const outOfStock = items.filter((i) => i.quantity === 0).length;
  const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < 10).length;
  const totalValue = items.reduce((s, i) => s + i.quantity * (i.parts?.price_retail ?? 0), 0);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            إدارة المخزون
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            تتبع مستويات المخزون في المستودعات
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">تعديل المخزون</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "إجمالي الأصناف", value: totalItems, accent: "var(--color-blue)", emoji: "📦" },
          { label: "نفد المخزون", value: outOfStock, accent: "var(--color-red)", emoji: "🚫" },
          { label: "مخزون منخفض", value: lowStock, accent: "var(--color-amber)", emoji: "⚠️" },
          {
            label: "قيمة المخزون",
            value: totalValue.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س",
            accent: "var(--color-green)",
            emoji: "💵",
          },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p
                className="font-mono font-bold text-xl"
                style={{ color: "var(--color-ink)", direction: "ltr" }}
              >
                {s.value}
              </p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 items-center">
        <div className="flex-1 relative">
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
            placeholder="بحث برقم القطعة أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {[
            { key: "all", label: "الكل" },
            { key: "low", label: "منخفض" },
            { key: "out", label: "نفد" },
          ].map((f) => (
            <button
              key={f.key}
              className="btn text-sm px-4"
              style={{
                padding: "6px 14px",
                background: filter === f.key ? "#fff" : "transparent",
                color: filter === f.key ? "var(--color-ink)" : "var(--color-ink-muted)",
                boxShadow: filter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
              onClick={() => setFilter(f.key as any)}
            >
              <span className="font-arabic">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">📦</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد بيانات</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>رقم القطعة</th>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>المستودع</th>
                <th>الكمية</th>
                <th>محجوز</th>
                <th>حد إعادة الطلب</th>
                <th>الموقع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty = item.quantity;
                const reorder = item.reorder_point ?? 5;
                const isOut = qty === 0;
                const isLow = qty > 0 && qty < reorder;

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        {item.parts?.part_number ?? "—"}
                      </span>
                    </td>
                    <td>
                      <p className="font-arabic font-medium text-sm" style={{ color: "var(--color-ink)" }}>
                        {item.parts?.name_ar ?? item.parts?.name}
                      </p>
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {item.parts?.part_categories?.name_ar ?? "—"}
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                      {item.warehouses?.name_ar ?? item.warehouses?.name ?? "—"}
                    </td>
                    <td>
                      <span
                        className="font-mono font-bold text-lg"
                        style={{
                          color: isOut ? "var(--color-red)" : isLow ? "var(--color-amber)" : "var(--color-green)",
                        }}
                      >
                        {qty}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {item.quantity_reserved}
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-faint)" }}>
                      {reorder}
                    </td>
                    <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {item.location_code ?? "—"}
                    </td>
                    <td>
                      {isOut ? (
                        <span className="badge" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
                          نفد
                        </span>
                      ) : isLow ? (
                        <span className="badge" style={{ background: "var(--color-amber-bg)", color: "var(--color-amber)" }}>
                          منخفض
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}>
                          متوفر
                        </span>
                      )}
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
