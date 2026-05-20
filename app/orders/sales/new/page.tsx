"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_TENANT    = "d0000000-0000-0000-0000-000000000001";
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

interface LineItem {
  part_id:       string;
  part_number:   string;
  name_ar:       string;
  unit:          string;
  unit_price:    number;
  quantity:      number;
  discount_pct:  number;
  available_qty: number;
}

function genOrderNumber() { return `SO-${Date.now().toString().slice(-8)}`; }

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [customers,     setCustomers]     = useState<any[]>([]);
  const [selectedCust,  setSelectedCust]  = useState<any>(null);
  const [partSearch,    setPartSearch]    = useState("");
  const [partResults,   setPartResults]   = useState<any[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [lines,         setLines]         = useState<LineItem[]>([]);
  const [customerId,    setCustomerId]    = useState("");
  const [notes,         setNotes]         = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount,      setDiscount]      = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => {
    supabase.from("customers")
      .select("id,name,name_ar,customer_type,credit_limit,balance,phone,email")
      .eq("is_active", true).order("name_ar")
      .then(({ data }) => setCustomers(data ?? []));
  }, []);

  // Update selected customer when customerId changes
  useEffect(() => {
    if (customerId) setSelectedCust(customers.find((c) => c.id === customerId) ?? null);
    else setSelectedCust(null);
  }, [customerId, customers]);

  const searchParts = useCallback(async (q: string) => {
    if (!q.trim()) { setPartResults([]); return; }
    setSearching(true);
    const { data: parts } = await supabase
      .from("parts")
      .select("id,part_number,name,name_ar,price_retail,price_wholesale,unit")
      .eq("is_active", true)
      .or(`name.ilike.%${q}%,name_ar.ilike.%${q}%,part_number.ilike.%${q}%`)
      .limit(8);

    if (!parts?.length) { setPartResults([]); setSearching(false); return; }

    // Batch-fetch inventory for results
    const ids = parts.map((p) => p.id);
    const { data: invRows } = await supabase
      .from("inventory")
      .select("part_id,quantity")
      .in("part_id", ids)
      .eq("warehouse_id", DEFAULT_WAREHOUSE);

    const invMap: Record<string, number> = {};
    (invRows ?? []).forEach((r) => { invMap[r.part_id] = r.quantity; });

    setPartResults(parts.map((p) => ({ ...p, available_qty: invMap[p.id] ?? 0 })));
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 300);
    return () => clearTimeout(t);
  }, [partSearch, searchParts]);

  async function addPart(p: any) {
    if (lines.find((l) => l.part_id === p.id)) {
      // Just increment qty
      setLines((prev) => prev.map((l) => l.part_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines((prev) => [...prev, {
        part_id:       p.id,
        part_number:   p.part_number,
        name_ar:       p.name_ar,
        unit:          p.unit ?? "قطعة",
        unit_price:    p.price_retail,
        quantity:      1,
        discount_pct:  0,
        available_qty: p.available_qty ?? 0,
      }]);
    }
    setPartSearch("");
    setPartResults([]);
  }

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal     = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_pct / 100), 0);
  const discountAmt  = subtotal * (discount / 100);
  const taxableAmt   = subtotal - discountAmt;
  const taxAmount    = taxableAmt * 0.15;
  const total        = taxableAmt + taxAmount;

  // Credit remaining for selected customer
  const creditAvail = selectedCust
    ? (selectedCust.credit_limit ?? 0) - (selectedCust.balance ?? 0)
    : null;

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(status: "draft" | "confirmed") {
    if (lines.length === 0) { setError("أضف قطعة واحدة على الأقل"); return; }

    const overStock = lines.find((l) => l.quantity > l.available_qty && l.available_qty >= 0);
    if (overStock && status === "confirmed") {
      setError(`الكمية من "${overStock.name_ar}" (${overStock.quantity}) تتجاوز المخزون (${overStock.available_qty})`);
      return;
    }

    if (paymentMethod === "credit" && customerId && creditAvail !== null && total > creditAvail) {
      setError(`رصيد الائتمان غير كافٍ. المتاح: ${fmt(creditAvail)} ر.س، المطلوب: ${fmt(total)} ر.س`);
      return;
    }

    setSaving(true);
    setError("");

    const { data: order, error: orderErr } = await supabase
      .from("sales_orders")
      .insert({
        tenant_id:      DEFAULT_TENANT,
        order_number:   genOrderNumber(),
        customer_id:    customerId || null,
        warehouse_id:   DEFAULT_WAREHOUSE,
        status,
        payment_status: "unpaid",
        payment_method: paymentMethod,
        subtotal,
        discount:       discountAmt,
        tax_amount:     taxAmount,
        total,
        notes:          notes || null,
      })
      .select()
      .single();

    if (orderErr || !order) { setError(orderErr?.message ?? "خطأ في إنشاء الطلب"); setSaving(false); return; }

    await supabase.from("sales_order_items").insert(
      lines.map((l) => ({
        order_id:    order.id,
        part_id:     l.part_id,
        quantity:    l.quantity,
        unit_price:  l.unit_price,
        discount_pct: l.discount_pct,
      }))
    );

    // Deduct inventory
    if (status === "confirmed") {
      await Promise.all(lines.map(async (l) => {
        const { data: inv } = await supabase
          .from("inventory").select("id,quantity")
          .eq("part_id", l.part_id).eq("warehouse_id", DEFAULT_WAREHOUSE).single();
        if (inv) {
          await supabase.from("inventory").update({ quantity: Math.max(0, inv.quantity - l.quantity) }).eq("id", inv.id);
          await supabase.from("inventory_movements").insert({
            tenant_id:      DEFAULT_TENANT,
            part_id:        l.part_id,
            warehouse_id:   DEFAULT_WAREHOUSE,
            movement_type:  "sale",
            quantity:       -l.quantity,
            reference_type: "sales_order",
            reference_id:   order.id,
          });
        }
      }));

      // Update customer balance if credit
      if (paymentMethod === "credit" && customerId) {
        const cust = selectedCust;
        if (cust) {
          await supabase.from("customers")
            .update({ balance: (cust.balance ?? 0) + total })
            .eq("id", customerId);
        }
      }
    }

    router.push(`/orders/sales/${order.id}`);
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>طلب بيع جديد</h1>
          <p className="text-sm mt-0.5 font-arabic" style={{ color: "var(--color-ink-muted)" }}>أضف القطع وحدد العميل ثم احفظ</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-outline">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          <span className="font-arabic">رجوع</span>
        </button>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Left — items */}
        <div className="flex flex-col gap-4">

          {/* Customer + payment */}
          <div className="card p-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>العميل</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">بدون عميل (نقدي)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_ar ?? c.name}</option>
                ))}
              </select>
              {selectedCust && (
                <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--color-surface)" }}>
                  {selectedCust.phone && <p className="font-mono" style={{ color: "var(--color-ink-muted)" }}>{selectedCust.phone}</p>}
                  {creditAvail !== null && (
                    <p className="font-arabic mt-0.5" style={{ color: creditAvail < total ? "var(--color-red)" : "var(--color-green)" }}>
                      رصيد الائتمان المتاح: {fmt(creditAvail)} ر.س
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>طريقة الدفع</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="transfer">تحويل بنكي</option>
                <option value="credit">آجل</option>
              </select>
              {paymentMethod === "credit" && !customerId && (
                <p className="font-arabic text-xs mt-1.5" style={{ color: "var(--color-amber)" }}>
                  ⚠️ الدفع الآجل يتطلب تحديد عميل
                </p>
              )}
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
              <input className="input" style={{ paddingRight: 36 }}
                placeholder="ابحث برقم القطعة أو الاسم..."
                value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
              {searching && (
                <svg className="animate-spin absolute" width="14" height="14" fill="none" viewBox="0 0 24 24"
                  style={{ top: "50%", left: 10, transform: "translateY(-50%)" }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {partResults.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 card overflow-hidden z-10"
                  style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                  {partResults.map((p) => (
                    <button key={p.id} type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-sm transition-all text-right"
                      style={{ borderBottom: "1px solid var(--color-border-light)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                      onClick={() => addPart(p)}>
                      <div>
                        <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{p.name_ar}</p>
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                      </div>
                      <div className="text-left flex flex-col items-end gap-0.5">
                        <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                          {p.price_retail.toLocaleString("ar-SA")} ر.س
                        </span>
                        <span className="text-xs" style={{ color: p.available_qty > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                          متاح: {p.available_qty}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="card overflow-hidden">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-4xl opacity-20">📦</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>ابحث وأضف القطع أعلاه</p>
              </div>
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>القطعة</th>
                    <th style={{ width: 100 }}>السعر</th>
                    <th style={{ width: 80 }}>الكمية</th>
                    <th style={{ width: 80 }}>خصم %</th>
                    <th style={{ width: 110 }}>الإجمالي</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => {
                    const lineTotal = l.quantity * l.unit_price * (1 - l.discount_pct / 100);
                    const overStock = l.quantity > l.available_qty && l.available_qty >= 0;
                    return (
                      <tr key={l.part_id} style={{ background: overStock ? "var(--color-red-bg)" : undefined }}>
                        <td>
                          <p className="font-arabic font-medium text-sm" style={{ color: "var(--color-ink)" }}>{l.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{l.part_number}</p>
                          <p className="text-xs mt-0.5" style={{ color: overStock ? "var(--color-red)" : "var(--color-ink-faint)" }}>
                            {l.unit} · متاح: {l.available_qty}
                          </p>
                        </td>
                        <td>
                          <input className="input text-sm font-mono" style={{ padding: "4px 8px", direction: "ltr" }}
                            type="number" step="0.01" value={l.unit_price}
                            onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td>
                          <input className="input text-sm font-mono"
                            style={{ padding: "4px 8px", direction: "ltr", borderColor: overStock ? "var(--color-red)" : undefined }}
                            type="number" min="1" value={l.quantity}
                            onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)} />
                        </td>
                        <td>
                          <input className="input text-sm font-mono" style={{ padding: "4px 8px", direction: "ltr" }}
                            type="number" min="0" max="100" step="0.5" value={l.discount_pct}
                            onChange={(e) => updateLine(idx, "discount_pct", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr" }}>
                          {fmt(lineTotal)}
                        </td>
                        <td>
                          <button type="button" onClick={() => removeLine(idx)}
                            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                            style={{ color: "var(--color-ink-faint)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          <div className="card p-4">
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>ملاحظات</label>
            <textarea className="input" rows={2} placeholder="ملاحظات إضافية..."
              value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: "none" }} />
          </div>
        </div>

        {/* Right — summary */}
        <div className="flex flex-col gap-4">
          <div className="card p-5 sticky top-6">
            <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>ملخص الطلب</h3>

            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>المجموع الفرعي</span>
                <span className="font-mono text-sm" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{fmt(subtotal)} ر.س</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>خصم إجمالي %</span>
                <input className="input font-mono text-sm" style={{ width: 70, padding: "2px 8px", direction: "ltr", textAlign: "right" }}
                  type="number" min="0" max="100" value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>قيمة الخصم</span>
                  <span className="font-mono text-sm" style={{ color: "var(--color-red)", direction: "ltr" }}>- {fmt(discountAmt)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>ضريبة القيمة 15%</span>
                <span className="font-mono text-sm" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{fmt(taxAmount)} ر.س</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-1" style={{ borderTop: "2px solid var(--color-border)" }}>
                <span className="font-arabic font-bold" style={{ color: "var(--color-ink)" }}>الإجمالي</span>
                <span className="font-mono font-bold text-xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>
                  {fmt(total)} ر.س
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs mb-3" style={{ color: "var(--color-ink-muted)" }}>
              <span className="font-arabic">{lines.length} صنف · {lines.reduce((s, l) => s + l.quantity, 0)} وحدة</span>
            </div>

            {error && (
              <div className="mb-3 rounded-lg px-3 py-2.5 text-xs font-arabic leading-relaxed"
                style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button className="btn btn-primary w-full justify-center"
                disabled={saving || lines.length === 0}
                onClick={() => handleSubmit("confirmed")}>
                {saving ? (
                  <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : null}
                <span className="font-arabic">تأكيد الطلب</span>
              </button>
              <button className="btn btn-outline w-full justify-center"
                disabled={saving || lines.length === 0}
                onClick={() => handleSubmit("draft")}>
                <span className="font-arabic">حفظ كمسودة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
