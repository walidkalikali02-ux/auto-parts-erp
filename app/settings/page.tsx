"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { type AppLanguage, LANGUAGE_META, LANGUAGE_OPTIONS } from "@/lib/language";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_URL;

const PLANS: Record<string, { label: string; color: string }> = {
  starter:    { label: "Starter",    color: "var(--color-ink-muted)" },
  pro:        { label: "Pro",        color: "var(--color-blue)" },
  enterprise: { label: "Enterprise", color: "var(--color-gold)" },
};

type TenantUsage = {
  users?: number;
  parts?: number;
  orders_month?: number;
};

type TenantSettings = {
  name_ar?: string;
  name?: string;
  logo_url?: string;
  vat_number?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency?: string;
  plan?: string;
  max_users?: number;
  max_parts?: number;
  max_orders_month?: number;
  usage?: TenantUsage;
};

type TenantUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  created_at: string;
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [tenant, setTenant]   = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [languageValue, setLanguageValue] = useState<AppLanguage>(language);
  const [languageMsg, setLanguageMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // invite modal
  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteRole,   setInviteRole]   = useState("staff");
  const [inviting,     setInviting]     = useState(false);
  const [inviteMsg,    setInviteMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  const [users, setUsers] = useState<TenantUser[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const token = await getToken();
      const [settingsRes, usersRes] = await Promise.all([
        fetch(`${API}/api/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/settings/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (cancelled) return;

      if (settingsRes.ok) setTenant(await settingsRes.json() as TenantSettings);
      if (usersRes.ok)    setUsers(await usersRes.json() as TenantUser[]);
      setLoading(false);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

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
    const data = await res.json() as TenantSettings & { error?: string };
    setSaving(false);
    if (res.ok) {
      setTenant({ ...data, usage: tenant.usage });
      setMsg({ text: t("settings.saved_successfully", language), ok: true });
    } else {
      setMsg({ text: data.error ?? t("msg.error", language), ok: false });
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
    const data = await res.json() as { error?: string };
    setInviting(false);
    if (res.ok) {
      setInviteMsg({ text: t("settings.invite_sent", language), ok: true });
      setInviteEmail("");
      setTimeout(() => { setShowInvite(false); setInviteMsg(null); }, 2000);
    } else {
      setInviteMsg({ text: data.error ?? t("settings.invite_failed", language), ok: false });
    }
  }

  function handleLanguageSave(e: React.FormEvent) {
    e.preventDefault();
    setLanguage(languageValue);
    setLanguageMsg({
      text: t("settings.language_saved", languageValue),
      ok: true,
    });
    setTimeout(() => setLanguageMsg(null), 3000);
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
        <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>{t("settings.failed_to_load", language)}</p>
      </div>
    );
  }

  const usage = tenant.usage ?? {};
  const plan  = tenant.plan ? (PLANS[tenant.plan] ?? PLANS.starter) : PLANS.starter;

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-arabic text-2xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>{t("settings.title", language)}</h1>
          <p className="text-sm font-arabic" style={{ color: "var(--color-ink-muted)" }}>{t("settings.description", language)}</p>
        </div>
        <span className="badge" style={{ background: "var(--color-blue-bg)", color: plan.color, fontSize: 13, padding: "6px 14px" }}>
          {plan.label}
        </span>
      </div>

      {/* Plan usage */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: t("settings.users", language),        used: usage.users ?? 0,        max: tenant.max_users,        emoji: "👥" },
          { label: t("settings.parts", language),        used: usage.parts ?? 0,        max: tenant.max_parts,        emoji: "⚙️" },
          { label: t("settings.orders_month", language), used: usage.orders_month ?? 0, max: tenant.max_orders_month, emoji: "📋" },
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

      <div className="card p-6 mb-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-arabic font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
              {t("settings.language", language)}
            </h2>
            <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
              {t("settings.language_description", language)}
            </p>
          </div>
          <span className="badge" style={{ background: "var(--color-blue-bg)", color: "var(--color-blue)" }}>
            {LANGUAGE_META[languageValue].label}
          </span>
        </div>

        <form onSubmit={handleLanguageSave} className="flex items-end gap-4">
          <div className="flex-1">
            <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
              {t("settings.preferred_language", language)}
            </label>
            <select
              className="input w-full"
              value={languageValue}
              onChange={(e) => setLanguageValue(e.target.value as AppLanguage)}
            >
              {LANGUAGE_OPTIONS.map((value) => {
                const meta = LANGUAGE_META[value];
                return (
                <option key={value} value={value}>
                  {meta.label} - {meta.description}
                </option>
                );
              })}
            </select>
          </div>
          <button type="submit" className="btn btn-gold">
            {t("action.save", language)}
          </button>
        </form>

        {languageMsg && (
          <p className="font-arabic text-sm mt-3" style={{ color: languageMsg.ok ? "var(--color-green)" : "var(--color-red)" }}>
            {languageMsg.text}
          </p>
        )}
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Company info */}
          <div className="card p-6">
            <h2 className="font-arabic font-semibold mb-5" style={{ color: "var(--color-ink)", borderBottom: "1px solid var(--color-border-light)", paddingBottom: 12 }}>
              {language === "ar" ? "بيانات المنشأة" : "Company Information"}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("settings.company_name_ar", language)}
                </label>
                <input className="input w-full" value={tenant.name_ar ?? ""} onChange={(e) => setTenant({ ...tenant, name_ar: e.target.value })} placeholder={language === "ar" ? "مثال: شركة قطع الغيار" : "Example: Auto Parts Co."} />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("settings.company_name_en", language)}
                </label>
                <input className="input w-full" value={tenant.name ?? ""} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} placeholder="AutoParts Co." />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("settings.vat_number", language)}
                </label>
                <input className="input w-full font-mono" value={tenant.vat_number ?? ""} onChange={(e) => setTenant({ ...tenant, vat_number: e.target.value })} placeholder="300000000000003" maxLength={15} />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("settings.logo", language)}
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
              {language === "ar" ? "بيانات التواصل" : "Contact Information"}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.address", language)}</label>
                <input className="input w-full" value={tenant.address ?? ""} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} placeholder={language === "ar" ? "شارع الملك فهد، حي العليا" : "King Fahd Street"} />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.city", language)}</label>
                <input className="input w-full" value={tenant.city ?? ""} onChange={(e) => setTenant({ ...tenant, city: e.target.value })} placeholder={language === "ar" ? "الرياض" : "Riyadh"} />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.phone", language)}</label>
                <input className="input w-full font-mono" value={tenant.phone ?? ""} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} placeholder="+966500000000" dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.email", language)}</label>
                <input className="input w-full font-mono" type="email" value={tenant.email ?? ""} onChange={(e) => setTenant({ ...tenant, email: e.target.value })} placeholder="info@company.sa" dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.website", language)}</label>
                <input className="input w-full font-mono text-xs" value={tenant.website ?? ""} onChange={(e) => setTenant({ ...tenant, website: e.target.value })} placeholder="https://company.sa" dir="ltr" />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4 mt-6">
          <button type="submit" className="btn btn-gold" disabled={saving}>
            {saving ? (language === "ar" ? "جارٍ الحفظ..." : "Saving...") : t("action.save", language)}
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
            {t("settings.users", language)} ({users.length} / {tenant.max_users})
          </h2>
          <button className="btn btn-gold text-sm" onClick={() => setShowInvite(true)}>
            + {language === "ar" ? "دعوة مستخدم" : "Invite User"}
          </button>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>{language === "ar" ? "الاسم" : "Name"}</th>
              <th>{language === "ar" ? "البريد الإلكتروني" : "Email"}</th>
              <th>{language === "ar" ? "الدور" : "Role"}</th>
              <th>{language === "ar" ? "تاريخ الإضافة" : "Created"}</th>
            </tr>
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
                    {u.role === "superadmin" ? (language === "ar" ? "سوبر أدمن" : "Super Admin") : u.role === "admin" ? (language === "ar" ? "مدير" : "Admin") : u.role === "accountant" ? (language === "ar" ? "محاسب" : "Accountant") : (language === "ar" ? "موظف" : "Staff")}
                  </span>
                </td>
                <td className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                  {new Date(u.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
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
              {language === "ar" ? "دعوة مستخدم جديد" : "Invite User"}
            </h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  {t("settings.invite_email", language)}
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
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>{t("settings.invite_role", language)}</label>
                <select className="input w-full" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="staff">{language === "ar" ? "موظف" : "Staff"}</option>
                  <option value="admin">{language === "ar" ? "مدير" : "Admin"}</option>
                  <option value="accountant">{language === "ar" ? "محاسب" : "Accountant"}</option>
                </select>
              </div>
              {inviteMsg && (
                <p className="font-arabic text-sm" style={{ color: inviteMsg.ok ? "var(--color-green)" : "var(--color-red)" }}>
                  {inviteMsg.text}
                </p>
              )}
              <div className="flex gap-3 mt-2">
                <button type="submit" className="btn btn-gold flex-1" disabled={inviting}>
                  {inviting ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...") : (language === "ar" ? "إرسال الدعوة" : "Send Invite")}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowInvite(false)}>{t("action.cancel", language)}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
