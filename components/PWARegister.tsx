"use client";

import { useEffect, useState } from "react";

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [shown,         setShown]         = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Capture install prompt
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); setShown(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShown(false);
  }

  if (!shown) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 card p-4 flex items-center gap-3"
      style={{ maxWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,.15)", borderLeft: "3px solid var(--color-gold)" }}
    >
      <div className="text-2xl flex-shrink-0">📱</div>
      <div className="flex-1 min-w-0">
        <p className="font-arabic text-sm font-semibold" style={{ color: "var(--color-ink)" }}>تثبيت التطبيق</p>
        <p className="font-arabic text-xs" style={{ color: "var(--color-ink-muted)" }}>افتح AutoParts ERP بشكل أسرع</p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-gold text-xs px-3 py-1.5" onClick={install}>تثبيت</button>
        <button
          className="text-xs"
          style={{ color: "var(--color-ink-faint)" }}
          onClick={() => setShown(false)}
        >✕</button>
      </div>
    </div>
  );
}
