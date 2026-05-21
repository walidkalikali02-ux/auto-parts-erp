"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { exportDailyReport } from "@/lib/excel";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";

function getStatusLabel(status: string, language: "ar" | "en"): { bg: string; color: string; label: string } {
  const statusMap: Record<string, { bg: string; color: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)" },
    picking:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)" },
    shipped:   { bg: "var(--color-blue-bg)",   color: "var(--color-blue)" },
    delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)" },
    returned:  { bg: "var(--color-red-bg)",    color: "var(--color-red)" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)" },
  };

  const colors = statusMap[status] ?? statusMap.draft;
  const keyMap: Record<string, string> = {
    draft: "order.status.draft",
    confirmed: "order.status.confirmed",
    picking: "order.status.picking",
    shipped: "order.status.shipped",
    delivered: "order.status.delivered",
    returned: "order.status.returned",
    cancelled: "order.status.cancelled",
  };

  return {
    ...colors,
    label: t(keyMap[status] ?? "order.status.draft", language),
  };
}

function getPaymentStatusLabel(status: string, language: "ar" | "en"): { bg: string; color: string; label: string } {
  const payMap: Record<string, { bg: string; color: string }> = {
    unpaid:   { bg: "var(--color-red-bg)",   color: "var(--color-red)" },
    partial:  { bg: "var(--color-amber-bg)", color: "var(--color-amber)" },
    paid:     { bg: "var(--color-green-bg)", color: "var(--color-green)" },
    refunded: { bg: "var(--color-blue-bg)",  color: "var(--color-blue)" },
  };

  const colors = payMap[status] ?? payMap.unpaid;
  const keyMap: Record<string, string> = {
    unpaid: "order.pay_status.unpaid",
    partial: "order.pay_status.partial",
    paid: "order.pay_status.paid",
    refunded: "order.pay_status.refunded",
  };

  return {
    ...colors,
    label: t(keyMap[status] ?? "order.pay_status.unpaid", language),
  };
}

function getMethodLabel(method: string, language: "ar" | "en"): string {
  const keyMap: Record<string, string> = {
    cash: "payment.method.cash",
    card: "payment.method.card",
    transfer: "payment.method.transfer",
    credit: "payment.method.credit",
  };
  return t(keyMap[method] ?? "payment.method.cash", language);
}

function getDateRange(range: string): { from: string; to: string } | null {
  const now = new Date();
  if (range === "today") {
    const d = now.toISOString().split("T")[0];
    return { from: `${d}T00:00:00`, to: `${d}T23:59:59` };
  }
  if (range === "week") {
    const day = now.getDay();
    const start = new Date(now); start.setDate(now.getDate() - day);
    return { from: start.toISOString().split("T")[0] + "T00:00:00", to: now.toISOString() };
  }
  if (range === "month") {
    const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { from: `${d}T00:00:00`, to: now.toISOString() };
  }
  return null;
}

export default function SalesOrdersPage() {
  const { language } = useLanguage();
  const [orders,   setOrders]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [payStatus,setPayStatus]= useState("");
  const [dateRange,setDateRange]= useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("sales_orders")
      .select("*, customers(name, name_ar, phone)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status)    q = q.eq("status", status);
    if (payStatus) q = q.eq("payment_status", payStatus);

    const dr = getDateRange(dateRange);
    if (dr) { q = q.gte("created_at", dr.from).lte("created_at", dr.to); }

    if (search) {
      q = q.or(`order_number.ilike.%${search}%`);
    }

    const { data } = await q;
    let rows = data ?? [];

    // Client-side customer name filter
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((o) =>
        o.order_number?.toLowerCase().includes(s) ||
        o.customers?.name_ar?.includes(search) ||
        o.customers?.name?.toLowerCase().includes(s)
      );
    }

    setOrders(rows);
    setLoading(false);
  }, [search, status, payStatus, dateRange]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function markPaid(id: string) {
    setUpdating(id);
    await supabase.from("sales_orders").update({ payment_status: "paid" }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, payment_status: "paid" } : o));
    setUpdating(null);
  }

  async function markDelivered(id: string) {
    setUpdating(id);
    await supabase.from("sales_orders").update({ status: "delivered" }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "delivered" } : o));
    setUpdating(null);
  }

  async function cancelOrder(id: string) {
    if (!confirm(t("orders.sales.confirm_cancel", language))) return;
    setUpdating(id);
    await supabase.from("sales_orders").update({ status: "cancelled" }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "cancelled" } : o));
    setUpdating(null);
  }

  const activeOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const unpaidCount  = activeOrders.filter((o) => o.payment_status === "unpaid").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const fmt = (n: number) => n.toLocaleString(language === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{t("orders.sales.title", language)}</h1>
          <p className="text-sm mt-0.5 font-arabic" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${orders.length} ${t("unit.order", language)} · ${t("orders.sales.total_revenue", language)} ${fmt(totalRevenue)} ر.س`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-outline"
            onClick={() => exportDailyReport(orders, new Date().toISOString().split("T")[0])}
            style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="font-arabic">{t("action.export", language)}</span>
          </button>
          <Link href="/orders/sales/new" className="btn btn-primary">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-arabic">{t("orders.sales.new_order", language)}</span>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: t("orders.sales.total_revenue", language), value: `${fmt(totalRevenue)} ر.س`, accent: "var(--color-green)",      emoji: "💰" },
          { label: t("orders.sales.unpaid", language),         value: unpaidCount,                 accent: "var(--color-red)",        emoji: "⏳" },
          { label: t("orders.sales.delivered", language),      value: deliveredCount,              accent: "var(--color-blue)",       emoji: "✅" },
          { label: `${t("orders.sales.total_orders", language)}`, value: orders.length,               accent: "var(--color-ink-muted)",  emoji: "📋" },
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

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 flex-wrap">
        <div className="flex-1 relative" style={{ minWidth: 200 }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" style={{ paddingRight: 36 }}
            placeholder={t("orders.sales.search_placeholder", language)}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("filter.all_statuses", language)}</option>
          {["draft", "confirmed", "picking", "shipped", "delivered", "returned", "cancelled"].map((k) => (
            <option key={k} value={k}>{getStatusLabel(k, language).label}</option>
          ))}
        </select>
        <select className="input" style={{ width: "auto", minWidth: 140 }} value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">{t("filter.all_payment_statuses", language)}</option>
          {["unpaid", "partial", "paid", "refunded"].map((k) => (
            <option key={k} value={k}>{getPaymentStatusLabel(k, language).label}</option>
          ))}
        </select>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {[
            { label: t("filter.all", language), value: "" },
            { label: t("filter.today", language), value: "today" },
            { label: t("filter.this_week", language), value: "week" },
            { label: t("filter.this_month", language), value: "month" },
          ].map((r) => (
            <button
              key={r.value}
              className="px-3 py-1.5 rounded-md font-arabic text-xs transition-all"
              style={{
                background: dateRange === r.value ? "#fff" : "transparent",
                color: dateRange === r.value ? "var(--color-ink)" : "var(--color-ink-muted)",
                boxShadow: dateRange === r.value ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
              onClick={() => setDateRange(r.value)}
            >
              {r.label}
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
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">📋</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>{t("orders.sales.no_orders", language)}</p>
            <Link href="/orders/sales/new" className="btn btn-primary">
              <span className="font-arabic">{t("orders.sales.first_order", language)}</span>
            </Link>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>{t("table.order_number", language)}</th>
                <th>{t("table.customer", language)}</th>
                <th>{t("table.date", language)}</th>
                <th>{t("table.payment_method", language)}</th>
                <th>{t("table.payment_status", language)}</th>
                <th>{t("table.status", language)}</th>
                <th>{t("table.total", language)}</th>
                <th>{t("table.actions", language)}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s  = getStatusLabel(o.status, language);
                const p  = getPaymentStatusLabel(o.payment_status, language);
                const busy = updating === o.id;
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/sales/${o.id}`}
                        className="font-mono text-xs font-semibold hover:underline"
                        style={{ color: "var(--color-gold)" }}>
                        #{o.order_number}
                      </Link>
                    </td>
                    <td>
                      <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {o.customers?.name_ar ?? o.customers?.name ?? t("orders.sales.cash_sale", language)}
                      </p>
                      {o.customers?.phone && (
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                          {o.customers.phone}
                        </p>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(o.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
                      <p className="text-xs opacity-60">{new Date(o.created_at).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td>
                      <span className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {getMethodLabel(o.payment_method, language)}
                      </span>
                    </td>
                    <td><span className="badge" style={{ background: p.bg, color: p.color }}>{p.label}</span></td>
                    <td><span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td>
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--color-ink)" }}>
                        {Number(o.total).toLocaleString(language === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 })}
                        <span style={{ color: "var(--color-ink-faint)", fontSize: 10 }}> ر.س</span>
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Link href={`/orders/sales/${o.id}`}
                          className="btn btn-ghost text-xs" style={{ padding: "4px 10px" }}>
                          <span className="font-arabic">{t("action.view", language)}</span>
                        </Link>
                        {o.payment_status !== "paid" && o.status !== "cancelled" && o.status !== "returned" && (
                          <button
                            className="btn btn-ghost text-xs"
                            style={{ padding: "4px 8px", color: "var(--color-green)" }}
                            disabled={busy}
                            onClick={() => markPaid(o.id)}
                          >
                            {busy ? "..." : <span className="font-arabic">{t("orders.sales.mark_paid", language)}</span>}
                          </button>
                        )}
                        {o.status === "confirmed" && (
                          <button
                            className="btn btn-ghost text-xs"
                            style={{ padding: "4px 8px", color: "var(--color-blue)" }}
                            disabled={busy}
                            onClick={() => markDelivered(o.id)}
                          >
                            {busy ? "..." : <span className="font-arabic">{t("orders.sales.mark_delivered", language)}</span>}
                          </button>
                        )}
                        {(o.status === "draft" || o.status === "confirmed") && (
                          <button
                            className="btn btn-ghost text-xs"
                            style={{ padding: "4px 8px", color: "var(--color-red)" }}
                            disabled={busy}
                            onClick={() => cancelOrder(o.id)}
                          >
                            <span className="font-arabic">{t("orders.sales.cancel_order", language)}</span>
                          </button>
                        )}
                      </div>
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
