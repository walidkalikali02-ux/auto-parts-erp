"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      q = q.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data } = await q;
    setSuppliers(data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
            الموردون
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${suppliers.length} مورد`}
          </p>
        </div>
        <button className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">إضافة مورد</span>
        </button>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative" style={{ maxWidth: 400 }}>
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
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🏭</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا يوجد موردون</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>اسم المورد</th>
                <th>جهة الاتصال</th>
                <th>الجوال</th>
                <th>البريد</th>
                <th>المدينة</th>
                <th>الدولة</th>
                <th>شروط الدفع</th>
                <th>العملة</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                      {s.name_ar ?? s.name}
                    </p>
                    {s.name_ar && (
                      <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{s.name}</p>
                    )}
                  </td>
                  <td className="text-sm" style={{ color: "var(--color-ink-2)" }}>
                    {s.contact_name ?? "—"}
                  </td>
                  <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                    {s.phone ?? "—"}
                  </td>
                  <td className="text-sm" style={{ color: "var(--color-ink-muted)", direction: "ltr" }}>
                    {s.email ?? "—"}
                  </td>
                  <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {s.city ?? "—"}
                  </td>
                  <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {s.country}
                  </td>
                  <td>
                    <span className="badge" style={{ background: "var(--color-blue-bg)", color: "var(--color-blue)" }}>
                      {s.payment_terms} يوم
                    </span>
                  </td>
                  <td className="font-mono text-sm" style={{ color: "var(--color-gold)" }}>
                    {s.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
