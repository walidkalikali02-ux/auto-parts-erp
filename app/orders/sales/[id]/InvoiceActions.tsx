"use client";
import Link from "next/link";

export function InvoiceActions({ orderId }: { orderId: string }) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex gap-2">
      <Link href="/orders/sales/new" className="btn btn-primary">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="font-arabic">طلب جديد</span>
      </Link>
      <button className="btn btn-outline" onClick={handlePrint}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        <span className="font-arabic">طباعة الفاتورة</span>
      </button>
    </div>
  );
}
