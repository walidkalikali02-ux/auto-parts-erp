"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULT_TENANT = "d0000000-0000-0000-0000-000000000001";

interface Part { id: string; part_number: string; name_ar: string; name: string | null; price_retail: number; unit: string | null; }

export default function LabelsPage() {
  const [parts,     setParts]     = useState<Part[]>([]);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState<Map<string, { part: Part; copies: number }>>(new Map());
  const [loading,   setLoading]   = useState(false);
  const [labelSize, setLabelSize] = useState<"sm"|"md"|"lg">("md");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.trim()) { setParts([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.from("parts")
        .select("id,part_number,name_ar,name,price_retail,unit")
        .eq("is_active", true)
        .or(`name_ar.ilike.%${search}%,part_number.ilike.%${search}%,name.ilike.%${search}%`)
        .limit(15);
      setParts(data ?? []);
      setLoading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

  function toggle(part: Part) {
    setSelected((prev) => {
      const n = new Map(prev);
      if (n.has(part.id)) n.delete(part.id);
      else n.set(part.id, { part, copies: 1 });
      return n;
    });
  }

  function setCopies(id: string, copies: number) {
    setSelected((prev) => {
      const n = new Map(prev);
      const entry = n.get(id);
      if (entry) n.set(id, { ...entry, copies: Math.max(1, copies) });
      return n;
    });
  }

  const sizeStyle = {
    sm: { width: 140, height: 70,  fontSize: 8,  qrSize: 50 },
    md: { width: 200, height: 100, fontSize: 10, qrSize: 70 },
    lg: { width: 280, height: 130, fontSize: 12, qrSize: 90 },
  }[labelSize];

  const allLabels = Array.from(selected.values()).flatMap(({ part, copies }) => Array(copies).fill(part));

  function printLabels() {
    const w = window.open("", "_blank");
    if (!w) return;
    const labels = allLabels.map((p) => `
      <div style="display:inline-block;width:${sizeStyle.width}px;height:${sizeStyle.height}px;border:1px solid #ccc;margin:4px;padding:6px;font-family:Arial,sans-serif;vertical-align:top;break-inside:avoid;box-sizing:border-box;">
        <div style="display:flex;gap:6px;height:100%;align-items:center;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=${sizeStyle.qrSize}x${sizeStyle.qrSize}&data=${encodeURIComponent(p.part_number)}" width="${sizeStyle.qrSize}" height="${sizeStyle.qrSize}" style="flex-shrink:0;"/>
          <div style="flex:1;overflow:hidden;">
            <div style="font-weight:bold;font-size:${sizeStyle.fontSize + 2}px;margin-bottom:3px;color:#B5892A;">${p.part_number}</div>
            <div style="font-size:${sizeStyle.fontSize}px;color:#333;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" dir="rtl">${p.name_ar}</div>
            <div style="font-size:${sizeStyle.fontSize + 1}px;font-weight:bold;color:#1a1705;" dir="rtl">${Number(p.price_retail).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س</div>
          </div>
        </div>
      </div>`).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>طباعة الملصقات</title>
      <style>@media print{@page{margin:5mm}body{margin:0}} body{direction:rtl;}</style>
      </head><body>${labels}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    w.document.close();
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>طباعة ملصقات الباركود</h1>
          <p className="font-arabic text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            ابحث عن القطع وأضفها للطباعة — {selected.size} صنف · {allLabels.length} ملصق
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-surface)" }}>
            {([["sm","صغير"],["md","متوسط"],["lg","كبير"]] as const).map(([v, l]) => (
              <button key={v} className="px-3 py-1.5 rounded-md font-arabic text-xs"
                style={{ background: labelSize === v ? "#fff" : "transparent", color: labelSize === v ? "var(--color-ink)" : "var(--color-ink-muted)", boxShadow: labelSize === v ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}
                onClick={() => setLabelSize(v)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-gold" disabled={allLabels.length === 0} onClick={printLabels}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="font-arabic">طباعة {allLabels.length > 0 ? `(${allLabels.length})` : ""}</span>
          </button>
        </div>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Search + results */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <div className="relative">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input className="input" style={{ paddingRight: 36 }}
                placeholder="ابحث برقم القطعة أو الاسم..." value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {parts.length > 0 && (
            <div className="card overflow-hidden">
              <table className="erp-table">
                <thead><tr><th>القطعة</th><th>السعر</th><th></th></tr></thead>
                <tbody>
                  {parts.map((p) => {
                    const inSelected = selected.has(p.id);
                    return (
                      <tr key={p.id} style={{ background: inSelected ? "var(--color-gold-bg)" : undefined }}>
                        <td>
                          <p className="font-arabic text-sm font-medium">{p.name_ar}</p>
                          <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{p.part_number}</p>
                        </td>
                        <td className="font-mono text-sm" style={{ direction: "ltr" }}>
                          {Number(p.price_retail).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </td>
                        <td>
                          <button className={`btn text-xs ${inSelected ? "btn-outline" : "btn-gold"}`}
                            style={{ padding: "4px 12px" }} onClick={() => toggle(p)}>
                            <span className="font-arabic">{inSelected ? "إزالة" : "إضافة"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {search && parts.length === 0 && !loading && (
            <div className="card p-8 flex flex-col items-center gap-2">
              <span className="text-4xl opacity-20">🔍</span>
              <p className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>لا نتائج</p>
            </div>
          )}
        </div>

        {/* Selected + preview */}
        <div className="flex flex-col gap-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-light)" }}>
              <h3 className="font-arabic font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
                القطع المحددة ({selected.size})
              </h3>
            </div>
            {selected.size === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <span className="text-3xl opacity-20">🏷️</span>
                <p className="font-arabic text-xs text-center" style={{ color: "var(--color-ink-muted)" }}>
                  ابحث عن قطع وأضفها
                </p>
              </div>
            ) : (
              <div className="p-3 flex flex-col gap-2">
                {Array.from(selected.values()).map(({ part, copies }) => (
                  <div key={part.id} className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ background: "var(--color-surface)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-arabic text-xs font-medium truncate">{part.name_ar}</p>
                      <p className="font-mono text-xs" style={{ color: "var(--color-gold)" }}>{part.part_number}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="w-6 h-6 rounded flex items-center justify-center text-sm"
                        style={{ background: "var(--color-border)", color: "var(--color-ink)" }}
                        onClick={() => setCopies(part.id, copies - 1)}>−</button>
                      <span className="font-mono text-sm w-6 text-center">{copies}</span>
                      <button className="w-6 h-6 rounded flex items-center justify-center text-sm"
                        style={{ background: "var(--color-border)", color: "var(--color-ink)" }}
                        onClick={() => setCopies(part.id, copies + 1)}>+</button>
                    </div>
                    <button onClick={() => toggle(part)} style={{ color: "var(--color-ink-faint)", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {selected.size > 0 && (
            <div className="card p-4">
              <p className="font-arabic text-xs font-semibold mb-3" style={{ color: "var(--color-ink-muted)" }}>معاينة الملصق</p>
              <div style={{
                width: sizeStyle.width, height: sizeStyle.height,
                border: "1px solid var(--color-border)", borderRadius: 6,
                display: "flex", alignItems: "center", gap: 8, padding: 8,
                background: "#fff",
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=${sizeStyle.qrSize}x${sizeStyle.qrSize}&data=${encodeURIComponent(Array.from(selected.values())[0].part.part_number)}`}
                  width={sizeStyle.qrSize} height={sizeStyle.qrSize}
                  alt="QR"
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p className="font-mono font-bold" style={{ fontSize: sizeStyle.fontSize + 2, color: "#B5892A" }}>
                    {Array.from(selected.values())[0].part.part_number}
                  </p>
                  <p className="font-arabic" style={{ fontSize: sizeStyle.fontSize, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {Array.from(selected.values())[0].part.name_ar}
                  </p>
                  <p className="font-mono font-bold" style={{ fontSize: sizeStyle.fontSize + 1, color: "#1a1705", marginTop: 2 }}>
                    {Number(Array.from(selected.values())[0].part.price_retail).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
