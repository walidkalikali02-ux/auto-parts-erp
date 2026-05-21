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
const fmtN = (n: number, locale: string) => n.toLocaleString(locale);

function getMovementTypeLabel(type: string, language: "ar" | "en"): string {
  const movTypeMap: Record<string, Record<"ar"|"en", string>> = {
    sale: { ar: "بيع", en: "Sale" },
    purchase: { ar: "شراء", en: "Purchase" },
    adjustment: { ar: "تسوية", en: "Adjustment" },
    transfer_in: { ar: "تحويل وارد", en: "Transfer In" },
    transfer_out: { ar: "تحويل صادر", en: "Transfer Out" },
    return: { ar: "مرتجع", en: "Return" },
  };
  return movTypeMap[type]?.[language] ?? type;
}

export default function InventoryReportPage() {
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-SA" : "en-US";
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
      [t("table.part_number", language)]:  i.parts?.part_number ?? "",
      [t("table.name", language)]:           i.parts?.name_ar ?? "",
      [t("table.category", language)]:       i.parts?.part_categories?.name_ar ?? "",
      [t("table.warehouse", language)]:       i.warehouses?.name_ar ?? "",
      [t("table.quantity", language)]:           i.quantity,
      [t("report.inventory.reserved", language)]:            i.quantity_reserved ?? 0,
      [t("report.inventory.reorder_point", language)]:      i.reorder_point ?? 0,
      [t("report.inventory.cost_price", language)]:     (i.parts?.price_cost ?? 0).toFixed(2),
      [t("report.inventory.retail_price", language)]:        (i.parts?.price_retail ?? 0).toFixed(2),
      [t("report.inventory.cost_value", language)]: (i.quantity * (i.parts?.price_cost ?? 0)).toFixed(2),
      [t("report.inventory.retail_value", language)]:  (i.quantity * (i.parts?.price_retail ?? 0)).toFixed(2),
      [t("table.status", language)]:           i.quantity === 0 ? "نفذ" : i.quantity <= (i.reorder_point ?? 5) ? "منخفض" : "متاح",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [14,28,16,14,10,10,12,14,12,18,18,10].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("report.inventory.sheet_name", language));
    XLSX.writeFile(wb, `inventory-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color:"var(--color-ink)" }}>{t("report.inventory.report", language)}</h1>
          <p className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("report.inventory.subtitle", language)}</p>
        </div>
        <button className="btn btn-outline" onClick={exportInventory} style={{ color:"var(--color-green)", borderColor:"var(--color-green)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span className="font-arabic">{t("action.export", language)} Excel</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns:"repeat(5,1fr)" }}>
        {[
          { labelKey:"report.inventory.total_items",      value:fmtN(inventory.length, locale),          accent:"var(--color-blue)",      emoji:"📦" },
          { labelKey:"report.inventory.retail_value",     value:`${fmt(totalRetailValue, locale)} ร.س`,  accent:"var(--color-green)",     emoji:"💰" },
          { labelKey:"report.inventory.cost_value",       value:`${fmt(totalCostValue, locale)} ร.س`,    accent:"var(--color-ink-muted)", emoji:"🏷️" },
          { labelKey:"report.inventory.potential_profit",       value:`${fmt(potentialProfit, locale)} ร.س`,   accent:"var(--color-gold)",      emoji:"💹" },
          { labelKey:"report.inventory.out_low_stock",         value:`${fmtN(outOfStock, locale)} / ${fmtN(lowStock, locale)}`, accent:"var(--color-red)", emoji:"⚠️" },
        ].map((k)=>(
          <div key={k.labelKey} className="card p-4" style={{ borderTop:`2px solid ${k.accent}` }}>
            <div className="text-xl mb-2">{k.emoji}</div>
            <p className="font-mono font-bold text-base mb-0.5" style={{ color:"var(--color-ink)", direction:"ltr", textAlign:"right" }}>{k.value}</p>
            <p className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{t(k.labelKey, language)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background:"var(--color-surface)", width:"fit-content" }}>
        {([["valuation",t("report.inventory.tab_valuation", language)],["movements",t("report.inventory.tab_movements", language)],["aging",t("report.inventory.tab_aging", language)]] as const).map(([v,l])=>(
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
                <tr><th>{t("table.part", language)}</th><th>{t("table.category", language)}</th><th>{t("table.warehouse", language)}</th><th>{t("table.quantity", language)}</th><th>{t("report.inventory.cost_price", language)}</th><th>{t("report.inventory.retail_price", language)}</th><th>{t("report.inventory.retail_value", language)}</th><th>{t("table.status", language)}</th></tr>
              </thead>
              <tbody>
                {inventory.map((i)=>{
                  const status = i.quantity===0?t("report.inventory.out_of_stock", language):i.quantity<=(i.reorder_point??5)?t("report.inventory.low_stock", language):t("report.inventory.available", language);
                  const statusColor = i.quantity===0?"var(--color-red)":i.quantity<=(i.reorder_point??5)?"var(--color-amber)":"var(--color-green)";
                  return (
                    <tr key={i.id} style={{ background:i.quantity===0?"var(--color-red-bg)":i.quantity<=(i.reorder_point??5)?"var(--color-amber-bg)":undefined }}>
                      <td>
                        <p className="font-arabic text-sm font-medium">{i.parts?.name_ar}</p>
                        <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{i.parts?.part_number}</p>
                      </td>
                      <td className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{i.parts?.part_categories?.name_ar??"-"}</td>
                      <td className="font-arabic text-xs">{i.warehouses?.name_ar}</td>
                      <td className="font-mono font-bold text-sm">{fmtN(i.quantity, locale)}</td>
                      <td className="font-mono text-xs" style={{ direction:"ltr", color:"var(--color-ink-muted)" }}>{fmt(i.parts?.price_cost??0, locale)} ร.س</td>
                      <td className="font-mono text-xs" style={{ direction:"ltr" }}>{fmt(i.parts?.price_retail??0, locale)} ร.س</td>
                      <td className="font-mono font-bold text-sm" style={{ direction:"ltr", color:"var(--color-gold)" }}>
                        {fmt(i.quantity*(i.parts?.price_retail??0), locale)} ร.س
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
              <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("filter.from", language)}</label>
              <input className="input font-mono" type="date" value={movFrom} onChange={(e)=>setMovFrom(e.target.value)} style={{ width:155 }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("filter.to", language)}</label>
              <input className="input font-mono" type="date" value={movTo} onChange={(e)=>setMovTo(e.target.value)} style={{ width:155 }} />
            </div>
            <select className="input" style={{ width:"auto",minWidth:150 }} value={movType} onChange={(e)=>setMovType(e.target.value)}>
              <option value="">{t("report.inventory.all_movements", language)}</option>
              {Object.entries({ sale: "", purchase: "", adjustment: "", transfer_in: "", transfer_out: "", return: "" }).map(([k])=><option key={k} value={k}>{getMovementTypeLabel(k, language)}</option>)}
            </select>
            <button className="btn btn-gold" onClick={loadMovements} disabled={movLoading}>
              <span className="font-arabic">{movLoading?"...":t("action.refresh", language)}</span>
            </button>
          </div>

          {/* Summary badges */}
          <div className="flex gap-3 flex-wrap mb-4">
            {Object.entries(byType).map(([t,v]:any)=>(
              <div key={t} className="card px-4 py-2 flex items-center gap-3">
                <span className="font-arabic text-xs font-semibold" style={{ color:"var(--color-ink-2)" }}>{getMovementTypeLabel(t, language)}</span>
                <span className="font-mono text-xs" style={{ color:"var(--color-green)" }}>+{fmtN(v.qty_in, locale)}</span>
                <span className="font-mono text-xs" style={{ color:"var(--color-red)" }}>-{fmtN(v.qty_out, locale)}</span>
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
                  <p className="font-arabic text-sm" style={{ color:"var(--color-ink-muted)" }}>{t("msg.no_movements", language)}</p>
                </div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>{t("table.date", language)}</th><th>{t("table.part", language)}</th><th>{t("table.warehouse", language)}</th><th>{t("table.type", language)}</th><th>{t("table.quantity", language)}</th></tr></thead>
                  <tbody>
                    {movements.map((m)=>(
                      <tr key={m.id}>
                        <td className="text-sm" style={{ color:"var(--color-ink-muted)" }}>{new Date(m.created_at).toLocaleDateString(locale)}<p className="text-xs opacity-60">{new Date(m.created_at).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</p></td>
                        <td>
                          <p className="font-arabic text-sm">{m.parts?.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{m.parts?.part_number}</p>
                        </td>
                        <td className="font-arabic text-xs">{m.warehouses?.name_ar}</td>
                        <td><span className="badge text-xs">{getMovementTypeLabel(m.movement_type, language)}</span></td>
                        <td className="font-mono font-bold text-sm" style={{ color:m.quantity>0?"var(--color-green)":"var(--color-red)", direction:"ltr" }}>
                          {m.quantity>0?"+":""}{fmtN(m.quantity, locale)}
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
              ⚠️ {t("report.inventory.aging_warning", language)}
            </p>
          </div>
          <div className="card overflow-hidden">
            <table className="erp-table">
              <thead><tr><th>{t("table.part", language)}</th><th>{t("table.category", language)}</th><th>{t("table.quantity", language)}</th><th>{t("report.inventory.retail_value", language)}</th><th>{t("report.inventory.suggested_action", language)}</th></tr></thead>
              <tbody>
                {aging.map((i)=>(
                  <tr key={i.id}>
                    <td>
                      <p className="font-arabic text-sm font-medium">{i.parts?.name_ar}</p>
                      <p className="font-mono text-xs" style={{ color:"var(--color-gold)" }}>{i.parts?.part_number}</p>
                    </td>
                    <td className="font-arabic text-xs" style={{ color:"var(--color-ink-muted)" }}>{i.parts?.part_categories?.name_ar??"-"}</td>
                    <td className="font-mono font-bold text-sm" style={{ color:"var(--color-amber)" }}>{fmtN(i.quantity, locale)}</td>
                    <td className="font-mono text-sm" style={{ direction:"ltr", color:"var(--color-gold)" }}>{fmt(i.quantity*(i.parts?.price_retail??0), locale)} ร.س</td>
                    <td>
                      <span className="badge text-xs" style={{ background:"var(--color-amber-bg)", color:"var(--color-amber)" }}>
                        {i.quantity>50?t("report.inventory.discount_suggested", language):t("report.inventory.review_price", language)}
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
