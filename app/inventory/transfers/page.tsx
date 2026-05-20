"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  draft:      { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  in_transit: { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "قيد النقل" },
  completed:  { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "مكتمل" },
  cancelled:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "ملغي" },
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

interface TransferLine { part_id: string; part_number: string; name_ar: string; unit: string; quantity: number; available: number; }

export default function TransfersPage() {
  const [transfers,   setTransfers]   = useState<any[]>([]);
  const [warehouses,  setWarehouses]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate]   = useState(false);
  const [fromWh,     setFromWh]       = useState(DEFAULT_WAREHOUSE);
  const [toWh,       setToWh]         = useState("");
  const [lines,      setLines]        = useState<TransferLine[]>([]);
  const [partSearch, setPartSearch]   = useState("");
  const [partResults,setPartResults]  = useState<any[]>([]);
  const [notes,      setNotes]        = useState("");
  const [creating,   setCreating]     = useState(false);
  const [createErr,  setCreateErr]    = useState("");

  // Detail modal
  const [viewTransfer, setViewTransfer] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/api/transfers`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setTransfers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase.from("warehouses").select("id,name_ar").then(({ data }) => setWarehouses(data ?? []));
  }, [load]);

  // Part search
  useEffect(() => {
    if (!partSearch.trim()) { setPartResults([]); return; }
    const t = setTimeout(async () => {
      const { data: parts } = await supabase.from("parts")
        .select("id,part_number,name_ar,unit").eq("is_active", true)
        .or(`name_ar.ilike.%${partSearch}%,part_number.ilike.%${partSearch}%`).limit(7);
      const ids = (parts ?? []).map((p) => p.id);
      if (!ids.length) { setPartResults([]); return; }
      const { data: invRows } = await supabase.from("inventory").select("part_id,quantity")
        .in("part_id", ids).eq("warehouse_id", fromWh);
      const invMap: Record<string, number> = {};
      (invRows ?? []).forEach((r) => { invMap[r.part_id] = r.quantity; });
      setPartResults((parts ?? []).map((p) => ({ ...p, available: invMap[p.id] ?? 0 })));
    }, 280);
    return () => clearTimeout(t);
  }, [partSearch, fromWh]);

  function addLine(p: any) {
    if (lines.find((l) => l.part_id === p.id)) {
      setLines((prev) => prev.map((l) => l.part_id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, l.available) } : l));
    } else {
      setLines((prev) => [...prev, { part_id: p.id, part_number: p.part_number, name_ar: p.name_ar, unit: p.unit ?? "قطعة", quantity: 1, available: p.available }]);
    }
    setPartSearch(""); setPartResults([]);
  }

  async function handleCreate(status: "draft" | "completed") {
    if (!toWh)          { setCreateErr("حدد المستودع الهدف"); return; }
    if (!lines.length)  { setCreateErr("أضف قطعة واحدة على الأقل"); return; }
    setCreating(true); setCreateErr("");
    const token = await getToken();
    const res = await fetch(`${API}/api/transfers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from_warehouse: fromWh, to_warehouse: toWh, items: lines.map((l) => ({ part_id: l.part_id, quantity: l.quantity })), notes: notes || null, status }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateErr(data.error ?? "فشل الإنشاء"); return; }
    setShowCreate(false); setLines([]); setToWh(""); setNotes("");
    load();
  }

  async function complete(id: string) {
    setProcessing(id);
    const token = await getToken();
    await fetch(`${API}/api/transfers/${id}/complete`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
    setProcessing(null); load();
  }

  async function cancel(id: string) {
    if (!confirm("إلغاء هذا التحويل؟")) return;
    setProcessing(id);
    const token = await getToken();
    await fetch(`${API}/api/transfers/${id}/cancel`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
    setProcessing(null); load();
  }

  async function openView(t: any) {
    const token = await getToken();
    const res = await fetch(`${API}/api/transfers/${t.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setViewTransfer(await res.json());
  }

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name_ar ?? id;
  const fmt = (n: number) => n.toLocaleString("ar-SA");

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>تحويلات المخزون</h1>
          <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>نقل القطع بين المستودعات</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateErr(""); setLines([]); }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
          <span className="font-arabic">تحويل جديد</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl opacity-20">🔄</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>لا توجد تحويلات بعد</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>رقم التحويل</th><th>من</th><th>إلى</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const s = statusMap[t.status] ?? statusMap.draft;
                const busy = processing === t.id;
                return (
                  <tr key={t.id}>
                    <td>
                      <button className="font-mono text-xs font-semibold hover:underline" style={{ color: "var(--color-gold)" }} onClick={() => openView(t)}>
                        #{t.transfer_number}
                      </button>
                    </td>
                    <td className="font-arabic text-sm">{t.from_wh?.name_ar ?? whName(t.from_warehouse)}</td>
                    <td className="font-arabic text-sm">{t.to_wh?.name_ar ?? whName(t.to_warehouse)}</td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>{new Date(t.created_at).toLocaleDateString("ar-SA")}</td>
                    <td><span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost text-xs" style={{ padding: "4px 10px" }} onClick={() => openView(t)}>
                          <span className="font-arabic">عرض</span>
                        </button>
                        {t.status === "draft" && (
                          <button className="btn btn-ghost text-xs" style={{ padding: "4px 8px", color: "var(--color-green)" }}
                            disabled={busy} onClick={() => complete(t.id)}>
                            <span className="font-arabic">{busy ? "..." : "تنفيذ"}</span>
                          </button>
                        )}
                        {t.status === "draft" && (
                          <button className="btn btn-ghost text-xs" style={{ padding: "4px 8px", color: "var(--color-red)" }}
                            disabled={busy} onClick={() => cancel(t.id)}>
                            <span className="font-arabic">إلغاء</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }} onClick={() => setShowCreate(false)}>
          <div className="card w-full overflow-hidden flex flex-col" style={{ maxWidth: 760, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>تحويل مخزون جديد</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: "var(--color-ink-faint)", fontSize: 20 }}>✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>من المستودع</label>
                  <select className="input w-full" value={fromWh} onChange={(e) => { setFromWh(e.target.value); setLines([]); }}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>إلى المستودع *</label>
                  <select className="input w-full" value={toWh} onChange={(e) => setToWh(e.target.value)}>
                    <option value="">اختر مستودعاً</option>
                    {warehouses.filter((w) => w.id !== fromWh).map((w) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                  </select>
                </div>
              </div>

              {/* Part search */}
              <div className="mb-4 relative">
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>إضافة قطعة</label>
                <input className="input w-full" placeholder="ابحث برقم القطعة أو الاسم..." value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
                {partResults.length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 card overflow-hidden z-20" style={{ boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>
                    {partResults.map((p) => (
                      <button key={p.id} type="button"
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all text-right"
                        style={{ borderBottom: "1px solid var(--color-border-light)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                        onClick={() => addLine(p)}>
                        <div>
                          <p className="font-arabic text-sm font-medium">{p.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                        </div>
                        <span className="text-xs" style={{ color: p.available > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                          متاح: {p.available}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lines */}
              {lines.length > 0 && (
                <table className="erp-table mb-4">
                  <thead><tr><th>القطعة</th><th style={{ width: 90 }}>الكمية</th><th>متاح</th><th style={{ width: 36 }}></th></tr></thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={l.part_id} style={{ background: l.quantity > l.available ? "var(--color-red-bg)" : undefined }}>
                        <td>
                          <p className="font-arabic text-sm">{l.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{l.part_number}</p>
                        </td>
                        <td>
                          <input className="input font-mono text-sm" style={{ padding: "3px 8px", direction: "ltr" }}
                            type="number" min="1" max={l.available} value={l.quantity}
                            onChange={(e) => setLines((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Math.min(l.available, parseInt(e.target.value) || 1) } : x))} />
                        </td>
                        <td className="font-mono text-sm" style={{ color: l.quantity > l.available ? "var(--color-red)" : "var(--color-green)" }}>{l.available}</td>
                        <td>
                          <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ color: "var(--color-ink-faint)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>ملاحظات</label>
                <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: "none" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: "1px solid var(--color-border-light)" }}>
              {createErr && <p className="font-arabic text-sm" style={{ color: "var(--color-red)" }}>{createErr}</p>}
              <div className="flex gap-2 mr-auto">
                <button className="btn btn-outline" onClick={() => setShowCreate(false)}>إلغاء</button>
                <button className="btn btn-outline" disabled={creating} onClick={() => handleCreate("draft")}><span className="font-arabic">حفظ مسودة</span></button>
                <button className="btn btn-primary" disabled={creating} onClick={() => handleCreate("completed")}>{creating ? "..." : <span className="font-arabic">تنفيذ فوري</span>}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }} onClick={() => setViewTransfer(null)}>
          <div className="card w-full overflow-hidden" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <div>
                <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>تفاصيل التحويل</h2>
                <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-gold)" }}>#{viewTransfer.transfer_number}</p>
              </div>
              <button onClick={() => setViewTransfer(null)} style={{ color: "var(--color-ink-faint)", fontSize: 20 }}>✕</button>
            </div>
            <div className="p-6">
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {[
                  ["من",       viewTransfer.from_wh?.name_ar],
                  ["إلى",      viewTransfer.to_wh?.name_ar],
                  ["الحالة",   statusMap[viewTransfer.status]?.label],
                  ["التاريخ",  new Date(viewTransfer.created_at).toLocaleDateString("ar-SA")],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{k}</p>
                    <p className="font-arabic text-sm font-medium mt-0.5" style={{ color: "var(--color-ink)" }}>{v}</p>
                  </div>
                ))}
              </div>
              <table className="erp-table mb-4">
                <thead><tr><th>القطعة</th><th>الكمية</th></tr></thead>
                <tbody>
                  {(viewTransfer.items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td>
                        <p className="font-arabic text-sm">{i.parts?.name_ar}</p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{i.parts?.part_number}</p>
                      </td>
                      <td className="font-mono text-sm font-semibold">{fmt(i.quantity)} {i.parts?.unit ?? "قطعة"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewTransfer.notes && <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>ملاحظة: {viewTransfer.notes}</p>}
              <div className="flex gap-2 justify-end mt-4">
                {viewTransfer.status === "draft" && (
                  <button className="btn btn-primary" onClick={() => { setViewTransfer(null); complete(viewTransfer.id); }}>
                    <span className="font-arabic">تنفيذ التحويل</span>
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => setViewTransfer(null)}><span className="font-arabic">إغلاق</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
