"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL;
const COLORS = ["#B5892A","#2563EB","#16A34A","#DC2626","#7C3AED","#EA580C","#0891B2"];

const methodAr: Record<string,string> = { cash:"نقدي", card:"بطاقة", transfer:"تحويل", credit:"آجل" };
const statusAr: Record<string,string> = { confirmed:"مؤكد", delivered:"مُسلَّم", returned:"مُرتجع", draft:"مسودة", cancelled:"ملغي" };

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt  = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number) => n.toLocaleString("ar-SA");

const QUICK = [
  { label: "اليوم",        from: () => { const d=new Date().toISOString().split("T")[0]; return {from:d,to:d}; } },
  { label: "هذا الأسبوع", from: () => { const n=new Date(); const s=new Date(n); s.setDate(n.getDate()-n.getDay()); return {from:s.toISOString().split("T")[0],to:n.toISOString().split("T")[0]}; } },
  { label: "هذا الشهر",   from: () => { const n=new Date(); return {from:`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`,to:n.toISOString().split("T")[0]}; } },
  { label: "هذا الربع",   from: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3); const s=new Date(n.getFullYear(),q*3,1); return {from:s.toISOString().split("T")[0],to:n.toISOString().split("T")[0]}; } },
  { label: "هذا العام",   from: () => { const n=new Date(); return {from:`${n.getFullYear()}-01-01`,to:n.toISOString().split("T")[0]}; } },
];

export default function SalesReportPage() {
  const now = new Date();
  const [from,    setFrom]    = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`);
  const [to,      setTo]      = useState(now.toISOString().split("T")[0]);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState<"overview"|"orders"|"customers"|"categories">("overview");

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

  function applyQuick(q: typeof QUICK[0]) {
    const { from: f, to: t } = q.from();
    setFrom(f); setTo(t);
  }

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    // Orders sheet
    const ordersData = (data.orders ?? []).map((o: any) => ({
      "رقم الطلب":     o.order_number,
      "العميل":         o.customers?.name_ar ?? "نقدي",
      "التاريخ":        new Date(o.created_at).toLocaleDateString("ar-SA"),
      "طريقة الدفع":   methodAr[o.payment_method] ?? o.payment_method,
      "الحالة":         statusAr[o.status] ?? o.status,
      "المجموع قبل الضريبة": Number(o.subtotal).toFixed(2),
      "الضريبة":        Number(o.tax_amount).toFixed(2),
      "الإجمالي":       Number(o.total).toFixed(2),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), "الطلبات");
    // Summary
    const s = data.summary;
    const summaryData = [
      { "البند": "إجمالي الطلبات",   "القيمة": s.total_orders },
      { "البند": "إجمالي الإيرادات", "القيمة": s.total_revenue },
      { "البند": "ضريبة القيمة",     "القيمة": s.total_vat },
      { "البند": "المرتجعات",         "القيمة": s.total_returns },
      { "البند": "صافي الإيراد",     "القيمة": s.net_revenue },
      { "البند": "متوسط الطلب",      "القيمة": s.avg_order },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "الملخص");
    XLSX.writeFile(wb, `sales-report-${from}-${to}.xlsx`);
  }

  const s = data?.summary;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>تقرير المبيعات</h1>
          <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>تحليل مفصّل للمبيعات بحسب الفترة والعميل والفئة</p>
        </div>
        {data && (
          <button className="btn btn-outline" onClick={exportExcel} style={{ color:"var(--color-green)", borderColor:"var(--color-green)" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="font-arabic">تصدير Excel</span>
          </button>
        )}
      </div>

      {/* Date filter */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>من</label>
          <input className="input font-mono" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} style={{ width:155 }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>إلى</label>
          <input className="input font-mono" type="date" value={to} onChange={(e)=>setTo(e.target.value)} style={{ width:155 }} />
        </div>
        <button className="btn btn-gold" onClick={load} disabled={loading}>
          <span className="font-arabic">{loading ? "..." : "تحديث"}</span>
        </button>
        <div className="flex gap-1 p-1 rounded-lg mr-auto" style={{ background:"var(--color-surface)" }}>
          {QUICK.map((q) => (
            <button key={q.label} className="px-3 py-1.5 rounded-md font-arabic text-xs transition-all"
              style={{ color:"var(--color-ink-muted)" }}
              onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.background="#fff"; }}
              onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}
              onClick={()=>applyQuick(q)}>{q.label}</button>
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
              { label:"عدد الطلبات",    value: fmtN(s.total_orders),       accent:"var(--color-blue)",       emoji:"📋" },
              { label:"إجمالي الإيراد", value: fmt(s.total_revenue)+" ر.س", accent:"var(--color-green)",      emoji:"💰" },
              { label:"ضريبة القيمة",   value: fmt(s.total_vat)+" ر.س",     accent:"var(--color-amber)",      emoji:"📊" },
              { label:"المرتجعات",       value: fmt(s.total_returns)+" ر.س", accent:"var(--color-red)",        emoji:"↩️" },
              { label:"صافي الإيراد",   value: fmt(s.net_revenue)+" ر.س",   accent:"var(--color-gold)",       emoji:"✅" },
              { label:"متوسط الطلب",    value: fmt(s.avg_order)+" ر.س",     accent:"var(--color-ink-muted)",  emoji:"📈" },
            ].map((k) => (
              <div key={k.label} className="card p-4" style={{ borderTop:`2px solid ${k.accent}` }}>
                <div className="text-xl mb-2">{k.emoji}</div>
                <p className="font-mono font-bold text-base mb-0.5" style={{ color:"var(--color-ink)", direction:"ltr", textAlign:"right" }}>{k.value}</p>
                <p className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background:"var(--color-surface)", width:"fit-content" }}>
            {([["overview","نظرة عامة"],["orders","الطلبات"],["customers","العملاء"],["categories","الفئات"]] as const).map(([v,l])=>(
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
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>مسار المبيعات اليومي</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.daily_trend} margin={{ top:4,right:8,left:0,bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize:10, fill:"#999" }}
                        tickFormatter={(d)=>new Date(d).toLocaleDateString("ar-SA",{month:"short",day:"numeric"})} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize:10, fill:"#999" }} width={44}
                        tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v} />
                      <Tooltip
                        formatter={(v:number)=>[`${fmt(v)} ر.س`,"الإيراد"]}
                        labelFormatter={(d)=>new Date(d).toLocaleDateString("ar-SA",{weekday:"short",month:"short",day:"numeric"})}
                        contentStyle={{ fontFamily:"monospace", fontSize:11 }} />
                      <Bar dataKey="revenue" fill="#B5892A" radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid gap-6" style={{ gridTemplateColumns:"1fr 1fr" }}>
                {/* By payment method */}
                <div className="card p-5">
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>بحسب طريقة الدفع</h3>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={Object.entries(data.by_method).map(([k,v]:any)=>({ name:methodAr[k]??k, value:v.amount }))}
                          dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={32} strokeWidth={2}>
                          {Object.keys(data.by_method).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v:number)=>[`${fmt(v)} ر.س`,""]} contentStyle={{ fontSize:11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 flex flex-col gap-2">
                      {Object.entries(data.by_method).map(([k,v]:any, i)=>(
                        <div key={k} className="flex items-center gap-2">
                          <div style={{ width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0 }} />
                          <span className="font-arabic text-xs flex-1" style={{ color:"var(--color-ink-2)" }}>{methodAr[k]??k}</span>
                          <span className="font-mono text-xs" style={{ direction:"ltr" }}>{fmt(v.amount)} ر.س</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* By status */}
                <div className="card p-5">
                  <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>بحسب الحالة</h3>
                  <div className="flex flex-col gap-3">
                    {Object.entries(data.by_status).map(([k,v]:any)=>{
                      const total = Object.values(data.by_status).reduce((a:number,b:any)=>a+b,0) as number;
                      const pct = total>0?(v/total)*100:0;
                      return (
                        <div key={k}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-arabic" style={{ color:"var(--color-ink-2)" }}>{statusAr[k]??k}</span>
                            <span className="font-mono">{v} طلب</span>
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
                  <tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>الدفع</th><th>الحالة</th><th>الإجمالي</th></tr>
                </thead>
                <tbody>
                  {(data.orders??[]).map((o:any)=>(
                    <tr key={o.id}>
                      <td className="font-mono text-xs font-semibold" style={{ color:"var(--color-gold)" }}>#{o.order_number}</td>
                      <td className="font-arabic text-sm">{o.customers?.name_ar??"نقدي"}</td>
                      <td className="text-sm" style={{ color:"var(--color-ink-muted)" }}>{new Date(o.created_at).toLocaleDateString("ar-SA")}</td>
                      <td className="font-arabic text-xs">{methodAr[o.payment_method]??o.payment_method}</td>
                      <td><span className="badge text-xs">{statusAr[o.status]??o.status}</span></td>
                      <td className="font-mono text-sm font-semibold" style={{ direction:"ltr" }}>{fmt(o.total)} ر.س</td>
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
                <thead><tr><th>#</th><th>العميل</th><th>عدد الطلبات</th><th>إجمالي الإنفاق</th><th>متوسط الطلب</th></tr></thead>
                <tbody>
                  {(data.top_customers??[]).map((c:any,i:number)=>(
                    <tr key={c.name}>
                      <td className="font-mono text-sm" style={{ color:"var(--color-ink-muted)" }}>{i+1}</td>
                      <td className="font-arabic text-sm font-medium">{c.name}</td>
                      <td className="font-mono text-sm">{c.count}</td>
                      <td className="font-mono font-bold text-sm" style={{ color:"var(--color-gold)", direction:"ltr" }}>{fmt(c.revenue)} ر.س</td>
                      <td className="font-mono text-sm" style={{ direction:"ltr", color:"var(--color-ink-muted)" }}>{fmt(c.revenue/c.count)} ر.س</td>
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
                <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>الإيراد بحسب الفئة</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.by_category??[]} layout="vertical" margin={{ top:4,right:8,left:8,bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:10, fill:"#999" }} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:"#555", fontFamily:"Cairo,sans-serif" }} width={90} />
                    <Tooltip formatter={(v:number)=>[`${fmt(v)} ر.س`,"الإيراد"]} contentStyle={{ fontFamily:"monospace", fontSize:11 }} />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[0,3,3,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card overflow-hidden">
                <table className="erp-table">
                  <thead><tr><th>الفئة</th><th>الكمية</th><th>الإيراد</th></tr></thead>
                  <tbody>
                    {(data.by_category??[]).map((c:any)=>(
                      <tr key={c.name}>
                        <td className="font-arabic text-sm">{c.name}</td>
                        <td className="font-mono text-sm">{fmtN(c.qty)} وحدة</td>
                        <td className="font-mono font-bold text-sm" style={{ color:"var(--color-gold)", direction:"ltr" }}>{fmt(c.revenue)} ر.س</td>
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
