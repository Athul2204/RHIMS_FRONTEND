// src/modules/manager/pages/website/ProceduresTab.jsx
//
// Diseases & Procedures listed under a specialty's page. Diseases and
// procedures share one model (`kind` distinguishes them) rather than
// being split into two tabs, matching the backend's tag-chip design.
//
// GET .../procedures/ is NOT paginated (plain array) and genuinely
// supports ?specialty=<id> server-side (WebsiteProcedureListView filters
// on it directly) — so the specialty filter below hits the backend
// rather than filtering an already-fetched list client-side.
import { useState, useEffect, useCallback } from "react";
import {
  getProcedures, createProcedure, updateProcedure, deleteProcedure,
  activateProcedure, deactivateProcedure, reorderProcedures, getSpecialityOptions,
  toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, PhotoUploadField, SubsectionsField,
} from "./shared";

const KIND_OPTIONS = ["Disease", "Procedure"];
const EMPTY_FORM = {
  specialty: "", name: "", kind: "Procedure", summary: "",
  hero_image: null, removeHeroImage: false, currentHeroImageUrl: null,
  sections: [], display_order: 0,
};
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "name",          label: "Name (A–Z)" },
  { value: "-name",         label: "Name (Z–A)" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function ProceduresTab({ showToast }) {
  const [items, setItems]     = useState([]);
  const [search, setSearch]   = useState("");
  const [ordering, setOrdering] = useState("display_order");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [specialties, setSpecialties] = useState([]);

  const [showModal, setModal]     = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [togglingActive, setTogglingActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { search, ordering };
      if (specialtyFilter) params.specialty = specialtyFilter;
      const res = await getProcedures(params);
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load diseases/procedures.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering, specialtyFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getSpecialityOptions().then((res) => {
      setSpecialties(Array.isArray(res) ? res : []);
    }).catch(() => setSpecialties([]));
  }, []);

  const specialtyLabel = (s) => (s.parent_name ? `${s.parent_name} — ${s.name}` : s.name);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, specialty: specialtyFilter || "" });
    setFormError(null);
    setModal(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      specialty: p.specialty ?? "", name: p.name, kind: p.kind || "Procedure",
      summary: p.summary || "",
      hero_image: null, removeHeroImage: false,
      currentHeroImageUrl: p.hero_image ? toAbsoluteMediaUrl(p.hero_image) : null,
      sections: Array.isArray(p.sections) ? p.sections : [],
      display_order: p.display_order ?? 0,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.specialty) {
      setFormError("Please select a specialty.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        specialty: form.specialty,
        name: form.name,
        kind: form.kind,
        summary: form.summary,
        sections: form.sections,
        display_order: form.display_order,
      };
      if (form.hero_image) payload.hero_image = form.hero_image;
      if (editing && form.removeHeroImage && !form.hero_image) payload.remove_hero_image = true;
      if (editing) {
        await updateProcedure(editing.id, payload);
        showToast("Updated.");
      } else {
        await createProcedure(payload);
        showToast("Added.");
      }
      setModal(false);
      load();
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteProcedure(confirmDelete.id);
    showToast("Deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (p) => {
    setTogglingActive(p.id);
    try {
      if (p.is_active) await deactivateProcedure(p.id);
      else await activateProcedure(p.id);
      showToast(p.is_active ? "Deactivated." : "Activated.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setTogglingActive(null);
    }
  };

  const move = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = moveItem(items, index, newIndex);
    setItems(reordered);
    try {
      await reorderProcedures(reordered.map((i) => i.id));
    } catch {
      showToast("Failed to save new order.", false);
      load();
    }
  };

  const canReorder = ordering === "display_order" && !search;

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, maxWidth: "220px" }}
          placeholder="Search name / summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "220px" }} value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
          <option value="">All specialties</option>
          {specialties.map((s) => <option key={s.id} value={s.id}>{specialtyLabel(s)}</option>)}
        </select>
        <select style={{ ...inputStyle, maxWidth: "180px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Disease / Procedure</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No diseases or procedures found." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              {canReorder && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              <div style={{
                width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden", flexShrink: 0,
                background: "#F1F5F9", border: "1px solid #E2E8F0",
              }}>
                {p.hero_image && (
                  <img src={toAbsoluteMediaUrl(p.hero_image)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{
                padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, flexShrink: 0,
                background: p.kind === "Disease" ? "#FEF2F2" : "#EFF6FF",
                color:      p.kind === "Disease" ? "#B91C1C" : "#2563EB",
              }}>
                {p.kind}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{p.name}</span>
                  <StatusPill active={p.is_active} />
                  {Array.isArray(p.sections) && p.sections.length > 0 && (
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>· has detail page content</span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                  {p.specialty_name || "No specialty"}
                  {p.slug && <span style={{ color: "#CBD5E1" }}> · /{p.slug}</span>}
                </div>
                {p.summary && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{p.summary}</p>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => toggleActive(p)} disabled={togglingActive === p.id}>
                  {p.is_active ? "Deactivate" : "Activate"}
                </button>
                <button style={btnGhost} onClick={() => openEdit(p)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(p)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Disease / Procedure" : "Add Disease / Procedure"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Specialty" required>
            <select style={inputStyle} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}>
              <option value="">Select a specialty…</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{specialtyLabel(s)}</option>)}
            </select>
          </InputField>
          <InputField label="Name" required>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </InputField>
          <InputField label="Kind" required>
            <select style={inputStyle} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </InputField>
          <InputField label="Summary" hint="Short blurb — used as the chip tooltip in the list above, and as the lead paragraph at the top of the detail page.">
            <textarea style={textareaStyle} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
          </InputField>
          <InputField label="Hero Image" hint="Shown in the detail page hero, beside the 'Book An Appointment' form.">
            <PhotoUploadField
              file={form.hero_image}
              currentUrl={form.currentHeroImageUrl}
              removed={form.removeHeroImage}
              onSelect={(f) => setForm((prev) => ({ ...prev, hero_image: f, removeHeroImage: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, hero_image: null, removeHeroImage: true }))}
            />
          </InputField>
          <InputField label="Detail Page Content" hint="Optional. Builds the body of the full detail page — e.g. 'What symptoms does X Cause?' + bullets, 'Who is More at Risk?' + bullets. Leave empty to keep this entry as just a chip with no detail page beyond its summary.">
            <SubsectionsField
              value={form.sections}
              onChange={(sections) => setForm((f) => ({ ...f, sections }))}
            />
          </InputField>
          <InputField label="Display Order">
            <input
              type="number"
              style={inputStyle}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
            />
          </InputField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button style={btnSecondary} onClick={() => setModal(false)} disabled={saving}>Cancel</button>
            <button style={{ ...btnPrimary(), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Entry"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}