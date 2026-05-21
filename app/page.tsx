"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { MiniTrendChart } from "@/components/charts/MiniTrend";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import { AppLanguage } from "@/lib/language";

// Helper function for number formatting with language support
function fmt(n: number, language: AppLanguage): string {
  const locale = language === "ar" ? "ar-SA" : "en-US";
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Helper function for currency formatting
function fmtCurrency(n: number, language: AppLanguage): string {
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const formatted = n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${formatted} ร.س`;
}

// Helper function for status label with colors
function getStatusLabel(status: string, language: AppLanguage): { bg: string; color: string; label: string } {
  const statusMap: Record<string, { bg: string; color: string; labelKey: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", labelKey: "order.status.draft" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      labelKey: "order.status.confirmed" },
    picking:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     labelKey: "order.status.picking" },
    shipped:   { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      labelKey: "order.status.shipped" },
    delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     labelKey: "order.status.delivered" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       labelKey: "order.status.cancelled" },
  };

  const m = statusMap[status] ?? statusMap.draft;
  return { bg: m.bg, color: m.color, label: t(m.labelKey, language) };
}

interface DashboardStats {
  totalParts: number;
  totalRevenue: number;
  totalCustomers: number;
  lowStock: number;
}

export default function DashboardPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [trend, setTrend] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch all data in parallel
        const [parts, inventory, sales, customers, ordersData, lowStockData, trendData] = await Promise.all([
          supabase.from("parts").select("id", { count: "exact", head: true }),
          supabase.from("inventory").select("quantity").gt("quantity", 0),
          supabase.from("sales_orders").select("total, status").neq("status", "cancelled"),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase
            .from("sales_orders")
            .select("id, order_number, total, status, payment_status, order_date, customers(name, name_ar)")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("inventory")
            .select("quantity, reorder_point, parts(part_number, name, name_ar)")
            .lt("quantity", 10)
            .order("quantity", { ascending: true })
            .limit(5),
          (async () => {
            const now = new Date();
            const day7ago = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
            const { data } = await supabase
              .from("sales_orders")
              .select("total,status,created_at")
              .gte("created_at", `${day7ago}T00:00:00`)
              .neq("status", "cancelled")
              .neq("status", "returned");

            const trendMap: Record<string, number> = {};
            (data ?? []).forEach((o) => {
              const d = (o.created_at as string).slice(0, 10);
              trendMap[d] = (trendMap[d] ?? 0) + Number(o.total);
            });
            const result: { date: string; revenue: number }[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
              result.push({ date: d, revenue: Math.round((trendMap[d] ?? 0) * 100) / 100 });
            }
            return result;
          })(),
        ]);

        const totalRevenue = (sales.data ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
        const lowStockCount = (inventory.data ?? []).filter((i) => i.quantity < 5).length;

        setStats({
          totalParts: parts.count ?? 0,
          totalRevenue,
          totalCustomers: customers.count ?? 0,
          lowStock: lowStockCount,
        });
        setOrders(ordersData.data ?? []);
        setLowStock(lowStockData.data ?? []);
        setTrend(trendData);
        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setLoading(false);
      }
    }

    loadData();
  }, [language]);

  const kpis = stats ? [
    {
      labelKey: "dashboard.total_parts",
      value: fmt(stats.totalParts, language),
      subKey: "dashboard.in_catalog",
      emoji: "⚙️",
      accent: "var(--color-gold)",
    },
    {
      labelKey: "dashboard.revenue",
      value: fmtCurrency(stats.totalRevenue, language),
      subKey: "dashboard.total_sales",
      emoji: "💰",
      accent: "var(--color-green)",
    },
    {
      labelKey: "dashboard.customers",
      value: fmt(stats.totalCustomers, language),
      subKey: "dashboard.registered_customers",
      emoji: "👥",
      accent: "var(--color-blue)",
    },
    {
      labelKey: "dashboard.low_stock",
      value: fmt(stats.lowStock, language),
      subKey: "dashboard.items_below_minimum",
      emoji: "⚠️",
      accent: "var(--color-red)",
    },
  ] : [];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
            {t("dashboard.title", language)}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
            {t("dashboard.subtitle", language)}
          </p>
        </div>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.12">
          <polygon points="24,2 46,13 46,35 24,46 2,35 2,13" stroke="var(--color-gold)" strokeWidth="2" fill="none" />
          <polygon points="24,10 38,17 38,31 24,38 10,31 10,17" stroke="var(--color-gold)" strokeWidth="1.5" fill="none" />
          <circle cx="24" cy="24" r="5" fill="var(--color-gold)" />
        </svg>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse" style={{ height: 110 }} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {kpis.map((k) => (
            <div key={k.labelKey} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{k.emoji}</span>
                <div className="w-1 h-8 rounded-full" style={{ background: k.accent, opacity: 0.4 }} />
              </div>
              <p
                className="font-arabic text-2xl font-bold mb-1"
                style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}
              >
                {k.value}
              </p>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                {t(k.labelKey, language)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                {t(k.subKey, language)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Mini trend + analytics link */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "1fr auto" }}>
        <MiniTrendChart data={trend} />
        <Link
          href="/reports/analytics"
          className="card p-5 flex flex-col items-center justify-center gap-2 no-underline"
          style={{ minWidth: 160, border: "1px dashed var(--color-gold-dim)", background: "var(--color-gold-bg)" }}
        >
          <span className="text-3xl">📊</span>
          <p className="font-arabic text-sm font-semibold text-center" style={{ color: "var(--color-gold)" }}>
            {t("dashboard.analytics", language)}
          </p>
          <p className="font-arabic text-xs text-center" style={{ color: "var(--color-ink-muted)" }}>
            {t("dashboard.charts_and_stats", language)}
          </p>
        </Link>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Recent Orders */}
        <div className="card overflow-hidden">
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-border-light)" }}
          >
            <h2 className="font-arabic font-semibold text-base" style={{ color: "var(--color-ink)" }}>
              {t("dashboard.recent_orders", language)}
            </h2>
            <Link
              href="/orders/sales"
              className="text-xs font-arabic"
              style={{ color: "var(--color-gold)" }}
            >
              {t("action.view_all", language)}
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-3xl opacity-30">📋</span>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                {t("dashboard.no_orders_yet", language)}
              </p>
            </div>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>{t("table.order_number", language)}</th>
                  <th>{t("table.customer", language)}</th>
                  <th>{t("table.status", language)}</th>
                  <th>{t("table.total", language)}</th>
                  <th>{t("table.date", language)}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const s = getStatusLabel(o.status, language);
                  return (
                    <tr key={o.id}>
                      <td className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>
                        #{o.order_number}
                      </td>
                      <td className="font-arabic">{o.customers?.name_ar ?? o.customers?.name ?? "—"}</td>
                      <td>
                        <span className="badge" style={{ background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="font-mono" style={{ direction: "ltr", textAlign: "right" }}>
                        {fmt(o.total, language)}{" "}
                        <span style={{ color: "var(--color-ink-muted)", fontSize: 11 }}>ร.س</span>
                      </td>
                      <td style={{ color: "var(--color-ink-muted)", fontSize: 12 }}>
                        {new Date(o.order_date).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h2 className="font-arabic font-semibold text-base" style={{ color: "var(--color-ink)" }}>
              {t("dashboard.stock_alerts", language)}
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl">✅</span>
                <p className="font-arabic text-sm text-center" style={{ color: "var(--color-ink-muted)" }}>
                  {t("dashboard.inventory_healthy", language)}
                </p>
              </div>
            ) : (
              lowStock.map((item: any, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: item.quantity === 0 ? "var(--color-red-bg)" : "var(--color-amber-bg)",
                  }}
                >
                  <div>
                    <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                      {item.parts?.name_ar ?? item.parts?.name}
                    </p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                      {item.parts?.part_number}
                    </p>
                  </div>
                  <div className="text-left">
                    <span
                      className="text-lg font-bold font-mono"
                      style={{
                        color: item.quantity === 0 ? "var(--color-red)" : "var(--color-amber)",
                      }}
                    >
                      {item.quantity}
                    </span>
                    <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {t("unit.part", language)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
