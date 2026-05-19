"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  sent:      { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مُرسل" },
  accepted:  { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "مقبول" },
  rejected:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "مرفوض" },
  expired:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "منتهي الصلاحية" },
  converted: { bg: "var(--color-gold-bg)",   color: "var(--color-gold)",      label: "تحوّل لطلب" },
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("quotes")
      .select("*, customers(name, name_ar)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    setQuotes(data ?? []);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2 });

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>عروض الأسعار</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${quotes.length} عرض`}
          </p>
        </div>
        <Link href="/quotes/new" className="btn btn-primary">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
          <span className="font-arabic">عرض سعر جديد</span>
        </Link>
      </div>

      <div className="card p-4 mb-6 flex gap-3">
        <select className="input" style={{ width: "auto", minWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">📄</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد عروض أسعار</p>
            <Link href="/quotes/new" className="btn btn-primary"><span className="font-arabic">إنشاء عرض سعر</span></Link>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>رقم العرض</th><th>العميل</th><th>الحالة</th><th>صالح حتى</th><th>الإجمالي</th><th></th></tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => {
                const s = statusMap[q.status] ?? statusMap.draft;
                const expired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === "sent";
                return (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/quotes/${q.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: "var(--color-gold)" }}>
                        #{q.quote_number}
                      </Link>
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                      {q.customers?.name_ar ?? q.customers?.name ?? "—"}
                    </td>
                    <td>
                      <span className="badge" style={{ background: expired ? "var(--color-amber-bg)" : s.bg, color: expired ? "var(--color-amber)" : s.color }}>
                        {expired ? "منتهي" : s.label}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: q.valid_until && new Date(q.valid_until) < new Date() ? "var(--color-red)" : "var(--color-ink-muted)" }}>
                      {q.valid_until ? new Date(q.valid_until).toLocaleDateString("ar-SA") : "—"}
                    </td>
                    <td className="font-mono font-bold text-sm" style={{ color: "var(--color-ink)" }}>
                      {fmt(q.total)} ر.س
                    </td>
                    <td>
                      <Link href={`/quotes/${q.id}`} className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }}>
                        <span className="font-arabic">عرض</span>
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
