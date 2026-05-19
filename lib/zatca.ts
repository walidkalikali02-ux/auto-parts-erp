// ZATCA Phase 2 — TLV encoder for e-invoice QR code
// Tags: 1=SellerName 2=VATNumber 3=Timestamp 4=TotalWithVAT 5=VATAmount

function encodeTLV(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const result = new Uint8Array(2 + valueBytes.length);
  result[0] = tag;
  result[1] = valueBytes.length;
  result.set(valueBytes, 2);
  return result;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
  return out;
}

export function buildZatcaQRData(params: {
  sellerName: string;
  vatNumber: string;
  invoiceDate: string;   // ISO string
  totalWithVat: number;
  vatAmount: number;
}): string {
  const tlv = concat(
    encodeTLV(1, params.sellerName),
    encodeTLV(2, params.vatNumber),
    encodeTLV(3, params.invoiceDate),
    encodeTLV(4, params.totalWithVat.toFixed(2)),
    encodeTLV(5, params.vatAmount.toFixed(2))
  );
  return Buffer.from(tlv).toString("base64");
}

export function getZatcaQRUrl(base64Data: string, size = 160): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(base64Data)}&format=png&ecc=M`;
}

export interface InvoiceData {
  orderNumber: string;
  orderDate: string;
  sellerName: string;
  sellerNameAr: string;
  sellerVat: string;
  sellerAddress: string;
  customerName?: string;
  customerNameAr?: string;
  customerVat?: string;
  subtotal: number;
  discount: number;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  items: {
    name: string;
    nameAr: string;
    partNumber: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    total: number;
    taxRate: number;
  }[];
}
