import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

const planColor: Record<string, { bg: string; color: string; label: string }> = {
  starter:    { bg: "rgba(255,255,255,0.06)", color: "rgba(100,100,100,0.8)", label: "Starter" },
  pro:        { bg: "rgba(181,137,42,0.15)",  color: "#b5892a",              label: "Pro"     },
  enterprise: { bg: "rgba(52,199,89,0.12)",   color: "#34c759",              label: "Enterprise" },
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  const withStats = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const [parts, orders, users, warehouses] = await Promise.all([
        supabase.from("parts").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        supabase.from("sales_orders").select("total, status").eq("tenant_id", t.id),
        supabase.from("profiles").select("id, role").eq("tenant_id", t.id),
        supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      const revenue = (orders.data ?? [])
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + (o.total ?? 0), 0);
      return {
        ...t,
        parts_count: parts.count ?? 0,
        orders_count: orders.data?.length ?? 0,
        revenue,
        users_count: users.count ?? 0,
        users: users.data ?? [],
        warehouses_count: warehouses.count ?? 0,
      };
    })
  );

  const fmt = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            إدارة المستأجرين
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {withStats.length} مستأجر مسجل في المنصة
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">إضافة مستأجر</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "Starter", count: withStats.filter((t) => t.plan === "starter").length, color: "#6b7280" },
          { label: "Pro",        count: withStats.filter((t) => t.plan === "pro").length,     color: "#b5892a" },
          { label: "Enterprise", count: withStats.filter((t) => t.plan === "enterprise").length, color: "#34c759" },
        ].map((p) => (
          <div key={p.label} className="card p-4 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: `${p.color}18`, color: p.color }}
            >
              {p.label[0]}
            </div>
            <div>
              <p className="font-mono font-bold text-2xl" style={{ color: "var(--color-ink)" }}>{p.count}</p>
              <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>{p.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>الشركة</th>
              <th>الخطة</th>
              <th>الحالة</th>
              <th>القطع</th>
              <th>الطلبات</th>
              <th>المستخدمون</th>
              <th>المستودعات</th>
              <th>الإيرادات</th>
              <th>الإنشاء</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {withStats.map((t: any) => {
              const plan = planColor[t.plan] ?? planColor.starter;
              return (
                <tr key={t.id}>
                  <td>
                    <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                      {t.name_ar ?? t.name}
                    </p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                      /{t.slug}
                    </p>
                  </td>
                  <td>
                    <span className="badge" style={{ background: plan.bg, color: plan.color }}>
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
                  <td className="font-mono text-sm">{t.parts_count.toLocaleString()}</td>
                  <td className="font-mono text-sm">{t.orders_count.toLocaleString()}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm">{t.users_count}</span>
                      {t.users.filter((u: any) => u.role === "admin").length > 0 && (
                        <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
                          {t.users.filter((u: any) => u.role === "admin").length} admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="font-mono text-sm">{t.warehouses_count}</td>
                  <td>
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                      {fmt(t.revenue)}{" "}
                      <span style={{ color: "var(--color-ink-faint)", fontSize: 10 }}>ر.س</span>
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                    {new Date(t.created_at).toLocaleDateString("ar-SA")}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link
                        href={`/superadmin/tenants/${t.id}`}
                        className="btn btn-ghost text-xs"
                        style={{ padding: "5px 10px" }}
                      >
                        <span className="font-arabic">تفاصيل</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
