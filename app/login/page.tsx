"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--color-surface)" }}
    >
      {/* Background pattern */}
      <div
        className="fixed inset-0 geo-pattern pointer-events-none"
        style={{ opacity: 0.4 }}
      />

      <div className="w-full relative" style={{ maxWidth: 400 }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="mb-4">
            <polygon
              points="26,3 49,15 49,37 26,49 3,37 3,15"
              fill="var(--color-gold-dim)"
              stroke="var(--color-gold)"
              strokeWidth="1.5"
            />
            <polygon
              points="26,11 41,19 41,33 26,41 11,33 11,19"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle cx="26" cy="26" r="6" fill="var(--color-gold)" />
          </svg>
          <h1
            className="font-arabic text-2xl font-bold"
            style={{ color: "var(--color-ink)" }}
          >
            قطع الغيار ERP
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
            نظام إدارة موارد قطع السيارات
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2
            className="font-arabic text-lg font-semibold mb-6 text-center"
            style={{ color: "var(--color-ink)" }}
          >
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label
                className="block font-arabic text-sm font-medium mb-1.5"
                style={{ color: "var(--color-ink-2)" }}
              >
                البريد الإلكتروني
              </label>
              <input
                className="input"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ direction: "ltr", textAlign: "left" }}
              />
            </div>

            <div>
              <label
                className="block font-arabic text-sm font-medium mb-1.5"
                style={{ color: "var(--color-ink-2)" }}
              >
                كلمة المرور
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ direction: "ltr" }}
              />
            </div>

            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm font-arabic"
                style={{ background: "var(--color-red-bg)", color: "var(--color-red)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-gold w-full justify-center mt-2"
              style={{ padding: "11px 0" }}
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : null}
              <span className="font-arabic">دخول</span>
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-6 font-arabic"
          style={{ color: "var(--color-ink-faint)" }}
        >
          نظام SaaS لقطع غيار السيارات · جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
