"use client";

import { useState } from "react";

interface Props {
  label?: string;
  onExport: () => void | Promise<void>;
}

export function ExportButton({ label = "تصدير Excel", onExport }: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try { await onExport(); } finally { setLoading(false); }
  }

  return (
    <button
      className="btn btn-outline"
      onClick={handle}
      disabled={loading}
      style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      <span className="font-arabic">{loading ? "جارٍ التصدير..." : label}</span>
    </button>
  );
}
