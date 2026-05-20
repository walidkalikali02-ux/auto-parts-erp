"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface OrderItem { name: string; partNumber: string; qty: number; price: number; taxRate: number; }

interface Props {
  orderId:      string;
  orderStatus:  string;
  orderNumber:  string;
  total:        number;
  taxAmount:    number;
  subtotal:     number;
  customerName: string;
  customerPhone:string;
  customerVat:  string;
  sellerName:   string;
  sellerVat:    string;
  createdAt:    string;
  items:        OrderItem[];
}

function buildZatcaXml(p: Props): string {
  const fmt = (n: number) => n.toFixed(2);
  const date = new Date(p.createdAt).toISOString().split("T")[0];
  const time = new Date(p.createdAt).toISOString().split("T")[1].split(".")[0];

  const itemLines = p.items.map((i, idx) => {
    const lineTotal = i.qty * i.price;
    const lineTax   = lineTotal * (i.taxRate / 100);
    return `
      <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${i.qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${fmt(lineTotal)}</cbc:LineExtensionAmount>
        <cac:Item>
          <cbc:Name>${i.name}</cbc:Name>
          <cac:SellersItemIdentification><cbc:ID>${i.partNumber}</cbc:ID></cac:SellersItemIdentification>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="SAR">${fmt(i.price)}</cbc:PriceAmount>
        </cac:Price>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="SAR">${fmt(lineTax)}</cbc:TaxAmount>
          <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${fmt(lineTotal)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${fmt(lineTax)}</cbc:TaxAmount>
            <cac:TaxCategory>
              <cbc:ID>S</cbc:ID>
              <cbc:Percent>${i.taxRate}</cbc:Percent>
              <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:TaxSubtotal>
        </cac:TaxTotal>
      </cac:InvoiceLine>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${p.orderNumber}</cbc:ID>
  <cbc:UUID>${p.orderId}</cbc:UUID>
  <cbc:IssueDate>${date}</cbc:IssueDate>
  <cbc:IssueTime>${time}Z</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${p.sellerName}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${p.sellerVat}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${p.customerName}</cbc:Name></cac:PartyName>
      ${p.customerVat ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${p.customerVat}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${fmt(p.taxAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${fmt(p.subtotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${fmt(p.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${fmt(p.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${fmt(p.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${fmt(p.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${fmt(p.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${itemLines}
</Invoice>`;
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildWhatsAppMsg(p: Props): string {
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2 });
  const lines = p.items.map((i) => `• ${i.name} × ${i.qty} = ${fmt(i.qty * i.price)} ر.س`).join("\n");
  return encodeURIComponent(
    `🧾 *فاتورة #${p.orderNumber}*\n\n` +
    `العميل: ${p.customerName}\n` +
    `التاريخ: ${new Date(p.createdAt).toLocaleDateString("ar-SA")}\n\n` +
    `*القطع:*\n${lines}\n\n` +
    `المجموع قبل الضريبة: ${fmt(p.subtotal)} ر.س\n` +
    `ضريبة القيمة المضافة (15%): ${fmt(p.taxAmount)} ر.س\n` +
    `*الإجمالي: ${fmt(p.total)} ر.س*`
  );
}

export function InvoiceActions(props: Props) {
  const { orderId, orderStatus, orderNumber, customerPhone } = props;
  const router   = useRouter();
  const [updating, setUpdating] = useState(false);

  async function markPaid() {
    setUpdating(true);
    await supabase.from("sales_orders").update({ payment_status: "paid" }).eq("id", orderId);
    router.refresh(); setUpdating(false);
  }

  async function markDelivered() {
    setUpdating(true);
    await supabase.from("sales_orders").update({ status: "delivered" }).eq("id", orderId);
    router.refresh(); setUpdating(false);
  }

  const waPhone = customerPhone.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "966");
  const waUrl   = `https://wa.me/${waPhone}?text=${buildWhatsAppMsg(props)}`;
  const waShare = !waPhone
    ? `https://wa.me/?text=${buildWhatsAppMsg(props)}`
    : waUrl;

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
        <span className="font-arabic">مدفوع</span>
      </button>

      {/* WhatsApp share */}
      <a
        href={waShare}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline"
        style={{ background: "#dcfce7", color: "#16a34a", borderColor: "transparent" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.126 1.529 5.859L.057 23.428a.5.5 0 00.609.611l5.63-1.476A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.908a9.9 9.9 0 01-5.032-1.366l-.361-.213-3.74.98.998-3.647-.234-.374A9.859 9.859 0 012.091 12C2.091 6.533 6.533 2.091 12 2.091S21.909 6.533 21.909 12 17.467 21.908 12 21.908z"/>
        </svg>
        <span className="font-arabic">واتساب</span>
      </a>

      {/* ZATCA XML download */}
      <button
        className="btn btn-outline"
        style={{ color: "var(--color-blue)", borderColor: "var(--color-blue)" }}
        onClick={() => downloadXml(buildZatcaXml(props), `invoice-${orderNumber}.xml`)}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-arabic">ZATCA XML</span>
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
