import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: part } = await supabase
    .from("parts")
    .select("*, part_categories(name, name_ar)")
    .eq("id", id)
    .single();

  if (!part) notFound();

  const { data: compat } = await supabase
    .from("part_compatibility")
    .select("*, car_models(id, name, name_ar, body_type, year_start, year_end, car_brands(name, name_ar, logo_url))")
    .eq("part_id", id)
    .order("created_at");

  const { data: stock } = await supabase
    .from("inventory")
    .select("quantity, quantity_reserved, location_code, warehouses(name, name_ar, city)")
    .eq("part_id", id);

  const totalQty = (stock ?? []).reduce((s, r) => s + r.quantity, 0);

  const conditionAr: Record<string, string> = {
    new: "جديد", used: "مستعمل", refurbished: "مجدد",
  };

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-ink-muted)" }}>
        <Link href="/catalog" className="hover:underline font-arabic">كتالوج القطع</Link>
        <span>/</span>
        <span className="font-arabic" style={{ color: "var(--color-ink)" }}>{part.name_ar}</span>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Main info */}
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
                  {part.name_ar}
                </h1>
                <p className="text-base" style={{ color: "var(--color-ink-muted)" }}>{part.name}</p>
              </div>
              <span
                className="badge"
                style={{
                  background: totalQty > 0 ? "var(--color-green-bg)" : "var(--color-red-bg)",
                  color: totalQty > 0 ? "var(--color-green)" : "var(--color-red)",
                }}
              >
                {totalQty > 0 ? `متوفر (${totalQty})` : "غير متوفر"}
              </span>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {[
                ["رقم القطعة", part.part_number, true],
                ["رقم OEM", part.oem_number ?? "—", true],
                ["الباركود", part.barcode ?? "—", true],
                ["الماركة", part.brand ?? "—", false],
                ["الفئة", (part as any).part_categories?.name_ar ?? "—", false],
                ["الحالة", conditionAr[part.condition] ?? part.condition, false],
                ["الوزن", part.weight_kg ? `${part.weight_kg} كغ` : "—", false],
                ["الوحدة", part.unit, false],
              ].map(([label, value, mono]) => (
                <div
                  key={label as string}
                  className="flex flex-col gap-1 p-3 rounded-lg"
                  style={{ background: "var(--color-surface)" }}
                >
                  <span className="text-xs font-arabic" style={{ color: "var(--color-ink-muted)" }}>
                    {label as string}
                  </span>
                  <span
                    className={`text-sm font-medium ${mono ? "font-mono" : "font-arabic"}`}
                    style={{ color: mono ? "var(--color-gold)" : "var(--color-ink-2)" }}
                  >
                    {value as string}
                  </span>
                </div>
              ))}
            </div>

            {part.description_ar && (
              <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--color-surface)" }}>
                <p className="font-arabic text-sm mb-1" style={{ color: "var(--color-ink-muted)" }}>الوصف</p>
                <p className="font-arabic text-sm leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
                  {part.description_ar}
                </p>
              </div>
            )}
          </div>

          {/* Compatibility Table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                التوافق مع السيارات
                <span
                  className="mr-2 text-sm font-normal"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  ({(compat ?? []).length} موديل)
                </span>
              </h2>
            </div>
            {!compat || compat.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-4xl opacity-20">🚗</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  لم يتم تحديد توافق بعد
                </p>
              </div>
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>الماركة</th>
                    <th>الموديل</th>
                    <th>نوع الهيكل</th>
                    <th>سنوات التوافق</th>
                    <th>كود المحرك</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {compat.map((c: any) => (
                    <tr key={c.id}>
                      <td className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>
                        {c.car_models?.car_brands?.name_ar ?? c.car_models?.car_brands?.name ?? "—"}
                      </td>
                      <td className="font-arabic">{c.car_models?.name_ar ?? c.car_models?.name ?? "—"}</td>
                      <td>
                        {c.car_models?.body_type ? (
                          <span className="badge" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}>
                            {c.car_models.body_type}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                        {c.year_from && c.year_to
                          ? `${c.year_from} – ${c.year_to}`
                          : c.year_from ?? c.year_to ?? "—"}
                      </td>
                      <td className="font-mono text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {c.engine_code ?? "—"}
                      </td>
                      <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                        {c.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar: pricing + stock */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>
              الأسعار
            </h3>
            <div className="flex flex-col gap-3">
              {[
                ["سعر التكلفة", part.price_cost],
                ["سعر البيع", part.price_retail],
                ["سعر الجملة", part.price_wholesale ?? null],
              ].map(([label, price]) => (
                price !== null && (
                  <div key={label as string} className="flex justify-between items-center">
                    <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {label as string}
                    </span>
                    <span
                      className="font-mono font-semibold"
                      style={{ color: "var(--color-ink)", direction: "ltr" }}
                    >
                      {Number(price).toLocaleString("ar-SA")}{" "}
                      <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                    </span>
                  </div>
                )
              ))}
              <div
                className="flex justify-between items-center pt-3"
                style={{ borderTop: "1px solid var(--color-border-light)" }}
              >
                <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>ضريبة القيمة</span>
                <span className="font-mono text-sm" style={{ color: "var(--color-ink-2)" }}>
                  {part.tax_rate}%
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-arabic font-semibold mb-4" style={{ color: "var(--color-ink)" }}>
              المخزون
            </h3>
            {!stock || stock.length === 0 ? (
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                لا يوجد مخزون مسجل
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {stock.map((s: any, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {s.warehouses?.name_ar ?? s.warehouses?.name}
                      </span>
                      <span
                        className="font-mono font-bold text-lg"
                        style={{ color: s.quantity < 5 ? "var(--color-red)" : "var(--color-green)" }}
                      >
                        {s.quantity}
                      </span>
                    </div>
                    {s.location_code && (
                      <p className="text-xs font-mono" style={{ color: "var(--color-ink-faint)" }}>
                        موقع: {s.location_code}
                      </p>
                    )}
                    {s.quantity_reserved > 0 && (
                      <p className="font-arabic text-xs" style={{ color: "var(--color-amber)" }}>
                        محجوز: {s.quantity_reserved}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/catalog" className="btn btn-outline w-full justify-center">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="font-arabic">العودة للكتالوج</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
