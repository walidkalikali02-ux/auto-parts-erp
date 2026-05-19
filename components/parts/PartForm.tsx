"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Part, PartCategory } from "@/lib/types";

interface PartFormProps {
  part?: Part | null;
  onSave: () => void;
  onCancel: () => void;
}

const conditions = [
  { value: "new", label: "جديد" },
  { value: "used", label: "مستعمل" },
  { value: "refurbished", label: "مجدد" },
];

const DEFAULT_TENANT = "d0000000-0000-0000-0000-000000000001";

export function PartForm({ part, onSave, onCancel }: PartFormProps) {
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    part_number: part?.part_number ?? "",
    oem_number: part?.oem_number ?? "",
    name: part?.name ?? "",
    name_ar: part?.name_ar ?? "",
    description_ar: part?.description_ar ?? "",
    category_id: part?.category_id ?? "",
    brand: part?.brand ?? "",
    condition: part?.condition ?? "new",
    unit: part?.unit ?? "piece",
    weight_kg: part?.weight_kg?.toString() ?? "",
    price_cost: part?.price_cost?.toString() ?? "",
    price_retail: part?.price_retail?.toString() ?? "",
    price_wholesale: part?.price_wholesale?.toString() ?? "",
    tax_rate: part?.tax_rate?.toString() ?? "15",
    barcode: part?.barcode ?? "",
    notes: part?.notes ?? "",
  });

  useEffect(() => {
    supabase.from("part_categories").select("*").order("name_ar").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      tenant_id: DEFAULT_TENANT,
      part_number: form.part_number.trim(),
      oem_number: form.oem_number || null,
      name: form.name.trim(),
      name_ar: form.name_ar.trim(),
      description_ar: form.description_ar || null,
      category_id: form.category_id || null,
      brand: form.brand || null,
      condition: form.condition,
      unit: form.unit,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      price_cost: parseFloat(form.price_cost) || 0,
      price_retail: parseFloat(form.price_retail) || 0,
      price_wholesale: form.price_wholesale ? parseFloat(form.price_wholesale) : null,
      tax_rate: parseFloat(form.tax_rate) || 15,
      barcode: form.barcode || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (part) {
      ({ error: err } = await supabase.from("parts").update(payload).eq("id", part.id));
    } else {
      ({ error: err } = await supabase.from("parts").insert(payload));
    }

    if (err) {
      setError(err.message.includes("unique") ? "رقم القطعة موجود مسبقاً" : err.message);
      setSaving(false);
    } else {
      onSave();
    }
  }

  const field = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
        {label}
      </label>
      <input
        className="input"
        value={(form as any)[key]}
        onChange={(e) => set(key, e.target.value)}
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {field("رقم القطعة *", "part_number", { required: true, placeholder: "BRK-001" })}
        {field("رقم OEM", "oem_number", { placeholder: "04465-06190" })}
        {field("الاسم بالعربي *", "name_ar", { required: true, placeholder: "طقم تيل فرامل" })}
        {field("الاسم بالإنجليزي *", "name", { required: true, placeholder: "Brake Pad Set" })}
        {field("الباركود", "barcode", { placeholder: "6291003088498" })}
        {field("ماركة القطعة", "brand", { placeholder: "Bosch / NGK / Denso" })}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
            الفئة
          </label>
          <select className="input" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">اختر الفئة</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
            الحالة
          </label>
          <select className="input" value={form.condition} onChange={(e) => set("condition", e.target.value)}>
            {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
            الوحدة
          </label>
          <select className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {["piece","set","liter","kg","meter","box"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        {field("الوزن (كغ)", "weight_kg", { type: "number", step: "0.001", placeholder: "0.500" })}
      </div>

      {/* Pricing */}
      <div
        className="p-4 rounded-lg"
        style={{ background: "var(--color-gold-bg)", border: "1px solid var(--color-gold-dim)" }}
      >
        <p className="font-arabic text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>الأسعار</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          {field("سعر التكلفة *", "price_cost", { type: "number", step: "0.01", required: true, placeholder: "45.00" })}
          {field("سعر البيع *", "price_retail", { type: "number", step: "0.01", required: true, placeholder: "90.00" })}
          {field("سعر الجملة", "price_wholesale", { type: "number", step: "0.01", placeholder: "75.00" })}
          {field("الضريبة %", "tax_rate", { type: "number", step: "0.01", placeholder: "15" })}
        </div>
      </div>

      <div>
        <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>
          وصف القطعة
        </label>
        <textarea
          className="input"
          rows={2}
          placeholder="وصف مختصر للقطعة..."
          value={form.description_ar}
          onChange={(e) => set("description_ar", e.target.value)}
          style={{ resize: "none" }}
        />
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-arabic" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--color-border-light)" }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          <span className="font-arabic">إلغاء</span>
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && (
            <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          <span className="font-arabic">{part ? "حفظ التعديلات" : "إضافة القطعة"}</span>
        </button>
      </div>
    </form>
  );
}
