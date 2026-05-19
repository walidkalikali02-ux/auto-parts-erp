"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const DEFAULT_TENANT    = "d0000000-0000-0000-0000-000000000001";
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

function genOrderNum() { return `SO-${Date.now().toString().slice(-8)}`; }

export function QuoteActions({ quoteId, status, items, quote }: { quoteId: string; status: string; items: any[]; quote: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await supabase.from("quotes").update({ status: newStatus }).eq("id", quoteId);
    router.refresh();
    setLoading(false);
  }

  async function convertToOrder() {
    setLoading(true);
    const { data: order } = await supabase.from("sales_orders").insert({
      tenant_id: DEFAULT_TENANT,
      order_number: genOrderNum(),
      customer_id: quote.customer_id ?? null,
      warehouse_id: DEFAULT_WAREHOUSE,
      status: "confirmed",
      payment_status: "unpaid",
      payment_method: "transfer",
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax_amount: quote.tax_amount,
      total: quote.total,
      notes: `محوّل من عرض سعر #${quote.quote_number}`,
    }).select().single();

    if (!order) { setLoading(false); return; }

    await supabase.from("sales_order_items").insert(
      items.map((i) => ({ order_id: order.id, part_id: i.part_id, quantity: i.quantity, unit_price: i.unit_price, discount_pct: i.discount_pct }))
    );

    await supabase.from("quotes").update({ status: "converted", converted_order_id: order.id }).eq("id", quoteId);
    router.push(`/orders/sales/${order.id}`);
  }

  return (
    <div className="flex gap-2 no-print">
      {status === "draft" && (
        <button className="btn btn-primary" onClick={() => updateStatus("sent")} disabled={loading}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          <span className="font-arabic">إرسال</span>
        </button>
      )}
      {status === "sent" && (
        <>
          <button className="btn btn-outline" style={{ background: "var(--color-green-bg)", color: "var(--color-green)", borderColor: "transparent" }}
            onClick={() => updateStatus("accepted")} disabled={loading}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7" /></svg>
            <span className="font-arabic">قُبل</span>
          </button>
          <button className="btn btn-outline" style={{ color: "var(--color-red)", borderColor: "var(--color-red)" }}
            onClick={() => updateStatus("rejected")} disabled={loading}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="font-arabic">رُفض</span>
          </button>
        </>
      )}
      {(status === "accepted" || status === "sent") && (
        <button className="btn btn-gold" onClick={convertToOrder} disabled={loading}>
          {loading ? (
            <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>
          ) : (
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
          )}
          <span className="font-arabic">تحويل لطلب بيع</span>
        </button>
      )}
      <button className="btn btn-outline" onClick={() => window.print()}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
        <span className="font-arabic">طباعة</span>
      </button>
    </div>
  );
}
