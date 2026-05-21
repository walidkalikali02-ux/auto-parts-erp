"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancePage() {
  const { language } = useLanguage();
  const [unpaid,   setUnpaid]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API}/api/payments/unpaid`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUnpaid(await res.json());
      setLoading(false);
    })();
  }, []);

  const totalOutstanding = unpaid.reduce((s, o) => s + o.remaining, 0);
  const overdueCount     = unpaid.filter((o) => o.days_overdue > 7).length;
  const creditCount      = unpaid.filter((o) => o.payment_method === "credit").length;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>{t("finance.title", language)}</h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
            {t("finance.subtitle", language)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: t("finance.total_due", language),   value: `${fmt(totalOutstanding)} ر.س`, accent: "var(--color-red)",   emoji: "💸" },
          { label: t("finance.overdue_orders", language),      value: overdueCount,                   accent: "var(--color-amber)", emoji: "⏰" },
          { label: t("finance.credit_orders", language),        value: creditCount,                    accent: "var(--color-blue)",  emoji: "📋" },
          { label: t("finance.total_orders", language),   value: unpaid.length,                  accent: "var(--color-ink-muted)", emoji: "📊" },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3" style={{ borderRight: `3px solid ${k.accent}` }}>
            <span className="text-2xl">{k.emoji}</span>
            <div>
              <p className="font-mono font-bold text-lg" style={{ color: "var(--color-ink)", direction: "ltr" }}>{k.value}</p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : unpaid.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl opacity-20">✅</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>{t("finance.no_pending", language)}</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>{t("table.order_number", language)}</th>
                <th>{t("table.customer", language)}</th>
                <th>{t("table.date", language)}</th>
                <th>{t("table.days_overdue", language)}</th>
                <th>{t("table.total", language)}</th>
                <th>{t("finance.amount_paid", language)}</th>
                <th>{t("finance.amount_remaining", language)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map((o) => {
                const overdue = o.days_overdue > 7;
                return (
                  <tr key={o.id} style={{ background: overdue ? "var(--color-red-bg)" : undefined }}>
                    <td>
                      <Link href={`/orders/sales/${o.id}`}
                        className="font-mono text-xs font-semibold hover:underline"
                        style={{ color: "var(--color-gold)" }}>
                        #{o.order_number}
                      </Link>
                    </td>
                    <td>
                      <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {o.customers?.name_ar ?? t("payment.method.cash", language)}
                      </p>
                      {o.customers?.phone && (
                        <p className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>{o.customers.phone}</p>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(o.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: overdue ? "var(--color-red-bg)" : "var(--color-amber-bg)",
                        color:      overdue ? "var(--color-red)"    : "var(--color-amber)",
                      }}>
                        {o.days_overdue} {t("finance.days_overdue_suffix", language)}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                      {fmt(o.total)} ر.س
                    </td>
                    <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-green)" }}>
                      {fmt(o.total_paid)} ر.س
                    </td>
                    <td className="font-mono font-bold text-sm" style={{ direction: "ltr", color: "var(--color-red)" }}>
                      {fmt(o.remaining)} ر.س
                    </td>
                    <td>
                      <Link href={`/orders/sales/${o.id}`} className="btn btn-ghost text-xs" style={{ padding: "4px 10px" }}>
                        <span className="font-arabic">{t("action.pay", language)}</span>
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
