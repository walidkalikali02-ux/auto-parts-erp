"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;
const methodAr: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل بنكي", cheque: "شيك" };

interface Payment { id: string; amount: number; method: string; reference_no: string | null; paid_at: string; notes: string | null; }

interface Props {
  orderId:       string;
  orderNumber:   string;
  orderTotal:    number;
  alreadyPaid:   number;
  payments:      Payment[];
  onClose:       () => void;
  onSuccess:     () => void;
}

export function PaymentModal({ orderId, orderNumber, orderTotal, alreadyPaid, payments, onClose, onSuccess }: Props) {
  const remaining = orderTotal - alreadyPaid;
  const [amount,      setAmount]      = useState(remaining > 0 ? remaining.toFixed(2) : "");
  const [method,      setMethod]      = useState("cash");
  const [reference,   setReference]   = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("أدخل مبلغاً صحيحاً"); return; }
    if (amt > remaining + 0.01) { setError(`المبلغ أكبر من المتبقي (${fmt(remaining)} ر.س)`); return; }

    setSaving(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const res = await fetch(`${API}/api/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, amount: amt, method, reference_no: reference || null, notes: notes || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "فشل تسجيل الدفع"); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="card w-full overflow-hidden" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <div>
            <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>تسجيل دفعة</h2>
            <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-gold)" }}>#{orderNumber}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--color-ink-faint)", fontSize: 20 }}>✕</button>
        </div>

        <div className="p-6">
          {/* Order summary */}
          <div className="grid grid-cols-3 gap-3 mb-5 p-4 rounded-xl" style={{ background: "var(--color-gold-bg)" }}>
            {[
              ["إجمالي الطلب",   fmt(orderTotal)   + " ر.س"],
              ["المدفوع",         fmt(alreadyPaid)  + " ر.س"],
              ["المتبقي",         fmt(remaining)    + " ر.س"],
            ].map(([k, v]) => (
              <div key={k as string} className="text-center">
                <p className="font-arabic text-xs mb-1" style={{ color: "var(--color-ink-muted)" }}>{k}</p>
                <p className="font-mono font-bold text-sm" style={{ color: "var(--color-gold)", direction: "ltr" }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Previous payments */}
          {payments.length > 0 && (
            <div className="mb-4">
              <p className="font-arabic text-xs font-semibold mb-2" style={{ color: "var(--color-ink-muted)" }}>الدفعات السابقة</p>
              <div className="flex flex-col gap-1.5">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--color-surface)" }}>
                    <div className="flex items-center gap-3">
                      <span className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {new Date(p.paid_at).toLocaleDateString("ar-SA")}
                      </span>
                      <span className="badge text-xs" style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}>
                        {methodAr[p.method] ?? p.method}
                      </span>
                    </div>
                    <span className="font-mono font-semibold" style={{ color: "var(--color-green)", direction: "ltr" }}>
                      +{fmt(p.amount)} ر.س
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remaining > 0 ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>المبلغ *</label>
                  <input className="input w-full font-mono" type="number" step="0.01" min="0.01"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00" dir="ltr" autoFocus />
                </div>
                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>طريقة الدفع</label>
                  <select className="input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {Object.entries(methodAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>رقم المرجع (اختياري)</label>
                <input className="input w-full font-mono" value={reference}
                  onChange={(e) => setReference(e.target.value)} placeholder="رقم الشيك / رقم التحويل" dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>ملاحظات</label>
                <input className="input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error && <p className="font-arabic text-sm" style={{ color: "var(--color-red)" }}>{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn btn-gold flex-1" disabled={saving}>
                  {saving ? "..." : <span className="font-arabic">تسجيل الدفعة</span>}
                </button>
                <button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--color-green-bg)" }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--color-green)" strokeWidth={2.5}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-arabic font-semibold" style={{ color: "var(--color-green)" }}>تم سداد الطلب بالكامل</p>
              <button className="btn btn-outline" onClick={onClose}><span className="font-arabic">إغلاق</span></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
