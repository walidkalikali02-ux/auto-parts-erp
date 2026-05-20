"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentModal } from "@/components/payments/PaymentModal";

const methodAr: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل بنكي", cheque: "شيك" };
const payStatusStyle: Record<string, { bg: string; color: string; label: string }> = {
  unpaid:  { bg: "var(--color-red-bg)",   color: "var(--color-red)",   label: "غير مدفوع" },
  partial: { bg: "var(--color-amber-bg)", color: "var(--color-amber)", label: "مدفوع جزئياً" },
  paid:    { bg: "var(--color-green-bg)", color: "var(--color-green)", label: "مدفوع بالكامل" },
};

interface Payment { id: string; amount: number; method: string; reference_no: string | null; paid_at: string; notes: string | null; }

interface Props {
  orderId:       string;
  orderNumber:   string;
  orderTotal:    number;
  payments:      Payment[];
  alreadyPaid:   number;
  paymentStatus: string;
}

export function PaymentSection({ orderId, orderNumber, orderTotal, payments, alreadyPaid, paymentStatus }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const remaining = orderTotal - alreadyPaid;
  const ps = payStatusStyle[paymentStatus] ?? payStatusStyle.unpaid;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border-light)" }}>
        <div className="flex items-center gap-3">
          <h3 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>سجل الدفعات</h3>
          <span className="badge" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
        </div>
        {paymentStatus !== "paid" && (
          <button className="btn btn-gold text-sm" onClick={() => setShowModal(true)}>
            + تسجيل دفعة
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span style={{ color: "var(--color-green)" }}>{fmt(alreadyPaid)} ر.س مدفوع</span>
            <span style={{ color: "var(--color-ink-muted)" }}>{fmt(orderTotal)} ر.س إجمالي</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, orderTotal > 0 ? (alreadyPaid / orderTotal) * 100 : 0)}%`, background: "var(--color-green)" }} />
          </div>
          {remaining > 0 && (
            <p className="font-arabic text-xs mt-1" style={{ color: "var(--color-red)" }}>
              متبقي: {fmt(remaining)} ر.س
            </p>
          )}
        </div>

        {payments.length === 0 ? (
          <p className="font-arabic text-sm text-center py-6" style={{ color: "var(--color-ink-faint)" }}>
            لا توجد دفعات مسجلة بعد
          </p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>ملاحظات</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                    {new Date(p.paid_at).toLocaleDateString("ar-SA")}
                    <p className="text-xs opacity-60">{new Date(p.paid_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
                  </td>
                  <td className="font-mono font-bold text-sm" style={{ color: "var(--color-green)", direction: "ltr" }}>
                    +{fmt(p.amount)} ر.س
                  </td>
                  <td>
                    <span className="badge" style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}>
                      {methodAr[p.method] ?? p.method}
                    </span>
                  </td>
                  <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                    {p.reference_no ?? "—"}
                  </td>
                  <td className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                    {p.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PaymentModal
          orderId={orderId}
          orderNumber={orderNumber}
          orderTotal={orderTotal}
          alreadyPaid={alreadyPaid}
          payments={payments}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
