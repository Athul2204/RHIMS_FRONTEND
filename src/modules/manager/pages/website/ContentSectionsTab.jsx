// src/modules/manager/pages/website/ContentSectionsTab.jsx
//
// Free-form bulleted content blocks shown on a specialty detail page —
// "Why Choose Us?", "Treatments and Procedures at RHIMS HEALTH",
// "Available Facilities and Equipment", or any other heading + optional
// intro paragraph + bullet list a specialty page needs. A specialty can
// have any number of these, in whatever order display_order gives them.
//
// GET .../specialty-sections/ is NOT paginated (plain array) and
// supports ?specialty=<id> server-side, same shape as ProceduresTab.
import { useState, useEffect, useCallback } from "react";
import {
  getSpecialtySections, createSpecialtySection, updateSpecialtySection, deleteSpecialtySection,
  reorderSpecialtySections, getSpecialityOptions,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, StringListField, SubsectionsField, letterLabel,
} from "./shared";

const EMPTY_FORM = { specialty: "", heading: "", intro: "", items: [], subsections: [], is_active: true, display_order: 0 };

// Mirrors the public site's rendering of a content section (see the
// public repo's ContentSections component in pages/SpecialtyDetail.jsx)
// as closely as this admin's plain inline-style world allows, so staff
// can see roughly how it'll look before saving — heading, then intro
// paragraph, then a dotted bullet list.
function BulletList({ items }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "6px" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: "10px", fontSize: "13.5px", color: "#374151", lineHeight: 1.6 }}>
          <span style={{ marginTop: "7px", width: "6px", height: "6px", borderRadius: "50%", background: "#EA580C", flexShrink: 0 }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionPreview({ heading, intro, items, subsections = [] }) {
  const visibleSubsections = subsections.filter(
    (s) =>
      (s.heading || "").trim() ||
      (s.description || "").trim() ||
      (s.items || []).length > 0 ||
      (s.alphabet_list || []).some((a) => (a.description || "").trim() || (a.items || []).length > 0)
  );
  const hasContent = heading.trim() || intro.trim() || items.length > 0 || visibleSubsections.length > 0;
  if (!hasContent) {
    return (
      <p style={{ fontSize: "12.5px", color: "#94A3B8", fontStyle: "italic", margin: 0 }}>
        Start filling in the fields above to see a preview.
      </p>
    );
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: "10px", padding: "18px 20px" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
        {heading.trim() || <span style={{ color: "#CBD5E1" }}>Heading…</span>}
      </h3>
      {intro.trim() && (
        <p style={{ margin: "0 0 10px", fontSize: "13.5px", color: "#374151", lineHeight: 1.6 }}>{intro}</p>
      )}
      {items.length > 0 && <BulletList items={items} />}
      {visibleSubsections.length > 0 && (
        <div style={{ display: "grid", gap: "12px", marginTop: items.length > 0 ? "14px" : "0" }}>
          {visibleSubsections.map((sub, i) => {
            const alphabetList = (sub.alphabet_list || []).filter(
              (a) => (a.description || "").trim() || (a.items || []).length > 0
            );
            return (
              <div key={i}>
                <h4 style={{ margin: "0 0 6px", fontSize: "14.5px", fontWeight: 700, color: "#1E293B" }}>
                  {(sub.heading || "").trim() || <span style={{ color: "#CBD5E1" }}>Sub-heading…</span>}
                </h4>
                {(sub.description || "").trim() && (
                  <p style={{ margin: "0 0 6px", fontSize: "13.5px", color: "#374151", lineHeight: 1.6 }}>{sub.description}</p>
                )}
                {alphabetList.length > 0 ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {alphabetList.map((entry, j) => (
                      <div key={j}>
                        <p style={{ margin: 0, fontSize: "13.5px", color: "#374151", lineHeight: 1.6 }}>
                          <strong>{letterLabel(j)}.</strong>{" "}
                          {(entry.description || "").trim()}
                        </p>
                        {(entry.items || []).length > 0 && (
                          <div style={{ marginTop: "4px", marginLeft: "18px" }}>
                            <BulletList items={entry.items} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  (sub.items || []).length > 0 && <BulletList items={sub.items} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "heading",       label: "Heading (A–Z)" },
  { value: "-heading",      label: "Heading (Z–A)" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function ContentSectionsTab({ showToast }) {
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
      const res = await getSpecialtySections(specialtyFilter || undefined);
      let list = Array.isArray(res) ? res : [];

      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (s) => s.heading.toLowerCase().includes(q) || (s.intro || "").toLowerCase().includes(q)
        );
      }

      const sorted = [...list];
      if (ordering === "heading") sorted.sort((a, b) => a.heading.localeCompare(b.heading));
      else if (ordering === "-heading") sorted.sort((a, b) => b.heading.localeCompare(a.heading));
      else if (ordering === "-created_at") sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      else if (ordering === "created_at") sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      else sorted.sort((a, b) => a.display_order - b.display_order);

      setItems(sorted);
    } catch {
      setError("Failed to load content sections.");
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
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      specialty: s.specialty ?? "", heading: s.heading, intro: s.intro || "",
      items: (s.items || "").split("\n").map((l) => l.trim()).filter(Boolean),
      subsections: Array.isArray(s.subsections)
        ? s.subsections.map((sub) => ({
            heading: sub.heading || "",
            description: sub.description || "",
            items: Array.isArray(sub.items) ? sub.items : [],
            alphabet_list: Array.isArray(sub.alphabet_list)
              ? sub.alphabet_list.map((a) => ({
                  description: a.description || "",
                  items: Array.isArray(a.items) ? a.items : [],
                }))
              : [],
            list_type: sub.list_type === "alphabet" || sub.list_type === "bullets"
              ? sub.list_type
              : (Array.isArray(sub.alphabet_list) && sub.alphabet_list.length > 0 ? "alphabet" : "bullets"),
          }))
        : [],
      is_active: s.is_active, display_order: s.display_order ?? 0,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.specialty) {
      setFormError("Please select a specialty.");
      return;
    }
    if (!form.heading.trim()) {
      setFormError("Heading is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        specialty: form.specialty,
        heading: form.heading,
        intro: form.intro,
        items: form.items.join("\n"),
        // Drop any sub-heading left completely empty (no heading text and
        // no bullets) rather than saving placeholder rows the manager
        // never actually filled in.
        subsections: form.subsections.filter((s) => s.heading.trim() || (s.description || "").trim() || (s.items || []).length > 0),
        is_active: form.is_active,
        display_order: form.display_order,
      };
      if (editing) {
        await updateSpecialtySection(editing.id, payload);
        showToast("Section updated.");
      } else {
        await createSpecialtySection(payload);
        showToast("Section added.");
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
    await deleteSpecialtySection(confirmDelete.id);
    showToast("Section deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (s) => {
    setTogglingActive(s.id);
    try {
      await updateSpecialtySection(s.id, { is_active: !s.is_active });
      showToast(s.is_active ? "Hidden from the public site." : "Shown on the public site.");
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
      await reorderSpecialtySections(reordered.map((i) => i.id));
    } catch {
      showToast("Failed to save new order.", false);
      load();
    }
  };

  // Reordering across different specialties in the same view wouldn't
  // make sense (display_order is only meaningful within one specialty's
  // page) — only allow it once a single specialty is selected, same
  // restriction the backend's reorder endpoint doesn't enforce itself
  // but the UI should.
  const canReorder = ordering === "display_order" && !search && !!specialtyFilter;

  const itemCount = (s) => (s.items || "").split("\n").map((l) => l.trim()).filter(Boolean).length;
  const subsectionCount = (s) => (Array.isArray(s.subsections) ? s.subsections.length : 0);

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, maxWidth: "220px" }}
          placeholder="Search heading / intro…"
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
        <button style={btnPrimary()} onClick={openCreate}>+ Add Content Section</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Select one specialty, switch to "Display order", and clear search to reorder its sections.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No content sections found." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((s, i) => (
            <div key={s.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              {canReorder && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{s.heading}</span>
                  <StatusPill active={s.is_active} activeLabel="Visible" inactiveLabel="Hidden" />
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                  {s.specialty_name || "No specialty"} · {itemCount(s)} bullet{itemCount(s) === 1 ? "" : "s"}
                  {subsectionCount(s) > 0 && ` · ${subsectionCount(s)} sub-heading${subsectionCount(s) === 1 ? "" : "s"}`}
                </div>
                {s.intro && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{s.intro}</p>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => toggleActive(s)} disabled={togglingActive === s.id}>
                  {s.is_active ? "Hide" : "Show"}
                </button>
                <button style={btnGhost} onClick={() => openEdit(s)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(s)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Content Section" : "Add Content Section"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Specialty" required>
            <select style={inputStyle} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}>
              <option value="">Select a specialty…</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{specialtyLabel(s)}</option>)}
            </select>
          </InputField>
          <InputField label="Heading" required hint="e.g. 'Why Choose Us?', 'Treatments and Procedures at RHIMS HEALTH'.">
            <input style={inputStyle} value={form.heading} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} />
          </InputField>
          <InputField label="Intro" hint="Optional paragraph shown above the bullet list.">
            <textarea style={textareaStyle} value={form.intro} onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))} />
          </InputField>
          <InputField label="Bullet Points" hint="Shown directly under the main heading. Add each bullet point one at a time; reorder or remove with the controls.">
            <StringListField
              value={form.items}
              onChange={(items) => setForm((f) => ({ ...f, items }))}
              placeholder="e.g. E-CPR (Extracorporeal CPR): Advanced life-saving technique…"
            />
          </InputField>
          <InputField label="Sub-headings" hint="Optional. Each sub-heading can have its own description, then either a plain bullet list or an auto-lettered alphabet list — shown after the bullets above.">
            <SubsectionsField
              value={form.subsections}
              onChange={(subsections) => setForm((f) => ({ ...f, subsections }))}
            />
          </InputField>

          <div style={{ marginTop: "6px", marginBottom: "16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Preview — how this looks on the specialty page
            </p>
            <SectionPreview heading={form.heading} intro={form.intro} items={form.items} subsections={form.subsections} />
          </div>
          <InputField label="Display Order">
            <input
              type="number"
              style={inputStyle}
              value={form.display_order}
              onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
            />
          </InputField>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", marginTop: "4px" }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Visible on the public site
          </label>
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
          title="Delete Content Section"
          message={`Delete "${confirmDelete.heading}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}