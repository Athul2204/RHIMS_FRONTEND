// src/modules/manager/pages/website/SpecialitiesTab.jsx
//
// Specialties/departments (e.g. "Cardiac Sciences") that can nest
// sub-specialties (e.g. "Cardiology") one level deep via `parent`.
// Unlike the other website-CMS resources, GET .../specialities/ is NOT
// paginated — it's always a plain array — and by default only returns
// top-level rows. This tab always fetches with `all: true` instead, so
// every request gets the full SpecialtySerializer shape (hero_image,
// parent, etc. — not the compact SpecialtySubSerializer
// shape nested specialties would otherwise come back as) for every
// specialty, parent and child alike. That flat list is then built into a
// two-level tree client-side for display, and doubles as the data source
// for editing any row (including a child) without a second fetch.
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getSpecialities, createSpeciality, updateSpeciality, deleteSpeciality,
  activateSpeciality, deactivateSpeciality, reorderSpecialities, toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, PhotoUploadField,
} from "./shared";

const EMPTY_FORM = {
  name: "", slug: "", parent: "",
  hero_image: null, currentHeroImageUrl: null,
  display_order: 0,
};
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "name",          label: "Name (A–Z)" },
  { value: "-name",         label: "Name (Z–A)" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function SpecialitiesTab({ showToast }) {
  const [items, setItems]     = useState([]); // flat list — every specialty, parents + children
  const [search, setSearch]   = useState("");
  const [ordering, setOrdering] = useState("display_order");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [showModal, setModal]     = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [togglingActive, setTogglingActive] = useState(null);
  const [reorderingGroup, setReorderingGroup] = useState(null); // parent id (or "top") currently reordering

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSpecialities({ all: true, search, ordering });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load specialities.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering]);

  useEffect(() => { load(); }, [load]);

  // Build the two-level tree (top-level specialties, each carrying its
  // own children array) from the flat fetch. Children with a parent_id
  // not present in this list (shouldn't happen, but defensive) fall back
  // to being shown top-level rather than silently disappearing.
  const tree = useMemo(() => {
    const byId = new Map(items.map((s) => [s.id, s]));
    const topLevel = [];
    const childrenByParent = new Map();
    items.forEach((s) => {
      if (s.parent && byId.has(s.parent)) {
        if (!childrenByParent.has(s.parent)) childrenByParent.set(s.parent, []);
        childrenByParent.get(s.parent).push(s);
      } else {
        topLevel.push(s);
      }
    });
    return { topLevel, childrenByParent };
  }, [items]);

  const canReorder = ordering === "display_order" && !search;

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name, slug: s.slug || "", parent: s.parent ?? "",
      hero_image: null, currentHeroImageUrl: s.hero_image ? toAbsoluteMediaUrl(s.hero_image) : null,
      display_order: s.display_order ?? 0,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        parent: form.parent === "" ? null : form.parent,
        display_order: form.display_order,
      };
      if (form.hero_image) payload.hero_image = form.hero_image;

      if (editing) {
        await updateSpeciality(editing.id, payload);
        showToast("Specialty updated.");
      } else {
        await createSpeciality(payload);
        showToast("Specialty created.");
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
    await deleteSpeciality(confirmDelete.id);
    showToast("Specialty deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (s) => {
    setTogglingActive(s.id);
    try {
      if (s.is_published) await deactivateSpeciality(s.id);
      else await activateSpeciality(s.id);
      showToast(s.is_published ? "Specialty unpublished." : "Specialty published.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setTogglingActive(null);
    }
  };

  // Reorders within a single group (either the top-level list, or one
  // parent's children) — display_order only needs to be relatively
  // ordered within the group it's rendered in, so each group's reorder
  // call only ever sends that group's own ids.
  const moveWithinGroup = async (groupKey, groupItems, index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= groupItems.length) return;
    const reordered = moveItem(groupItems, index, newIndex);
    // Optimistic update: splice the reordered group back into the flat list.
    setItems((prev) => {
      const others = prev.filter((p) => !groupItems.some((g) => g.id === p.id));
      return [...others, ...reordered];
    });
    setReorderingGroup(groupKey);
    try {
      await reorderSpecialities(reordered.map((i) => i.id));
    } catch {
      showToast("Failed to save new order.", false);
      load();
    } finally {
      setReorderingGroup(null);
    }
  };

  // Parent-select options: every specialty except the one currently being
  // edited (mirrors the backend's clean() check — a specialty can't be
  // its own parent).
  const parentOptions = items.filter((s) => !editing || s.id !== editing.id);

  const renderRow = (s, { indent = false, group = null, groupItems = [], index = 0 } = {}) => (
    <div
      key={s.id}
      style={{
        display: "flex", gap: "14px", alignItems: "flex-start",
        padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px",
        background: "#fff", marginLeft: indent ? "32px" : 0,
        borderLeft: indent ? "2px solid #FED7AA" : "1px solid #F1F5F9",
      }}
    >
      {canReorder && group && (
        <ReorderButtons
          index={index}
          total={groupItems.length}
          onMoveUp={() => moveWithinGroup(group, groupItems, index, -1)}
          onMoveDown={() => moveWithinGroup(group, groupItems, index, 1)}
        />
      )}
      <div style={{
        width: "44px", height: "44px", borderRadius: "10px", overflow: "hidden", flexShrink: 0,
        background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#94A3B8", fontWeight: 700,
      }}>
        {s.hero_image
          ? <img src={toAbsoluteMediaUrl(s.hero_image)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : s.name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{s.name}</span>
          <StatusPill active={s.is_published} activeLabel="Published" inactiveLabel="Hidden" />
          {indent && <span style={{ fontSize: "11px", color: "#94A3B8" }}>sub-specialty</span>}
        </div>
        <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>/{s.slug} · Order {s.display_order}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
        <button style={btnGhost} onClick={() => toggleActive(s)} disabled={togglingActive === s.id}>
          {s.is_published ? "Unpublish" : "Publish"}
        </button>
        <button style={btnGhost} onClick={() => openEdit(s)}>Edit</button>
        <button style={btnDanger} onClick={() => setConfirmDelete(s)}>Delete</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, maxWidth: "240px" }}
          placeholder="Search name / description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Specialty</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder, and to see sub-specialties nested under their parent.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No specialities found." />
      ) : search || ordering !== "display_order" ? (
        // Searching or sorting by something other than display order
        // flattens the hierarchy — same tradeoff the other tabs make
        // (reorder/tree view only make sense against the natural order).
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((s) => renderRow(s))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {tree.topLevel.map((s, i) => {
            const children = tree.childrenByParent.get(s.id) || [];
            return (
              <div key={s.id} style={{ display: "grid", gap: "10px" }}>
                {renderRow(s, { group: "top", groupItems: tree.topLevel, index: i })}
                {children.map((c, ci) =>
                  renderRow(c, { indent: true, group: `sub-${s.id}`, groupItems: children, index: ci })
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Specialty" : "Add Specialty"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Name" required>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </InputField>
          <InputField label="Slug" hint="Auto-generated if left blank.">
            <input style={inputStyle} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </InputField>
          <InputField label="Parent Specialty" hint="Set to nest this under a top-level specialty. Leave blank for a top-level entry.">
            <select style={inputStyle} value={form.parent} onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}>
              <option value="">— Top-level (no parent) —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.parent ? `— ${p.name}` : p.name}</option>
              ))}
            </select>
          </InputField>
          <InputField label="Hero Image">
            <PhotoUploadField
              currentUrl={form.currentHeroImageUrl}
              file={form.hero_image}
              removed={false}
              allowRemove={false}
              onSelect={(f) => setForm((prev) => ({ ...prev, hero_image: f }))}
              onRemove={() => {}}
              hint="JPG or PNG. Shown at the top of the specialty page."
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Specialty"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Specialty"
          message={`Delete "${confirmDelete.name}"? ${
            (tree.childrenByParent.get(confirmDelete.id) || []).length > 0
              ? "Its sub-specialties will be deleted too. "
              : ""
          }This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}