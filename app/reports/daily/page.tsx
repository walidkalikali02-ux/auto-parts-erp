import { createClient } from "@/lib/supabase-server";
import { DailyExport } from "@/components/reports/DailyExport";

const methodAr: Record<string, string> = {
  cash: "نقدي", card: "بطاقة", transfer: "تحويل بنكي", credit: "آجل",
};

export default async function DailyReportPage() {
  const supabase = await createClient();

  const today      = new Date();
  const todayStr   = today.toISOString().split("T")[0];
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split("T")[0];

  const { data: todayOrders } = await supabase
    .from("sales_orders")
    .select("id, order_number, total, subtotal, tax_amount, discount, status, payment_status, payment_method, created_at, customers(name_ar)")
    .gte("created_at", `${todayStr}T00:00:00`)
    .lte("created_at", `${todayStr}T23:59:59`)
    .order("created_at", { ascending: false });

  const { data: yesterdayOrders } = await supabase
    .from("sales_orders")
    .select("total, status")
    .gte("created_at", `${yesterdayStr}T00:00:00`)
    .lte("created_at", `${yesterdayStr}T23:59:59`);

  const orders   = todayOrders ?? [];
  const yOrders  = yesterdayOrders ?? [];

  const active   = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const returned = orders.filter((o) => o.status === "returned");

  const totalSales    = active.reduce((s, o) => s + Number(o.total), 0);
  const totalVAT      = active.reduce((s, o) => s + Number(o.tax_amount), 0);
  const totalReturns  = returned.reduce((s, o) => s + Math.abs(Number(o.total)), 0);
  const netRevenue    = totalSales - totalReturns;
  const yTotal        = yOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const growthPct     = yTotal > 0 ? ((totalSales - yTotal) / yTotal) * 100 : 0;

  // By payment method
  const byMethod: Record<string, number> = {};
  active.forEach((o) => {
    const m = o.payment_method ?? "cash";
    byMethod[m] = (byMethod[m] ?? 0) + Number(o.total);
  });

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusColor: Record<string, { bg: string; color: string; label: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مؤكد" },
    delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "مُسلَّم" },
    returned:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "مُرتجع" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
  };

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            تقرير يومي
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {today.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 no-print">
        <DailyExport orders={orders} date={todayStr} />
        <button className="btn btn-outline" onClick={() => typeof window !== "undefined" && window.print()}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span className="font-arabic">طباعة</span>
        </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {[
          { label: "إجمالي المبيعات",  value: `${fmt(totalSales)} ر.س`,    emoji: "💰", accent: "var(--color-green)" },
          { label: "ضريبة القيمة",     value: `${fmt(totalVAT)} ر.س`,      emoji: "📊", accent: "var(--color-blue)" },
          { label: "المرتجعات",         value: `${fmt(totalReturns)} ر.س`,  emoji: "↩️", accent: "var(--color-red)" },
          { label: "الصافي",            value: `${fmt(netRevenue)} ر.س`,    emoji: "✅", accent: "var(--color-gold)" },
          { label: "عدد الطلبات",       value: active.length,               emoji: "📋", accent: "var(--color-ink-muted)" },
        ].map((k) => (
          <div key={k.label} className="card p-4" style={{ borderTop: `2px solid ${k.accent}` }}>
            <div className="text-xl mb-2">{k.emoji}</div>
            <p className="font-mono font-bold text-lg" style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
              {k.value}
            </p>
            <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* Orders table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              طلبات اليوم ({orders.length})
            </h3>
          </div>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-4xl opacity-20">📋</span>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد طلبات اليوم</p>
            </div>
          ) : (
            <table className="erp-table">
              <thead>
                <tr><th>رقم الطلب</th><th>العميل</th><th>الدفع</th><th>الحالة</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const s = statusColor[o.status] ?? statusColor.draft;
                  return (
                    <tr key={o.id}>
                      <td className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>
                        #{o.order_number}
                      </td>
                      <td className="font-arabic text-sm">{o.customers?.name_ar ?? "نقدي"}</td>
                      <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                        {methodAr[o.payment_method] ?? o.payment_method}
                      </td>
                      <td><span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td className="font-mono text-sm font-semibold" style={{ color: o.status === "returned" ? "var(--color-red)" : "var(--color-ink)" }}>
                        {o.status === "returned" ? "-" : ""}{fmt(Math.abs(Number(o.total)))} ر.س
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
            <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>
              توزيع طرق الدفع
            </h3>
            <div className="flex flex-col gap-3">
              {Object.keys(methodAr).map((m) => {
                const amount = byMethod[m] ?? 0;
                const pct    = totalSales > 0 ? (amount / totalSales) * 100 : 0;
                return (
                  <div key={m}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-arabic" style={{ color: "var(--color-ink-2)" }}>{methodAr[m]}</span>
                      <span className="font-mono" style={{ color: "var(--color-ink)", direction: "ltr" }}>
                        {fmt(amount)} ر.س
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "var(--color-gold)", transition: "width 0.3s" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* vs Yesterday */}
          <div className="card p-5">
            <h3 className="font-arabic font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
              مقارنة بالأمس
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>أمس</p>
                <p className="font-mono font-semibold" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>
                  {fmt(yTotal)} ر.س
                </p>
              </div>
              <div
                className="badge text-sm font-semibold"
                style={{
                  background: growthPct >= 0 ? "var(--color-green-bg)" : "var(--color-red-bg)",
                  color: growthPct >= 0 ? "var(--color-green)" : "var(--color-red)",
                  padding: "6px 12px",
                }}
              >
                {growthPct >= 0 ? "▲" : "▼"} {Math.abs(growthPct).toFixed(1)}%
              </div>
              <div>
                <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>اليوم</p>
                <p className="font-mono font-semibold" style={{ color: "var(--color-gold)", direction: "ltr" }}>
                  {fmt(totalSales)} ر.س
                </p>
              </div>
            </div>
          </div>

          {/* Net summary */}
          <div className="card p-5" style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
            <h3 className="font-arabic font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
              ملخص الصندوق
            </h3>
            {[
              ["مبيعات نقدية", byMethod["cash"] ?? 0],
              ["مبيعات بطاقة", byMethod["card"] ?? 0],
              ["تحويلات", byMethod["transfer"] ?? 0],
              ["آجل (ذمم)", byMethod["credit"] ?? 0],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm mb-2">
                <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                <span className="font-mono" style={{ color: "var(--color-ink)", direction: "ltr" }}>
                  {fmt(v as number)} ر.س
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "2px solid var(--color-gold)" }}>
              <span className="font-arabic font-bold" style={{ color: "var(--color-ink)" }}>الصافي</span>
              <span className="font-mono font-bold text-lg" style={{ color: "var(--color-gold)", direction: "ltr" }}>
                {fmt(netRevenue)} ر.س
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
