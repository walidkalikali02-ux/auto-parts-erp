"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReorderPage() {
  const [items,    setItems]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API}/api/stocktake/reorder/suggestions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.inventory_id)));
  }

  const totalSelected = items
    .filter((i) => selected.has(i.inventory_id))
    .reduce((s, i) => s + Number(i.estimated_cost), 0);

  const totalAll = items.reduce((s, i) => s + Number(i.estimated_cost), 0);

  function exportExcel() {
    const rows = items.map((i) => ({
      "رقم القطعة":       i.part_number,
      "اسم القطعة":       i.name_ar,
      "المستودع":          i.warehouse_name,
      "الكمية الحالية":   i.quantity,
      "حد إعادة الطلب":  i.reorder_point,
      "الكمية المقترحة":  i.suggested_qty,
      "سعر التكلفة":      Number(i.price_cost).toFixed(2),
      "التكلفة التقديرية": Number(i.estimated_cost).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [14,28,16,16,16,16,14,16].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اقتراحات الشراء");
    XLSX.writeFile(wb, `reorder-suggestions-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  async function createPO() {
    const toOrder = items.filter((i) => selected.has(i.inventory_id));
    if (!toOrder.length) return;

    // Group by supplier is not available here, so we create one PO for all
    // In a real scenario you'd group by supplier
    setCreating(true);
    const { data: suppliers } = await supabase.from("suppliers").select("id").limit(1).single();
    if (!suppliers) { alert("لم يتم العثور على موردين"); setCreating(false); return; }

    const token = await getToken();
    const res = await fetch(`${API}/api/orders/purchase`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: suppliers.id,
        items: toOrder.map((i) => ({ part_id: i.part_id, quantity: i.suggested_qty, unit_cost: i.price_cost })),
        notes: "أمر شراء تلقائي من اقتراحات المخزون",
      }),
    });
    setCreating(false);
    if (res.ok) {
      alert(`تم إنشاء أمر الشراء بنجاح (${toOrder.length} صنف)`);
      window.location.href = "/orders/purchase";
    } else {
      const data = await res.json();
      alert(data.error ?? "فشل إنشاء أمر الشراء");
    }
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>اقتراحات إعادة الطلب</h1>
          <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            القطع التي وصلت لحد إعادة الطلب أو نفدت
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={exportExcel} style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="font-arabic">تصدير Excel</span>
          </button>
          {selected.size > 0 && (
            <button className="btn btn-primary" disabled={creating} onClick={createPO}>
              <span className="font-arabic">{creating ? "..." : `إنشاء أمر شراء (${selected.size})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "أصناف تحتاج طلب",     value: items.length,                             accent: "var(--color-red)",   emoji: "⚠️" },
          { label: "نفد بالكامل",          value: items.filter((i) => i.quantity === 0).length, accent: "var(--color-red)",   emoji: "🚫" },
          { label: "التكلفة التقديرية",    value: `${fmt(totalAll)} ر.س`,                  accent: "var(--color-gold)",  emoji: "💰" },
          { label: "محدد للطلب",           value: selected.size > 0 ? `${fmt(totalSelected)} ر.س` : "—", accent: "var(--color-blue)",  emoji: "✓" },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3" style={{ borderRight: `3px solid ${k.accent}` }}>
            <span className="text-2xl">{k.emoji}</span>
            <div>
              <p className="font-mono font-bold text-lg" style={{ color: "var(--color-ink)", direction: "ltr" }}>{k.value}</p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl opacity-20">✅</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>جميع الأصناف فوق حد إعادة الطلب</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} />
                </th>
                <th>القطعة</th>
                <th>المستودع</th>
                <th>الكمية الحالية</th>
                <th>حد الإعادة</th>
                <th>الكمية المقترحة</th>
                <th>التكلفة التقديرية</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.inventory_id}
                  style={{ background: i.quantity === 0 ? "var(--color-red-bg)" : "var(--color-amber-bg)" }}>
                  <td>
                    <input type="checkbox"
                      checked={selected.has(i.inventory_id)}
                      onChange={(e) => setSelected((prev) => {
                        const n = new Set(prev);
                        e.target.checked ? n.add(i.inventory_id) : n.delete(i.inventory_id);
                        return n;
                      })} />
                  </td>
                  <td>
                    <p className="font-arabic text-sm font-medium">{i.name_ar}</p>
                    <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{i.part_number}</p>
                  </td>
                  <td className="font-arabic text-sm">{i.warehouse_name}</td>
                  <td>
                    <span className="badge font-mono" style={{
                      background: i.quantity === 0 ? "var(--color-red-bg)" : "var(--color-amber-bg)",
                      color:      i.quantity === 0 ? "var(--color-red)"    : "var(--color-amber)",
                    }}>{i.quantity}</span>
                  </td>
                  <td className="font-mono text-sm">{i.reorder_point}</td>
                  <td className="font-mono font-bold text-sm" style={{ color: "var(--color-blue)" }}>+{i.suggested_qty}</td>
                  <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-gold)" }}>
                    {fmt(i.estimated_cost)} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
