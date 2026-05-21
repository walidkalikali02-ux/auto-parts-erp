"use client";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import { exportDailyReport } from "@/lib/excel";

// Helper functions for payment and order status labels
function getMethodLabel(method: string, language: "ar" | "en"): string {
  const methodMap: Record<string, Record<"ar"|"en", string>> = {
    cash: { ar: "نقدي", en: "Cash" },
    card: { ar: "بطاقة", en: "Card" },
    transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
    credit: { ar: "آجل", en: "Credit" },
  };
  return methodMap[method]?.[language] ?? method;
}

function getStatusColors(status: string, language: "ar" | "en"): { bg: string; color: string; label: string } {
  const statusMap: Record<string, { bg: string; color: string; label_ar: string; label_en: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label_ar: "مسودة", label_en: "Draft" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label_ar: "مؤكد", label_en: "Confirmed" },
    delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label_ar: "مُسلَّم", label_en: "Delivered" },
    returned:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label_ar: "مُرتجع", label_en: "Returned" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label_ar: "ملغي", label_en: "Cancelled" },
  };
  const m = statusMap[status] ?? statusMap.draft;
  return { bg: m.bg, color: m.color, label: language === "ar" ? m.label_ar : m.label_en };
}

const fmt = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DailyReportPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const today = new Date().toISOString().split("T")[0];
  const [date,    setDate]    = useState(today);
  const [orders,  setOrders]  = useState<any[]>([]);
  const [yOrders, setYOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const prevDate = new Date(new Date(d).getTime() - 86400000).toISOString().split("T")[0];

    const [todayRes, yRes] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("id, order_number, total, subtotal, tax_amount, discount, status, payment_status, payment_method, created_at, customers(name_ar)")
        .gte("created_at", `${d}T00:00:00`)
        .lte("created_at", `${d}T23:59:59`)
        .order("created_at", { ascending: false }),
      supabase
        .from("sales_orders")
        .select("total, status")
        .gte("created_at", `${prevDate}T00:00:00`)
        .lte("created_at", `${prevDate}T23:59:59`),
    ]);

    setOrders(todayRes.data ?? []);
    setYOrders(yRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const active   = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const returned = orders.filter((o) => o.status === "returned");

  const totalSales   = active.reduce((s, o) => s + Number(o.total), 0);
  const totalVAT     = active.reduce((s, o) => s + Number(o.tax_amount ?? 0), 0);
  const totalReturns = returned.reduce((s, o) => s + Math.abs(Number(o.total)), 0);
  const netRevenue   = totalSales - totalReturns;
  const yTotal       = yOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const growthPct    = yTotal > 0 ? ((totalSales - yTotal) / yTotal) * 100 : 0;

  const byMethod: Record<string, number> = {};
  active.forEach((o) => {
    const m = o.payment_method ?? "cash";
    byMethod[m] = (byMethod[m] ?? 0) + Number(o.total);
  });

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            {t("report.daily", language)}
          </h1>
          <p className="text-sm mt-0.5 font-arabic" style={{ color: "var(--color-ink-muted)" }}>
            {displayDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <input
            type="date"
            className="input font-mono"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 160 }}
          />
          <button
            className="btn btn-outline"
            onClick={() => exportDailyReport(orders, date)}
            style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="font-arabic">{t("action.export", language)} Excel</span>
          </button>
          <button className="btn btn-outline" onClick={() => window.print()}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="font-arabic">{t("action.print", language)}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin" width="28" height="28" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {[
              { labelKey: "report.daily.total_sales",    value: `${fmt(totalSales, locale)} ร.س`,   emoji: "💰", accent: "var(--color-green)" },
              { labelKey: "report.daily.vat",            value: `${fmt(totalVAT, locale)} ร.س`,     emoji: "📊", accent: "var(--color-blue)" },
              { labelKey: "report.daily.returns",        value: `${fmt(totalReturns, locale)} ร.س`, emoji: "↩️", accent: "var(--color-red)" },
              { labelKey: "report.daily.net",            value: `${fmt(netRevenue, locale)} ร.س`,   emoji: "✅", accent: "var(--color-gold)" },
              { labelKey: "report.daily.order_count",    value: active.length,                        emoji: "📋", accent: "var(--color-ink-muted)" },
            ].map((k) => (
              <div key={k.labelKey} className="card p-4" style={{ borderTop: `2px solid ${k.accent}` }}>
                <div className="text-xl mb-2">{k.emoji}</div>
                <p className="font-mono font-bold text-lg"
                  style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
                  {k.value}
                </p>
                <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                  {t(k.labelKey, language)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 280px" }}>

            {/* Orders table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                  {t("report.daily.orders_today", language)} ({orders.length})
                </h3>
              </div>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <span className="text-4xl opacity-20">📋</span>
                  <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {t("msg.no_orders_today", language)}
                  </p>
                </div>
              ) : (
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>{t("table.order_number", language)}</th>
                      <th>{t("table.customer", language)}</th>
                      <th>{t("table.payment_method", language)}</th>
                      <th>{t("table.status", language)}</th>
                      <th>{t("table.total", language)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => {
                      const s = getStatusColors(o.status, language);
                      return (
                        <tr key={o.id}>
                          <td className="font-mono text-xs font-semibold"
                            style={{ color: "var(--color-gold)" }}>
                            #{o.order_number}
                          </td>
                          <td className="font-arabic text-sm">
                            {o.customers?.name_ar ?? "نقدي"}
                          </td>
                          <td className="font-arabic text-sm"
                            style={{ color: "var(--color-ink-muted)" }}>
                            {getMethodLabel(o.payment_method, language)}
                          </td>
                          <td>
                            <span className="badge"
                              style={{ background: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="font-mono text-sm font-semibold"
                            style={{ color: o.status === "returned" ? "var(--color-red)" : "var(--color-ink)" }}>
                            {o.status === "returned" ? "-" : ""}
                            {fmt(Math.abs(Number(o.total)), locale)} ร.س
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">

              {/* Payment breakdown */}
              <div className="card p-5">
                <h3 className="font-arabic font-semibold mb-4"
                  style={{ color: "var(--color-ink)" }}>
                  {t("report.daily.payment_breakdown", language)}
                </h3>
                <div className="flex flex-col gap-3">
                  {Object.keys({ cash: 0, card: 0, transfer: 0, credit: 0 }).map((m) => {
                    const amount = byMethod[m] ?? 0;
                    const pct    = totalSales > 0 ? (amount / totalSales) * 100 : 0;
                    return (
                      <div key={m}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-arabic"
                            style={{ color: "var(--color-ink-2)" }}>
                            {getMethodLabel(m, language)}
                          </span>
                          <span className="font-mono"
                            style={{ color: "var(--color-ink)", direction: "ltr" }}>
                            {fmt(amount, locale)} ร.س
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full"
                          style={{ background: "var(--color-border)" }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: "var(--color-gold)",
                              transition: "width 0.3s",
                            }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* vs Yesterday */}
              <div className="card p-5">
                <h3 className="font-arabic font-semibold mb-3"
                  style={{ color: "var(--color-ink)" }}>
                  {t("report.daily.vs_yesterday", language)}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-arabic text-xs"
                      style={{ color: "var(--color-ink-muted)" }}>{t("report.daily.yesterday", language)}</p>
                    <p className="font-mono font-semibold"
                      style={{ color: "var(--color-ink-2)", direction: "ltr" }}>
                      {fmt(yTotal, locale)} ร.س
                    </p>
                  </div>
                  <div className="badge text-sm font-semibold"
                    style={{
                      background: growthPct >= 0 ? "var(--color-green-bg)" : "var(--color-red-bg)",
                      color:      growthPct >= 0 ? "var(--color-green)"    : "var(--color-red)",
                      padding: "6px 12px",
                    }}>
                    {growthPct >= 0 ? "▲" : "▼"} {Math.abs(growthPct).toFixed(1)}%
                  </div>
                  <div>
                    <p className="font-arabic text-xs"
                      style={{ color: "var(--color-ink-muted)" }}>{t("report.daily.today", language)}</p>
                    <p className="font-mono font-semibold"
                      style={{ color: "var(--color-gold)", direction: "ltr" }}>
                      {fmt(totalSales, locale)} ร.س
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash summary */}
              <div className="card p-5"
                style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
                <h3 className="font-arabic font-semibold mb-3"
                  style={{ color: "var(--color-ink)" }}>
                  {t("report.daily.cash_summary", language)}
                </h3>
                {[
                  [t("report.daily.cash_sales", language),   byMethod["cash"]     ?? 0],
                  [t("report.daily.card_sales", language),   byMethod["card"]     ?? 0],
                  [t("report.daily.transfers", language),    byMethod["transfer"] ?? 0],
                  [t("report.daily.credit", language),       byMethod["credit"]   ?? 0],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-sm mb-2">
                    <span className="font-arabic"
                      style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                    <span className="font-mono"
                      style={{ color: "var(--color-ink)", direction: "ltr" }}>
                      {fmt(v as number, locale)} ร.س
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 mt-1"
                  style={{ borderTop: "2px solid var(--color-gold)" }}>
                  <span className="font-arabic font-bold"
                    style={{ color: "var(--color-ink)" }}>{t("report.daily.net", language)}</span>
                  <span className="font-mono font-bold text-lg"
                    style={{ color: "var(--color-gold)", direction: "ltr" }}>
                    {fmt(netRevenue, locale)} ร.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
