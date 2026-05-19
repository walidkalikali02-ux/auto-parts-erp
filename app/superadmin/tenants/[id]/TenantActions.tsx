"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const plans = ["starter", "pro", "enterprise"];

export function TenantActions({
  tenantId,
  isActive,
  currentPlan,
}: {
  tenantId: string;
  isActive: boolean;
  currentPlan: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    await supabase.from("tenants").update({ is_active: !isActive }).eq("id", tenantId);
    router.refresh();
    setLoading(false);
  }

  async function changePlan(plan: string) {
    setLoading(true);
    await supabase.from("tenants").update({ plan }).eq("id", tenantId);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2 items-center">
      {/* Plan selector */}
      <select
        className="input text-sm"
        style={{ width: "auto", minWidth: 130 }}
        value={currentPlan}
        onChange={(e) => changePlan(e.target.value)}
        disabled={loading}
      >
        {plans.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Pause / Activate */}
      <button
        className="btn"
        style={{
          background: isActive ? "var(--color-red-bg)" : "var(--color-green-bg)",
          color: isActive ? "var(--color-red)" : "var(--color-green)",
          border: `1px solid ${isActive ? "var(--color-red)" : "var(--color-green)"}20`,
        }}
        onClick={toggleActive}
        disabled={loading}
      >
        {isActive ? (
          <>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-arabic">إيقاف مؤقت</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-arabic">تفعيل</span>
          </>
        )}
      </button>
    </div>
  );
}
