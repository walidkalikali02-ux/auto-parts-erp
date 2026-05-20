import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { MiniTrendChart } from "@/components/charts/MiniTrend";

async function getStats() {
  const [parts, inventory, sales, customers] = await Promise.all([
    supabase.from("parts").select("id", { count: "exact", head: true }),
    supabase.from("inventory").select("quantity").gt("quantity", 0),
    supabase.from("sales_orders").select("total, status").neq("status", "cancelled"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const totalRevenue = (sales.data ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
  const lowStock = (inventory.data ?? []).filter((i) => i.quantity < 5).length;

  return {
    totalParts: parts.count ?? 0,
    totalRevenue,
    totalCustomers: customers.count ?? 0,
    lowStock,
  };
}

async function getRecentOrders() {
  const { data } = await supabase
    .from("sales_orders")
    .select("id, order_number, total, status, payment_status, order_date, customers(name, name_ar)")
    .order("created_at", { ascending: false })
    .limit(6);
  return data ?? [];
}

async function getLowStockParts() {
  const { data } = await supabase
    .from("inventory")
    .select("quantity, reorder_point, parts(part_number, name, name_ar)")
    .lt("quantity", 10)
    .order("quantity", { ascending: true })
    .limit(5);
  return data ?? [];
}

async function getRevenueTrend() {
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
}

const statusColor: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مؤكد" },
  picking:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "جارٍ التجهيز" },
  shipped:   { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مشحون" },
  delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "تم التسليم" },
  cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const [stats, orders, lowStock, trend] = await Promise.all([
    getStats(),
    getRecentOrders(),
    getLowStockParts(),
    getRevenueTrend(),
  ]);

  const kpis = [
    {
      label: "إجمالي القطع",
      value: stats.totalParts.toLocaleString("ar-SA"),
      sub: "في الكتالوج",
      emoji: "⚙️",
      accent: "var(--color-gold)",
    },
    {
      label: "الإيرادات",
      value: `${fmt(stats.totalRevenue)} ر.س`,
      sub: "إجمالي المبيعات",
      emoji: "💰",
      accent: "var(--color-green)",
    },
    {
      label: "العملاء",
      value: stats.totalCustomers.toLocaleString("ar-SA"),
      sub: "عميل مسجل",
      emoji: "👥",
      accent: "var(--color-blue)",
    },
    {
      label: "مخزون منخفض",
      value: stats.lowStock.toLocaleString("ar-SA"),
      sub: "قطعة تحت الحد",
      emoji: "⚠️",
      accent: "var(--color-red)",
    },
  ];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
            لوحة التحكم
          </h1>
          <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
            نظرة عامة على نشاط المخزن
          </p>
        </div>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.12">
          <polygon points="24,2 46,13 46,35 24,46 2,35 2,13" stroke="var(--color-gold)" strokeWidth="2" fill="none" />
          <polygon points="24,10 38,17 38,31 24,38 10,31 10,17" stroke="var(--color-gold)" strokeWidth="1.5" fill="none" />
          <circle cx="24" cy="24" r="5" fill="var(--color-gold)" />
        </svg>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
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
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

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
            التحليلات التفصيلية
          </p>
          <p className="font-arabic text-xs text-center" style={{ color: "var(--color-ink-muted)" }}>
            مخططات وإحصاءات
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
              آخر الطلبات
            </h2>
            <Link
              href="/orders/sales"
              className="text-xs font-arabic"
              style={{ color: "var(--color-gold)" }}
            >
              عرض الكل
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-3xl opacity-30">📋</span>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد طلبات بعد</p>
            </div>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الحالة</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const s = statusColor[o.status] ?? statusColor.draft;
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
                        {fmt(o.total)}{" "}
                        <span style={{ color: "var(--color-ink-muted)", fontSize: 11 }}>ر.س</span>
                      </td>
                      <td style={{ color: "var(--color-ink-muted)", fontSize: 12 }}>
                        {new Date(o.order_date).toLocaleDateString("ar-SA")}
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
              تنبيه المخزون
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl">✅</span>
                <p className="font-arabic text-sm text-center" style={{ color: "var(--color-ink-muted)" }}>
                  المخزون بمستوى جيد
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
                    <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>قطعة</p>
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
