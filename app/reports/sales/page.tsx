"use client";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL;
const COLORS = ["#B5892A","#2563EB","#16A34A","#DC2626","#7C3AED","#EA580C","#0891B2"];

// Helper functions for payment and order status labels
function getMethodLabel(method: string, language: "ar" | "en"): string {
  const methodMap: Record<string, Record<"ar"|"en", string>> = {
    cash: { ar: "نقدي", en: "Cash" },
    card: { ar: "بطاقة", en: "Card" },
    transfer: { ar: "تحويل", en: "Transfer" },
    credit: { ar: "آجل", en: "Credit" },
  };
  return methodMap[method]?.[language] ?? method;
}

function getStatusLabel(status: string, language: "ar" | "en"): string {
  const statusMap: Record<string, Record<"ar"|"en", string>> = {
    confirmed: { ar: "مؤكد", en: "Confirmed" },
    delivered: { ar: "مُسلَّم", en: "Delivered" },
    returned: { ar: "مُرتجع", en: "Returned" },
    draft: { ar: "مسودة", en: "Draft" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
  };
  return statusMap[status]?.[language] ?? status;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt  = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number, locale: string) => n.toLocaleString(locale);

function getQuickDateRanges(language: "ar" | "en") {
  return [
    { labelKey: "filter.today", from: () => { const d=new Date().toISOString().split("T")[0]; return {from:d,to:d}; } },
    { labelKey: "filter.this_week", from: () => { const n=new Date(); const s=new Date(n); s.setDate(n.getDate()-n.getDay()); return {from:s.toISOString().split("T")[0],to:n.toISOString().split("T")[0]}; } },
    { labelKey: "filter.this_month", from: () => { const n=new Date(); return {from:`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`,to:n.toISOString().split("T")[0]}; } },
    { labelKey: "filter.this_quarter", from: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3); const s=new Date(n.getFullYear(),q*3,1); return {from:s.toISOString().split("T")[0],to:n.toISOString().split("T")[0]}; } },
    { labelKey: "filter.this_year", from: () => { const n=new Date(); return {from:`${n.getFullYear()}-01-01`,to:n.toISOString().split("T")[0]}; } },
  ];
}

export default function SalesReportPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";
  const now = new Date();
  const [from,    setFrom]    = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
  const [to,      setTo]      = useState(now.toISOString().split("T")[0]);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<"overview"|"orders"|"customers"|"categories">("overview");
  const quickRanges = getQuickDateRanges(language);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/reports/sales?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function applyQuick(q: typeof quickRanges[0]) {
    const { from: f, to: t } = q.from();
    setFrom(f); setTo(t);
  }

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    // Orders sheet
    const ordersData = (data.orders ?? []).map((o: any) => ({
      [t("table.order_number", language)]:  o.order_number,
      [t("table.customer", language)]:        o.customers?.name_ar ?? "نقدي",
      [t("table.date", language)]:            new Date(o.created_at).toLocaleDateString(locale),
      [t("table.payment_method", language)]: getMethodLabel(o.payment_method, language),
      [t("table.status", language)]:          getStatusLabel(o.status, language),
      [t("table.subtotal", language)]:        Number(o.subtotal).toFixed(2),
      [t("table.tax", language)]:             Number(o.tax_amount).toFixed(2),
      [t("table.total", language)]:           Number(o.total).toFixed(2),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), t("report.sales.sheet_orders", language));
    // Summary
    const s = data.summary;
    const summaryData = [
      { [t("table.item", language)]: t("report.sales.total_orders", language), [t("table.value", language)]: s.total_orders },
      { [t("table.item", language)]: t("report.sales.total_revenue", language), [t("table.value", language)]: s.total_revenue },
      { [t("table.item", language)]: t("report.sales.total_tax", language), [t("table.value", language)]: s.total_vat },
      { [t("table.item", language)]: t("report.sales.total_returns", language), [t("table.value", language)]: s.total_returns },
      { [t("table.item", language)]: t("report.sales.net_revenue", language), [t("table.value", language)]: s.net_revenue },
      { [t("table.item", language)]: t("report.sales.avg_order", language), [t("table.value", language)]: s.avg_order },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), t("report.sales.sheet_summary", language));
    XLSX.writeFile(wb, `sales-report-${from}-${to}.xlsx`);
  }

  const s = data?.summary;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>{t("report.sales", language)}</h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{t("report.sales.subtitle", language)}</p>
        </div>
        {data && (
          <button className="btn btn-outline" onClick={exportExcel} style={{ color:"var(--color-green)", borderColor:"var(--color-green)" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="font-arabic">{t("action.export", language)} Excel</span>
          </button>
        )}
      </div>

      {/* Date filter */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("filter.from", language)}</label>
          <input className="input font-mono" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} style={{ width:155 }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("filter.to", language)}</label>
          <input className="input font-mono" type="date" value={to} onChange={(e)=>setTo(e.target.value)} style={{ width:155 }} />
        </div>
        <button className="btn btn-gold" onClick={load} disabled={loading}>
          <span className="font-arabic">{loading ? "..." : t("action.refresh", language)}</span>
        </button>
        <div className="flex gap-1 p-1 rounded-lg mr-auto" style={{ background:"var(--color-surface)" }}>
          {quickRanges.map((q) => (
            <button key={q.labelKey} className="px-3 py-1.5 rounded-md font-arabic text-xs transition-all"
              style={{ color:"var(--color-ink-muted)" }}
              onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.background="#fff"; }}
              onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}
              onClick={()=>applyQuick(q)}>{t(q.labelKey, language)}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin" width="28" height="28" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {s && !loading && (
        <>
          {/* KPIs */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
            {[
              { labelKey:"report.sales.total_orders",   value: fmtN(s.total_orders, locale),       accent:"var(--color-blue)",       emoji:"📋" },
              { labelKey:"report.sales.total_revenue",  value: fmt(s.total_revenue, locale)+" ر.س", accent:"var(--color-green)",      emoji:"💰" },
              { labelKey:"report.sales.total_tax",      value: fmt(s.total_vat, locale)+" ر.س",     accent:"var(--color-amber)",      emoji:"📊" },
              { labelKey:"report.sales.total_returns",  value: fmt(s.total_returns, locale)+" ر.س", accent:"var(--color-red)",        emoji:"↩️" },
              { labelKey:"report.sales.net_revenue",    value: fmt(s.net_revenue, locale)+" ر.س",   accent:"var(--color-gold)",       emoji:"✅" },
              { labelKey:"report.sales.avg_order",      value: fmt(s.avg_order, locale)+" ر.س",     accent:"var(--color-ink-muted)",  emoji:"📈" },
            ].map((k) => (
              <div key={k.labelKey} className="card p-4" style={{ borderTop:`2px solid ${k.accent}` }}>
                <div className="text-xl mb-2">{k.emoji}</div>
                <p className="font-mono font-bold text-base mb-0.5" style={{ color:"var(--color-ink)", direction:"ltr", textAlign:"right" }}>{k.value}</p>
                <p className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{t(k.labelKey, language)}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background:"var(--color-surface)", width:"fit-content" }}>
            {([["overview",t("report.sales.tab_overview", language)],["orders",t("report.sales.tab_orders", language)],["customers",t("report.sales.tab_customers", language)],["categories",t("report.sales.tab_categories", language)]] as const).map(([v,l])=>(
              <button key={v} className="px-4 py-2 rounded-lg font-arabic text-sm transition-all"
                style={{ background:tab===v?"#fff":"transparent", color:tab===v?"var(--color-ink)":"var(--color-ink-muted)", boxShadow:tab===v?"0 1px 4px rgba(0,0,0,.1)":"none" }}
                onClick={()=>setTab(v)}>{l}</button>
            ))}
          </div>

          {/* Overview */}
          {tab==="overview" && (
            <div className="grid gap-6">
              {/* Daily trend */}
              {data.daily_trend?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>{t("report.sales.daily_trend", language)}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.daily_trend} margin={{ top:4,right:8,left:0,bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize:10, fill:"#999" }}
                        tickFormatter={(d)=>new Date(d).toLocaleDateString(locale,{month:"short",day:"numeric"})} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize:10, fill:"#999" }} width={44}
                        tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v} />
                      <Tooltip
                        formatter={(v:number)=>[`${fmt(v, locale)} ر.س`,t("report.sales.revenue", language)]}
                        labelFormatter={(d)=>new Date(d).toLocaleDateString(locale,{weekday:"short",month:"short",day:"numeric"})}
                        contentStyle={{ fontFamily:"monospace", fontSize:11 }} />
                      <Bar dataKey="revenue" fill="#B5892A" radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid gap-6" style={{ gridTemplateColumns:"1fr 1fr" }}>
                {/* By payment method */}
                <div className="card p-5">
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>{t("report.sales.by_payment_method", language)}</h3>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={Object.entries(data.by_method).map(([k,v]:any)=>({ name:getMethodLabel(k, language), value:v.amount }))}
                          dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={32} strokeWidth={2}>
                          {Object.keys(data.by_method).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v:number)=>[`${fmt(v, locale)} ร.س`,""]} contentStyle={{ fontSize:11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(data.by_method).map(([k,v]:any, i)=>(
                        <div key={k} className="flex items-center gap-2">
                          <div style={{ width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0 }} />
                          <span className="font-arabic text-xs flex-1" style={{ color:"var(--color-ink-2)" }}>{getMethodLabel(k, language)}</span>
                          <span className="font-mono text-xs" style={{ direction:"ltr" }}>{fmt(v.amount, locale)} ร.س</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* By status */}
                <div className="card p-5">
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>{t("report.sales.by_status", language)}</h3>
                  <div className="flex flex-col gap-3">
                    {Object.entries(data.by_status).map(([k,v]:any)=>{
                      const total = Object.values(data.by_status).reduce((a:number,b:any)=>a+b,0) as number;
                      const pct = total>0?(v/total)*100:0;
                      return (
                        <div key={k}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-arabic" style={{ color:"var(--color-ink-2)" }}>{getStatusLabel(k, language)}</span>
                            <span className="font-mono">{v} {t("unit.order", language)}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background:"var(--color-border)" }}>
                            <div className="h-full rounded-full" style={{ width:`${pct}%`, background:"var(--color-gold)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders table */}
          {tab==="orders" && (
            <div className="card overflow-hidden">
              <table className="erp-table">
                <thead>
                  <tr><th>{t("table.order_number", language)}</th><th>{t("table.customer", language)}</th><th>{t("table.date", language)}</th><th>{t("table.payment_method", language)}</th><th>{t("table.status", language)}</th><th>{t("table.total", language)}</th></tr>
                </thead>
                <tbody>
                  {(data.orders??[]).map((o:any)=>(
                    <tr key={o.id}>
                      <td className="font-mono text-xs font-semibold" style={{ color:"var(--color-gold)" }}>#{o.order_number}</td>
                      <td className="font-arabic text-sm">{o.customers?.name_ar??"نقدي"}</td>
                      <td className="text-sm" style={{ color:"var(--color-ink-muted)" }}>{new Date(o.created_at).toLocaleDateString(locale)}</td>
                      <td className="font-arabic text-xs">{getMethodLabel(o.payment_method, language)}</td>
                      <td><span className="badge text-xs">{getStatusLabel(o.status, language)}</span></td>
                      <td className="font-mono text-sm font-semibold" style={{ direction:"ltr" }}>{fmt(o.total, locale)} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top customers */}
          {tab==="customers" && (
            <div className="card overflow-hidden">
              <table className="erp-table">
                <thead><tr><th>#</th><th>{t("table.customer", language)}</th><th>{t("report.sales.order_count", language)}</th><th>{t("report.sales.total_spent", language)}</th><th>{t("report.sales.avg_order", language)}</th></tr></thead>
                <tbody>
                  {(data.top_customers??[]).map((c:any,i:number)=>(
                    <tr key={c.name}>
                      <td className="font-mono text-sm" style={{ color:"var(--color-ink-muted)" }}>{i+1}</td>
                      <td className="font-arabic text-sm font-medium">{c.name}</td>
                      <td className="font-mono text-sm">{c.count}</td>
                      <td className="font-mono font-bold text-sm" style={{ color:"var(--color-gold)", direction:"ltr" }}>{fmt(c.revenue, locale)} ร.س</td>
                      <td className="font-mono text-sm" style={{ direction:"ltr", color:"var(--color-ink-muted)" }}>{fmt(c.revenue/c.count, locale)} ร.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* By category */}
          {tab==="categories" && (
            <div className="grid gap-6" style={{ gridTemplateColumns:"1fr 1fr" }}>
              <div className="card p-5">
                <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>{t("report.sales.by_category", language)}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.by_category??[]} layout="vertical" margin={{ top:4,right:8,left:8,bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:10, fill:"#999" }} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:"#555", fontFamily:"Cairo,sans-serif" }} width={90} />
                    <Tooltip formatter={(v:number)=>[`${fmt(v, locale)} ร.س`,t("report.sales.revenue", language)]} contentStyle={{ fontFamily:"monospace", fontSize:11 }} />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[0,3,3,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card overflow-hidden">
                <table className="erp-table">
                  <thead><tr><th>{t("table.category", language)}</th><th>{t("table.quantity", language)}</th><th>{t("report.sales.revenue", language)}</th></tr></thead>
                  <tbody>
                    {(data.by_category??[]).map((c:any)=>(
                      <tr key={c.name}>
                        <td className="font-arabic text-sm">{c.name}</td>
                        <td className="font-mono text-sm">{fmtN(c.qty, locale)} {t("unit.unit", language)}</td>
                        <td className="font-mono font-bold text-sm" style={{ color:"var(--color-gold)", direction:"ltr" }}>{fmt(c.revenue, locale)} ร.س</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
