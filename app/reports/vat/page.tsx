"use client";
import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt  = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: number, locale: string) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n, locale);

export default function VatReportPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const now = new Date();
  const [from,    setFrom]    = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [to,      setTo]      = useState(now.toISOString().split("T")[0]);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/reports/vat?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function exportExcel() {
    if (!data) return;
    const s = data.summary;
    const rows = [
      { [t("table.item", language)]: t("report.vat.taxable_sales", language), [t("table.value", language)]: s.taxable_sales },
      { [t("table.item", language)]: t("report.vat.vat_collected", language), [t("table.value", language)]: s.vat_collected },
      { [t("table.item", language)]: t("report.vat.total_sales", language), [t("table.value", language)]: s.total_sales },
      { [t("table.item", language)]: "───", [t("table.value", language)]: "" },
      { [t("table.item", language)]: t("report.vat.taxable_purchases", language), [t("table.value", language)]: s.taxable_purchases },
      { [t("table.item", language)]: t("report.vat.vat_paid", language), [t("table.value", language)]: s.vat_paid },
      { [t("table.item", language)]: t("report.vat.total_purchases", language), [t("table.value", language)]: s.total_purchases },
      { [t("table.item", language)]: "───", [t("table.value", language)]: "" },
      { [t("table.item", language)]: t("report.vat.net_vat_due", language), [t("table.value", language)]: s.net_vat },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 36 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${t("report.vat.sheet_name", language)} ${from} - ${to}`);
    XLSX.writeFile(wb, `vat-return-${from}-${to}.xlsx`);
  }

  const s = data?.summary;
  const byMonth = data?.by_month ?? {};
  const months = Object.keys(byMonth).sort();

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>{t("report.vat.title", language)}</h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
            {t("report.vat.subtitle", language)}
          </p>
        </div>
        <div className="flex gap-2">
          {data && (
            <button className="btn btn-outline" onClick={exportExcel}
              style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span className="font-arabic">{t("action.export", language)} Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Date range picker */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{t("filter.from", language)}</label>
          <input className="input font-mono" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 155 }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{t("filter.to", language)}</label>
          <input className="input font-mono" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 155 }} />
        </div>
        <button className="btn btn-gold" onClick={load} disabled={loading}>
          <span className="font-arabic">{loading ? "جارٍ التحميل..." : t("action.refresh", language)}</span>
        </button>

        {/* Quick range buttons */}
        <div className="flex gap-1 mr-auto p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {[
            { labelKey: "filter.this_month", action: () => { const d = now; setFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`); setTo(d.toISOString().split("T")[0]); } },
            { labelKey: "filter.last_month", action: () => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); setFrom(d.toISOString().split("T")[0]); setTo(e.toISOString().split("T")[0]); } },
            { labelKey: "filter.this_quarter", action: () => { const q = Math.floor(now.getMonth()/3); const s2 = new Date(now.getFullYear(), q*3, 1); setFrom(s2.toISOString().split("T")[0]); setTo(now.toISOString().split("T")[0]); } },
          ].map((b) => (
            <button key={b.labelKey} className="px-3 py-1.5 rounded-md font-arabic text-xs"
              style={{ color: "var(--color-ink-muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => { b.action(); setTimeout(load, 100); }}>{t(b.labelKey, language)}</button>
          ))}
        </div>
      </div>

      {s && (
        <>
          {/* Main VAT boxes */}
          <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Sales box */}
            <div className="card p-6" style={{ borderTop: "3px solid var(--color-green)" }}>
              <h2 className="font-arabic font-semibold mb-5 flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
                <span className="text-xl">📤</span> {t("report.vat.sales", language)}
              </h2>
              {[
                [t("report.vat.invoice_count", language),               s.orders_count,      false],
                [t("report.vat.sales_before_tax", language),            fmt(s.taxable_sales, locale) + " ร.س",   false],
                [t("report.vat.vat_collected", language),               fmt(s.vat_collected, locale) + " ร.س", true],
                [t("report.vat.total_sales_inc_tax", language),         fmt(s.total_sales, locale) + " ร.س", false],
              ].map(([k, v, highlight]) => (
                <div key={k as string} className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                  <span className={`font-mono font-${highlight ? "bold" : "medium"} text-sm`}
                    style={{ direction: "ltr", color: highlight ? "var(--color-green)" : "var(--color-ink)" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Purchases box */}
            <div className="card p-6" style={{ borderTop: "3px solid var(--color-blue)" }}>
              <h2 className="font-arabic font-semibold mb-5 flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
                <span className="text-xl">📥</span> {t("report.vat.purchases", language)}
              </h2>
              {[
                [t("report.vat.po_count", language),                    s.purchases_count,          false],
                [t("report.vat.purchases_before_tax", language),         fmt(s.taxable_purchases, locale) + " ร.س", false],
                [t("report.vat.vat_paid", language),                    fmt(s.vat_paid, locale) + " ร.س",          true],
                [t("report.vat.total_purchases_inc_tax", language),      fmt(s.total_purchases, locale) + " ร.س",  false],
              ].map(([k, v, highlight]) => (
                <div key={k as string} className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                  <span className={`font-mono font-${highlight ? "bold" : "medium"} text-sm`}
                    style={{ direction: "ltr", color: highlight ? "var(--color-blue)" : "var(--color-ink)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Net VAT payable */}
          <div className="card p-6 mb-6 flex items-center justify-between"
            style={{ background: s.net_vat >= 0 ? "var(--color-red-bg)" : "var(--color-green-bg)", border: `1px solid ${s.net_vat >= 0 ? "var(--color-red)" : "var(--color-green)"}22` }}>
            <div>
              <p className="font-arabic text-sm font-semibold mb-1" style={{ color: "var(--color-ink-muted)" }}>
                {s.net_vat >= 0 ? t("report.vat.net_vat_payable", language) : t("report.vat.vat_refund", language)}
              </p>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>
                {t("report.vat.calculation_formula", language, { vat_collected: fmt(s.vat_collected, locale), vat_paid: fmt(s.vat_paid, locale) })}
              </p>
            </div>
            <p className="font-mono font-bold text-3xl"
              style={{ color: s.net_vat >= 0 ? "var(--color-red)" : "var(--color-green)", direction: "ltr" }}>
              {s.net_vat >= 0 ? "" : "-"}{fmt(Math.abs(s.net_vat), locale)} ร.س
            </p>
          </div>

          {/* Monthly breakdown */}
          {months.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>{t("report.vat.monthly_breakdown", language)}</h3>
              </div>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>{t("table.month", language)}</th>
                    <th>{t("report.vat.sales", language)}</th>
                    <th>{t("report.vat.sales_tax", language)}</th>
                    <th>{t("report.vat.purchases", language)}</th>
                    <th>{t("report.vat.purchases_tax", language)}</th>
                    <th>{t("report.vat.net", language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => {
                    const r = byMonth[m];
                    const net = r.vat_collected - r.vat_paid;
                    return (
                      <tr key={m}>
                        <td className="font-mono text-sm">{m}</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmtK(r.sales, locale)} ร.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-green)" }}>{fmt(r.vat_collected, locale)} ร.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmtK(r.purchases, locale)} ร.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-blue)" }}>{fmt(r.vat_paid, locale)} ร.س</td>
                        <td className="font-mono font-bold text-sm" style={{ direction: "ltr", color: net >= 0 ? "var(--color-red)" : "var(--color-green)" }}>
                          {fmt(Math.abs(net), locale)} ร.س {net < 0 ? "✓" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
