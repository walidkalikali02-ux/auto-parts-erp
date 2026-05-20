import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

const fmt  = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("ar-SA");

async function getQuickStats() {
  const supabase = await createClient();
  const now      = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr   = now.toISOString().split("T")[0];
  const yearStart  = `${now.getFullYear()}-01-01`;

  const [monthOrders, todayOrders, inventory, unpaid, partsCount] = await Promise.all([
    supabase.from("sales_orders").select("total,status,tax_amount")
      .gte("created_at", `${monthStart}T00:00:00`).neq("status", "cancelled"),
    supabase.from("sales_orders").select("total,status")
      .gte("created_at", `${todayStr}T00:00:00`).neq("status", "cancelled"),
    supabase.from("inventory").select("quantity,parts(price_retail,price_cost)"),
    supabase.from("sales_orders").select("total").in("payment_status", ["unpaid", "partial"]).neq("status", "cancelled"),
    supabase.from("parts").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const mOrders  = (monthOrders.data ?? []).filter((o) => o.status !== "returned");
  const tOrders  = (todayOrders.data ?? []).filter((o) => o.status !== "returned");
  const inv      = inventory.data ?? [];

  return {
    month_revenue: mOrders.reduce((s, o) => s + Number(o.total), 0),
    month_vat:     mOrders.reduce((s, o) => s + Number(o.tax_amount ?? 0), 0),
    month_orders:  mOrders.length,
    today_revenue: tOrders.reduce((s, o) => s + Number(o.total), 0),
    today_orders:  tOrders.length,
    stock_value:   inv.reduce((s: number, i: any) => s + i.quantity * (i.parts?.price_retail ?? 0), 0),
    stock_cost:    inv.reduce((s: number, i: any) => s + i.quantity * (i.parts?.price_cost ?? 0), 0),
    unpaid_amount: (unpaid.data ?? []).reduce((s, o) => s + Number(o.total), 0),
    parts_count:   partsCount.count ?? 0,
    low_stock:     inv.filter((i) => i.quantity <= 5).length,
  };
}

const REPORTS = [
  {
    title:  "التقرير اليومي",
    desc:   "مبيعات اليوم، الدفعات، مقارنة بالأمس، ملخص الصندوق",
    href:   "/reports/daily",
    icon:   "📅",
    color:  "var(--color-blue)",
    tags:   ["مبيعات", "يومي", "دفعات"],
  },
  {
    title:  "التحليلات والمخططات",
    desc:   "مخططات الإيرادات 30 يوم، أكثر القطع مبيعاً، أفضل العملاء",
    href:   "/reports/analytics",
    icon:   "📊",
    color:  "var(--color-gold)",
    tags:   ["مخططات", "إيرادات", "تحليل"],
  },
  {
    title:  "تقرير المبيعات",
    desc:   "مبيعات بحسب الفترة، العميل، الفئة، طريقة الدفع",
    href:   "/reports/sales",
    icon:   "🛒",
    color:  "var(--color-green)",
    tags:   ["مبيعات", "تفصيلي", "عملاء"],
  },
  {
    title:  "الأرباح والخسائر",
    desc:   "إجمالي الإيراد، تكلفة البضاعة، الربح الإجمالي، هامش الربح",
    href:   "/reports/profit",
    icon:   "💹",
    color:  "var(--color-green)",
    tags:   ["ربح", "تكاليف", "هامش"],
  },
  {
    title:  "تقرير المخزون",
    desc:   "قيمة المخزون، حركة المخزون، الأصناف الراكدة",
    href:   "/reports/inventory-report",
    icon:   "📦",
    color:  "var(--color-amber)",
    tags:   ["مخزون", "حركة", "تقييم"],
  },
  {
    title:  "تقرير الضريبة (ZATCA)",
    desc:   "الضريبة المحصلة، ضريبة المشتريات، صافي الضريبة المستحقة",
    href:   "/reports/vat",
    icon:   "🧾",
    color:  "var(--color-red)",
    tags:   ["ضريبة", "ZATCA", "إقرار"],
  },
];

export default async function ReportsPage() {
  const stats = await getQuickStats();

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
          التقارير والإحصاءات
        </h1>
        <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
          نظرة شاملة على أداء المنشأة
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "إيرادات الشهر",    value: `${fmt(stats.month_revenue)} ر.س`,   sub: `${fmtN(stats.month_orders)} طلب`,           accent: "var(--color-green)",      emoji: "💰" },
          { label: "إيرادات اليوم",    value: `${fmt(stats.today_revenue)} ر.س`,   sub: `${fmtN(stats.today_orders)} طلب اليوم`,      accent: "var(--color-blue)",       emoji: "📅" },
          { label: "قيمة المخزون",    value: `${fmt(stats.stock_value)} ر.س`,      sub: `تكلفة: ${fmt(stats.stock_cost)} ر.س`,         accent: "var(--color-gold)",       emoji: "📦" },
          { label: "مستحقات غير مسددة",value: `${fmt(stats.unpaid_amount)} ر.س`,  sub: `${fmtN(stats.low_stock)} صنف مخزون منخفض`,   accent: "var(--color-red)",        emoji: "💸" },
        ].map((k) => (
          <div key={k.label} className="card p-5" style={{ borderTop: `3px solid ${k.accent}` }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{k.emoji}</span>
              <div className="w-1.5 h-6 rounded-full opacity-30" style={{ background: k.accent }} />
            </div>
            <p className="font-mono font-bold text-xl mb-0.5" style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
              {k.value}
            </p>
            <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>{k.label}</p>
            <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* VAT highlight */}
      <div className="card p-5 mb-8 flex items-center justify-between"
        style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
        <div className="flex items-center gap-4">
          <span className="text-3xl">🧾</span>
          <div>
            <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>ضريبة القيمة المضافة — هذا الشهر</p>
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>الضريبة المحصلة على المبيعات</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="font-mono font-bold text-xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>
              {fmt(stats.month_vat)} ر.س
            </p>
            <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>ضريبة المبيعات</p>
          </div>
          <Link href="/reports/vat" className="btn btn-gold text-sm">
            <span className="font-arabic">عرض الإقرار الكامل</span>
          </Link>
        </div>
      </div>

      {/* Report cards grid */}
      <h2 className="font-arabic font-semibold text-lg mb-4" style={{ color: "var(--color-ink)" }}>
        التقارير المتاحة
      </h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="card p-6 no-underline flex flex-col gap-4 transition-all"
            style={{ borderRight: `3px solid ${r.color}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,.08)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{r.icon}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-ink-faint)", marginTop: 4 }}>
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <div>
              <h3 className="font-arabic font-bold text-base mb-1.5" style={{ color: "var(--color-ink)" }}>
                {r.title}
              </h3>
              <p className="font-arabic text-sm leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
                {r.desc}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap mt-auto">
              {r.tags.map((t) => (
                <span key={t} className="badge text-xs" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}>
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
