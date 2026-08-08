import { useState, useEffect, useCallback } from "react";
import {
  getMediaEvents, createMediaEvent, updateMediaEvent, deleteMediaEvent,
  activateMediaEvent, deactivateMediaEvent, reorderMediaEvents, setMediaEventFeatured,
  toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, FeaturedPill, FeaturedToggleButton, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, DraftBanner, PhotoUploadField,
} from "./shared";

// New items publish immediately by default — the checkbox in the create
// form makes hiding an item the deliberate opt-out, matching the other
// tabs (Facebook/Instagram/YouTube posts).
const EMPTY_FORM = {
  title: "", excerpt: "", body: "", event_date: "", is_active: true,
  cover_image: null, removeCoverImage: false, currentCoverImageUrl: null,
  display_order: 0,
};
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function MediaEventsTab({ showToast }) {
  const [items, setItems]     = useState([]);
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
  const [togglingFeatured, setTogglingFeatured] = useState(null);
  const [togglingActive, setTogglingActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMediaEvents({ search, ordering });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load Media & Events items.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title, excerpt: item.excerpt || "", body: item.body || "",
      event_date: item.event_date || "", is_active: !!item.is_active,
      cover_image: null, removeCoverImage: false,
      currentCoverImageUrl: item.cover_image ? toAbsoluteMediaUrl(item.cover_image) : null,
      display_order: item.display_order ?? 0,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!form.body.trim()) {
      setFormError("Body is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        event_date: form.event_date || null,
        is_active: form.is_active,
        display_order: form.display_order,
      };
      if (form.cover_image) payload.cover_image = form.cover_image;
      if (editing && form.removeCoverImage && !form.cover_image) payload.remove_cover_image = true;

      if (editing) {
        await updateMediaEvent(editing.id, payload);
        showToast("Item updated.");
      } else {
        await createMediaEvent(payload);
        showToast("Item added.");
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
    await deleteMediaEvent(confirmDelete.id);
    showToast("Item deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (item) => {
    setTogglingActive(item.id);
    try {
      if (item.is_active) await deactivateMediaEvent(item.id);
      else await activateMediaEvent(item.id);
      showToast(item.is_active ? "Item deactivated." : "Item activated.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setTogglingActive(null);
    }
  };

  const toggleFeatured = async (item) => {
    setTogglingFeatured(item.id);
    try {
      const next = !item.is_featured;
      await setMediaEventFeatured(item.id, next);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_featured: next } : i)));
      showToast(next ? "Item featured." : "Item removed from featured.");
    } catch {
      showToast("Failed to update featured status.", false);
    } finally {
      setTogglingFeatured(null);
    }
  };

  const move = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = moveItem(items, index, newIndex);
    setItems(reordered);
    try {
      await reorderMediaEvents(reordered.map((i) => i.id));
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
          style={{ ...inputStyle, maxWidth: "280px" }}
          placeholder="Search title / excerpt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Media / Event</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No Media & Events items added yet." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              {canReorder && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              <div style={{ width: "64px", height: "44px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 700, fontSize: "12px" }}>
                {item.cover_image
                  ? <img src={toAbsoluteMediaUrl(item.cover_image)} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : "No image"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{item.title}</span>
                  <StatusPill active={item.is_active} />
                  <FeaturedPill featured={item.is_featured} />
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                  {item.event_date ? `Event date: ${item.event_date}` : "No event date set"}
                </div>
                {item.excerpt && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{item.excerpt}</p>}
                {!item.is_active && (
                  <DraftBanner onActivate={() => toggleActive(item)} busy={togglingActive === item.id} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => toggleActive(item)} disabled={togglingActive === item.id}>
                  {item.is_active ? "Deactivate" : "Activate"}
                </button>
                <FeaturedToggleButton featured={item.is_featured} busy={togglingFeatured === item.id} onClick={() => toggleFeatured(item)} />
                <button style={btnGhost} onClick={() => openEdit(item)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(item)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Media / Event" : "Add Media / Event"} maxWidth="640px" onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Title" required>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </InputField>
          <InputField label="Excerpt" hint="Short card summary, up to 300 characters.">
            <input style={inputStyle} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} maxLength={300} />
          </InputField>
          <InputField label="Body" required>
            <textarea style={{ ...textareaStyle, minHeight: "160px" }} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </InputField>
          <InputField label="Event Date" hint="Optional — for camps, awards, and dated events. Leave blank for general news.">
            <input type="date" style={inputStyle} value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
          </InputField>
          <InputField label="Cover Image">
            <PhotoUploadField
              currentUrl={form.currentCoverImageUrl}
              file={form.cover_image}
              removed={form.removeCoverImage}
              onSelect={(f) => setForm((prev) => ({ ...prev, cover_image: f, removeCoverImage: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, cover_image: null, removeCoverImage: true }))}
              hint="JPG or PNG, shown on the card and detail page."
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
          <InputField label="Published">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151" }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Visible on the public website
            </label>
          </InputField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button style={btnSecondary} onClick={() => setModal(false)} disabled={saving}>Cancel</button>
            <button style={{ ...btnPrimary(), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Media / Event"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Item"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}