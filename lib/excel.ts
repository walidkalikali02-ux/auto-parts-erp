import * as XLSX from "xlsx";

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function exportInventory(rows: any[]) {
  const data = rows.map((r) => ({
    "رقم القطعة":     r.parts?.part_number ?? "",
    "اسم القطعة":     r.parts?.name_ar ?? r.parts?.name ?? "",
    "الكمية":          r.quantity,
    "حد إعادة الطلب": r.reorder_point ?? 0,
    "سعر التكلفة":    r.parts?.price_cost ?? 0,
    "سعر البيع":      r.parts?.price_retail ?? 0,
    "قيمة المخزون":   (r.quantity * (r.parts?.price_retail ?? 0)).toFixed(2),
    "المستودع":        r.warehouses?.name_ar ?? "",
    "الحالة":          r.quantity === 0 ? "نفذ" : r.quantity < (r.reorder_point ?? 5) ? "منخفض" : "متاح",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [14, 30, 10, 16, 14, 14, 16, 16, 10].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المخزون");
  downloadWorkbook(wb, `inventory-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportDailyReport(orders: any[], date: string) {
  const data = orders.map((o) => ({
    "رقم الطلب":      o.order_number,
    "العميل":          o.customers?.name_ar ?? "نقدي",
    "طريقة الدفع":    { cash: "نقدي", card: "بطاقة", transfer: "تحويل", credit: "آجل" }[o.payment_method as string] ?? o.payment_method,
    "المبلغ قبل الضريبة": Number(o.subtotal).toFixed(2),
    "ضريبة القيمة":   Number(o.tax_amount).toFixed(2),
    "الإجمالي":        Number(o.total).toFixed(2),
    "الحالة":          { confirmed: "مؤكد", delivered: "مُسلَّم", returned: "مُرتجع", cancelled: "ملغي", draft: "مسودة" }[o.status as string] ?? o.status,
    "الوقت":           new Date(o.created_at).toLocaleTimeString("ar-SA"),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [14, 24, 14, 20, 14, 14, 12, 12].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `تقرير ${date}`);
  downloadWorkbook(wb, `daily-report-${date}.xlsx`);
}

export function exportParts(parts: any[]) {
  const data = parts.map((p) => ({
    "رقم القطعة":     p.part_number,
    "الاسم بالعربية": p.name_ar,
    "الاسم بالإنجليزية": p.name ?? "",
    "الفئة":           p.part_categories?.name_ar ?? "",
    "الوحدة":          p.unit ?? "قطعة",
    "سعر التكلفة":    Number(p.price_cost).toFixed(2),
    "سعر التجزئة":    Number(p.price_retail).toFixed(2),
    "سعر الجملة":     Number(p.price_wholesale).toFixed(2),
    "الحالة":          p.is_active ? "نشط" : "غير نشط",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [14, 28, 28, 18, 10, 14, 14, 14, 10].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "القطع");
  downloadWorkbook(wb, `parts-catalog-${new Date().toISOString().split("T")[0]}.xlsx`);
}
