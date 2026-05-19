import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { InvoiceActions } from "./InvoiceActions";
import { buildZatcaQRData, getZatcaQRUrl } from "@/lib/zatca";

const SELLER_NAME    = "شركة قطع الغيار";
const SELLER_NAME_EN = "Auto Parts Co.";
const SELLER_VAT     = "300000000000003";
const SELLER_ADDRESS = "الرياض، المملكة العربية السعودية";

const statusAr: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: "مسودة",        bg: "var(--color-surface-2)", color: "var(--color-ink-muted)" },
  confirmed: { label: "مؤكد",         bg: "var(--color-blue-bg)",   color: "var(--color-blue)"      },
  picking:   { label: "جارٍ التجهيز", bg: "var(--color-amber-bg)",  color: "var(--color-amber)"     },
  delivered: { label: "تم التسليم",   bg: "var(--color-green-bg)",  color: "var(--color-green)"     },
  cancelled: { label: "ملغي",         bg: "var(--color-red-bg)",    color: "var(--color-red)"       },
  returned:  { label: "مُرتجع",       bg: "var(--color-red-bg)",    color: "var(--color-red)"       },
};

const payAr:    Record<string, string> = { unpaid: "غير مدفوع", partial: "جزئي", paid: "مدفوع", refunded: "مُسترد" };
const methodAr: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل بنكي", credit: "آجل" };

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("sales_orders")
    .select("*, customers(name, name_ar, phone, email, tax_number, city)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("sales_order_items")
    .select("*, parts(part_number, name, name_ar, unit, tax_rate)")
    .eq("order_id", id);

  // ZATCA QR
  const zatcaData = buildZatcaQRData({
    sellerName:  SELLER_NAME,
    vatNumber:   SELLER_VAT,
    invoiceDate: order.created_at ?? order.order_date,
    totalWithVat: Number(order.total),
    vatAmount:   Number(order.tax_amount),
  });
  const qrUrl = getZatcaQRUrl(zatcaData, 140);

  const s   = statusAr[order.status] ?? statusAr.draft;
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6 no-print" style={{ color: "var(--color-ink-muted)" }}>
        <Link href="/orders/sales" className="hover:underline font-arabic">أوامر البيع</Link>
        <span>/</span>
        <span className="font-mono" style={{ color: "var(--color-ink)" }}>#{order.order_number}</span>
      </div>

      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl font-bold" style={{ color: "var(--color-ink)" }}>#{order.order_number}</h1>
          <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          <span className="badge" style={{
            background: order.payment_status === "paid" ? "var(--color-green-bg)" : "var(--color-red-bg)",
            color: order.payment_status === "paid" ? "var(--color-green)" : "var(--color-red)",
          }}>
            {payAr[order.payment_status] ?? order.payment_status}
          </span>
        </div>
        <InvoiceActions orderId={id} orderStatus={order.status} />
      </div>

      {/* ========== PRINTABLE INVOICE ========== */}
      <div id="invoice-print" className="card overflow-hidden">

        {/* Header */}
        <div className="p-6 flex items-start justify-between"
          style={{ background: "var(--color-gold-bg)", borderBottom: "2px solid var(--color-gold-dim)" }}>
          <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <polygon points="22,2 42,12 42,32 22,42 2,32 2,12" fill="var(--color-gold-dim)" stroke="var(--color-gold)" strokeWidth="1.5" />
              <circle cx="22" cy="22" r="7" fill="var(--color-gold)" opacity="0.8" />
            </svg>
            <div>
              <p className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>{SELLER_NAME}</p>
              <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{SELLER_NAME_EN}</p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                الرقم الضريبي: {SELLER_VAT}
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-arabic text-2xl font-bold" style={{ color: "var(--color-gold)" }}>فاتورة ضريبية</p>
            <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>Tax Invoice</p>
            <p className="font-mono text-base font-semibold mt-1" style={{ color: "var(--color-ink)" }}>
              #{order.order_number}
            </p>
            <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
              {new Date(order.order_date).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>

        {/* Seller + Customer + ZATCA info */}
        <div className="grid p-6 gap-6" style={{ gridTemplateColumns: "1fr 1fr 140px", borderBottom: "1px solid var(--color-border-light)" }}>
          {/* Seller */}
          <div>
            <p className="font-arabic text-xs font-semibold uppercase mb-2" style={{ color: "var(--color-ink-muted)", letterSpacing: "0.06em" }}>
              بيانات البائع
            </p>
            <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>{SELLER_NAME}</p>
            <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{SELLER_ADDRESS}</p>
            <p className="text-xs font-mono mt-1" style={{ color: "var(--color-ink-faint)" }}>
              ر.ض: {SELLER_VAT}
            </p>
          </div>

          {/* Customer */}
          <div>
            <p className="font-arabic text-xs font-semibold uppercase mb-2" style={{ color: "var(--color-ink-muted)", letterSpacing: "0.06em" }}>
              بيانات العميل
            </p>
            {order.customers ? (
              <>
                <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                  {order.customers.name_ar ?? order.customers.name}
                </p>
                {order.customers.phone && (
                  <p className="text-sm font-mono mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{order.customers.phone}</p>
                )}
                {order.customers.city && (
                  <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{order.customers.city}</p>
                )}
                {order.customers.tax_number && (
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                    ر.ض: {order.customers.tax_number}
                  </p>
                )}
              </>
            ) : (
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>نقدي</p>
            )}
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border-light)" }}>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>
                طريقة الدفع: <strong>{methodAr[order.payment_method] ?? order.payment_method ?? "—"}</strong>
              </p>
            </div>
          </div>

          {/* ZATCA QR */}
          <div className="flex flex-col items-center gap-1">
            <img
              src={qrUrl}
              alt="ZATCA QR"
              width={140}
              height={140}
              style={{ display: "block", borderRadius: 6 }}
            />
            <p className="text-xs text-center" style={{ color: "var(--color-ink-faint)" }}>
              ZATCA Phase 2
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="erp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>البيان</th>
              <th>الرقم</th>
              <th style={{ textAlign: "center" }}>الكمية</th>
              <th style={{ textAlign: "left" }}>سعر الوحدة</th>
              <th style={{ textAlign: "center" }}>خصم%</th>
              <th style={{ textAlign: "center" }}>ض.ق.م%</th>
              <th style={{ textAlign: "left" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item: any, idx: number) => (
              <tr key={item.id}>
                <td className="text-xs" style={{ color: "var(--color-ink-faint)", width: 28 }}>{idx + 1}</td>
                <td>
                  <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                    {item.parts?.name_ar ?? "—"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{item.parts?.name}</p>
                </td>
                <td className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>
                  {item.parts?.part_number}
                </td>
                <td className="font-mono text-sm text-center">{item.quantity}</td>
                <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                  {fmt(item.unit_price)}
                </td>
                <td className="text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  {item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}
                </td>
                <td className="text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  {item.parts?.tax_rate ?? 15}%
                </td>
                <td className="font-mono text-sm font-semibold" style={{ direction: "ltr", color: "var(--color-ink)" }}>
                  {fmt(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + VAT breakdown */}
        <div className="flex justify-between p-6" style={{ borderTop: "1px solid var(--color-border-light)" }}>
          {/* VAT note */}
          <div style={{ maxWidth: 280 }}>
            <p className="font-arabic text-xs font-semibold mb-2" style={{ color: "var(--color-ink-muted)" }}>
              ملاحظة ضريبية
            </p>
            <div
              className="p-3 rounded-lg"
              style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}
            >
              <p className="font-arabic text-xs leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
                هذه فاتورة ضريبية وفقاً لمتطلبات هيئة الزكاة والضريبة
                والجمارك (زاتكا) المرحلة الثانية.
              </p>
              <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-ink-faint)" }}>
                VAT Registration: {SELLER_VAT}
              </p>
            </div>
            {order.notes && (
              <div className="mt-3">
                <p className="font-arabic text-xs font-semibold mb-1" style={{ color: "var(--color-ink-muted)" }}>ملاحظات</p>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>{order.notes}</p>
              </div>
            )}
          </div>

          {/* Totals */}
          <div style={{ minWidth: 260 }}>
            {[
              ["المجموع قبل الضريبة", fmt(order.subtotal) + " ر.س"],
              ["الخصم", order.discount > 0 ? `-${fmt(order.discount)} ر.س` : "—"],
              ["ضريبة القيمة المضافة 15%", fmt(order.tax_amount) + " ر.س"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm mb-2">
                <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                <span className="font-mono" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{v}</span>
              </div>
            ))}
            <div
              className="flex justify-between pt-3"
              style={{ borderTop: "2px solid var(--color-gold)" }}
            >
              <span className="font-arabic font-bold text-base" style={{ color: "var(--color-ink)" }}>
                الإجمالي شامل الضريبة
              </span>
              <span className="font-mono font-bold text-xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>
                {fmt(order.total)} ر.س
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 text-center"
          style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border-light)" }}
        >
          <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>
            شكراً لتعاملكم معنا · للاستفسار يرجى التواصل معنا · جميع الأسعار شاملة ضريبة القيمة المضافة
          </p>
        </div>
      </div>
    </div>
  );
}
