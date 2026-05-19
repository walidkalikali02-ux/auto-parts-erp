"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const DEFAULT_TENANT    = "d0000000-0000-0000-0000-000000000001";
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

interface CartItem {
  part_id: string;
  part_number: string;
  name_ar: string;
  unit_price: number;
  quantity: number;
  available: number;
}

const paymentMethods = [
  { key: "cash",     label: "نقدي",        icon: "💵" },
  { key: "card",     label: "بطاقة",       icon: "💳" },
  { key: "transfer", label: "تحويل",       icon: "🏦" },
  { key: "credit",   label: "آجل",         icon: "📋" },
];

function genNum() { return `POS-${Date.now().toString().slice(-7)}`; }
function fmt(n: number) { return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function POSPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase.from("customers").select("id,name,name_ar,credit_limit,balance")
      .eq("is_active", true).order("name_ar").limit(50)
      .then(({ data }) => setCustomers(data ?? []));
    searchRef.current?.focus();
  }, []);

  const searchParts = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const { data } = await supabase
      .from("parts")
      .select("id,part_number,name_ar,price_retail,unit")
      .eq("is_active", true)
      .or(`name.ilike.%${q}%,name_ar.ilike.%${q}%,part_number.ilike.%${q}%,barcode.eq.${q}`)
      .limit(6);
    setResults(data ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchParts(search), 250);
    return () => clearTimeout(t);
  }, [search, searchParts]);

  async function addToCart(p: any) {
    const existing = cart.find((c) => c.part_id === p.id);
    if (existing) {
      setCart((prev) => prev.map((c) => c.part_id === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const { data: inv } = await supabase
        .from("inventory").select("quantity")
        .eq("part_id", p.id).eq("warehouse_id", DEFAULT_WAREHOUSE).single();
      setCart((prev) => [...prev, {
        part_id: p.id,
        part_number: p.part_number,
        name_ar: p.name_ar,
        unit_price: p.price_retail,
        quantity: 1,
        available: inv?.quantity ?? 0,
      }]);
    }
    setSearch("");
    setResults([]);
    searchRef.current?.focus();
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart((p) => p.filter((c) => c.part_id !== id)); return; }
    setCart((p) => p.map((c) => c.part_id === id ? { ...c, quantity: qty } : c));
  }

  function removeItem(id: string) { setCart((p) => p.filter((c) => c.part_id !== id)); }
  function clearCart() { setCart([]); setCustomerId(""); setPayMethod("cash"); setError(""); }

  const subtotal  = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const taxAmount = subtotal * 0.15;
  const total     = subtotal + taxAmount;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const creditAvailable = selectedCustomer
    ? selectedCustomer.credit_limit - selectedCustomer.balance
    : Infinity;

  async function handleSale() {
    if (cart.length === 0) { setError("السلة فارغة"); return; }
    const overStock = cart.find((c) => c.quantity > c.available);
    if (overStock) { setError(`مخزون "${overStock.name_ar}" غير كافٍ (متاح: ${overStock.available})`); return; }
    if (payMethod === "credit" && customerId && total > creditAvailable) {
      setError(`رصيد الائتمان غير كافٍ (المتاح: ${fmt(creditAvailable)} ر.س)`);
      return;
    }

    setSaving(true); setError("");
    const { data: order, error: err } = await supabase
      .from("sales_orders")
      .insert({
        tenant_id: DEFAULT_TENANT,
        order_number: genNum(),
        customer_id: customerId || null,
        warehouse_id: DEFAULT_WAREHOUSE,
        status: "delivered",
        payment_status: payMethod === "credit" ? "unpaid" : "paid",
        payment_method: payMethod,
        subtotal, discount: 0, tax_amount: taxAmount, total,
      })
      .select().single();

    if (err || !order) { setError(err?.message ?? "خطأ"); setSaving(false); return; }

    await supabase.from("sales_order_items").insert(
      cart.map((c) => ({ order_id: order.id, part_id: c.part_id, quantity: c.quantity, unit_price: c.unit_price, discount_pct: 0 }))
    );

    // Deduct inventory
    await Promise.all(cart.map((c) =>
      supabase.from("inventory").select("quantity").eq("part_id", c.part_id).eq("warehouse_id", DEFAULT_WAREHOUSE)
        .single().then(({ data }) => data
          ? supabase.from("inventory").update({ quantity: Math.max(0, data.quantity - c.quantity) })
              .eq("part_id", c.part_id).eq("warehouse_id", DEFAULT_WAREHOUSE)
          : null
        )
    ));

    setSuccess(`✅ تم البيع! رقم الطلب: ${order.order_number}`);
    clearCart();
    setSaving(false);
    setTimeout(() => {
      setSuccess("");
      router.push(`/orders/sales/${order.id}`);
    }, 1800);
  }

  return (
    <div className="flex-1 flex h-full" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* LEFT — Cart */}
      <div className="flex flex-col" style={{ width: 420, background: "#fff", borderLeft: "1px solid var(--color-border)", flexShrink: 0 }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>نقطة البيع</h2>
          <span className="badge" style={{ background: "var(--color-gold-bg)", color: "var(--color-gold)" }}>POS</span>
        </div>

        {/* Customer + Payment */}
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <select className="input text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">عميل نقدي (بدون حساب)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name_ar ?? c.name}</option>)}
          </select>
          {selectedCustomer && (
            <p className="font-arabic text-xs" style={{ color: creditAvailable < 0 ? "var(--color-red)" : "var(--color-green)" }}>
              حد الائتمان المتاح: {fmt(creditAvailable)} ر.س
            </p>
          )}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {paymentMethods.map((m) => (
              <button
                key={m.key}
                onClick={() => setPayMethod(m.key)}
                className="flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all"
                style={{
                  background: payMethod === m.key ? "var(--color-gold-bg)" : "var(--color-surface)",
                  borderColor: payMethod === m.key ? "var(--color-gold)" : "var(--color-border)",
                  color: payMethod === m.key ? "var(--color-gold)" : "var(--color-ink-muted)",
                }}
              >
                <span className="text-base">{m.icon}</span>
                <span className="font-arabic text-xs">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
              <span className="text-5xl">🛒</span>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                ابحث عن القطعة وأضفها
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((item) => (
                <div key={item.part_id} className="card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-arabic text-sm font-medium truncate" style={{ color: "var(--color-ink)" }}>
                      {item.name_ar}
                    </p>
                    <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{item.part_number}</p>
                    <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                      {fmt(item.unit_price)} ر.س × {item.quantity} = {fmt(item.quantity * item.unit_price)} ر.س
                    </p>
                    {item.quantity > item.available && (
                      <p className="font-arabic text-xs" style={{ color: "var(--color-red)" }}>
                        متاح: {item.available} فقط
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.part_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                      style={{ background: "var(--color-surface)", color: "var(--color-ink-muted)" }}
                    >−</button>
                    <span className="font-mono text-sm font-bold w-6 text-center" style={{ color: "var(--color-ink)" }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.part_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                      style={{ background: "var(--color-surface)", color: "var(--color-ink-muted)" }}
                    >+</button>
                  </div>
                  <button
                    onClick={() => removeItem(item.part_id)}
                    style={{ color: "var(--color-ink-faint)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Checkout */}
        <div className="px-4 py-4" style={{ borderTop: "2px solid var(--color-border)" }}>
          <div className="flex flex-col gap-1 mb-3">
            {[["قبل الضريبة", fmt(subtotal) + " ر.س"], ["ضريبة 15%", fmt(taxAmount) + " ر.س"]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                <span className="font-mono" style={{ color: "var(--color-ink-2)", direction: "ltr" }}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between items-baseline mt-1 pt-2" style={{ borderTop: "2px solid var(--color-border)" }}>
              <span className="font-arabic font-bold text-base" style={{ color: "var(--color-ink)" }}>الإجمالي</span>
              <span className="font-mono font-bold text-2xl" style={{ color: "var(--color-gold)", direction: "ltr" }}>
                {fmt(total)} ر.س
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs font-arabic" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg px-3 py-2 mb-3 text-sm font-arabic text-center font-semibold" style={{ background: "var(--color-green-bg)", color: "var(--color-green)" }}>
              {success}
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-outline flex-1 justify-center" onClick={clearCart} disabled={saving}>
              <span className="font-arabic">مسح</span>
            </button>
            <button
              className="btn btn-gold flex-1 justify-center text-base"
              style={{ padding: "14px 0", fontSize: 15 }}
              onClick={handleSale}
              disabled={saving || cart.length === 0}
            >
              {saving ? (
                <svg className="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg>}
              <span className="font-arabic font-bold">بيع</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — Search + numpad */}
      <div className="flex-1 flex flex-col p-6 gap-4">
        {/* Search */}
        <div className="relative">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute" style={{ top: "50%", right: 14, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            className="input"
            style={{ paddingRight: 44, fontSize: 18, height: 54 }}
            placeholder="ابحث أو امسح الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="card p-4 text-right flex flex-col gap-1 transition-all hover:shadow-md"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-gold)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
              >
                <p className="font-arabic font-semibold text-sm leading-tight" style={{ color: "var(--color-ink)" }}>
                  {p.name_ar}
                </p>
                <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                <p className="font-mono font-bold text-lg mt-1" style={{ color: "var(--color-ink)", direction: "ltr", textAlign: "right" }}>
                  {p.price_retail.toLocaleString("ar-SA")} ر.س
                </p>
              </button>
            ))}
          </div>
        )}

        {results.length === 0 && cart.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30">
            <svg width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="var(--color-gold)" strokeWidth={0.8}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="font-arabic text-lg" style={{ color: "var(--color-ink-muted)" }}>
              ابحث عن قطعة لإضافتها للسلة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
