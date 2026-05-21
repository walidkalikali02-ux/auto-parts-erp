"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";

const DEFAULT_TENANT = "d0000000-0000-0000-0000-000000000001";
const typeMap: Record<string, { label: string; bg: string; color: string }> = {
  retail:    { label: "تجزئة", bg: "var(--color-blue-bg)",  color: "var(--color-blue)"  },
  wholesale: { label: "جملة",  bg: "var(--color-gold-bg)",  color: "var(--color-gold)"  },
  workshop:  { label: "ورشة",  bg: "var(--color-green-bg)", color: "var(--color-green)" },
};

const emptyForm = { name: "", name_ar: "", phone: "", email: "", city: "", address: "", customer_type: "retail", tax_number: "", credit_limit: "" };

export default function CustomersPage() {
  const { language } = useLanguage();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("customers").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(100);
    if (search) q = q.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%,phone.ilike.%${search}%`);
    if (type) q = q.eq("customer_type", type);
    const { data } = await q;
    setCustomers(data ?? []);
    setLoading(false);
  }, [search, type, language]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  function openAdd() { setEditCustomer(null); setForm(emptyForm); setError(""); setShowForm(true); }
  function openEdit(c: any) {
    setEditCustomer(c);
    setForm({ name: c.name ?? "", name_ar: c.name_ar ?? "", phone: c.phone ?? "", email: c.email ?? "", city: c.city ?? "", address: c.address ?? "", customer_type: c.customer_type, tax_number: c.tax_number ?? "", credit_limit: c.credit_limit?.toString() ?? "" });
    setError("");
    setShowForm(true);
  }
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const payload = { tenant_id: DEFAULT_TENANT, name: form.name, name_ar: form.name_ar || null, phone: form.phone || null, email: form.email || null, city: form.city || null, address: form.address || null, customer_type: form.customer_type, tax_number: form.tax_number || null, credit_limit: parseFloat(form.credit_limit) || 0 };
    const { error: err } = editCustomer
      ? await supabase.from("customers").update(payload).eq("id", editCustomer.id)
      : await supabase.from("customers").insert(payload);
    if (err) { setError(err.message); setSaving(false); } else { setShowForm(false); load(); }
    setSaving(false);
  }

  const field = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>{label}</label>
      <input className="input" value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} {...props} />
    </div>
  );

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{t("customer.title", language)}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{loading ? "..." : `${customers.length} ${t("unit.customer", language)}`}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
          <span className="font-arabic">{t("customer.add_customer", language)}</span>
        </button>
      </div>

      <div className="card p-4 mb-6 flex gap-3">
        <div className="flex-1 relative">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" style={{ paddingRight: 36 }} placeholder={t("customer.search_placeholder", language)} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 140 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("filter.all_types", language)}</option>
          <option value="retail">{t("customer.type.retail", language)}</option>
          <option value="wholesale">{t("customer.type.wholesale", language)}</option>
          <option value="workshop">{t("customer.type.workshop", language)}</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" /></svg></div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">👥</span>
            <p className="font-arabic text-base" style={{ color: "var(--color-ink-muted)" }}>{t("customer.no_customers", language)}</p>
            <button className="btn btn-primary" onClick={openAdd}><span className="font-arabic">{t("customer.first_customer", language)}</span></button>
          </div>
        ) : (
          <table className="erp-table">
            <thead><tr><th>{t("table.part_name", language)}</th><th>{t("table.type", language)}</th><th>{t("customer.phone", language)}</th><th>{t("table.city", language)}</th><th>{t("customer.balance", language)}</th><th>{t("table.credit_limit", language)}</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => {
                const t = typeMap[c.customer_type] ?? typeMap.retail;
                return (
                  <tr key={c.id}>
                    <td><p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{c.name_ar ?? c.name}</p>{c.name_ar && <p className="text-xs" style={{ color: "var(--color-ink-muted)" }}>{c.name}</p>}</td>
                    <td><span className="badge" style={{ background: t.bg, color: t.color }}>{t.label}</span></td>
                    <td className="font-mono text-sm" style={{ direction: "ltr" }}>{c.phone ?? "—"}</td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{c.city ?? "—"}</td>
                    <td><span className="font-mono text-sm font-semibold" style={{ color: c.balance < 0 ? "var(--color-red)" : "var(--color-ink)" }}>{Number(c.balance).toLocaleString("ar-SA")} ر.س</span></td>
                    <td className="font-mono text-sm" style={{ color: "var(--color-ink-muted)" }}>{Number(c.credit_limit).toLocaleString("ar-SA")} ر.س</td>
                    <td>
                      <div className="flex gap-1">
                        <Link href={`/customers/${c.id}`} className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }}>
                          <span className="font-arabic">{t("customer.profile", language)}</span>
                        </Link>
                        <button className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }} onClick={() => openEdit(c)}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          <span className="font-arabic">{t("action.edit", language)}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editCustomer ? t("customer.edit_title", language) : t("customer.add_title", language)} size="md">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {field(t("customer.name_ar", language), "name_ar", { required: true, placeholder: "محمد العتيبي" })}
            {field(t("customer.name_en", language), "name", { placeholder: "Mohammed Al-Otaibi" })}
            {field(t("customer.phone", language), "phone", { placeholder: "0501234567", type: "tel" })}
            {field(t("customer.email", language), "email", { placeholder: "customer@email.com", type: "email" })}
            {field(t("customer.city", language), "city", { placeholder: "الرياض" })}
            {field(t("customer.tax_id", language), "tax_number", { placeholder: "300000000000003" })}
            <div>
              <label className="block font-arabic text-sm font-medium mb-1.5" style={{ color: "var(--color-ink-2)" }}>{t("customer.type", language)}</label>
              <select className="input" value={form.customer_type} onChange={(e) => set("customer_type", e.target.value)}>
                <option value="retail">{t("customer.type.retail", language)}</option>
                <option value="wholesale">{t("customer.type.wholesale", language)}</option>
                <option value="workshop">{t("customer.type.workshop", language)}</option>
              </select>
            </div>
            {field(t("customer.credit_limit", language), "credit_limit", { type: "number", min: "0", placeholder: "0" })}
          </div>
          {error && <div className="rounded-lg px-4 py-3 text-sm font-arabic" style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}>{error}</div>}
          <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--color-border-light)" }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}><span className="font-arabic">{t("action.cancel", language)}</span></button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>}
              <span className="font-arabic">{editCustomer ? t("action.save", language) : t("action.add", language)}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
