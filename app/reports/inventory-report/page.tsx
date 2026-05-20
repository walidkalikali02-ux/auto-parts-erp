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
const fmtN = (n: number) => n.toLocaleString("ar-SA");

const movTypeAr: Record<string,string> = {
  sale:"بيع", purchase:"شراء", adjustment:"تسوية",
  transfer_in:"تحويل وارد", transfer_out:"تحويل صادر",
  return:"مرتجع",
};

export default function InventoryReportPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [byType,    setByType]    = useState<any>({});
  const [loading,   setLoading]   = useState(true);
  const [movLoading,setMovLoading]= useState(false);
  const [tab,       setTab]       = useState<"valuation"|"movements"|"aging">("valuation");
  const [movFrom,   setMovFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-30);
    return d.toISOString().split("T")[0];
  });
  const [movTo, setMovTo] = useState(new Date().toISOString().split("T")[0]);
  const [movType, setMovType] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory")
        .select("id,quantity,quantity_reserved,reorder_point,location_code,parts(id,part_number,name_ar,price_retail,price_cost,part_categories(name_ar)),warehouses(name_ar)")
        .order("quantity", { ascending: true });
      setInventory(data ?? []);
      setLoading(false);
    })();
  }, []);

  async function loadMovements() {
    setMovLoading(true);
    const token = await getToken();
    const params = new URLSearchParams({ from: movFrom, to: movTo });
    if (movType) params.set("type", movType);
    const res = await fetch(`${API}/api/reports/movements?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setMovements(data.movements ?? []);
      setByType(data.by_type ?? {});
    }
    setMovLoading(false);
  }

  useEffect(() => { if (tab === "movements") loadMovements(); }, [tab]);

  // Valuation stats
  const totalRetailValue = inventory.reduce((s, i) => s + i.quantity * (i.parts?.price_retail ?? 0), 0);
  const totalCostValue   = inventory.reduce((s, i) => s + i.quantity * (i.parts?.price_cost ?? 0), 0);
  const potentialProfit  = totalRetailValue - totalCostValue;
  const outOfStock       = inventory.filter((i) => i.quantity === 0).length;
  const lowStock         = inventory.filter((i) => i.quantity > 0 && i.quantity <= (i.reorder_point ?? 5)).length;

  // Aging: parts with 0 sales (rough proxy: quantity unchanged high)
  const aging = inventory.filter((i) => i.quantity > 20).sort((a, b) => b.quantity - a.quantity).slice(0, 20);

  function exportInventory() {
    const rows = inventory.map((i) => ({
      "رقم القطعة":      i.parts?.part_number ?? "",
      "الاسم":           i.parts?.name_ar ?? "",
      "الفئة":           i.parts?.part_categories?.name_ar ?? "",
      "المستودع":         i.warehouses?.name_ar ?? "",
      "الكمية":           i.quantity,
      "محجوز":            i.quantity_reserved ?? 0,
      "حد الإعادة":      i.reorder_point ?? 0,
      "سعر التكلفة":     (i.parts?.price_cost ?? 0).toFixed(2),
      "سعر البيع":        (i.parts?.price_retail ?? 0).toFixed(2),
      "قيمة بسعر التكلفة": (i.quantity * (i.parts?.price_cost ?? 0)).toFixed(2),
      "قيمة بسعر البيع":  (i.quantity * (i.parts?.price_retail ?? 0)).toFixed(2),
      "الحالة":           i.quantity === 0 ? "نفذ" : i.quantity <= (i.reorder_point ?? 5) ? "منخفض" : "متاح",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [14,28,16,14,10,10,12,14,12,18,18,10].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المخزون");
    XLSX.writeFile(wb, `inventory-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color:"var(--color-ink)" }}>تقرير المخزون</h1>
          <p className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>تقييم المخزون · حركة البضاعة · الأصناف الراكدة</p>
        </div>
        <button className="btn btn-outline" onClick={exportInventory} style={{ color:"var(--color-green)", borderColor:"var(--color-green)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span className="font-arabic">تصدير Excel</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns:"repeat(5,1fr)" }}>
        {[
          { label:"إجمالي الأصناف",      value:fmtN(inventory.length),          accent:"var(--color-blue)",      emoji:"📦" },
          { label:"قيمة بسعر البيع",     value:`${fmt(totalRetailValue)} ر.س`,  accent:"var(--color-green)",     emoji:"💰" },
          { label:"قيمة بسعر التكلفة",   value:`${fmt(totalCostValue)} ر.س`,    accent:"var(--color-ink-muted)", emoji:"🏷️" },
          { label:"الربح المحتمل",       value:`${fmt(potentialProfit)} ر.س`,   accent:"var(--color-gold)",      emoji:"💹" },
          { label:"نفذ / منخفض",         value:`${fmtN(outOfStock)} / ${fmtN(lowStock)}`, accent:"var(--color-red)", emoji:"⚠️" },
        ].map((k)=>(
          <div key={k.label} className="card p-4" style={{ borderTop:`2px solid ${k.accent}` }}>
            <div className="text-xl mb-2">{k.emoji}</div>
            <p className="font-mono font-bold text-base mb-0.5" style={{ color:"var(--color-ink)", direction:"ltr", textAlign:"right" }}>{k.value}</p>
            <p className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background:"var(--color-surface)", width:"fit-content" }}>
        {([["valuation","تقييم المخزون"],["movements","حركة البضاعة"],["aging","الأصناف الراكدة"]] as const).map(([v,l])=>(
          <button key={v} className="px-4 py-2 rounded-lg font-arabic text-sm transition-all"
            style={{ background:tab===v?"#fff":"transparent", color:tab===v?"var(--color-ink)":"var(--color-ink-muted)", boxShadow:tab===v?"0 1px 4px rgba(0,0,0,.1)":"none" }}
            onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>

      {/* Valuation */}
      {tab==="valuation" && (
        loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin" width="28" height="28" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="erp-table">
              <thead>
                <tr><th>القطعة</th><th>الفئة</th><th>المستودع</th><th>الكمية</th><th>التكلفة</th><th>البيع</th><th>قيمة المخزون</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {inventory.map((i)=>{
                  const status = i.quantity===0?"نفذ":i.quantity<=(i.reorder_point??5)?"منخفض":"متاح";
                  const statusColor = i.quantity===0?"var(--color-red)":i.quantity<=(i.reorder_point??5)?"var(--color-amber)":"var(--color-green)";
                  return (
                    <tr key={i.id} style={{ background:i.quantity===0?"var(--color-red-bg)":i.quantity<=(i.reorder_point??5)?"var(--color-amber-bg)":undefined }}>
                      <td>
                        <p className="font-arabic text-sm font-medium">{i.parts?.name_ar}</p>
                        <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{i.parts?.part_number}</p>
                      </td>
                      <td className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{i.parts?.part_categories?.name_ar??"-"}</td>
                      <td className="font-arabic text-xs">{i.warehouses?.name_ar}</td>
                      <td className="font-mono font-bold text-sm">{fmtN(i.quantity)}</td>
                      <td className="font-mono text-xs" style={{ direction:"ltr", color:"var(--color-ink-muted)" }}>{fmt(i.parts?.price_cost??0)} ر.س</td>
                      <td className="font-mono text-xs" style={{ direction:"ltr" }}>{fmt(i.parts?.price_retail??0)} ر.س</td>
                      <td className="font-mono font-bold text-sm" style={{ direction:"ltr", color:"var(--color-gold)" }}>
                        {fmt(i.quantity*(i.parts?.price_retail??0))} ر.س
                      </td>
                      <td><span className="badge text-xs" style={{ color:statusColor }}>{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Movements */}
      {tab==="movements" && (
        <div>
          <div className="card p-4 mb-4 flex gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>من</label>
              <input className="input font-mono" type="date" value={movFrom} onChange={(e)=>setMovFrom(e.target.value)} style={{ width:155 }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>إلى</label>
              <input className="input font-mono" type="date" value={movTo} onChange={(e)=>setMovTo(e.target.value)} style={{ width:155 }} />
            </div>
            <select className="input" style={{ width:"auto",minWidth:150 }} value={movType} onChange={(e)=>setMovType(e.target.value)}>
              <option value="">كل الحركات</option>
              {Object.entries(movTypeAr).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn btn-gold" onClick={loadMovements} disabled={movLoading}>
              <span className="font-arabic">{movLoading?"...":"تحديث"}</span>
            </button>
          </div>

          {/* Summary badges */}
          <div className="flex gap-3 flex-wrap mb-4">
            {Object.entries(byType).map(([t,v]:any)=>(
              <div key={t} className="card px-4 py-2 flex items-center gap-3">
                <span className="font-arabic text-xs font-semibold" style={{ color:"var(--color-ink-2)" }}>{movTypeAr[t]??t}</span>
                <span className="font-mono text-xs" style={{ color:"var(--color-green)" }}>+{fmtN(v.qty_in)}</span>
                <span className="font-mono text-xs" style={{ color:"var(--color-red)" }}>-{fmtN(v.qty_out)}</span>
              </div>
            ))}
          </div>

          {movLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {movements.length===0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <span className="text-4xl opacity-20">📋</span>
                  <p className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>لا توجد حركات في هذه الفترة</p>
                </div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>التاريخ</th><th>القطعة</th><th>المستودع</th><th>النوع</th><th>الكمية</th></tr></thead>
                  <tbody>
                    {movements.map((m)=>(
                      <tr key={m.id}>
                        <td className="text-sm" style={{ color:"var(--color-ink-muted)" }}>{new Date(m.created_at).toLocaleDateString("ar-SA")}<p className="text-xs opacity-60">{new Date(m.created_at).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}</p></td>
                        <td>
                          <p className="font-arabic text-sm">{m.parts?.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{m.parts?.part_number}</p>
                        </td>
                        <td className="font-arabic text-xs">{m.warehouses?.name_ar}</td>
                        <td><span className="badge text-xs">{movTypeAr[m.movement_type]??m.movement_type}</span></td>
                        <td className="font-mono font-bold text-sm" style={{ color:m.quantity>0?"var(--color-green)":"var(--color-red)", direction:"ltr" }}>
                          {m.quantity>0?"+":""}{fmtN(m.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aging */}
      {tab==="aging" && (
        <div>
          <div className="card p-4 mb-4" style={{ background:"var(--color-amber-bg)", border:"1px solid var(--color-amber)22" }}>
            <p className="font-arabic text-sm" style={{ color:"var(--color-amber)" }}>
              ⚠️ الأصناف الراكدة هي أصناف بكميات مرتفعة ({">"}20 قطعة). قد تحتاج إلى تخفيض السعر أو تحويلها إلى مستودع آخر.
            </p>
          </div>
          <div className="card overflow-hidden">
            <table className="erp-table">
              <thead><tr><th>القطعة</th><th>الفئة</th><th>الكمية</th><th>قيمة المخزون</th><th>الإجراء المقترح</th></tr></thead>
              <tbody>
                {aging.map((i)=>(
                  <tr key={i.id}>
                    <td>
                      <p className="font-arabic text-sm font-medium">{i.parts?.name_ar}</p>
                      <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{i.parts?.part_number}</p>
                    </td>
                    <td className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{i.parts?.part_categories?.name_ar??"-"}</td>
                    <td className="font-mono font-bold text-sm" style={{ color:"var(--color-amber)" }}>{fmtN(i.quantity)}</td>
                    <td className="font-mono text-sm" style={{ direction:"ltr", color:"var(--color-gold)" }}>{fmt(i.quantity*(i.parts?.price_retail??0))} ر.س</td>
                    <td>
                      <span className="badge text-xs" style={{ background:"var(--color-amber-bg)", color:"var(--color-amber)" }}>
                        {i.quantity>50?"خصم مقترح":"مراجعة السعر"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
