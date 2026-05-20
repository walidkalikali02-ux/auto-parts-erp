"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const QUICK = [
  { label:"هذا الشهر", f:()=>{ const n=new Date(); return {from:`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`,to:n.toISOString().split("T")[0]}; } },
  { label:"هذا الربع", f:()=>{ const n=new Date(); const q=Math.floor(n.getMonth()/3); const s=new Date(n.getFullYear(),q*3,1); return {from:s.toISOString().split("T")[0],to:n.toISOString().split("T")[0]}; } },
  { label:"هذا العام",  f:()=>{ const n=new Date(); return {from:`${n.getFullYear()}-01-01`,to:n.toISOString().split("T")[0]}; } },
  { label:"العام الماضي", f:()=>{ const n=new Date(); return {from:`${n.getFullYear()-1}-01-01`,to:`${n.getFullYear()-1}-12-31`}; } },
];

export default function ProfitPage() {
  const now = new Date();
  const [from,    setFrom]    = useState(`${now.getFullYear()}-01-01`);
  const [to,      setTo]      = useState(now.toISOString().split("T")[0]);
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/reports/profit?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const s = data.summary;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { "البند":"إجمالي الإيرادات",       "المبلغ (ر.س)": s.total_revenue },
      { "البند":"تكلفة البضاعة المباعة",  "المبلغ (ر.س)": s.total_cogs },
      { "البند":"الربح الإجمالي",          "المبلغ (ر.س)": s.gross_profit },
      { "البند":"هامش الربح %",            "المبلغ (ر.س)": s.gross_margin_pct },
    ]), "الملخص");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.by_category??[]).map((c:any)=>({ "الفئة":c.name, "الإيراد":c.revenue, "التكلفة":c.cogs, "الربح الإجمالي":c.gross_profit, "هامش %":c.margin_pct }))
    ), "بحسب الفئة");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      (data.monthly??[]).map((m:any)=>({ "الشهر":m.month, "الإيراد":m.revenue, "التكلفة":m.cogs, "الربح":m.gross_profit }))
    ), "شهري");
    XLSX.writeFile(wb, `profit-report-${from}-${to}.xlsx`);
  }

  const s = data?.summary;
  const chartData = (data?.monthly ?? []).map((m: any) => ({
    month: m.month,
    إيراد: m.revenue,
    تكلفة: m.cogs,
    ربح: m.gross_profit,
  }));

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color:"var(--color-ink)" }}>تقرير الأرباح والخسائر</h1>
          <p className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>الإيراد · تكلفة البضاعة · الربح الإجمالي · الهامش</p>
        </div>
        <div className="flex gap-2">
          {data && (
            <button className="btn btn-outline" onClick={exportExcel} style={{ color:"var(--color-green)", borderColor:"var(--color-green)" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span className="font-arabic">تصدير Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>من</label>
          <input className="input font-mono" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} style={{ width:155 }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>إلى</label>
          <input className="input font-mono" type="date" value={to} onChange={(e)=>setTo(e.target.value)} style={{ width:155 }} />
        </div>
        <button className="btn btn-gold" onClick={load} disabled={loading}><span className="font-arabic">{loading?"...":"تحديث"}</span></button>
        <div className="flex gap-1 p-1 rounded-lg mr-auto" style={{ background:"var(--color-surface)" }}>
          {QUICK.map((q)=>(
            <button key={q.label} className="px-3 py-1.5 rounded-md font-arabic text-xs"
              style={{ color:"var(--color-ink-muted)" }}
              onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.background="#fff"; }}
              onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}
              onClick={()=>{ const {from:f,to:t}=q.f(); setFrom(f); setTo(t); }}>{q.label}</button>
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
          {/* P&L summary */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns:"1fr 1fr 1fr" }}>
            {/* Revenue box */}
            <div className="card p-5" style={{ borderTop:"3px solid var(--color-green)" }}>
              <p className="font-arabic text-xs font-semibold mb-3" style={{ color:"var(--color-ink-muted)" }}>📤 إجمالي الإيرادات</p>
              <p className="font-mono font-bold text-2xl" style={{ color:"var(--color-green)", direction:"ltr" }}>{fmt(s.total_revenue)} ر.س</p>
            </div>
            {/* COGS box */}
            <div className="card p-5" style={{ borderTop:"3px solid var(--color-red)" }}>
              <p className="font-arabic text-xs font-semibold mb-3" style={{ color:"var(--color-ink-muted)" }}>📦 تكلفة البضاعة المباعة</p>
              <p className="font-mono font-bold text-2xl" style={{ color:"var(--color-red)", direction:"ltr" }}>{fmt(s.total_cogs)} ر.س</p>
            </div>
            {/* Gross profit */}
            <div className="card p-5" style={{ background:"var(--color-gold-bg)", borderTop:"3px solid var(--color-gold)" }}>
              <p className="font-arabic text-xs font-semibold mb-1" style={{ color:"var(--color-ink-muted)" }}>💹 الربح الإجمالي</p>
              <p className="font-mono font-bold text-2xl" style={{ color:"var(--color-gold)", direction:"ltr" }}>{fmt(s.gross_profit)} ر.س</p>
              <p className="font-mono font-bold text-base mt-1" style={{ color:"var(--color-ink-muted)" }}>هامش {s.gross_margin_pct}%</p>
            </div>
          </div>

          {/* Visual P&L breakdown */}
          <div className="card p-5 mb-6">
            <h3 className="font-arabic font-semibold mb-1" style={{ color:"var(--color-ink)" }}>تحليل الربحية</h3>
            <p className="font-arabic text-xs mb-4" style={{ color:"var(--color-ink-muted)" }}>الإيراد = تكلفة + ربح</p>
            <div className="h-8 rounded-xl overflow-hidden flex mb-3">
              <div style={{ width:`${s.total_revenue>0?(s.total_cogs/s.total_revenue)*100:0}%`, background:"var(--color-red)", transition:"width 0.4s", minWidth:4 }} />
              <div style={{ flex:1, background:"var(--color-green)" }} />
            </div>
            <div className="flex gap-6">
              {[
                ["تكلفة البضاعة", s.total_cogs, "var(--color-red)", s.total_revenue>0?(s.total_cogs/s.total_revenue*100).toFixed(1):0],
                ["الربح الإجمالي", s.gross_profit, "var(--color-green)", s.gross_margin_pct],
              ].map(([k,v,c,pct])=>(
                <div key={k as string} className="flex items-center gap-2">
                  <div style={{ width:10,height:10,borderRadius:2,background:c as string }} />
                  <span className="font-arabic text-sm" style={{ color:"var(--color-ink-2)" }}>{k}</span>
                  <span className="font-mono text-sm" style={{ color:c as string, direction:"ltr" }}>{fmt(v as number)} ر.س ({pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          {chartData.length > 0 && (
            <div className="card p-5 mb-6">
              <h3 className="font-arabic font-semibold mb-4" style={{ color:"var(--color-ink)" }}>الأرباح الشهرية</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top:4,right:8,left:0,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:"#999" }} />
                  <YAxis tick={{ fontSize:10, fill:"#999" }} width={52} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v} />
                  <Tooltip contentStyle={{ fontFamily:"monospace", fontSize:11 }} formatter={(v:number)=>[`${fmt(v)} ر.س`,""]} />
                  <Legend wrapperStyle={{ fontFamily:"Cairo,sans-serif", fontSize:12 }} />
                  <Bar dataKey="إيراد" fill="#16A34A" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="تكلفة" fill="#DC2626" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="ربح"   fill="#B5892A" radius={[3,3,0,0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By category */}
          {data.by_category?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4" style={{ borderBottom:"1px solid var(--color-border-light)" }}>
                <h3 className="font-arabic font-semibold" style={{ color:"var(--color-ink)" }}>الربحية بحسب الفئة</h3>
              </div>
              <table className="erp-table">
                <thead>
                  <tr><th>الفئة</th><th>الإيراد</th><th>التكلفة</th><th>الربح الإجمالي</th><th>الهامش %</th></tr>
                </thead>
                <tbody>
                  {data.by_category.map((c:any)=>(
                    <tr key={c.name}>
                      <td className="font-arabic text-sm font-medium">{c.name}</td>
                      <td className="font-mono text-sm" style={{ direction:"ltr" }}>{fmt(c.revenue)} ر.س</td>
                      <td className="font-mono text-sm" style={{ direction:"ltr", color:"var(--color-red)" }}>{fmt(c.cogs)} ر.س</td>
                      <td className="font-mono font-bold text-sm" style={{ direction:"ltr", color: c.gross_profit>0?"var(--color-green)":"var(--color-red)" }}>
                        {fmt(c.gross_profit)} ر.س
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full flex-1" style={{ background:"var(--color-border)", maxWidth:80 }}>
                            <div className="h-full rounded-full" style={{ width:`${Math.min(100,Math.max(0,c.margin_pct))}%`, background: c.margin_pct>20?"var(--color-green)":c.margin_pct>0?"var(--color-amber)":"var(--color-red)" }} />
                          </div>
                          <span className="font-mono text-xs" style={{ color:"var(--color-ink-muted)" }}>{c.margin_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
