"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;

const PLANS: Record<string, { label: string; color: string }> = {
  starter:    { label: "Starter",    color: "var(--color-ink-muted)" },
  pro:        { label: "Pro",        color: "var(--color-blue)" },
  enterprise: { label: "Enterprise", color: "var(--color-gold)" },
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function SettingsPage() {
  const [tenant, setTenant]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  // invite modal
  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState("staff");
  const [inviting,     setInviting]     = useState(false);
  const [inviteMsg,    setInviteMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = await getToken();
    const [settingsRes, usersRes] = await Promise.all([
      fetch(`${API}/api/settings`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/settings/users`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (settingsRes.ok) setTenant(await settingsRes.json());
    if (usersRes.ok)    setUsers(await usersRes.json());
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const token = await getToken();
    const res = await fetch(`${API}/api/settings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name_ar:    tenant.name_ar,
        name:       tenant.name,
        logo_url:   tenant.logo_url,
        vat_number: tenant.vat_number,
        address:    tenant.address,
        city:       tenant.city,
        phone:      tenant.phone,
        email:      tenant.email,
        website:    tenant.website,
        currency:   tenant.currency,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setTenant({ ...data, usage: tenant.usage });
      setMsg({ text: "تم حفظ الإعدادات بنجاح", ok: true });
    } else {
      setMsg({ text: data.error ?? "حدث خطأ", ok: false });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    const token = await getToken();
    const res = await fetch(`${API}/api/settings/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);
    if (res.ok) {
      setInviteMsg({ text: "تم إرسال الدعوة بنجاح", ok: true });
      setInviteEmail("");
      setTimeout(() => { setShowInvite(false); setInviteMsg(null); }, 2000);
    } else {
      setInviteMsg({ text: data.error ?? "فشل الإرسال", ok: false });
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-gold)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>تعذّر تحميل الإعدادات</p>
      </div>
    );
  }

  const usage = tenant.usage ?? {};
  const plan  = PLANS[tenant.plan] ?? PLANS.starter;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>إعدادات المنشأة</h1>
          <p className="text-sm font-arabic" style={{ color: "var(--color-ink-muted)" }}>بيانات الشركة، الشعار، معلومات الضريبة</p>
        </div>
        <span className="badge" style={{ background: "var(--color-blue-bg)", color: plan.color, fontSize: 13, padding: "6px 14px" }}>
          {plan.label}
        </span>
      </div>

      {/* Plan usage */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "المستخدمون",   used: usage.users ?? 0,        max: tenant.max_users,        emoji: "👥" },
          { label: "القطع",         used: usage.parts ?? 0,        max: tenant.max_parts,        emoji: "⚙️" },
          { label: "طلبات الشهر",  used: usage.orders_month ?? 0, max: tenant.max_orders_month, emoji: "📋" },
        ].map((u) => {
          const pct = Math.min(100, Math.round((u.used / (u.max || 1)) * 100));
          const color = pct >= 90 ? "var(--color-red)" : pct >= 70 ? "var(--color-amber)" : "var(--color-green)";
          return (
            <div key={u.label} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-arabic text-sm" style={{ color: "var(--color-ink-2)" }}>{u.emoji} {u.label}</span>
                <span className="font-mono text-xs" style={{ color }}>
                  {u.used} / {u.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--color-border)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Company info */}
          <div className="card p-6">
            <h2 className="font-arabic font-semibold mb-5" style={{ color: "var(--color-ink)", borderBottom: "1px solid var(--color-border-light)", paddingBottom: 12 }}>
              بيانات المنشأة
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  الاسم بالعربية
                </label>
                <input className="input w-full" value={tenant.name_ar ?? ""} onChange={(e) => setTenant({ ...tenant, name_ar: e.target.value })} placeholder="مثال: شركة قطع الغيار" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  الاسم بالإنجليزية
                </label>
                <input className="input w-full" value={tenant.name ?? ""} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} placeholder="AutoParts Co." />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  رقم تسجيل ضريبة القيمة المضافة
                </label>
                <input className="input w-full font-mono" value={tenant.vat_number ?? ""} onChange={(e) => setTenant({ ...tenant, vat_number: e.target.value })} placeholder="300000000000003" maxLength={15} />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  رابط الشعار (URL)
                </label>
                <input className="input w-full font-mono text-xs" value={tenant.logo_url ?? ""} onChange={(e) => setTenant({ ...tenant, logo_url: e.target.value })} placeholder="https://..." />
                {tenant.logo_url && (
                  <img src={tenant.logo_url} alt="logo" className="mt-2 rounded" style={{ height: 48, objectFit: "contain" }} />
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="card p-6">
            <h2 className="font-arabic font-semibold mb-5" style={{ color: "var(--color-ink)", borderBottom: "1px solid var(--color-border-light)", paddingBottom: 12 }}>
              بيانات التواصل
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>العنوان</label>
                <input className="input w-full" value={tenant.address ?? ""} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} placeholder="شارع الملك فهد، حي العليا" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>المدينة</label>
                <input className="input w-full" value={tenant.city ?? ""} onChange={(e) => setTenant({ ...tenant, city: e.target.value })} placeholder="الرياض" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>رقم الهاتف</label>
                <input className="input w-full font-mono" value={tenant.phone ?? ""} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} placeholder="+966500000000" dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>البريد الإلكتروني</label>
                <input className="input w-full font-mono" type="email" value={tenant.email ?? ""} onChange={(e) => setTenant({ ...tenant, email: e.target.value })} placeholder="info@company.sa" dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>الموقع الإلكتروني</label>
                <input className="input w-full font-mono text-xs" value={tenant.website ?? ""} onChange={(e) => setTenant({ ...tenant, website: e.target.value })} placeholder="https://company.sa" dir="ltr" />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4 mt-6">
          <button type="submit" className="btn btn-gold" disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </button>
          {msg && (
            <p className="font-arabic text-sm" style={{ color: msg.ok ? "var(--color-green)" : "var(--color-red)" }}>
              {msg.text}
            </p>
          )}
        </div>
      </form>

      {/* Users */}
      <div className="card overflow-hidden mt-8">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
          <h2 className="font-arabic font-semibold" style={{ color: "var(--color-ink)" }}>
            المستخدمون ({users.length} / {tenant.max_users})
          </h2>
          <button className="btn btn-gold text-sm" onClick={() => setShowInvite(true)}>
            + دعوة مستخدم
          </button>
        </div>
        <table className="erp-table">
          <thead>
            <tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>تاريخ الإضافة</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-arabic text-sm">{u.full_name ?? "—"}</td>
                <td className="font-mono text-xs" style={{ direction: "ltr" }}>{u.email}</td>
                <td>
                  <span className="badge" style={{
                    background: u.role === "superadmin" ? "var(--color-gold-bg)" : u.role === "admin" ? "var(--color-blue-bg)" : "var(--color-surface-2)",
                    color:      u.role === "superadmin" ? "var(--color-gold)"    : u.role === "admin" ? "var(--color-blue)"   : "var(--color-ink-muted)",
                  }}>
                    {u.role === "superadmin" ? "سوبر أدمن" : u.role === "admin" ? "مدير" : u.role === "accountant" ? "محاسب" : "موظف"}
                  </span>
                </td>
                <td className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                  {new Date(u.created_at).toLocaleDateString("ar-SA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(26,23,5,.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowInvite(false)}
        >
          <div
            className="card p-8 w-full"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-arabic font-bold text-lg mb-6" style={{ color: "var(--color-ink)" }}>
              دعوة مستخدم جديد
            </h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  البريد الإلكتروني
                </label>
                <input
                  className="input w-full font-mono"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@company.sa"
                  dir="ltr"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>الدور</label>
                <select className="input w-full" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="staff">موظف</option>
                  <option value="admin">مدير</option>
                  <option value="accountant">محاسب</option>
                </select>
              </div>
              {inviteMsg && (
                <p className="font-arabic text-sm" style={{ color: inviteMsg.ok ? "var(--color-green)" : "var(--color-red)" }}>
                  {inviteMsg.text}
                </p>
              )}
              <div className="flex gap-3 mt-2">
                <button type="submit" className="btn btn-gold flex-1" disabled={inviting}>
                  {inviting ? "جارٍ الإرسال..." : "إرسال الدعوة"}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowInvite(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
