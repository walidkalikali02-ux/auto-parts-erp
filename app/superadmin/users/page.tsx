import { createClient } from "@/lib/supabase-server";

const roleColor: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: "rgba(181,137,42,0.15)", color: "#b5892a" },
  admin:      { bg: "var(--color-blue-bg)",  color: "var(--color-blue)" },
  manager:    { bg: "var(--color-green-bg)", color: "var(--color-green)" },
  staff:      { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)" },
};

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, tenants(name, name_ar)")
    .order("created_at", { ascending: false });

  const { data: authUsers } = await supabase.auth.admin.listUsers();

  const merged = (profiles ?? []).map((p) => {
    const authUser = authUsers?.users?.find((u) => u.id === p.id);
    return { ...p, email: authUser?.email ?? "—", last_sign_in: authUser?.last_sign_in_at };
  });

  const roleCount = merged.reduce((acc: any, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            إدارة المستخدمين
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {merged.length} مستخدم عبر المنصة
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {["superadmin", "admin", "manager", "staff"].map((role) => {
          const c = roleColor[role];
          return (
            <div key={role} className="card p-4 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ background: c.bg, color: c.color }}
              >
                {roleCount[role] ?? 0}
              </div>
              <p className="text-sm font-mono" style={{ color: "var(--color-ink-2)" }}>{role}</p>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الدور</th>
              <th>المستأجر</th>
              <th>آخر دخول</th>
              <th>تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {merged.map((u: any) => {
              const c = roleColor[u.role] ?? roleColor.staff;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: c.bg, color: c.color }}
                      >
                        {u.full_name_ar?.[0] ?? u.email?.[0]?.toUpperCase() ?? "؟"}
                      </div>
                      <span className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        {u.full_name_ar ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="text-sm font-mono" style={{ color: "var(--color-ink-muted)", direction: "ltr" }}>
                    {u.email}
                  </td>
                  <td>
                    <span className="badge" style={{ background: c.bg, color: c.color }}>{u.role}</span>
                  </td>
                  <td className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                    {(u as any).tenants?.name_ar ?? (u as any).tenants?.name ?? "—"}
                  </td>
                  <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {u.last_sign_in
                      ? new Date(u.last_sign_in).toLocaleDateString("ar-SA")
                      : "لم يدخل بعد"}
                  </td>
                  <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {new Date(u.created_at).toLocaleDateString("ar-SA")}
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
