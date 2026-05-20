import { createClient } from "@/lib/supabase-server";
import {
  RevenueTrendChart,
  MonthlyRevenueChart,
  TopPartsChart,
  TopCustomersChart,
} from "@/components/charts/RevenueChart";

async function getAnalyticsData() {
  const supabase = await createClient();
  const now = new Date();
  const day30ago = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const month6ago = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];

  const [ordersRes, itemsRes, monthlySalesRes] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("total,status,created_at,customers(name_ar)")
      .gte("created_at", `${day30ago}T00:00:00`)
      .neq("status", "cancelled")
      .neq("status", "returned"),
    supabase
      .from("sales_order_items")
      .select("quantity,unit_price,parts(part_number,name_ar)")
      .limit(300),
    supabase
      .from("sales_orders")
      .select("total,status,created_at")
      .gte("created_at", `${month6ago}T00:00:00`)
      .neq("status", "cancelled")
      .neq("status", "returned"),
  ]);

  const orders = ordersRes.data ?? [];
  const items  = itemsRes.data ?? [];
  const monthly = monthlySalesRes.data ?? [];

  // Revenue trend last 30 days
  const trendMap: Record<string, number> = {};
  orders.forEach((o) => {
    const d = (o.created_at as string).slice(0, 10);
    trendMap[d] = (trendMap[d] ?? 0) + Number(o.total);
  });
  const revenueTrend: { date: string; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
    revenueTrend.push({ date: d, revenue: Math.round((trendMap[d] ?? 0) * 100) / 100 });
  }

  // Top parts by units sold
  const partsMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  items.forEach((item: any) => {
    const key  = item.parts?.part_number ?? "unknown";
    const name = item.parts?.name_ar ?? key;
    if (!partsMap[key]) partsMap[key] = { name, qty: 0, revenue: 0 };
    partsMap[key].qty     += item.quantity;
    partsMap[key].revenue += item.quantity * Number(item.unit_price ?? 0);
  });
  const topParts = Object.entries(partsMap)
    .map(([, v]) => v)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 7);

  // Top customers by spend
  const custMap: Record<string, number> = {};
  orders.forEach((o: any) => {
    const name = o.customers?.name_ar ?? "نقدي";
    custMap[name] = (custMap[name] ?? 0) + Number(o.total);
  });
  const topCustomers = Object.entries(custMap)
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Monthly (last 6 months)
  const monthlyMap: Record<string, number> = {};
  monthly.forEach((o) => {
    const m = (o.created_at as string).slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] ?? 0) + Number(o.total);
  });
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" });
    monthlyRevenue.push({ month: label, revenue: Math.round((monthlyMap[key] ?? 0) * 100) / 100 });
  }

  // Totals
  const allOrdersRes = await supabase
    .from("sales_orders")
    .select("total,status,created_at");
  const allOrders = (allOrdersRes.data ?? []).filter(
    (o) => o.status !== "cancelled" && o.status !== "returned"
  );
  const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total), 0);
  const monthStart   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthRevenue = allOrders
    .filter((o) => (o.created_at as string) >= monthStart)
    .reduce((s, o) => s + Number(o.total), 0);

  const [partsCount, customersCount, lowStockCount] = await Promise.all([
    supabase.from("parts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("inventory").select("id", { count: "exact", head: true }).lt("quantity", 5),
  ]);

  return {
    total_revenue:   totalRevenue,
    month_revenue:   monthRevenue,
    total_orders:    allOrders.length,
    low_stock_count: lowStockCount.count ?? 0,
    total_parts:     partsCount.count ?? 0,
    total_customers: customersCount.count ?? 0,
    revenue_trend:   revenueTrend,
    top_parts:       topParts,
    top_customers:   topCustomers,
    monthly_revenue: monthlyRevenue,
  };
}

const fmt = (n: number) =>
  n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const kpis = [
    { label: "إجمالي الإيرادات",  value: `${fmt(data.total_revenue)} ر.س`,                       accent: "var(--color-green)",      emoji: "💰" },
    { label: "إيرادات الشهر",     value: `${fmt(data.month_revenue)} ر.س`,                       accent: "var(--color-gold)",       emoji: "📅" },
    { label: "إجمالي الطلبات",    value: data.total_orders.toLocaleString("ar-SA"),               accent: "var(--color-blue)",       emoji: "📋" },
    { label: "إجمالي العملاء",    value: data.total_customers.toLocaleString("ar-SA"),            accent: "var(--color-ink-muted)",  emoji: "👥" },
    { label: "إجمالي القطع",      value: data.total_parts.toLocaleString("ar-SA"),               accent: "var(--color-gold)",       emoji: "⚙️" },
    { label: "مخزون منخفض",       value: data.low_stock_count.toLocaleString("ar-SA"),           accent: "var(--color-red)",        emoji: "⚠️" },
  ];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
          التحليلات والتقارير
        </h1>
        <p className="text-sm font-arabic" style={{ color: "var(--color-ink-muted)" }}>
          بيانات حية — إيرادات، مبيعات، عملاء، قطع
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {kpis.map((k) => (
          <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.accent}` }}>
            <div className="text-xl mb-2">{k.emoji}</div>
            <p className="font-mono font-bold text-lg mb-1" style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
              {k.value}
            </p>
            <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Trend full-width */}
      <div className="mb-6">
        <RevenueTrendChart data={data.revenue_trend} />
      </div>

      {/* Monthly + Top Parts */}
      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <MonthlyRevenueChart data={data.monthly_revenue} />
        <TopPartsChart data={data.top_parts} />
      </div>

      {/* Top Customers + Top Parts table */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <TopCustomersChart data={data.top_customers} />

        <div className="card p-5">
          <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>
            أعلى القطع إيراداً
          </h3>
          {data.top_parts.length === 0 ? (
            <p className="font-arabic text-sm text-center py-8" style={{ color: "var(--color-ink-muted)" }}>
              لا توجد بيانات بعد
            </p>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>القطعة</th>
                  <th>الكمية</th>
                  <th>الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {data.top_parts.map((p, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      {i + 1}
                    </td>
                    <td className="font-arabic text-sm">{p.name}</td>
                    <td className="font-mono text-sm">{p.qty}</td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-gold)" }}>
                      {p.revenue.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
