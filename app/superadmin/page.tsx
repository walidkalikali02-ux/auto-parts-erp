import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

async function getPlatformStats() {
  const supabase = await createClient();

  const [tenants, users, parts, orders, inventory] = await Promise.all([
    supabase.from("tenants").select("id, plan, is_active, created_at"),
    supabase.from("profiles").select("id, role, tenant_id"),
    supabase.from("parts").select("id", { count: "exact", head: true }),
    supabase.from("sales_orders").select("total, status, created_at, tenant_id"),
    supabase.from("inventory").select("quantity, parts(price_retail)"),
  ]);

  const allTenants = tenants.data ?? [];
  const allOrders = orders.data ?? [];
  const allInventory = inventory.data ?? [];

  const totalRevenue = allOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + (o.total ?? 0), 0);

  const stockValue = allInventory.reduce(
    (s, i) => s + i.quantity * ((i.parts as any)?.price_retail ?? 0),
    0
  );

  const planCounts = allTenants.reduce((acc: any, t) => {
    acc[t.plan] = (acc[t.plan] ?? 0) + 1;
    return acc;
  }, {});

  const today = new Date();
  const last30 = new Date(today); last30.setDate(today.getDate() - 30);
  const newTenants = allTenants.filter((t) => new Date(t.created_at) > last30).length;
  const recentOrders = allOrders.filter((o) => new Date(o.created_at) > last30).length;

  return {
    totalTenants: allTenants.length,
    activeTenants: allTenants.filter((t) => t.is_active).length,
    totalUsers: users.data?.length ?? 0,
    totalParts: parts.count ?? 0,
    totalRevenue,
    stockValue,
    planCounts,
    newTenants,
    recentOrders,
    tenants: allTenants,
    ordersByDay: allOrders,
  };
}

async function getTenantsWithStats() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (!tenants?.length) return [];

  const stats = await Promise.all(
    tenants.map(async (t) => {
      const [parts, orders, users] = await Promise.all([
        supabase.from("parts").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        supabase.from("sales_orders").select("total").eq("tenant_id", t.id).neq("status", "cancelled"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      return {
        ...t,
        parts_count: parts.count ?? 0,
        revenue: (orders.data ?? []).reduce((s, o) => s + (o.total ?? 0), 0),
        users_count: users.count ?? 0,
      };
    })
  );
  return stats;
}

const planColor: Record<string, { bg: string; color: string; label: string }> = {
  starter:    { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", label: "Starter" },
  pro:        { bg: "rgba(181,137,42,0.15)",  color: "#b5892a",              label: "Pro" },
  enterprise: { bg: "rgba(52,199,89,0.12)",   color: "#34c759",              label: "Enterprise" },
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

export default async function SuperadminDashboard() {
  const [stats, tenants] = await Promise.all([getPlatformStats(), getTenantsWithStats()]);

  const kpis = [
    {
      label: "المستأجرون",
      value: stats.totalTenants,
      sub: `${stats.activeTenants} نشط · ${stats.newTenants} جديد هذا الشهر`,
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#b5892a" strokeWidth={1.8}>
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h1m4 0h1M9 7h1m4 0h1" />
        </svg>
      ),
      accent: "#b5892a",
    },
    {
      label: "إجمالي المستخدمين",
      value: stats.totalUsers,
      sub: "عبر جميع المستأجرين",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={1.8}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      accent: "#3b82f6",
    },
    {
      label: "إجمالي الإيرادات",
      value: `${fmt(stats.totalRevenue)} ر.س`,
      sub: `${stats.recentOrders} طلب هذا الشهر`,
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#34c759" strokeWidth={1.8}>
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: "#34c759",
    },
    {
      label: "إجمالي القطع",
      value: stats.totalParts,
      sub: `قيمة المخزون: ${fmt(stats.stockValue)} ر.س`,
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth={1.8}>
          <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
        </svg>
      ),
      accent: "#a855f7",
    },
  ];

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="badge text-xs"
              style={{ background: "rgba(181,137,42,0.15)", color: "#b5892a" }}
            >
              SaaS Platform
            </span>
          </div>
          <h1
            className="font-arabic text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            لوحة تحكم المنصة
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            إدارة شاملة لجميع المستأجرين والمستخدمين
          </p>
        </div>

        {/* Plan distribution */}
        <div className="card px-5 py-4 flex gap-5">
          {Object.entries(planColor).map(([plan, cfg]) => (
            <div key={plan} className="text-center">
              <p
                className="text-xl font-bold font-mono"
                style={{ color: cfg.color }}
              >
                {stats.planCounts[plan] ?? 0}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{cfg.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            className="card p-5"
            style={{ borderTop: `2px solid ${k.accent}` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${k.accent}15` }}
              >
                {k.icon}
              </div>
            </div>
            <p
              className="font-mono font-bold text-2xl mb-1"
              style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}
            >
              {k.value}
            </p>
            <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              {k.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tenants Table */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border-light)" }}
        >
          <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
            المستأجرون
          </h2>
          <Link
            href="/superadmin/tenants"
            className="text-xs font-arabic"
            style={{ color: "#b5892a" }}
          >
            إدارة الكل
          </Link>
        </div>

        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-4xl opacity-20">🏢</span>
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
              لا يوجد مستأجرون بعد
            </p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>اسم الشركة</th>
                <th>الخطة</th>
                <th>الحالة</th>
                <th>القطع</th>
                <th>المستخدمون</th>
                <th>الإيرادات</th>
                <th>تاريخ الإنشاء</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => {
                const plan = planColor[t.plan] ?? planColor.starter;
                return (
                  <tr key={t.id}>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                        {t.name_ar ?? t.name}
                      </p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                        {t.slug}
                      </p>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: plan.bg, color: plan.color }}
                      >
                        {plan.label}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: t.is_active ? "var(--color-green-bg)" : "var(--color-red-bg)",
                          color: t.is_active ? "var(--color-green)" : "var(--color-red)",
                        }}
                      >
                        {t.is_active ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-2)" }}>
                      {t.parts_count.toLocaleString("ar-SA")}
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-2)" }}>
                      {t.users_count}
                    </td>
                    <td>
                      <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                        {fmt(t.revenue)}{" "}
                        <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(t.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <Link
                        href={`/superadmin/tenants/${t.id}`}
                        className="btn btn-ghost text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        <span className="font-arabic">إدارة</span>
                      </Link>
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
