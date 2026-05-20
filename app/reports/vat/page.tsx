"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt  = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n);

export default function VatReportPage() {
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
      { "البند": "المبيعات الخاضعة للضريبة",  "المبلغ (ر.س)": s.taxable_sales },
      { "البند": "ضريبة القيمة المضافة المحصّلة", "المبلغ (ر.س)": s.vat_collected },
      { "البند": "إجمالي المبيعات",            "المبلغ (ر.س)": s.total_sales },
      { "البند": "───", "المبلغ (ر.س)": "" },
      { "البند": "المشتريات الخاضعة للضريبة",  "المبلغ (ر.س)": s.taxable_purchases },
      { "البند": "ضريبة القيمة المضافة المدفوعة", "المبلغ (ر.س)": s.vat_paid },
      { "البند": "إجمالي المشتريات",           "المبلغ (ر.س)": s.total_purchases },
      { "البند": "───", "المبلغ (ر.س)": "" },
      { "البند": "صافي الضريبة المستحقة",      "المبلغ (ر.س)": s.net_vat },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 36 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `الضريبة ${from} - ${to}`);
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
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>تقرير ضريبة القيمة المضافة</h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
            الإقرار الضريبي · 15% ضريبة القيمة المضافة (ZATCA)
          </p>
        </div>
        <div className="flex gap-2">
          {data && (
            <button className="btn btn-outline" onClick={exportExcel}
              style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span className="font-arabic">تصدير Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Date range picker */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>من</label>
          <input className="input font-mono" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 155 }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>إلى</label>
          <input className="input font-mono" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 155 }} />
        </div>
        <button className="btn btn-gold" onClick={load} disabled={loading}>
          <span className="font-arabic">{loading ? "جارٍ التحميل..." : "تحديث"}</span>
        </button>

        {/* Quick range buttons */}
        <div className="flex gap-1 mr-auto p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
          {[
            { label: "هذا الشهر", action: () => { const d = now; setFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`); setTo(d.toISOString().split("T")[0]); } },
            { label: "الشهر الماضي", action: () => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); setFrom(d.toISOString().split("T")[0]); setTo(e.toISOString().split("T")[0]); } },
            { label: "هذا الربع", action: () => { const q = Math.floor(now.getMonth()/3); const s2 = new Date(now.getFullYear(), q*3, 1); setFrom(s2.toISOString().split("T")[0]); setTo(now.toISOString().split("T")[0]); } },
          ].map((b) => (
            <button key={b.label} className="px-3 py-1.5 rounded-md font-arabic text-xs"
              style={{ color: "var(--color-ink-muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => { b.action(); setTimeout(load, 100); }}>{b.label}</button>
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
                <span className="text-xl">📤</span> المبيعات
              </h2>
              {[
                ["عدد الفواتير",               s.orders_count,      false],
                ["المبيعات قبل الضريبة",       fmt(s.taxable_sales) + " ر.س",   false],
                ["ضريبة القيمة المضافة المحصّلة", fmt(s.vat_collected) + " ر.س", true],
                ["إجمالي المبيعات (شامل الضريبة)", fmt(s.total_sales) + " ر.س", false],
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
                <span className="text-xl">📥</span> المشتريات
              </h2>
              {[
                ["عدد أوامر الشراء",              s.purchases_count,          false],
                ["المشتريات قبل الضريبة",         fmt(s.taxable_purchases) + " ر.س", false],
                ["ضريبة القيمة المضافة المدفوعة",  fmt(s.vat_paid) + " ر.س",          true],
                ["إجمالي المشتريات (شامل الضريبة)", fmt(s.total_purchases) + " ر.س",  false],
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
                {s.net_vat >= 0 ? "صافي الضريبة المستحقة الدفع" : "ضريبة مستردة"}
              </p>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>
                ضريبة المبيعات ({fmt(s.vat_collected)} ر.س) − ضريبة المشتريات ({fmt(s.vat_paid)} ر.س)
              </p>
            </div>
            <p className="font-mono font-bold text-3xl"
              style={{ color: s.net_vat >= 0 ? "var(--color-red)" : "var(--color-green)", direction: "ltr" }}>
              {s.net_vat >= 0 ? "" : "-"}{fmt(Math.abs(s.net_vat))} ر.س
            </p>
          </div>

          {/* Monthly breakdown */}
          {months.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>التفصيل الشهري</h3>
              </div>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>المبيعات</th>
                    <th>ضريبة المبيعات</th>
                    <th>المشتريات</th>
                    <th>ضريبة المشتريات</th>
                    <th>الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => {
                    const r = byMonth[m];
                    const net = r.vat_collected - r.vat_paid;
                    return (
                      <tr key={m}>
                        <td className="font-mono text-sm">{m}</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmtK(r.sales)} ر.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-green)" }}>{fmt(r.vat_collected)} ر.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmtK(r.purchases)} ر.س</td>
                        <td className="font-mono text-sm" style={{ direction: "ltr", color: "var(--color-blue)" }}>{fmt(r.vat_paid)} ر.س</td>
                        <td className="font-mono font-bold text-sm" style={{ direction: "ltr", color: net >= 0 ? "var(--color-red)" : "var(--color-green)" }}>
                          {fmt(Math.abs(net))} ر.س {net < 0 ? "✓" : ""}
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
