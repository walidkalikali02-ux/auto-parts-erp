"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const typeMap: Record<string, { label: string; bg: string; color: string }> = {
  retail:    { label: "تجزئة",   bg: "var(--color-blue-bg)",  color: "var(--color-blue)"  },
  wholesale: { label: "جملة",    bg: "var(--color-gold-bg)",  color: "var(--color-gold)"  },
  workshop:  { label: "ورشة",    bg: "var(--color-green-bg)", color: "var(--color-green)" },
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("customers")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      q = q.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (type) q = q.eq("customer_type", type);

    const { data } = await q;
    setCustomers(data ?? []);
    setLoading(false);
  }, [search, type]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            العملاء
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${customers.length} عميل`}
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">إضافة عميل</span>
        </button>
      </div>

      <div className="card p-4 mb-6 flex gap-3">
        <div className="flex-1 relative">
          <svg
            width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute"
            style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="input"
            style={{ paddingRight: 36 }}
            placeholder="بحث بالاسم أو الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 140 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="retail">تجزئة</option>
          <option value="wholesale">جملة</option>
          <option value="workshop">ورشة</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">👥</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا يوجد عملاء</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>الجوال</th>
                <th>البريد</th>
                <th>المدينة</th>
                <th>الرصيد</th>
                <th>حد الائتمان</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const t = typeMap[c.customer_type] ?? typeMap.retail;
                return (
                  <tr key={c.id}>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                        {c.name_ar ?? c.name}
                      </p>
                      {c.name_ar && (
                        <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{c.name}</p>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {c.phone ?? "—"}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)", direction: "ltr" }}>
                      {c.email ?? "—"}
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {c.city ?? "—"}
                    </td>
                    <td>
                      <span
                        className="font-mono text-sm font-semibold"
                        style={{ color: c.balance < 0 ? "var(--color-red)" : "var(--color-ink)" }}
                      >
                        {Number(c.balance).toLocaleString("ar-SA")} ر.س
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {Number(c.credit_limit).toLocaleString("ar-SA")} ر.س
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(c.created_at).toLocaleDateString("ar-SA")}
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
