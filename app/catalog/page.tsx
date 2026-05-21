"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";
import { PartForm } from "@/components/parts/PartForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { t } from "@/lib/translations";
import type { Part, PartCategory } from "@/lib/types";

const getConditionLabel = (condition: string, language: string): string => {
  const conditionKey: Record<string, string> = {
    new: "catalog.condition_new",
    used: "catalog.condition_used",
    refurbished: "catalog.condition_refurbished",
  };
  return t(conditionKey[condition] || "catalog.condition_new", language);
};
const conditionColor: Record<string, { bg: string; color: string }> = {
  new:         { bg: "var(--color-green-bg)",  color: "var(--color-green)" },
  used:        { bg: "var(--color-amber-bg)",  color: "var(--color-amber)" },
  refurbished: { bg: "var(--color-blue-bg)",   color: "var(--color-blue)"  },
};

export default function CatalogPage() {
  const { language } = useLanguage();
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("parts")
      .select("*, part_categories(id,name,name_ar)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) q = q.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%,part_number.ilike.%${search}%,oem_number.ilike.%${search}%`);
    if (category) q = q.eq("category_id", category);
    if (condition) q = q.eq("condition", condition);

    const { data } = await q;
    setParts(data ?? []);
    setLoading(false);
  }, [search, category, condition]);

  useEffect(() => {
    supabase.from("part_categories").select("*").order("name_ar").then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openAdd() { setEditPart(null); setShowForm(true); }
  function openEdit(p: Part) { setEditPart(p); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditPart(null); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("parts").update({ is_active: false }).eq("id", deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
    load();
  }

  return (
    <div className="flex-1 p-8" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-arabic text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{t("catalog.title", language)}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
            {loading ? t("msg.loading", language) : `${parts.length} ${t("catalog.part", language)}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="font-arabic">{t("catalog.add_part", language)}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 items-center flex-wrap">
        <div className="flex-1 relative" style={{ minWidth: 200 }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            className="absolute" style={{ top: "50%", right: 10, transform: "translateY(-50%)", color: "var(--color-ink-faint)" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="input" style={{ paddingRight: 36 }} placeholder={t("catalog.search_placeholder", language)}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: "auto", minWidth: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("filter.all_categories", language)}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
        </select>
        <select className="input" style={{ width: "auto", minWidth: 130 }} value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">{t("filter.all_conditions", language)}</option>
          <option value="new">{getConditionLabel("new", language)}</option>
          <option value="used">{getConditionLabel("used", language)}</option>
          <option value="refurbished">{getConditionLabel("refurbished", language)}</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">⚙️</span>
            <p className="font-arabic text-base font-medium" style={{ color: "var(--color-ink-muted)" }}>{t("msg.no_data", language)}</p>
            <button className="btn btn-primary" onClick={openAdd}>
              <span className="font-arabic">{t("catalog.add_first_part", language)}</span>
            </button>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>{t("table.part_number", language)}</th>
                <th>{t("table.name", language)}</th>
                <th>{t("table.category", language)}</th>
                <th>{t("table.brand", language)}</th>
                <th>{t("table.condition", language)}</th>
                <th>{t("table.cost_price", language)}</th>
                <th>{t("table.selling_price", language)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const cond = conditionColor[p.condition] ?? conditionColor.new;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-gold)" }}>{p.part_number}</span>
                      {p.oem_number && <p className="font-mono text-xs mt-0.5" style={{ color: "var(--color-ink-faint)" }}>OEM: {p.oem_number}</p>}
                    </td>
                    <td>
                      <p className="font-arabic font-medium" style={{ color: "var(--color-ink)" }}>{p.name_ar}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>{p.name}</p>
                    </td>
                    <td className="font-arabic text-sm" style={{ color: "var(--color-ink-muted)" }}>
                      {(p as any).part_categories?.name_ar ?? "—"}
                    </td>
                    <td className="text-sm" style={{ color: "var(--color-ink-2)" }}>{p.brand ?? "—"}</td>
                    <td>
                      <span className="badge" style={{ background: cond.bg, color: cond.color }}>
                        {getConditionLabel(p.condition, language)}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-sm" style={{ direction: "ltr", display: "inline-block" }}>
                        {p.price_cost.toLocaleString("ar-SA")} <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)", direction: "ltr", display: "inline-block" }}>
                        {p.price_retail.toLocaleString("ar-SA")} <span style={{ color: "var(--color-ink-faint)", fontSize: 11 }}>ر.س</span>
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }} onClick={() => openEdit(p)}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="font-arabic">{t("action.edit", language)}</span>
                        </button>
                        <Link href={`/catalog/${p.id}`} className="btn btn-ghost text-xs" style={{ padding: "5px 10px" }}>
                          <span className="font-arabic">{t("action.view", language)}</span>
                        </Link>
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ color: "var(--color-ink-faint)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-red)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-faint)"; }}
                          onClick={() => setDeleteTarget(p)}
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editPart ? t("catalog.edit_part", language) : t("catalog.add_new_part", language)}
        size="lg"
      >
        <PartForm
          part={editPart}
          onSave={() => { closeForm(); load(); }}
          onCancel={closeForm}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t("catalog.delete_part", language)} size="sm">
        <div className="flex flex-col gap-4">
          <p className="font-arabic text-sm leading-relaxed" style={{ color: "var(--color-ink-2)" }}>
            {t("catalog.confirm_delete", language)}{" "}
            <strong style={{ color: "var(--color-ink)" }}>{deleteTarget?.name_ar}</strong>؟
            <br />
            {t("catalog.delete_note", language)}
          </p>
          <div className="flex gap-3 justify-end">
            <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
              <span className="font-arabic">{t("action.cancel", language)}</span>
            </button>
            <button
              className="btn"
              style={{ background: "var(--color-red)", color: "#fff" }}
              onClick={confirmDelete}
              disabled={deleting}
            >
              <span className="font-arabic">{t("action.delete", language)}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
