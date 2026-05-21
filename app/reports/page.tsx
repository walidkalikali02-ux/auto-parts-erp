"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";

const fmt  = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number, locale: string) => n.toLocaleString(locale);

// Helper to build reports data with translations
function getReportsData(language: "ar" | "en") {
  return [
    {
      titleKey: "report.daily",
      descKey: "report.daily.desc",
      href:  "/reports/daily",
      icon:  "📅",
      color: "var(--color-blue)",
      tagsKeys:  ["tag.sales", "tag.daily", "tag.payments"],
    },
    {
      titleKey: "report.analytics",
      descKey: "report.analytics.desc",
      href:  "/reports/analytics",
      icon:  "📊",
      color: "var(--color-gold)",
      tagsKeys:  ["tag.charts", "tag.revenue", "tag.analysis"],
    },
    {
      titleKey: "report.sales",
      descKey: "report.sales.desc",
      href:  "/reports/sales",
      icon:  "🛒",
      color: "var(--color-green)",
      tagsKeys:  ["tag.sales", "tag.detailed", "tag.customers"],
    },
    {
      titleKey: "report.profit",
      descKey: "report.profit.desc",
      href:  "/reports/profit",
      icon:  "💹",
      color: "var(--color-green)",
      tagsKeys:  ["tag.profit", "tag.costs", "tag.margin"],
    },
    {
      titleKey: "report.inventory.report",
      descKey: "report.inventory.desc",
      href:  "/reports/inventory-report",
      icon:  "📦",
      color: "var(--color-amber)",
      tagsKeys:  ["tag.inventory", "tag.movement", "tag.valuation"],
    },
    {
      titleKey: "report.vat.title",
      descKey: "report.vat.desc",
      href:  "/reports/vat",
      icon:  "🧾",
      color: "var(--color-red)",
      tagsKeys:  ["tag.tax", "tag.zatca", "tag.return"],
    },
  ];
}

interface Stats {
  month_revenue: number;
  month_vat: number;
  month_orders: number;
  today_revenue: number;
  today_orders: number;
  stock_value: number;
  unpaid_amount: number;
  low_stock: number;
}

export default function ReportsPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const reports = getReportsData(language);

  useEffect(() => {
    (async () => {
      const now        = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const todayStr   = now.toISOString().split("T")[0];

      const [monthOrders, todayOrders, inventory, unpaid] = await Promise.all([
        supabase.from("sales_orders").select("total,status,tax_amount")
          .gte("created_at", `${monthStart}T00:00:00`).neq("status", "cancelled"),
        supabase.from("sales_orders").select("total,status")
          .gte("created_at", `${todayStr}T00:00:00`).neq("status", "cancelled"),
        supabase.from("inventory").select("quantity,parts(price_retail,price_cost)"),
        supabase.from("sales_orders").select("total")
          .in("payment_status", ["unpaid", "partial"]).neq("status", "cancelled"),
      ]);

      const mOrders = (monthOrders.data ?? []).filter((o) => o.status !== "returned");
      const tOrders = (todayOrders.data  ?? []).filter((o) => o.status !== "returned");
      const inv     = inventory.data ?? [];

      setStats({
        month_revenue: mOrders.reduce((s, o) => s + Number(o.total), 0),
        month_vat:     mOrders.reduce((s, o) => s + Number((o as any).tax_amount ?? 0), 0),
        month_orders:  mOrders.length,
        today_revenue: tOrders.reduce((s, o) => s + Number(o.total), 0),
        today_orders:  tOrders.length,
        stock_value:   inv.reduce((s: number, i: any) => s + i.quantity * (i.parts?.price_retail ?? 0), 0),
        unpaid_amount: (unpaid.data ?? []).reduce((s, o) => s + Number(o.total), 0),
        low_stock:     inv.filter((i) => i.quantity <= 5).length,
      });
      setLoading(false);
    })();
  }, []);

  const kpis = stats ? [
    { labelKey: "report.hub.month_revenue",      value: `${fmt(stats.month_revenue, locale)} ر.س`,  subKey: "report.hub.orders_count",      subValue: fmtN(stats.month_orders, locale),   accent: "var(--color-green)",     emoji: "💰" },
    { labelKey: "report.hub.today_revenue",      value: `${fmt(stats.today_revenue, locale)} ر.س`,  subKey: "report.hub.orders_today",      subValue: fmtN(stats.today_orders, locale),   accent: "var(--color-blue)",      emoji: "📅" },
    { labelKey: "report.hub.stock_value",        value: `${fmt(stats.stock_value, locale)} ر.س`,    subKey: "report.hub.low_stock",         subValue: fmtN(stats.low_stock, locale),      accent: "var(--color-gold)",      emoji: "📦" },
    { labelKey: "report.hub.unpaid_amount",      value: `${fmt(stats.unpaid_amount, locale)} ر.س`,  subKey: "report.hub.pending",           subValue: "",                                   accent: "var(--color-red)",       emoji: "💸" },
  ] : [];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
          {t("report.hub.title", language)}
        </h1>
        <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
          {t("report.hub.subtitle", language)}
        </p>
      </div>

      {/* Quick KPIs */}
      {loading ? (
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[0,1,2,3].map((i) => (
            <div key={i} className="card p-5 animate-pulse" style={{ height: 110 }} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {kpis.map((k) => (
            <div key={k.labelKey} className="card p-5" style={{ borderTop: `3px solid ${k.accent}` }}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{k.emoji}</span>
                <div className="w-1.5 h-6 rounded-full opacity-30" style={{ background: k.accent }} />
              </div>
              <p className="font-mono font-bold text-xl mb-0.5"
                style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
                {k.value}
              </p>
              <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>{t(k.labelKey, language)}</p>
              {k.subValue && (
                <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                  {k.subValue} {t(k.subKey, language)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VAT highlight */}
      {stats && (
        <div className="card p-5 mb-8 flex items-center justify-between"
          style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
          <div className="flex items-center gap-4">
            <span className="text-3xl">🧾</span>
            <div>
              <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                {t("report.vat.this_month", language)}
              </p>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                {t("report.vat.collected_label", language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="font-mono font-bold text-xl"
                style={{ color: "var(--color-gold)", direction: "ltr" }}>
                {fmt(stats.month_vat, locale)} ر.س
              </p>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                {t("report.vat.sales_tax", language)}
              </p>
            </div>
            <Link href="/reports/vat" className="btn btn-gold text-sm">
              <span className="font-arabic">{t("report.vat.full_return", language)}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Report cards */}
      <h2 className="font-arabic font-semibold text-lg mb-4" style={{ color: "var(--color-ink)" }}>
        {t("report.hub.available_reports", language)}
      </h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="card p-6 no-underline flex flex-col gap-4"
            style={{
              borderRight: `3px solid ${r.color}`,
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{r.icon}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}
                style={{ color: "var(--color-ink-faint)", marginTop: 4 }}>
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <div>
              <h3 className="font-arabic font-bold text-base mb-1.5"
                style={{ color: "var(--color-ink)" }}>
                {t(r.titleKey, language)}
              </h3>
              <p className="font-arabic text-sm leading-relaxed"
                style={{ color: "var(--color-ink-muted)" }}>
                {t(r.descKey, language)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap mt-auto">
              {r.tagsKeys.map((tagKey) => (
                <span key={tagKey} className="badge text-xs"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}>
                  {t(tagKey, language)}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
