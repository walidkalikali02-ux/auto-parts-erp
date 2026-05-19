"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";

const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjType, setAdjType] = useState<"add" | "remove" | "set">("add");
  const [adjusting, setAdjusting] = useState(false);
  const [adjError, setAdjError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("inventory")
      .select(`id, quantity, quantity_reserved, reorder_point, reorder_qty, location_code,
        parts(id, part_number, name, name_ar, price_retail, part_categories(name_ar)),
        warehouses(name, name_ar, city)`)
      .order("quantity", { ascending: true })
      .limit(150);

    if (filter === "out") q = q.eq("quantity", 0);
    if (filter === "low") q = q.gt("quantity", 0).lt("quantity", 10);

    const { data } = await q;
    const filtered = (data ?? []).filter((item: any) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return item.parts?.name_ar?.includes(search) ||
        item.parts?.name?.toLowerCase().includes(s) ||
        item.parts?.part_number?.toLowerCase().includes(s);
    });
    setItems(filtered);
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleAdjust() {
    if (!adjustTarget || !adjQty) return;
    setAdjusting(true);
    setAdjError("");

    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty < 0) { setAdjError("أدخل كمية صحيحة"); setAdjusting(false); return; }

    let newQty = adjustTarget.quantity;
    if (adjType === "add") newQty = adjustTarget.quantity + qty;
    else if (adjType === "remove") newQty = Math.max(0, adjustTarget.quantity - qty);
    else newQty = qty;

    const { error } = await supabase
      .from("inventory")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", adjustTarget.id);

    if (error) { setAdjError(error.message); setAdjusting(false); return; }

    await supabase.from("inventory_movements").insert({
      tenant_id: "d0000000-0000-0000-0000-000000000001",
      part_id: adjustTarget.parts?.id,
      warehouse_id: DEFAULT_WAREHOUSE,
      movement_type: "adjustment",
      quantity: adjType === "remove" ? -qty : qty,
      notes: adjReason || null,
    }).catch(() => null);

    setAdjustTarget(null);
    setAdjQty("");
    setAdjReason("");
    setAdjType("add");
    setAdjusting(false);
    load();
  }

  const totalValue = items.reduce((s, i) => s + i.quantity * (i.parts?.price_retail ?? 0), 0);
  const outOfStock = items.filter((i) => i.quantity === 0).length;
  const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < 10).length;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>إدارة المخزون</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>تتبع مستويات المخزون في المستودعات</p>
        </div>
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "إجمالي الأصناف", value: items.length, accent: "var(--color-blue)", emoji: "📦" },
          { label: "نفد المخزون",    value: outOfStock,   accent: "var(--color-red)",  emoji: "🚫" },
          { label: "مخزون منخفض",   value: lowStock,     accent: "var(--color-amber)", emoji: "⚠️" },
          { label: "قيمة المخزون",   value: totalValue.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س", accent: "var(--color-green)", emoji: "💵" },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p className="font-mono font-bold text-xl" style={{ color: "var(--color-ink)", direction: "ltr" }}>{s.value}</p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-6 flex gap-3 items-center">
        <div className="flex-1 relative">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" style={{ paddingRight: 36 }} placeholder="بحث برقم القطعة أو الاسم..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {[{ key: "all", label: "الكل" }, { key: "low", label: "منخفض" }, { key: "out", label: "نفد" }].map((f) => (
            <button key={f.key} className="btn text-sm"
              style={{ padding: "6px 14px", background: filter === f.key ? "#fff" : "transparent", color: filter === f.key ? "var(--color-ink)" : "var(--color-ink-muted)", boxShadow: filter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}
              onClick={() => setFilter(f.key as any)}>
              <span className="font-arabic">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

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
                <th>حد الطلب</th>
                <th>الموقع</th>
                <th>الحالة</th>
                <th></th>
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
                      <span className="font-mono font-bold text-lg" style={{ color: isOut ? "var(--color-red)" : isLow ? "var(--color-amber)" : "var(--color-green)" }}>
                        {qty}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>{item.quantity_reserved}</td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-faint)" }}>{reorder}</td>
                    <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>{item.location_code ?? "—"}</td>
                    <td>
                      {isOut ? (
                        <span className="badge" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>نفد</span>
                      ) : isLow ? (
                        <span className="badge" style={{ background: "var(--color-amber-bg)", color: "var(--color-amber)" }}>منخفض</span>
                      ) : (
                        <span className="badge" style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}>متوفر</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost text-xs"
                        style={{ padding: "5px 10px" }}
                        onClick={() => { setAdjustTarget(item); setAdjQty(""); setAdjReason(""); setAdjType("add"); setAdjError(""); }}
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span className="font-arabic">تعديل</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjust Modal */}
      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="تعديل المخزون" size="sm">
        {adjustTarget && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
              <p className="font-arabic font-medium text-sm" style={{ color: "var(--color-ink)" }}>{adjustTarget.parts?.name_ar}</p>
              <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-gold)" }}>{adjustTarget.parts?.part_number}</p>
              <p className="font-arabic text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
                الكمية الحالية: <strong style={{ color: "var(--color-ink)" }}>{adjustTarget.quantity}</strong>
              </p>
            </div>

            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
                نوع التعديل
              </label>
              <div className="flex gap-2">
                {[{ key: "add", label: "إضافة" }, { key: "remove", label: "خصم" }, { key: "set", label: "تحديد" }].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="btn flex-1 justify-center"
                    style={{
                      background: adjType === t.key ? "var(--color-ink)" : "var(--color-surface)",
                      color: adjType === t.key ? "#fff" : "var(--color-ink-muted)",
                      padding: "8px 0",
                    }}
                    onClick={() => setAdjType(t.key as any)}
                  >
                    <span className="font-arabic text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
                {adjType === "set" ? "الكمية الجديدة" : "الكمية"}
              </label>
              <input
                className="input text-xl font-mono text-center"
                type="number"
                min="0"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                placeholder="0"
                style={{ direction: "ltr" }}
                autoFocus
              />
            </div>

            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
                سبب التعديل
              </label>
              <input
                className="input"
                placeholder="مثال: جرد دوري، إرجاع، تلف..."
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
              />
            </div>

            {adjQty && !isNaN(parseInt(adjQty)) && (
              <div className="p-3 rounded-lg" style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                  الكمية بعد التعديل:{" "}
                  <strong style={{ color: "var(--color-gold)" }}>
                    {adjType === "add" ? adjustTarget.quantity + parseInt(adjQty)
                      : adjType === "remove" ? Math.max(0, adjustTarget.quantity - parseInt(adjQty))
                      : parseInt(adjQty)}
                  </strong>
                </p>
              </div>
            )}

            {adjError && (
              <div className="rounded-lg px-3 py-2.5 text-sm font-arabic" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
                {adjError}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1" style={{ borderTop: "1px solid var(--color-border-light)" }}>
              <button className="btn btn-outline" onClick={() => setAdjustTarget(null)}>
                <span className="font-arabic">إلغاء</span>
              </button>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={adjusting || !adjQty}>
                {adjusting && <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
                <span className="font-arabic">تأكيد التعديل</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
