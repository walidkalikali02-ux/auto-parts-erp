"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: "مجاني",
    desc: "للمحلات الصغيرة",
    features: ["3 مستخدمين", "200 قطعة", "100 طلب/شهر"],
    accent: "var(--color-ink-muted)",
  },
  {
    id: "pro",
    label: "Pro",
    price: "499 ر.س / شهر",
    desc: "للمحلات المتوسطة",
    features: ["10 مستخدمين", "2000 قطعة", "1000 طلب/شهر", "تقارير متقدمة", "ZATCA"],
    accent: "var(--color-blue)",
    recommended: true,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "تواصل معنا",
    desc: "للشركات الكبرى",
    features: ["مستخدمون غير محدود", "قطع غير محدودة", "طلبات غير محدودة", "دعم مخصص", "API"],
    accent: "var(--color-gold)",
  },
];

const STEPS = ["الباقة", "المنشأة", "الحساب", "الانتهاء"];

export default function SignupPage() {
  const router = useRouter();
  const [step,     setStep]     = useState(0);
  const [plan,     setPlan]     = useState("pro");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Step 2 — company
  const [companyAr,  setCompanyAr]  = useState("");
  const [companyEn,  setCompanyEn]  = useState("");
  const [vatNumber,  setVatNumber]  = useState("");
  const [city,       setCity]       = useState("");
  const [phone,      setPhone]      = useState("");

  // Step 3 — account
  const [fullName,   setFullName]   = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [password2,  setPassword2]  = useState("");

  async function handleSignup() {
    if (password !== password2) { setError("كلمتا المرور غير متطابقتين"); return; }
    if (password.length < 8)    { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    setLoading(true);
    setError("");

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
      if (authErr || !authData.user) throw new Error(authErr?.message ?? "فشل إنشاء الحساب");

      const userId = authData.user.id;
      const slug   = companyEn.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `tenant-${Date.now()}`;

      // 2. Create tenant
      const { data: tenantData, error: tenantErr } = await supabase
        .from("tenants")
        .insert({
          name:       companyEn,
          name_ar:    companyAr,
          slug,
          plan,
          vat_number: vatNumber || null,
          city:       city || null,
          phone:      phone || null,
        })
        .select()
        .single();

      if (tenantErr || !tenantData) throw new Error(tenantErr?.message ?? "فشل إنشاء المنشأة");

      // 3. Create profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({
          id:        userId,
          tenant_id: tenantData.id,
          full_name: fullName,
          email,
          role:      "admin",
        });

      if (profileErr) throw new Error(profileErr.message);

      setStep(3);
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
          <polygon points="24,2 46,13 46,35 24,46 2,35 2,13" stroke="#B5892A" strokeWidth="2.5" fill="none" />
          <circle cx="24" cy="24" r="7" fill="#B5892A" />
        </svg>
        <div>
          <p className="font-mono font-bold text-base" style={{ color: "var(--color-ink)" }}>AutoParts ERP</p>
          <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>نظام إدارة قطع الغيار</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full text-xs font-bold"
              style={{
                width: 28, height: 28,
                background: i <= step ? "var(--color-gold)" : "var(--color-border)",
                color:      i <= step ? "#fff"              : "var(--color-ink-muted)",
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className="font-arabic text-xs" style={{ color: i === step ? "var(--color-ink)" : "var(--color-ink-faint)" }}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div style={{ width: 20, height: 1, background: "var(--color-border)" }} />}
          </div>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 680 }}>

        {/* Step 0 — Choose plan */}
        {step === 0 && (
          <div>
            <h1 className="font-arabic text-2xl font-bold text-center mb-2" style={{ color: "var(--color-ink)" }}>
              اختر الباقة المناسبة
            </h1>
            <p className="font-arabic text-sm text-center mb-8" style={{ color: "var(--color-ink-muted)" }}>
              يمكنك تغيير الباقة في أي وقت
            </p>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  className="card p-6 cursor-pointer transition-all"
                  style={{
                    border: plan === p.id ? `2px solid ${p.accent}` : "1px solid var(--color-border)",
                    transform: plan === p.id ? "translateY(-2px)" : "none",
                  }}
                  onClick={() => setPlan(p.id)}
                >
                  {p.recommended && (
                    <p className="font-arabic text-xs font-bold mb-3" style={{ color: p.accent }}>
                      ★ الأكثر شيوعاً
                    </p>
                  )}
                  <p className="font-mono font-bold text-base mb-1" style={{ color: p.accent }}>{p.label}</p>
                  <p className="font-arabic font-bold text-lg mb-1" style={{ color: "var(--color-ink)" }}>{p.price}</p>
                  <p className="font-arabic text-xs mb-4" style={{ color: "var(--color-ink-muted)" }}>{p.desc}</p>
                  <ul className="flex flex-col gap-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="font-arabic text-xs flex items-center gap-2" style={{ color: "var(--color-ink-2)" }}>
                        <span style={{ color: p.accent }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-8">
              <button className="btn btn-gold px-10" onClick={() => setStep(1)}>
                متابعة
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Company info */}
        {step === 1 && (
          <div className="card p-8">
            <h1 className="font-arabic text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
              بيانات المنشأة
            </h1>
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  اسم المنشأة بالعربية *
                </label>
                <input className="input w-full" value={companyAr} onChange={(e) => setCompanyAr(e.target.value)} placeholder="مثال: شركة الغيار العربية" required />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  اسم المنشأة بالإنجليزية
                </label>
                <input className="input w-full" value={companyEn} onChange={(e) => setCompanyEn(e.target.value)} placeholder="Auto Parts Co." dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>
                  رقم تسجيل ضريبة القيمة المضافة
                </label>
                <input className="input w-full font-mono" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="300000000000003" maxLength={15} dir="ltr" />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>المدينة</label>
                <input className="input w-full" value={city} onChange={(e) => setCity(e.target.value)} placeholder="الرياض" />
              </div>
              <div className="col-span-2">
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>رقم الهاتف</label>
                <input className="input w-full font-mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966500000000" dir="ltr" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-gold flex-1" onClick={() => { if (!companyAr.trim()) { setError("اسم المنشأة مطلوب"); return; } setError(""); setStep(2); }}>
                متابعة
              </button>
              <button className="btn btn-outline" onClick={() => setStep(0)}>رجوع</button>
            </div>
            {error && <p className="font-arabic text-sm mt-3" style={{ color: "var(--color-red)" }}>{error}</p>}
          </div>
        )}

        {/* Step 2 — Account */}
        {step === 2 && (
          <div className="card p-8">
            <h1 className="font-arabic text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
              إنشاء حساب المدير
            </h1>
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>الاسم الكامل *</label>
                <input className="input w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="محمد أحمد" required />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>البريد الإلكتروني *</label>
                <input className="input w-full font-mono" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@company.sa" dir="ltr" required />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>كلمة المرور *</label>
                <input className="input w-full font-mono" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف على الأقل" dir="ltr" required />
              </div>
              <div>
                <label className="font-arabic text-xs font-semibold block mb-1" style={{ color: "var(--color-ink-muted)" }}>تأكيد كلمة المرور *</label>
                <input className="input w-full font-mono" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="أعد كتابة كلمة المرور" dir="ltr" required />
              </div>
            </div>
            {error && <p className="font-arabic text-sm mt-3" style={{ color: "var(--color-red)" }}>{error}</p>}
            <div className="flex gap-3 mt-6">
              <button className="btn btn-gold flex-1" disabled={loading} onClick={handleSignup}>
                {loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
              </button>
              <button className="btn btn-outline" onClick={() => { setError(""); setStep(1); }}>رجوع</button>
            </div>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="card p-12 flex flex-col items-center gap-6">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 72, height: 72, background: "var(--color-green-bg)" }}
            >
              <span className="text-4xl">✓</span>
            </div>
            <div className="text-center">
              <h1 className="font-arabic text-2xl font-bold mb-2" style={{ color: "var(--color-ink)" }}>
                تم إنشاء حسابك بنجاح!
              </h1>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                مرحباً بك في AutoParts ERP — يمكنك الآن تسجيل الدخول والبدء.
              </p>
              <p className="font-arabic text-xs mt-2" style={{ color: "var(--color-ink-faint)" }}>
                إذا لم يتم تأكيد بريدك الإلكتروني تلقائياً، تحقق من صندوق الوارد.
              </p>
            </div>
            <button
              className="btn btn-gold px-12 mt-2"
              onClick={() => { window.location.href = "/login"; }}
            >
              تسجيل الدخول
            </button>
          </div>
        )}
      </div>

      <p className="font-arabic text-xs mt-8" style={{ color: "var(--color-ink-faint)" }}>
        لديك حساب بالفعل؟{" "}
        <a href="/login" style={{ color: "var(--color-gold)" }}>تسجيل الدخول</a>
      </p>
    </div>
  );
}
