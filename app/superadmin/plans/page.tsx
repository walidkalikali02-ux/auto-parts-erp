import { createClient } from "@/lib/supabase-server";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, name_ar, plan, is_active, created_at");

  const plans = [
    {
      name: "Starter",
      key: "starter",
      price: "مجاني",
      color: "#6b7280",
      features: ["قطع غير محدودة (للعرض)", "مستخدم واحد", "مستودع واحد", "دعم أساسي"],
    },
    {
      name: "Pro",
      key: "pro",
      price: "10$ / شهر",
      color: "#b5892a",
      features: ["كل مميزات Starter", "5 مستخدمين", "3 مستودعات", "فواتير ZATCA", "دعم أولوية"],
    },
    {
      name: "Enterprise",
      key: "enterprise",
      price: "مخصص",
      color: "#34c759",
      features: ["مستخدمون غير محدودين", "مستودعات غير محدودة", "API كامل + Webhooks", "دومين مخصص", "دعم 24/7"],
    },
  ];

  const counts = (tenants ?? []).reduce((acc: any, t) => {
    acc[t.plan] = (acc[t.plan] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div className="mb-6">
        <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
          خطط الاشتراك
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
          إدارة الخطط والأسعار للمستأجرين
        </p>
      </div>

      <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {plans.map((plan) => (
          <div
            key={plan.key}
            className="card p-6 flex flex-col"
            style={{ borderTop: `3px solid ${plan.color}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: plan.color }}>{plan.name}</h3>
              <span
                className="text-2xl font-mono font-bold"
                style={{ color: "var(--color-ink)" }}
              >
                {counts[plan.key] ?? 0}
              </span>
            </div>

            <p className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink-2)" }}>
              {plan.price}
            </p>

            <ul className="flex flex-col gap-2 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={plan.color} strokeWidth={2.5} className="flex-shrink-0 mt-0.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div
              className="mt-5 pt-4 flex justify-between items-center"
              style={{ borderTop: "1px solid var(--color-border-light)" }}
            >
              <span className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                {counts[plan.key] ?? 0} مستأجر
              </span>
              <button className="btn btn-outline text-xs" style={{ padding: "5px 12px" }}>
                <span className="font-arabic">تعديل</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tenants by plan */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
            توزيع المستأجرين
          </h3>
        </div>
        <table className="erp-table">
          <thead>
            <tr><th>الشركة</th><th>الخطة الحالية</th><th>الحالة</th><th>تاريخ الاشتراك</th></tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t) => (
              <tr key={t.id}>
                <td className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                  {t.name_ar ?? t.name}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${plans.find((p) => p.key === t.plan)?.color ?? "#6b7280"}18`,
                      color: plans.find((p) => p.key === t.plan)?.color ?? "#6b7280",
                    }}
                  >
                    {t.plan}
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
                <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  {new Date(t.created_at).toLocaleDateString("ar-SA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
