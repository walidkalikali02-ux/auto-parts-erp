"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer]   = useState<any>(null);
  const [vehicles, setVehicles]   = useState<any[]>([]);
  const [orders, setOrders]       = useState<any[]>([]);
  const [brands, setBrands]       = useState<any[]>([]);
  const [models, setModels]       = useState<any[]>([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editVehicle, setEditVehicle]         = useState<any>(null);
  const [saving, setSaving]       = useState(false);
  const [vForm, setVForm]         = useState({
    plate_number: "", vin: "", car_brand_id: "", car_model_id: "",
    year: "", color: "", engine_code: "", mileage: "", notes: "",
  });

  useEffect(() => {
    if (!id) return;
    supabase.from("customers").select("*").eq("id", id).single().then(({ data }) => setCustomer(data));
    supabase.from("customer_vehicles").select("*, car_brands(name,name_ar), car_models(name,name_ar)").eq("customer_id", id).eq("is_active", true).then(({ data }) => setVehicles(data ?? []));
    supabase.from("sales_orders").select("id,order_number,total,status,payment_status,order_date").eq("customer_id", id).order("created_at", { ascending: false }).limit(10).then(({ data }) => setOrders(data ?? []));
    supabase.from("car_brands").select("id,name,name_ar").eq("is_active", true).order("name").then(({ data }) => setBrands(data ?? []));
  }, [id]);

  useEffect(() => {
    if (!vForm.car_brand_id) { setModels([]); return; }
    supabase.from("car_models").select("id,name,name_ar").eq("brand_id", vForm.car_brand_id).eq("is_active", true).order("name").then(({ data }) => setModels(data ?? []));
  }, [vForm.car_brand_id]);

  function setVF(k: string, v: string) { setVForm((f) => ({ ...f, [k]: v })); }

  function openAddVehicle() {
    setEditVehicle(null);
    setVForm({ plate_number: "", vin: "", car_brand_id: "", car_model_id: "", year: "", color: "", engine_code: "", mileage: "", notes: "" });
    setShowVehicleForm(true);
  }

  function openEditVehicle(v: any) {
    setEditVehicle(v);
    setVForm({
      plate_number: v.plate_number ?? "", vin: v.vin ?? "",
      car_brand_id: v.car_brand_id ?? "", car_model_id: v.car_model_id ?? "",
      year: v.year?.toString() ?? "", color: v.color ?? "",
      engine_code: v.engine_code ?? "", mileage: v.mileage?.toString() ?? "", notes: v.notes ?? "",
    });
    setShowVehicleForm(true);
  }

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const payload = {
      customer_id: id,
      plate_number: vForm.plate_number,
      vin: vForm.vin || null,
      car_brand_id: vForm.car_brand_id || null,
      car_model_id: vForm.car_model_id || null,
      year: vForm.year ? parseInt(vForm.year) : null,
      color: vForm.color || null,
      engine_code: vForm.engine_code || null,
      mileage: vForm.mileage ? parseInt(vForm.mileage) : null,
      notes: vForm.notes || null,
    };
    if (editVehicle) {
      await supabase.from("customer_vehicles").update(payload).eq("id", editVehicle.id);
    } else {
      await supabase.from("customer_vehicles").insert(payload);
    }
    const { data } = await supabase.from("customer_vehicles").select("*, car_brands(name,name_ar), car_models(name,name_ar)").eq("customer_id", id).eq("is_active", true);
    setVehicles(data ?? []);
    setShowVehicleForm(false); setSaving(false);
  }

  async function deleteVehicle(vid: string) {
    await supabase.from("customer_vehicles").update({ is_active: false }).eq("id", vid);
    setVehicles((v) => v.filter((x) => x.id !== vid));
  }

  if (!customer) return (
    <div className="flex-1 flex items-center justify-center">
      <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
        <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );

  const typeAr: Record<string, string> = { retail: "تجزئة", wholesale: "جملة", workshop: "ورشة" };
  const typeColor: Record<string, { bg: string; color: string }> = {
    retail:    { bg: "var(--color-blue-bg)",  color: "var(--color-blue)"  },
    wholesale: { bg: "var(--color-gold-bg)",  color: "var(--color-gold)"  },
    workshop:  { bg: "var(--color-green-bg)", color: "var(--color-green)" },
  };
  const tc = typeColor[customer.customer_type] ?? typeColor.retail;
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2 });
  const statusMap: Record<string, { label: string; bg: string; color: string }> = {
    delivered: { label: "مُسلَّم", bg: "var(--color-green-bg)", color: "var(--color-green)" },
    confirmed: { label: "مؤكد",   bg: "var(--color-blue-bg)",  color: "var(--color-blue)"  },
    draft:     { label: "مسودة",  bg: "var(--color-surface-2)",color: "var(--color-ink-muted)" },
    cancelled: { label: "ملغي",   bg: "var(--color-red-bg)",   color: "var(--color-red)"   },
    returned:  { label: "مُرتجع", bg: "var(--color-red-bg)",   color: "var(--color-red)"   },
  };

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--color-ink-muted)" }}>
        <Link href="/customers" className="hover:underline font-arabic">العملاء</Link>
        <span>/</span>
        <span className="font-arabic" style={{ color: "var(--color-ink)" }}>{customer.name_ar ?? customer.name}</span>
      </div>

      {/* Header */}
      <div className="card p-6 mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold"
            style={{ background: tc.bg, color: tc.color }}
          >
            {(customer.name_ar ?? customer.name)[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-arabic text-xl font-bold" style={{ color: "var(--color-ink)" }}>
                {customer.name_ar ?? customer.name}
              </h1>
              <span className="badge" style={{ background: tc.bg, color: tc.color }}>
                {typeAr[customer.customer_type] ?? customer.customer_type}
              </span>
            </div>
            <div className="flex gap-4 text-sm">
              {customer.phone && <span className="font-mono" style={{ color: "var(--color-ink-muted)", direction: "ltr" }}>{customer.phone}</span>}
              {customer.city && <span className="font-arabic" style={{ color: "var(--color-ink-muted)" }}>{customer.city}</span>}
              {customer.tax_number && <span className="font-mono text-xs" style={{ color: "var(--color-ink-faint)" }}>ر.ض: {customer.tax_number}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 text-center">
          {[
            { label: "الرصيد", value: `${fmt(customer.balance)} ر.س`, color: customer.balance < 0 ? "var(--color-red)" : "var(--color-ink)" },
            { label: "حد الائتمان", value: `${fmt(customer.credit_limit)} ر.س`, color: "var(--color-ink-2)" },
            { label: "الطلبات", value: orders.length, color: "var(--color-gold)" },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 rounded-lg" style={{ background: "var(--color-surface)" }}>
              <p className="font-mono font-bold text-lg" style={{ color: s.color as string, direction: "ltr" }}>{s.value}</p>
              <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Vehicles */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              السيارات ({vehicles.length})
            </h2>
            <button className="btn btn-primary text-xs" style={{ padding: "6px 14px" }} onClick={openAddVehicle}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
              <span className="font-arabic">إضافة</span>
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-4xl opacity-20">🚗</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد سيارات مسجلة</p>
                <button className="btn btn-outline text-xs" onClick={openAddVehicle}>
                  <span className="font-arabic">تسجيل سيارة</span>
                </button>
              </div>
            ) : (
              vehicles.map((v: any) => (
                <div key={v.id} className="p-4 rounded-xl flex items-start justify-between"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-light)" }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-arabic font-bold" style={{ color: "var(--color-ink)" }}>
                        {v.car_brands?.name_ar ?? v.car_brands?.name ?? "—"}
                      </span>
                      <span className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>
                        {v.car_models?.name_ar ?? v.car_models?.name ?? "—"}
                      </span>
                      {v.year && <span className="font-mono text-xs badge" style={{ background: "var(--color-gold-dim)", color: "var(--color-gold)" }}>{v.year}</span>}
                    </div>
                    <div className="flex gap-3 text-xs" style={{ color: "var(--color-ink-muted)" }}>
                      <span className="font-arabic font-semibold" style={{ color: "var(--color-ink-2)" }}>
                        🚙 {v.plate_number}
                      </span>
                      {v.color && <span className="font-arabic">{v.color}</span>}
                      {v.mileage && <span className="font-mono">{v.mileage.toLocaleString()} كم</span>}
                    </div>
                    {v.vin && <p className="font-mono text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>VIN: {v.vin}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost text-xs" style={{ padding: "4px 8px" }} onClick={() => openEditVehicle(v)}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button className="btn btn-ghost text-xs" style={{ padding: "4px 8px", color: "var(--color-red)" }} onClick={() => deleteVehicle(v.id)}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Purchase History */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
              تاريخ الشراء ({orders.length})
            </h2>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--color-border-light)" }}>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-4xl opacity-20">📋</span>
                <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا توجد طلبات</p>
              </div>
            ) : orders.map((o: any) => {
              const s = statusMap[o.status] ?? statusMap.draft;
              return (
                <Link key={o.id} href={`/orders/sales/${o.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-all"
                  style={{ textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                >
                  <div>
                    <p className="font-mono text-sm font-semibold" style={{ color: "var(--color-gold)" }}>#{o.order_number}</p>
                    <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{new Date(o.order_date).toLocaleDateString("ar-SA")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr" }}>
                      {Number(o.total).toLocaleString("ar-SA")} ر.س
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vehicle Form Modal */}
      <Modal open={showVehicleForm} onClose={() => setShowVehicleForm(false)} title={editVehicle ? "تعديل السيارة" : "إضافة سيارة"} size="md">
        <form onSubmit={saveVehicle} className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>رقم اللوحة *</label>
              <input className="input" required placeholder="أ ب ج 1234" value={vForm.plate_number} onChange={(e) => setVF("plate_number", e.target.value)} />
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>رقم الهيكل VIN</label>
              <input className="input font-mono" placeholder="17 خانة" value={vForm.vin} onChange={(e) => setVF("vin", e.target.value.toUpperCase())} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>الماركة</label>
              <select className="input" value={vForm.car_brand_id} onChange={(e) => setVF("car_brand_id", e.target.value)}>
                <option value="">اختر الماركة</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name_ar ?? b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>الموديل</label>
              <select className="input" value={vForm.car_model_id} onChange={(e) => setVF("car_model_id", e.target.value)} disabled={!vForm.car_brand_id}>
                <option value="">اختر الموديل</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name_ar ?? m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>سنة الصنع</label>
              <input className="input font-mono" type="number" min="1990" max="2030" placeholder="2022" value={vForm.year} onChange={(e) => setVF("year", e.target.value)} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>اللون</label>
              <input className="input font-arabic" placeholder="أبيض / أسود / فضي..." value={vForm.color} onChange={(e) => setVF("color", e.target.value)} />
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>كود المحرك</label>
              <input className="input font-mono" placeholder="2AR-FE" value={vForm.engine_code} onChange={(e) => setVF("engine_code", e.target.value)} style={{ direction: "ltr" }} />
            </div>
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>عداد الكيلومترات</label>
              <input className="input font-mono" type="number" placeholder="85000" value={vForm.mileage} onChange={(e) => setVF("mileage", e.target.value)} style={{ direction: "ltr" }} />
            </div>
          </div>
          <div>
            <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>ملاحظات</label>
            <textarea className="input" rows={2} style={{ resize: "none" }} value={vForm.notes} onChange={(e) => setVF("notes", e.target.value)} placeholder="أي ملاحظات إضافية..." />
          </div>
          <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--color-border-light)" }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowVehicleForm(false)}><span className="font-arabic">إلغاء</span></button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
              <span className="font-arabic">{editVehicle ? "حفظ" : "إضافة"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
