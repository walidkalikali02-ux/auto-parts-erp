"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function InvoiceActions({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function markPaid() {
    setUpdating(true);
    await supabase.from("sales_orders").update({ payment_status: "paid" }).eq("id", orderId);
    router.refresh();
    setUpdating(false);
  }

  async function markDelivered() {
    setUpdating(true);
    await supabase.from("sales_orders").update({ status: "delivered" }).eq("id", orderId);
    router.refresh();
    setUpdating(false);
  }

  return (
    <div className="flex gap-2 flex-wrap no-print">
      <Link href="/orders/sales/new" className="btn btn-primary">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="font-arabic">طلب جديد</span>
      </Link>

      {orderStatus === "confirmed" && (
        <button className="btn btn-outline" onClick={markDelivered} disabled={updating}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-arabic">تسليم</span>
        </button>
      )}

      <button
        className="btn btn-outline"
        style={{ background: "var(--color-green-bg)", color: "var(--color-green)", borderColor: "transparent" }}
        onClick={markPaid}
        disabled={updating}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="font-arabic">تحديد مدفوع</span>
      </button>

      <Link
        href={`/returns/new?order_id=${orderId}`}
        className="btn btn-outline"
        style={{ color: "var(--color-red)", borderColor: "var(--color-red)" }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span className="font-arabic">إرجاع</span>
      </Link>

      <button className="btn btn-outline" onClick={() => window.print()}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        <span className="font-arabic">طباعة</span>
      </button>
    </div>
  );
}
