"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مؤكد" },
  picking:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "جارٍ التجهيز" },
  shipped:   { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مشحون" },
  delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "تم التسليم" },
  returned:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "مُرتجع" },
  cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
};

const payMap: Record<string, { bg: string; color: string; label: string }> = {
  unpaid:   { bg: "var(--color-red-bg)",    color: "var(--color-red)",    label: "غير مدفوع" },
  partial:  { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",  label: "جزئي" },
  paid:     { bg: "var(--color-green-bg)",  color: "var(--color-green)",  label: "مدفوع" },
  refunded: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",   label: "مُسترد" },
};

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("sales_orders")
      .select("*, customers(name, name_ar, phone)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) q = q.ilike("order_number", `%${search}%`);
    if (status) q = q.eq("status", status);

    const { data } = await q;
    setOrders(data ?? []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const total = orders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            أوامر البيع
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${orders.length} طلب · إجمالي ${total.toLocaleString("ar-SA")} ر.س`}
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">طلب جديد</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3">
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
            placeholder="بحث برقم الطلب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
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
            <span className="text-5xl opacity-20">📋</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد طلبات</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>التاريخ</th>
                <th>حالة الطلب</th>
                <th>حالة الدفع</th>
                <th>المجموع الفرعي</th>
                <th>الخصم</th>
                <th>الضريبة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = statusMap[o.status] ?? statusMap.draft;
                const p = payMap[o.payment_status] ?? payMap.unpaid;
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        #{o.order_number}
                      </span>
                    </td>
                    <td>
                      <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {o.customers?.name_ar ?? o.customers?.name ?? "—"}
                      </p>
                      {o.customers?.phone && (
                        <p className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>
                          {o.customers.phone}
                        </p>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(o.order_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: p.bg, color: p.color }}>{p.label}</span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {Number(o.subtotal).toLocaleString("ar-SA")}
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-red)" }}>
                      {Number(o.discount) > 0 ? `-${Number(o.discount).toLocaleString("ar-SA")}` : "—"}
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
