"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const DEFAULT_TENANT    = "d0000000-0000-0000-0000-000000000001";
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

const reasons = [
  "قطعة خاطئة",
  "قطعة معيبة",
  "تلف عند الاستلام",
  "غير متوافقة مع السيارة",
  "طلب العميل",
  "أخرى",
];

function genNum() { return `RET-${Date.now().toString().slice(-7)}`; }

function ReturnsForm() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order_id") ?? "";

  const [order, setOrder]         = useState<any>(null);
  const [items, setItems]         = useState<any[]>([]);
  const [selected, setSelected]   = useState<Record<string, number>>({});
  const [reason, setReason]       = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderResults, setOrderResults] = useState<any[]>([]);

  async function loadOrder(id: string) {
    const { data: o } = await supabase
      .from("sales_orders")
      .select("*, customers(name_ar)")
      .eq("id", id).single();
    if (!o) return;
    setOrder(o);
    const { data: it } = await supabase
      .from("sales_order_items")
      .select("*, parts(part_number, name_ar)")
      .eq("order_id", id);
    setItems(it ?? []);
    setSelected({});
  }

  useEffect(() => { if (orderId) loadOrder(orderId); }, [orderId]);

  useEffect(() => {
    if (!orderSearch.trim()) { setOrderResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, order_number, order_date, customers(name_ar)")
        .ilike("order_number", `%${orderSearch}%`)
        .limit(6);
      setOrderResults(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [orderSearch]);

  function toggleItem(itemId: string, maxQty: number) {
    setSelected((prev) =>
      prev[itemId] ? { ...prev, [itemId]: 0 } : { ...prev, [itemId]: maxQty }
    );
  }

  async function handleReturn() {
    const returnItems = items.filter((i) => (selected[i.id] ?? 0) > 0);
    if (returnItems.length === 0) { setError("اختر قطعة واحدة على الأقل"); return; }
    if (!reason) { setError("اختر سبب الإرجاع"); return; }

    setSaving(true); setError("");
    const total = returnItems.reduce((s, i) => s + (selected[i.id] ?? 0) * i.unit_price, 0);

    const { data: ret, error: err } = await supabase
      .from("sales_orders")
      .insert({
        tenant_id: DEFAULT_TENANT,
        order_number: genNum(),
        customer_id: order?.customer_id ?? null,
        warehouse_id: DEFAULT_WAREHOUSE,
        status: "returned",
        payment_status: "refunded",
        payment_method: order?.payment_method ?? "cash",
        subtotal: -total,
        discount: 0,
        tax_amount: -(total * 0.15),
        total: -(total * 1.15),
        notes: `إرجاع من طلب #${order?.order_number} — ${reason}${notes ? ` — ${notes}` : ""}`,
      })
      .select().single();

    if (err || !ret) { setError(err?.message ?? "خطأ"); setSaving(false); return; }

    await supabase.from("sales_order_items").insert(
      returnItems.map((i) => ({
        order_id: ret.id,
        part_id: i.parts?.id ?? i.part_id,
        quantity: selected[i.id],
        unit_price: i.unit_price,
        discount_pct: 0,
      }))
    );

    // Restore inventory
    await Promise.all(returnItems.map((i) =>
      supabase.from("inventory").select("quantity,id")
        .eq("part_id", i.part_id).eq("warehouse_id", DEFAULT_WAREHOUSE).single()
        .then(({ data }) => data
          ? supabase.from("inventory").update({ quantity: data.quantity + (selected[i.id] ?? 0) }).eq("id", data.id)
          : null
        )
    ));

    router.push(`/orders/sales/${ret.id}`);
  }

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2 });
  const totalReturn = items
    .filter((i) => (selected[i.id] ?? 0) > 0)
    .reduce((s, i) => s + (selected[i.id] ?? 0) * i.unit_price * 1.15, 0);

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>إرجاع بضاعة</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>إنشاء طلب إرجاع وإعادة للمخزون</p>
        </div>
      </div>

      {/* Order selector */}
      {!order ? (
        <div className="card p-6 mb-4">
          <label className="block font-arabic text-sm font-medium mb-2" style={{ color: "var(--color-ink-2)" }}>
            رقم الطلب الأصلي
          </label>
          <div className="relative">
            <input
              className="input"
              placeholder="ابحث برقم الطلب..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
            {orderResults.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 card overflow-hidden z-10"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                {orderResults.map((o: any) => (
                  <button
                    key={o.id}
                    className="w-full flex items-center justify-between px-4 py-3 text-right"
                    style={{ borderBottom: "1px solid var(--color-border-light)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                    onClick={() => { loadOrder(o.id); setOrderSearch(""); setOrderResults([]); }}
                  >
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-gold)" }}>
                      #{o.order_number}
                    </span>
                    <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {o.customers?.name_ar ?? "نقدي"} · {new Date(o.order_date).toLocaleDateString("ar-SA")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Order info */}
          <div className="card p-4 mb-4 flex items-center justify-between"
            style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
            <div>
              <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                طلب #{order.order_number} · {order.customers?.name_ar ?? "نقدي"}
              </p>
              <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                {new Date(order.order_date).toLocaleDateString("ar-SA")}
              </p>
            </div>
            <button className="btn btn-ghost text-xs" onClick={() => { setOrder(null); setItems([]); setSelected({}); }}>
              <span className="font-arabic">تغيير</span>
            </button>
          </div>

          {/* Items */}
          <div className="card overflow-hidden mb-4">
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <p className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
                اختر القطع المُرجعة
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--color-border-light)" }}>
              {items.map((item: any) => {
                const qty = selected[item.id] ?? 0;
                const checked = qty > 0;
                return (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3"
                    style={{ background: checked ? "var(--color-gold-bg)" : "#fff" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id, item.quantity)}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--color-gold)" }}
                    />
                    <div className="flex-1">
                      <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        {item.parts?.name_ar}
                      </p>
                      <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>
                        {item.parts?.part_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {checked && (
                        <>
                          <button
                            onClick={() => setSelected((p) => ({ ...p, [item.id]: Math.max(1, (p[item.id] ?? 1) - 1) }))}
                            className="w-7 h-7 rounded flex items-center justify-center font-bold"
                            style={{ background: "var(--color-surface)" }}
                          >−</button>
                          <span className="font-mono font-bold w-6 text-center">{qty}</span>
                          <button
                            onClick={() => setSelected((p) => ({ ...p, [item.id]: Math.min(item.quantity, (p[item.id] ?? 1) + 1) }))}
                            className="w-7 h-7 rounded flex items-center justify-center font-bold"
                            style={{ background: "var(--color-surface)" }}
                          >+</button>
                        </>
                      )}
                      <span className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                        / {item.quantity}
                      </span>
                      <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr", minWidth: 80, textAlign: "right" }}>
                        {fmt(item.unit_price)} ر.س
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div className="card p-5 mb-4 flex flex-col gap-3">
            <div>
              <label className="block font-arabic text-sm font-medium mb-2" style={{ color: "var(--color-ink-2)" }}>
                سبب الإرجاع *
              </label>
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className="badge cursor-pointer transition-all"
                    style={{
                      padding: "6px 12px",
                      background: reason === r ? "var(--color-ink)" : "var(--color-surface)",
                      color: reason === r ? "#fff" : "var(--color-ink-muted)",
                      border: `1px solid ${reason === r ? "var(--color-ink)" : "var(--color-border)"}`,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
                ملاحظات إضافية
              </label>
              <textarea className="input" rows={2} style={{ resize: "none" }}
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل إضافية..." />
            </div>
          </div>

          {/* Total + Submit */}
          {totalReturn > 0 && (
            <div className="card p-5 flex items-center justify-between mb-4"
              style={{ background: "var(--color-red-bg)", border: "1px solid rgba(192,57,43,0.2)" }}>
              <span className="font-arabic font-medium" style={{ color: "var(--color-red)" }}>
                إجمالي المبلغ المُسترد
              </span>
              <span className="font-mono font-bold text-xl" style={{ color: "var(--color-red)", direction: "ltr" }}>
                {fmt(totalReturn)} ر.س
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm font-arabic"
              style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full justify-center"
            style={{ padding: "13px 0", fontSize: 15 }}
            onClick={handleReturn}
            disabled={saving}
          >
            {saving && <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
            <span className="font-arabic font-bold">تأكيد الإرجاع</span>
          </button>
        </>
      )}
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" /></svg></div>}>
      <ReturnsForm />
    </Suspense>
  );
}
