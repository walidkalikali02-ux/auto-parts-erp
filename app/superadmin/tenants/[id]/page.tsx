import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TenantActions } from "./TenantActions";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  const [parts, orders, users, warehouses, inventory] = await Promise.all([
    supabase.from("parts").select("id, part_number, name_ar, price_retail, is_active, created_at").eq("tenant_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("sales_orders").select("id, order_number, total, status, order_date, customers(name_ar)").eq("tenant_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("profiles").select("id, role, full_name_ar, created_at").eq("tenant_id", id),
    supabase.from("warehouses").select("*").eq("tenant_id", id),
    supabase.from("inventory").select("quantity, parts(name_ar)").eq("tenant_id", id),
  ]);

  const revenue = (orders.data ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
  const totalStock = (inventory.data ?? []).reduce((s, i) => s + i.quantity, 0);
  const fmt = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });

  const planColor: Record<string, string> = { starter: "#6b7280", pro: "#b5892a", enterprise: "#34c759" };
  const statusColor: Record<string, { bg: string; color: string; label: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مؤكد" },
    delivered: { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "تم التسليم" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
  };

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-ink-muted)" }}>
        <Link href="/superadmin" className="hover:underline font-arabic">SuperAdmin</Link>
        <span>/</span>
        <Link href="/superadmin/tenants" className="hover:underline font-arabic">المستأجرون</Link>
        <span>/</span>
        <span className="font-arabic" style={{ color: "var(--color-ink)" }}>{tenant.name_ar ?? tenant.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {tenant.name_ar ?? tenant.name}
            </h1>
            <span
              className="badge"
              style={{ background: `${planColor[tenant.plan]}18`, color: planColor[tenant.plan] ?? "#6b7280" }}
            >
              {tenant.plan}
            </span>
            <span
              className="badge"
              style={{
                background: tenant.is_active ? "var(--color-green-bg)" : "var(--color-red-bg)",
                color: tenant.is_active ? "var(--color-green)" : "var(--color-red)",
              }}
            >
              {tenant.is_active ? "نشط" : "موقوف"}
            </span>
          </div>
          <p className="text-sm font-mono" style={{ color: "var(--color-ink-muted)" }}>/{tenant.slug}</p>
        </div>
        <TenantActions tenantId={id} isActive={tenant.is_active} currentPlan={tenant.plan} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "القطع", value: parts.data?.length ?? 0, icon: "⚙️" },
          { label: "الطلبات", value: orders.data?.length ?? 0, icon: "📋" },
          { label: "إجمالي المخزون", value: totalStock, icon: "📦" },
          { label: "الإيرادات", value: `${fmt(revenue)} ر.س`, icon: "💰" },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-mono font-bold text-xl" style={{ color: "var(--color-ink)" }}>{s.value}</p>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Users */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              المستخدمون ({users.data?.length ?? 0})
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {(users.data ?? []).length === 0 ? (
              <p className="font-arabic text-sm text-center py-4" style={{ color: "var(--color-ink-muted)" }}>
                لا يوجد مستخدمون
              </p>
            ) : (
              (users.data ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--color-gold-dim)", color: "var(--color-gold)" }}
                    >
                      {u.full_name_ar?.[0] ?? "؟"}
                    </div>
                    <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                      {u.full_name_ar ?? "—"}
                    </p>
                  </div>
                  <span
                    className="badge text-xs"
                    style={{
                      background: u.role === "admin" ? "var(--color-gold-bg)" : "var(--color-surface-2)",
                      color: u.role === "admin" ? "var(--color-gold)" : "var(--color-ink-muted)",
                    }}
                  >
                    {u.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Warehouses */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              المستودعات ({warehouses.data?.length ?? 0})
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {(warehouses.data ?? []).length === 0 ? (
              <p className="font-arabic text-sm text-center py-4" style={{ color: "var(--color-ink-muted)" }}>لا توجد مستودعات</p>
            ) : (
              (warehouses.data ?? []).map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--color-surface)" }}>
                  <div>
                    <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>{w.name_ar ?? w.name}</p>
                    <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>{w.city}</p>
                  </div>
                  {w.is_default && (
                    <span className="badge" style={{ background: "var(--color-blue-bg)", color: "var(--color-blue)" }}>
                      رئيسي
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card overflow-hidden mt-6">
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>آخر الطلبات</h3>
        </div>
        {(orders.data ?? []).length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد طلبات</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>رقم الطلب</th><th>العميل</th><th>الحالة</th><th>الإجمالي</th><th>التاريخ</th></tr>
            </thead>
            <tbody>
              {(orders.data ?? []).map((o: any) => {
                const s = statusColor[o.status] ?? statusColor.draft;
                return (
                  <tr key={o.id}>
                    <td className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>#{o.order_number}</td>
                    <td className="font-arabic text-sm">{o.customers?.name_ar ?? "نقدي"}</td>
                    <td><span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td className="font-mono text-sm font-semibold">{fmt(o.total)} ر.س</td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>{new Date(o.order_date).toLocaleDateString("ar-SA")}</td>
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
