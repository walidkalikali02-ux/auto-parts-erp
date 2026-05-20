"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const fmt = (n: number) => n.toLocaleString("ar-SA");

export default function StocktakePage() {
  const [stocktakes,  setStocktakes]  = useState<any[]>([]);
  const [warehouses,  setWarehouses]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [active,      setActive]      = useState<any>(null);   // open stocktake being counted
  const [counts,      setCounts]      = useState<Record<string, number>>({});
  const [saving,      setSaving]      = useState(false);
  const [completing,  setCompleting]  = useState(false);
  const [filter,      setFilter]      = useState<"all"|"uncounted"|"variance">("all");
  const [search,      setSearch]      = useState("");
  const [startWh,     setStartWh]     = useState("");
  const [starting,    setStarting]    = useState(false);
  const [startErr,    setStartErr]    = useState("");

  async function loadList() {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/stocktake`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setStocktakes(await res.json());
    setLoading(false);
  }

  async function openStocktake(id: string) {
    const token = await getToken();
    const res = await fetch(`${API}/api/stocktake/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setActive(data);
      const initCounts: Record<string, number> = {};
      (data.items ?? []).forEach((i: any) => { if (i.counted_qty !== null) initCounts[i.id] = i.counted_qty; });
      setCounts(initCounts);
    }
  }

  useEffect(() => {
    loadList();
    supabase.from("warehouses").select("id,name_ar").then(({ data }) => {
      setWarehouses(data ?? []);
      if (data?.[0]) setStartWh(data[0].id);
    });
  }, []);

  async function startNew() {
    if (!startWh) { setStartErr("اختر مستودعاً"); return; }
    setStarting(true); setStartErr("");
    const token = await getToken();
    const res = await fetch(`${API}/api/stocktake`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ warehouse_id: startWh }),
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) { setStartErr(data.error ?? "فشل البدء"); return; }
    await loadList();
    openStocktake(data.id);
  }

  async function saveProgress() {
    if (!active) return;
    setSaving(true);
    const token = await getToken();
    const payload = Object.entries(counts).map(([item_id, counted_qty]) => ({ item_id, counted_qty }));
    await fetch(`${API}/api/stocktake/${active.id}/count`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ counts: payload }),
    });
    setSaving(false);
    openStocktake(active.id);
  }

  async function completeStocktake() {
    if (!confirm("سيتم تطبيق جميع التسويات على المخزون. هل تريد المتابعة؟")) return;
    setCompleting(true);
    const token = await getToken();
    await saveProgress();
    const res = await fetch(`${API}/api/stocktake/${active.id}/complete`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCompleting(false);
    if (res.ok) { setActive(null); loadList(); alert(`تم الجرد. تم تسوية ${data.adjusted} صنف.`); }
  }

  const filteredItems = (active?.items ?? []).filter((i: any) => {
    if (filter === "uncounted" && i.counted_qty !== null) return false;
    if (filter === "variance"  && (i.counted_qty === null || i.variance === 0)) return false;
    if (search) {
      const s = search.toLowerCase();
      return i.parts?.name_ar?.includes(search) || i.parts?.part_number?.toLowerCase().includes(s);
    }
    return true;
  });

  const countedCount  = (active?.items ?? []).filter((i: any) => i.counted_qty !== null).length;
  const varianceCount = (active?.items ?? []).filter((i: any) => i.counted_qty !== null && i.variance !== 0).length;
  const totalItems    = active?.items?.length ?? 0;

  if (active) {
    return (
      <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>جرد المخزون</h1>
            <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
              {active.warehouses?.name_ar} · {countedCount}/{totalItems} تم عدها
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={() => setActive(null)}><span className="font-arabic">رجوع</span></button>
            <button className="btn btn-outline" disabled={saving} onClick={saveProgress}>
              <span className="font-arabic">{saving ? "..." : "حفظ التقدم"}</span>
            </button>
            <button className="btn btn-gold" disabled={completing || countedCount === 0} onClick={completeStocktake}>
              <span className="font-arabic">{completing ? "..." : "إغلاق وتطبيق التسويات"}</span>
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="card p-4 mb-5">
          <div className="flex gap-6 mb-3">
            {[
              ["إجمالي الأصناف", totalItems,    "var(--color-ink-muted)"],
              ["تم عدها",        countedCount,  "var(--color-blue)"],
              ["فروقات",          varianceCount, varianceCount > 0 ? "var(--color-red)" : "var(--color-green)"],
              ["لم تُعدَّ بعد",  totalItems - countedCount, "var(--color-amber)"],
            ].map(([k, v, c]) => (
              <div key={k as string} className="text-center">
                <p className="font-mono font-bold text-xl" style={{ color: c as string }}>{v}</p>
                <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{k}</p>
              </div>
            ))}
            <div className="flex-1 flex items-center">
              <div className="w-full h-2 rounded-full" style={{ background: "var(--color-border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${totalItems > 0 ? (countedCount / totalItems) * 100 : 0}%`, background: "var(--color-green)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <input className="input" placeholder="بحث بالاسم أو رقم القطعة..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
            {[["all","الكل"],["uncounted","لم تُعدَّ"],["variance","فروقات"]].map(([v, l]) => (
              <button key={v} className="px-3 py-1.5 rounded-md font-arabic text-xs transition-all"
                style={{ background: filter === v ? "#fff" : "transparent", color: filter === v ? "var(--color-ink)" : "var(--color-ink-muted)", boxShadow: filter === v ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}
                onClick={() => setFilter(v as any)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Items table */}
        <div className="card overflow-hidden">
          <table className="erp-table">
            <thead>
              <tr><th>القطعة</th><th>في النظام</th><th style={{ width: 120 }}>العدد الفعلي</th><th>الفرق</th></tr>
            </thead>
            <tbody>
              {filteredItems.map((i: any) => {
                const current  = counts[i.id] ?? i.counted_qty;
                const variance = current !== undefined ? current - i.system_qty : null;
                return (
                  <tr key={i.id} style={{ background: variance !== null && variance !== 0 ? "var(--color-amber-bg)" : undefined }}>
                    <td>
                      <p className="font-arabic text-sm font-medium">{i.parts?.name_ar}</p>
                      <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{i.parts?.part_number}</p>
                      <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>{i.parts?.part_categories?.name_ar}</p>
                    </td>
                    <td className="font-mono text-sm font-semibold">{fmt(i.system_qty)}</td>
                    <td>
                      <input className="input font-mono text-sm" style={{ padding: "4px 10px", direction: "ltr", width: 100,
                        borderColor: variance !== null && variance !== 0 ? "var(--color-amber)" : undefined }}
                        type="number" min="0" placeholder="أدخل العدد"
                        value={counts[i.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseInt(e.target.value);
                          setCounts((prev) => { const n = { ...prev }; if (v === undefined) delete n[i.id]; else n[i.id] = v; return n; });
                        }} />
                    </td>
                    <td>
                      {variance !== null ? (
                        <span className="badge font-mono" style={{
                          background: variance === 0 ? "var(--color-green-bg)" : "var(--color-amber-bg)",
                          color:      variance === 0 ? "var(--color-green)"    : "var(--color-amber)",
                        }}>
                          {variance > 0 ? "+" : ""}{variance}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-faint)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>الجرد الدوري</h1>
          <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>جرد فعلي للمخزون وتسوية الفروقات</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" style={{ width: "auto" }} value={startWh} onChange={(e) => setStartWh(e.target.value)}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
          </select>
          <button className="btn btn-primary" disabled={starting} onClick={startNew}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
            <span className="font-arabic">{starting ? "..." : "بدء جرد جديد"}</span>
          </button>
        </div>
      </div>
      {startErr && <p className="font-arabic text-sm mb-4" style={{ color: "var(--color-red)" }}>{startErr}</p>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : stocktakes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl opacity-20">📋</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد عمليات جرد بعد</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead><tr><th>المستودع</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {stocktakes.map((st) => (
                <tr key={st.id}>
                  <td className="font-arabic text-sm font-medium">{st.warehouses?.name_ar}</td>
                  <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>{new Date(st.created_at).toLocaleDateString("ar-SA")}</td>
                  <td>
                    <span className="badge" style={{
                      background: st.status === "completed" ? "var(--color-green-bg)" : "var(--color-amber-bg)",
                      color:      st.status === "completed" ? "var(--color-green)"    : "var(--color-amber)",
                    }}>
                      {st.status === "completed" ? "مكتمل" : "مفتوح"}
                    </span>
                  </td>
                  <td>
                    {st.status !== "completed" && (
                      <button className="btn btn-ghost text-xs font-arabic" style={{ padding: "4px 10px", color: "var(--color-gold)" }}
                        onClick={() => openStocktake(st.id)}>
                        متابعة الجرد
                      </button>
                    )}
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
