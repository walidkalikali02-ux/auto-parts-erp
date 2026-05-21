"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";

const DEFAULT_TENANT    = "d0000000-0000-0000-0000-000000000001";
const DEFAULT_WAREHOUSE = "e0000000-0000-0000-0000-000000000001";

function getStatusLabel(status: string, language: "ar" | "en"): { bg: string; color: string; label: string } {
  const statusMap: Record<string, { bg: string; color: string }> = {
    draft:     { bg: "var(--color-surface-2)", color: "var(--color-ink-muted)" },
    sent:      { bg: "var(--color-blue-bg)",   color: "var(--color-blue)" },
    confirmed: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)" },
    partial:   { bg: "var(--color-amber-bg)",  color: "var(--color-amber)" },
    received:  { bg: "var(--color-green-bg)",  color: "var(--color-green)" },
    cancelled: { bg: "var(--color-red-bg)",    color: "var(--color-red)" },
  };

  const colors = statusMap[status] ?? statusMap.draft;
  const keyMap: Record<string, string> = {
    draft: "order.status.draft",
    sent: "order.status.sent",
    confirmed: "order.status.confirmed",
    partial: "order.status.partial_receive",
    received: "order.status.received",
    cancelled: "order.status.cancelled",
  };

  return {
    ...colors,
    label: t(keyMap[status] ?? "order.status.draft", language),
  };
}

interface POLine {
  part_id:      string;
  part_number:  string;
  name_ar:      string;
  unit:         string;
  unit_cost:    number;
  quantity:     number;
}

interface ReceiveLine {
  item_id:          string;
  part_id:          string;
  name_ar:          string;
  part_number:      string;
  ordered_qty:      number;
  received_so_far:  number;
  receiving_qty:    number;
}

function genPONumber() { return `PO-${Date.now().toString().slice(-8)}`; }
const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PurchaseOrdersPage() {
  const { language } = useLanguage();
  const [orders,    setOrders]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [status,    setStatus]    = useState("");
  const [search,    setSearch]    = useState("");
  const [updating,  setUpdating]  = useState<string | null>(null);

  // ── Create PO modal ──────────────────────────────────────────
  const [showCreate,   setShowCreate]   = useState(false);
  const [suppliers,    setSuppliers]    = useState<any[]>([]);
  const [supplierId,   setSupplierId]   = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes,      setPoNotes]      = useState("");
  const [poLines,      setPoLines]      = useState<POLine[]>([]);
  const [partSearch,   setPartSearch]   = useState("");
  const [partResults,  setPartResults]  = useState<any[]>([]);
  const [creating,     setCreating]     = useState(false);
  const [createErr,    setCreateErr]    = useState("");

  // ── Receive goods modal ──────────────────────────────────────
  const [showReceive,   setShowReceive]   = useState(false);
  const [receiveOrder,  setReceiveOrder]  = useState<any>(null);
  const [receiveLines,  setReceiveLines]  = useState<ReceiveLine[]>([]);
  const [receiveNotes,  setReceiveNotes]  = useState("");
  const [receiving,     setReceiving]     = useState(false);
  const [receiveErr,    setReceiveErr]    = useState("");

  // ── View detail modal ────────────────────────────────────────
  const [viewOrder, setViewOrder] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("purchase_orders")
      .select("*, suppliers(name, name_ar, phone, email)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data } = await q;
    let rows = data ?? [];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((o) =>
        o.po_number?.toLowerCase().includes(s) ||
        o.suppliers?.name_ar?.includes(search) ||
        o.suppliers?.name?.toLowerCase().includes(s)
      );
    }
    setOrders(rows);
    setLoading(false);
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (showCreate && suppliers.length === 0) {
      supabase.from("suppliers").select("id,name,name_ar,phone").eq("is_active", true).order("name_ar")
        .then(({ data }) => setSuppliers(data ?? []));
    }
  }, [showCreate, suppliers.length]);

  // Part search for PO
  const searchParts = useCallback(async (q: string) => {
    if (!q.trim()) { setPartResults([]); return; }
    const { data } = await supabase
      .from("parts").select("id,part_number,name,name_ar,price_cost,unit")
      .eq("is_active", true)
      .or(`name.ilike.%${q}%,name_ar.ilike.%${q}%,part_number.ilike.%${q}%`)
      .limit(7);
    setPartResults(data ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchParts(partSearch), 280);
    return () => clearTimeout(t);
  }, [partSearch, searchParts]);

  function addPOLine(p: any) {
    if (poLines.find((l) => l.part_id === p.id)) {
      setPoLines((prev) => prev.map((l) => l.part_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setPoLines((prev) => [...prev, {
        part_id: p.id, part_number: p.part_number,
        name_ar: p.name_ar, unit: p.unit ?? "قطعة",
        unit_cost: p.price_cost ?? 0, quantity: 1,
      }]);
    }
    setPartSearch(""); setPartResults([]);
  }

  const poSubtotal  = poLines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const poTax       = poSubtotal * 0.15;
  const poTotal     = poSubtotal + poTax;

  async function handleCreate(poStatus: "draft" | "confirmed") {
    if (!supplierId)        { setCreateErr(t("orders.purchase.select_supplier", language)); return; }
    if (poLines.length === 0) { setCreateErr(t("orders.purchase.add_items", language)); return; }
    setCreating(true); setCreateErr("");

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        tenant_id:     DEFAULT_TENANT,
        supplier_id:   supplierId,
        po_number:     genPONumber(),
        status:        poStatus,
        subtotal:      poSubtotal,
        tax_amount:    poTax,
        total:         poTotal,
        expected_date: expectedDate || null,
        notes:         poNotes || null,
      }).select().single();

    if (error || !po) { setCreateErr(error?.message ?? t("orders.purchase.creation_failed", language)); setCreating(false); return; }

    await supabase.from("purchase_order_items").insert(
      poLines.map((l) => ({
        order_id: po.id, part_id: l.part_id,
        quantity: l.quantity, unit_cost: l.unit_cost,
        received_qty: 0,
      }))
    );

    setCreating(false);
    setShowCreate(false);
    setSupplierId(""); setPoLines([]); setExpectedDate(""); setPoNotes("");
    load();
  }

  async function openReceive(order: any) {
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("*, parts(part_number, name_ar)")
      .eq("order_id", order.id);

    setReceiveLines((items ?? []).map((i: any) => ({
      item_id:         i.id,
      part_id:         i.part_id,
      name_ar:         i.parts?.name_ar ?? "",
      part_number:     i.parts?.part_number ?? "",
      ordered_qty:     i.quantity,
      received_so_far: i.received_qty ?? 0,
      receiving_qty:   Math.max(0, i.quantity - (i.received_qty ?? 0)),
    })));
    setReceiveOrder(order);
    setReceiveNotes("");
    setReceiveErr("");
    setShowReceive(true);
  }

  async function openView(order: any) {
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("*, parts(part_number, name_ar, unit)")
      .eq("order_id", order.id);
    setViewOrder({ ...order, items: items ?? [] });
  }

  async function handleReceive() {
    const toReceive = receiveLines.filter((l) => l.receiving_qty > 0);
    if (toReceive.length === 0) { setReceiveErr(t("orders.purchase.receiving_quantity", language)); return; }
    setReceiving(true); setReceiveErr("");

    await Promise.all(toReceive.map(async (l) => {
      // Update received_qty on item
      await supabase.from("purchase_order_items")
        .update({ received_qty: l.received_so_far + l.receiving_qty })
        .eq("id", l.item_id);

      // Add to inventory
      const { data: inv } = await supabase.from("inventory").select("id,quantity")
        .eq("part_id", l.part_id).eq("warehouse_id", DEFAULT_WAREHOUSE).single();

      if (inv) {
        await supabase.from("inventory").update({ quantity: inv.quantity + l.receiving_qty }).eq("id", inv.id);
      } else {
        await supabase.from("inventory").insert({
          tenant_id: DEFAULT_TENANT, part_id: l.part_id,
          warehouse_id: DEFAULT_WAREHOUSE, quantity: l.receiving_qty, reorder_point: 5,
        });
      }

      // Movement log
      await supabase.from("inventory_movements").insert({
        tenant_id: DEFAULT_TENANT, part_id: l.part_id,
        warehouse_id: DEFAULT_WAREHOUSE, movement_type: "purchase",
        quantity: l.receiving_qty, reference_type: "purchase_order",
        reference_id: receiveOrder.id, notes: receiveNotes || null,
      });
    }));

    // Determine new PO status
    const allFulfilled = receiveLines.every(
      (l) => (l.received_so_far + l.receiving_qty) >= l.ordered_qty
    );
    const anyReceived = toReceive.length > 0;
    const newStatus = allFulfilled ? "received" : anyReceived ? "partial" : receiveOrder.status;

    await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", receiveOrder.id);

    setReceiving(false);
    setShowReceive(false);
    load();
  }

  async function cancelPO(id: string) {
    if (!confirm(t("orders.purchase.confirm_cancel", language))) return;
    setUpdating(id);
    await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "cancelled" } : o));
    setUpdating(null);
  }

  const totalValue = orders.filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total ?? 0), 0);
  const pendingCount  = orders.filter((o) => ["draft","sent","confirmed","partial"].includes(o.status)).length;
  const receivedCount = orders.filter((o) => o.status === "received").length;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{t("orders.purchase.title", language)}</h1>
          <p className="text-sm mt-0.5 font-arabic" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? "..." : `${orders.length} ${t("unit.order", language)} · ${t("orders.purchase.total_value", language)} ${fmt(totalValue)} ر.س`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateErr(""); setPoLines([]); setSupplierId(""); }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">{t("orders.purchase.new_po", language)}</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: t("orders.purchase.total_value", language),  value: `${fmt(totalValue)} ر.س`, accent: "var(--color-gold)",      emoji: "💰" },
          { label: t("orders.purchase.pending", language),   value: pendingCount,              accent: "var(--color-amber)",     emoji: "⏳" },
          { label: t("orders.purchase.received", language),    value: receivedCount,             accent: "var(--color-green)",     emoji: "✅" },
          { label: `${t("unit.order", language)}s`, value: orders.length,             accent: "var(--color-ink-muted)", emoji: "🛒" },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3" style={{ borderRight: `3px solid ${k.accent}` }}>
            <span className="text-2xl">{k.emoji}</span>
            <div>
              <p className="font-mono font-bold text-lg" style={{ color: "var(--color-ink)", direction: "ltr" }}>{k.value}</p>
              <p className="font-arabic text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3">
        <div className="flex-1 relative">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" style={{ paddingRight: 36 }}
            placeholder={t("orders.purchase.search_placeholder", language)}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("filter.all_statuses", language)}</option>
          {["draft", "sent", "confirmed", "partial", "received", "cancelled"].map((k) => (
            <option key={k} value={k}>{getStatusLabel(k, language).label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">🛒</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.no_orders", language)}</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <span className="font-arabic">{t("orders.purchase.first_order", language)}</span>
            </button>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>{t("table.po_number", language)}</th>
                <th>{t("table.supplier", language)}</th>
                <th>{t("table.date", language)}</th>
                <th>{t("table.expected_date", language)}</th>
                <th>{t("table.status", language)}</th>
                <th>{t("table.total", language)}</th>
                <th>{t("table.actions", language)}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s    = getStatusLabel(o.status, language);
                const busy = updating === o.id;
                const canReceive = ["sent", "confirmed", "partial"].includes(o.status);
                return (
                  <tr key={o.id}>
                    <td>
                      <button className="font-mono text-xs font-semibold hover:underline text-right"
                        style={{ color: "var(--color-gold)" }} onClick={() => openView(o)}>
                        #{o.po_number}
                      </button>
                    </td>
                    <td>
                      <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {o.suppliers?.name_ar ?? o.suppliers?.name ?? "—"}
                      </p>
                      {o.suppliers?.phone && (
                        <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{o.suppliers.phone}</p>
                      )}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {new Date(o.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
                    </td>
                    <td className="text-sm" style={{ color: o.expected_date && new Date(o.expected_date) < new Date() && o.status !== "received" ? "var(--color-red)" : "var(--color-ink-muted)" }}>
                      {o.expected_date ? new Date(o.expected_date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US") : "—"}
                    </td>
                    <td><span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td>
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--color-ink)" }}>
                        {Number(o.total).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                        <span style={{ color: "var(--color-ink-faint)", fontSize: 10 }}> ر.س</span>
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost text-xs" style={{ padding: "4px 10px" }} onClick={() => openView(o)}>
                          <span className="font-arabic">{t("action.view", language)}</span>
                        </button>
                        {canReceive && (
                          <button className="btn btn-ghost text-xs"
                            style={{ padding: "4px 8px", color: "var(--color-green)" }}
                            onClick={() => openReceive(o)}>
                            <span className="font-arabic">{t("action.receive", language)}</span>
                          </button>
                        )}
                        {(o.status === "draft" || o.status === "sent") && (
                          <button className="btn btn-ghost text-xs"
                            style={{ padding: "4px 8px", color: "var(--color-red)" }}
                            disabled={busy} onClick={() => cancelPO(o.id)}>
                            <span className="font-arabic">{t("action.cancel", language)}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════════ CREATE PO MODAL ═══════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowCreate(false)}>
          <div className="card w-full overflow-hidden flex flex-col" style={{ maxWidth: 800, maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>{t("orders.purchase.create_po", language)}</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: "var(--color-ink-faint)", fontSize: 18 }}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 flex gap-5" style={{ minHeight: 0 }}>
              {/* Left — form */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.supplier", language)}</label>
                    <select className="input w-full" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">{t("action.filter", language)}</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_ar ?? s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.expected_date", language)}</label>
                    <input className="input w-full" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                  </div>
                </div>

                {/* Part search */}
                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.add_item", language)}</label>
                  <div className="relative">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input className="input w-full" style={{ paddingRight: 34 }}
                      placeholder={t("orders.purchase.search_part_placeholder", language)}
                      value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
                    {partResults.length > 0 && (
                      <div className="absolute top-full right-0 left-0 mt-1 card overflow-hidden z-20"
                        style={{ boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>
                        {partResults.map((p) => (
                          <button key={p.id} type="button"
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all text-right"
                            style={{ borderBottom: "1px solid var(--color-border-light)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                            onClick={() => addPOLine(p)}>
                            <div>
                              <p className="font-arabic text-sm font-medium" style={{ color: "var(--color-ink)" }}>{p.name_ar}</p>
                              <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                            </div>
                            <span className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>
                              {(p.price_cost ?? 0).toLocaleString("ar-SA")} ر.س
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PO lines */}
                {poLines.length > 0 && (
                  <table className="erp-table">
                    <thead>
                      <tr><th>{t("orders.purchase.part", language)}</th><th style={{ width: 100 }}>{t("orders.purchase.cost_price", language)}</th><th style={{ width: 80 }}>{t("table.quantity", language)}</th><th style={{ width: 100 }}>{t("table.total", language)}</th><th style={{ width: 36 }}></th></tr>
                    </thead>
                    <tbody>
                      {poLines.map((l, idx) => (
                        <tr key={l.part_id}>
                          <td>
                            <p className="font-arabic text-sm">{l.name_ar}</p>
                            <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{l.part_number}</p>
                          </td>
                          <td>
                            <input className="input text-sm font-mono" style={{ padding: "3px 8px", direction: "ltr" }}
                              type="number" step="0.01" value={l.unit_cost}
                              onChange={(e) => setPoLines((prev) => prev.map((x, i) => i === idx ? { ...x, unit_cost: parseFloat(e.target.value) || 0 } : x))} />
                          </td>
                          <td>
                            <input className="input text-sm font-mono" style={{ padding: "3px 8px", direction: "ltr" }}
                              type="number" min="1" value={l.quantity}
                              onChange={(e) => setPoLines((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} />
                          </td>
                          <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                            {fmt(l.quantity * l.unit_cost)}
                          </td>
                          <td>
                            <button type="button" onClick={() => setPoLines((prev) => prev.filter((_, i) => i !== idx))}
                              style={{ color: "var(--color-ink-faint)" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}>
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div>
                  <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>ملاحظات</label>
                  <textarea className="input w-full" rows={2} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} style={{ resize: "none" }} />
                </div>
              </div>

              {/* Right — totals */}
              <div style={{ width: 200, flexShrink: 0 }}>
                <div className="card p-4" style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}>
                  <p className="font-arabic text-xs font-semibold mb-3" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.summary", language)}</p>
                  {[[t("orders.purchase.subtotal", language), fmt(poSubtotal) + " ر.س"], [t("orders.purchase.tax_15", language), fmt(poTax) + " ر.س"]].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between mb-2">
                      <span className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{k}</span>
                      <span className="font-mono text-xs" style={{ direction: "ltr" }}>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--color-gold-dim)" }}>
                    <span className="font-arabic text-sm font-bold" style={{ color: "var(--color-ink)" }}>{t("orders.purchase.total", language)}</span>
                    <span className="font-mono font-bold text-base" style={{ color: "var(--color-gold)", direction: "ltr" }}>{fmt(poTotal)} ر.س</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: "1px solid var(--color-border-light)" }}>
              {createErr && <p className="font-arabic text-sm flex-1" style={{ color: "var(--color-red)" }}>{createErr}</p>}
              <div className="flex gap-2 mr-auto">
                <button className="btn btn-outline" onClick={() => setShowCreate(false)}>{t("action.cancel", language)}</button>
                <button className="btn btn-outline" disabled={creating} onClick={() => handleCreate("draft")}>
                  <span className="font-arabic">{t("orders.purchase.save_draft", language)}</span>
                </button>
                <button className="btn btn-primary" disabled={creating} onClick={() => handleCreate("confirmed")}>
                  {creating ? "..." : <span className="font-arabic">{t("orders.purchase.confirm_order", language)}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RECEIVE GOODS MODAL ═══════════════ */}
      {showReceive && receiveOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowReceive(false)}>
          <div className="card w-full overflow-hidden" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <div>
                <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>{t("orders.purchase.receive_goods", language)}</h2>
                <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>#{receiveOrder.po_number}</p>
              </div>
              <button onClick={() => setShowReceive(false)} style={{ color: "var(--color-ink-faint)", fontSize: 18 }}>✕</button>
            </div>

            <div className="p-6">
              <table className="erp-table mb-4">
                <thead>
                  <tr><th>{t("orders.purchase.part", language)}</th><th>{t("orders.purchase.required", language)}</th><th>{t("orders.purchase.previously_received", language)}</th><th style={{ width: 90 }}>{t("orders.purchase.receiving_now", language)}</th></tr>
                </thead>
                <tbody>
                  {receiveLines.map((l, idx) => {
                    const remaining = l.ordered_qty - l.received_so_far;
                    return (
                      <tr key={l.item_id}>
                        <td>
                          <p className="font-arabic text-sm">{l.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{l.part_number}</p>
                        </td>
                        <td className="font-mono text-sm">{l.ordered_qty}</td>
                        <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>{l.received_so_far}</td>
                        <td>
                          <input className="input font-mono text-sm" style={{ padding: "4px 8px", direction: "ltr" }}
                            type="number" min="0" max={remaining} value={l.receiving_qty}
                            onChange={(e) => setReceiveLines((prev) => prev.map((x, i) =>
                              i === idx ? { ...x, receiving_qty: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)) } : x
                            ))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mb-4">
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.receiving_notes", language)}</label>
                <textarea className="input w-full" rows={2} value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)} style={{ resize: "none" }} />
              </div>

              {receiveErr && <p className="font-arabic text-sm mb-3" style={{ color: "var(--color-red)" }}>{receiveErr}</p>}

              <div className="flex gap-2 justify-end">
                <button className="btn btn-outline" onClick={() => setShowReceive(false)}>{t("action.cancel", language)}</button>
                <button className="btn btn-primary" disabled={receiving} onClick={handleReceive}>
                  {receiving ? "..." : <span className="font-arabic">{t("orders.purchase.confirm_receive", language)}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ VIEW DETAIL MODAL ═══════════════ */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,5,.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setViewOrder(null)}>
          <div className="card w-full overflow-hidden" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <div>
                <h2 className="font-arabic font-bold text-lg" style={{ color: "var(--color-ink)" }}>{t("orders.purchase.po_details", language)}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>#{viewOrder.po_number}</span>
                  <span className="badge" style={{ background: getStatusLabel(viewOrder.status, language)?.bg, color: getStatusLabel(viewOrder.status, language)?.color, fontSize: 11 }}>
                    {getStatusLabel(viewOrder.status, language)?.label}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewOrder(null)} style={{ color: "var(--color-ink-faint)", fontSize: 18 }}>✕</button>
            </div>

            <div className="p-6">
              <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {[
                  [t("table.supplier", language),          viewOrder.suppliers?.name_ar ?? "—"],
                  [t("table.date", language),     new Date(viewOrder.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")],
                  [t("table.expected_date", language),    viewOrder.expected_date ? new Date(viewOrder.expected_date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US") : "—"],
                  [t("orders.purchase.supplier_phone", language),     viewOrder.suppliers?.phone ?? "—"],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{k}</p>
                    <p className="font-arabic text-sm font-medium mt-0.5" style={{ color: "var(--color-ink)" }}>{v}</p>
                  </div>
                ))}
              </div>

              <table className="erp-table mb-4">
                <thead>
                  <tr><th>{t("orders.purchase.part", language)}</th><th>{t("table.quantity", language)}</th><th>{t("orders.purchase.receiving_now", language)}</th><th>{t("orders.purchase.cost_price", language)}</th><th>{t("table.total", language)}</th></tr>
                </thead>
                <tbody>
                  {(viewOrder.items ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td>
                        <p className="font-arabic text-sm">{i.parts?.name_ar}</p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{i.parts?.part_number}</p>
                      </td>
                      <td className="font-mono text-sm">{i.quantity}</td>
                      <td>
                        <span className="font-mono text-sm" style={{ color: i.received_qty >= i.quantity ? "var(--color-green)" : i.received_qty > 0 ? "var(--color-amber)" : "var(--color-ink-muted)" }}>
                          {i.received_qty ?? 0}
                        </span>
                      </td>
                      <td className="font-mono text-sm" style={{ direction: "ltr" }}>{fmt(i.unit_cost)} ر.س</td>
                      <td className="font-mono text-sm font-semibold" style={{ direction: "ltr", color: "var(--color-ink)" }}>
                        {fmt(i.quantity * i.unit_cost)} ر.س
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center px-3 py-3 rounded-lg" style={{ background: "var(--color-gold-bg)" }}>
                <div className="flex gap-6">
                  {[[t("orders.purchase.subtotal", language), fmt(viewOrder.subtotal)], [t("orders.purchase.tax_15", language), fmt(viewOrder.tax_amount)]].map(([k, v]) => (
                    <div key={k as string}>
                      <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{k}</p>
                      <p className="font-mono text-sm" style={{ direction: "ltr" }}>{v} ر.س</p>
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{t("orders.purchase.total", language)}</p>
                  <p className="font-mono font-bold text-lg" style={{ color: "var(--color-gold)", direction: "ltr" }}>{fmt(viewOrder.total)} ر.س</p>
                </div>
              </div>

              {viewOrder.notes && (
                <p className="font-arabic text-sm mt-4 px-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("orders.purchase.note", language)} {viewOrder.notes}
                </p>
              )}

              <div className="flex gap-2 justify-end mt-4">
                {["sent","confirmed","partial"].includes(viewOrder.status) && (
                  <button className="btn btn-primary" onClick={() => { setViewOrder(null); openReceive(viewOrder); }}>
                    <span className="font-arabic">{t("orders.purchase.receive_goods_btn", language)}</span>
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => setViewOrder(null)}>
                  <span className="font-arabic">{t("action.close", language)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
