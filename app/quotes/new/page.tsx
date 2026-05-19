"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_TENANT = "d0000000-0000-0000-0000-000000000001";

interface LineItem {
  part_id: string; part_number: string; name_ar: string;
  unit_price: number; quantity: number; discount_pct: number;
}

function genNum() { return `QT-${Date.now().toString().slice(-7)}`; }
const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2 });

export default function NewQuotePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<any[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("customers").select("id,name,name_ar").eq("is_active", true).order("name_ar").then(({ data }) => setCustomers(data ?? []));
  }, []);

  const searchParts = useCallback(async (q: string) => {
    if (!q.trim()) { setPartResults([]); return; }
    const { data } = await supabase.from("parts").select("id,part_number,name,name_ar,price_retail")
      .eq("is_active", true)
      .or(`name.ilike.%${q}%,name_ar.ilike.%${q}%,part_number.ilike.%${q}%`).limit(7);
    setPartResults(data ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 300);
    return () => clearTimeout(t);
  }, [partSearch, searchParts]);

  function addPart(p: any) {
    if (lines.find((l) => l.part_id === p.id)) { setPartSearch(""); setPartResults([]); return; }
    setLines((prev) => [...prev, { part_id: p.id, part_number: p.part_number, name_ar: p.name_ar, unit_price: p.price_retail, quantity: 1, discount_pct: 0 }]);
    setPartSearch(""); setPartResults([]);
  }

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_pct / 100), 0);
  const taxAmount = subtotal * 0.15;
  const total = subtotal + taxAmount;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + parseInt(validDays || "7"));

  async function handleSave(st: "draft" | "sent") {
    if (lines.length === 0) { setError("أضف قطعة واحدة على الأقل"); return; }
    setSaving(true); setError("");

    const { data: quote, error: err } = await supabase.from("quotes").insert({
      tenant_id: DEFAULT_TENANT,
      quote_number: genNum(),
      customer_id: customerId || null,
      status: st,
      valid_until: validUntil.toISOString().split("T")[0],
      subtotal, discount: 0, tax_amount: taxAmount, total,
      notes: notes || null,
    }).select().single();

    if (err || !quote) { setError(err?.message ?? "خطأ"); setSaving(false); return; }

    await supabase.from("quote_items").insert(
      lines.map((l) => ({ quote_id: quote.id, part_id: l.part_id, quantity: l.quantity, unit_price: l.unit_price, discount_pct: l.discount_pct }))
    );
    router.push(`/quotes/${quote.id}`);
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>عرض سعر جديد</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>أضف القطع وحدد العميل ومدة الصلاحية</p>
        </div>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 300px" }}>
        <div className="flex flex-col gap-4">
          {/* Customer + validity */}
          <div className="card p-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="col-span-2">
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>العميل</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">بدون عميل محدد</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name_ar ?? c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>صالح لمدة</label>
              <select className="input" value={validDays} onChange={(e) => setValidDays(e.target.value)}>
                {[["3","3 أيام"],["7","7 أيام"],["14","14 يوم"],["30","30 يوم"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Part search */}
          <div className="card p-4">
            <label className="block font-arabic text-sm font-medium mb-2" style={{ color: "var(--color-ink-2)" }}>إضافة قطعة</label>
            <div className="relative">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input className="input" style={{ paddingRight: 36 }} placeholder="ابحث برقم القطعة أو الاسم..."
                value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
              {partResults.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 card overflow-hidden z-10" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                  {partResults.map((p) => (
                    <button key={p.id} type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-right"
                      style={{ borderBottom: "1px solid var(--color-border-light)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                      onClick={() => addPart(p)}
                    >
                      <div>
                        <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{p.name_ar}</p>
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold">{p.price_retail?.toLocaleString("ar-SA")} ر.س</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="card overflow-hidden">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-4xl opacity-20">📦</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>ابحث وأضف القطع أعلاه</p>
              </div>
            ) : (
              <table className="erp-table">
                <thead><tr><th>القطعة</th><th style={{ width: 90 }}>السعر</th><th style={{ width: 80 }}>الكمية</th><th style={{ width: 80 }}>خصم%</th><th style={{ width: 100 }}>الإجمالي</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {lines.map((l, idx) => {
                    const lineTotal = l.quantity * l.unit_price * (1 - l.discount_pct / 100);
                    return (
                      <tr key={l.part_id}>
                        <td>
                          <p className="font-arabic font-medium text-sm" style={{ color: "var(--color-ink)" }}>{l.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{l.part_number}</p>
                        </td>
                        <td><input className="input text-sm font-mono" style={{ padding: "4px 8px", direction: "ltr" }} type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)} /></td>
                        <td><input className="input text-sm font-mono" style={{ padding: "4px 8px", direction: "ltr" }} type="number" min="1" value={l.quantity} onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)} /></td>
                        <td><input className="input text-sm font-mono" style={{ padding: "4px 8px", direction: "ltr" }} type="number" min="0" max="100" step="0.5" value={l.discount_pct} onChange={(e) => updateLine(idx, "discount_pct", parseFloat(e.target.value) || 0)} /></td>
                        <td className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr" }}>{fmt(lineTotal)}</td>
                        <td>
                          <button type="button" onClick={() => removeLine(idx)} style={{ color: "var(--color-ink-faint)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-4">
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>ملاحظات</label>
            <textarea className="input" rows={2} style={{ resize: "none" }} placeholder="ملاحظات للعميل..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-4">
          <div className="card p-5 sticky top-6">
            <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>ملخص العرض</h3>
            <div className="flex flex-col gap-2 mb-4">
              {[["المجموع الفرعي", fmt(subtotal) + " ر.س"], ["ضريبة القيمة 15%", fmt(taxAmount) + " ر.س"]].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{label}</span>
                  <span className="font-mono text-sm" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline pt-3 mt-1" style={{ borderTop: "2px solid var(--color-border)" }}>
                <span className="font-arabic font-bold" style={{ color: "var(--color-ink)" }}>الإجمالي</span>
                <span className="font-mono font-bold text-xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>{fmt(total)} ر.س</span>
              </div>
            </div>
            <div className="p-3 rounded-lg mb-4" style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>صالح حتى</p>
              <p className="font-arabic text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                {validUntil.toLocaleDateString("ar-SA")}
              </p>
            </div>
            {error && <div className="rounded-lg px-3 py-2.5 mb-3 text-xs font-arabic" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>{error}</div>}
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary w-full justify-center" disabled={saving || lines.length === 0} onClick={() => handleSave("sent")}>
                {saving && <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
                <span className="font-arabic">إرسال العرض</span>
              </button>
              <button className="btn btn-outline w-full justify-center" disabled={saving || lines.length === 0} onClick={() => handleSave("draft")}>
                <span className="font-arabic">حفظ كمسودة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
