"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  sent:      { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مُرسل" },
  confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مؤكد" },
  partial:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "استلام جزئي" },
  received:  { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "مستلم" },
  cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("purchase_orders")
      .select("*, suppliers(name, name_ar)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    setOrders(data ?? []);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const total = orders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            أوامر الشراء
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${orders.length} أمر · إجمالي ${total.toLocaleString("ar-SA")} ر.س`}
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">أمر شراء جديد</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3">
        <select
          className="input"
          style={{ width: "auto", minWidth: 160 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">كل الحالات</option>
          {Object.entries(statusMap).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🛒</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد أوامر شراء</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>رقم الأمر</th>
                <th>المورد</th>
                <th>تاريخ الطلب</th>
                <th>تاريخ التوقع</th>
                <th>الحالة</th>
                <th>المجموع الفرعي</th>
                <th>الضريبة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = statusMap[o.status] ?? statusMap.draft;
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        #{o.po_number}
                      </span>
                    </td>
                    <td className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                      {o.suppliers?.name_ar ?? o.suppliers?.name ?? "—"}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(o.order_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {o.expected_date ? new Date(o.expected_date).toLocaleDateString("ar-SA") : "—"}
                    </td>
                    <td>
                      <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {Number(o.subtotal).toLocaleString("ar-SA")}
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-ink-muted)" }}>
                      {Number(o.tax_amount).toLocaleString("ar-SA")}
                    </td>
                    <td>
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--color-ink)" }}>
                        {Number(o.total).toLocaleString("ar-SA")}{" "}
                        <span style={{ color: "var(--color-ink-faint)", fontSize: 10 }}>ر.س</span>
                      </span>
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
