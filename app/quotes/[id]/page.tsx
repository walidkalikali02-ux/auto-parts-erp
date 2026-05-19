import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QuoteActions } from "./QuoteActions";

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)", label: "مسودة" },
  sent:      { bg: "var(--color-blue-bg)",   color: "var(--color-blue)",      label: "مُرسل للعميل" },
  accepted:  { bg: "var(--color-green-bg)",  color: "var(--color-green)",     label: "مقبول" },
  rejected:  { bg: "var(--color-red-bg)",    color: "var(--color-red)",       label: "مرفوض" },
  expired:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)",     label: "منتهي الصلاحية" },
  converted: { bg: "var(--color-gold-bg)",   color: "var(--color-gold)",      label: "تحوّل لطلب بيع" },
};

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, customers(name, name_ar, phone, city, tax_number)")
    .eq("id", id).single();

  if (!quote) notFound();

  const { data: items } = await supabase
    .from("quote_items")
    .select("*, parts(part_number, name, name_ar, unit)")
    .eq("quote_id", id);

  const s = statusMap[quote.status] ?? statusMap.draft;
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center gap-2 text-sm mb-6 no-print" style={{ color: "var(--color-ink-muted)" }}>
        <Link href="/quotes" className="hover:underline font-arabic">عروض الأسعار</Link>
        <span>/</span>
        <span className="font-mono" style={{ color: "var(--color-ink)" }}>#{quote.quote_number}</span>
      </div>

      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl font-bold" style={{ color: "var(--color-ink)" }}>#{quote.quote_number}</h1>
          <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          {isExpired && quote.status === "sent" && (
            <span className="badge" style={{ background: "var(--color-amber-bg)", color: "var(--color-amber)" }}>منتهي</span>
          )}
        </div>
        <QuoteActions quoteId={id} status={quote.status} items={items ?? []} quote={quote} />
      </div>

      {/* Quote document */}
      <div id="quote-print" className="card overflow-hidden">
        {/* Header */}
        <div className="p-6 flex items-start justify-between"
          style={{ background: "var(--color-gold-bg)", borderBottom: "2px solid var(--color-gold-dim)" }}>
          <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <polygon points="22,2 42,12 42,32 22,42 2,32 2,12" fill="var(--color-gold-dim)" stroke="var(--color-gold)" strokeWidth="1.5" />
              <circle cx="22" cy="22" r="7" fill="var(--color-gold)" opacity="0.8" />
            </svg>
            <div>
              <p className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>شركة قطع الغيار</p>
              <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>Auto Parts Co.</p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-arabic text-2xl font-bold" style={{ color: "var(--color-gold)" }}>عرض سعر</p>
            <p className="font-mono text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>#{quote.quote_number}</p>
            <p className="font-arabic text-xs mt-1" style={{ color: "var(--color-ink-muted)" }}>
              التاريخ: {new Date(quote.created_at).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>

        {/* Customer + validity */}
        <div className="grid p-6 gap-6" style={{ gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--color-border-light)" }}>
          <div>
            <p className="font-arabic text-xs font-semibold uppercase mb-2" style={{ color: "var(--color-ink-muted)", letterSpacing: "0.06em" }}>مقدَّم إلى</p>
            {quote.customers ? (
              <>
                <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>{quote.customers.name_ar ?? quote.customers.name}</p>
                {quote.customers.phone && <p className="font-mono text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{quote.customers.phone}</p>}
                {quote.customers.city && <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{quote.customers.city}</p>}
              </>
            ) : <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>—</p>}
          </div>
          <div>
            <p className="font-arabic text-xs font-semibold uppercase mb-2" style={{ color: "var(--color-ink-muted)", letterSpacing: "0.06em" }}>تفاصيل العرض</p>
            {[
              ["رقم العرض", `#${quote.quote_number}`],
              ["تاريخ الإصدار", new Date(quote.created_at).toLocaleDateString("ar-SA")],
              ["صالح حتى", quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("ar-SA") : "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm mb-1">
                <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                <span className="font-mono" style={{ color: "var(--color-ink-2)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Items */}
        <table className="erp-table">
          <thead>
            <tr><th>#</th><th>البيان</th><th>الرقم</th><th style={{ textAlign: "center" }}>الكمية</th><th style={{ textAlign: "left" }}>سعر الوحدة</th><th style={{ textAlign: "center" }}>خصم%</th><th style={{ textAlign: "left" }}>الإجمالي</th></tr>
          </thead>
          <tbody>
            {(items ?? []).map((item: any, idx: number) => (
              <tr key={item.id}>
                <td className="text-xs" style={{ color: "var(--color-ink-faint)", width: 28 }}>{idx + 1}</td>
                <td>
                  <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{item.parts?.name_ar}</p>
                  <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{item.parts?.name}</p>
                </td>
                <td className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{item.parts?.part_number}</td>
                <td className="font-mono text-sm text-center">{item.quantity}</td>
                <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmt(item.unit_price)} ر.س</td>
                <td className="text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>{item.discount_pct > 0 ? `${item.discount_pct}%` : "—"}</td>
                <td className="font-mono text-sm font-semibold" style={{ direction: "ltr", color: "var(--color-ink)" }}>{fmt(item.total)} ر.س</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end p-6" style={{ borderTop: "1px solid var(--color-border-light)" }}>
          <div style={{ minWidth: 260 }}>
            {[["المجموع الفرعي", fmt(quote.subtotal) + " ر.س"], ["ضريبة القيمة 15%", fmt(quote.tax_amount) + " ر.س"]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm mb-2">
                <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                <span className="font-mono" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3" style={{ borderTop: "2px solid var(--color-gold)" }}>
              <span className="font-arabic font-bold text-base" style={{ color: "var(--color-ink)" }}>الإجمالي</span>
              <span className="font-mono font-bold text-xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>{fmt(quote.total)} ر.س</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="px-6 pb-5">
            <p className="font-arabic text-xs font-semibold mb-1" style={{ color: "var(--color-ink-muted)" }}>ملاحظات</p>
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>{quote.notes}</p>
          </div>
        )}

        <div className="px-6 py-4 text-center" style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border-light)" }}>
          <p className="font-arabic text-xs" style={{ color: "var(--color-ink-faint)" }}>
            هذا العرض سعر غير ملزم · يُرجى تأكيد الطلب خلال مدة الصلاحية · شكراً لتعاملكم معنا
          </p>
        </div>
      </div>
    </div>
  );
}
