// src/modules/manager/pages/website/GalleryTab.jsx
//
// The simplest of the website-content tabs — a single required image
// plus an optional caption, no title/body/URL, no "featured" flag
// (there's no featured treatment for a plain photo grid).
import { useState, useEffect, useCallback } from "react";
import {
  getGalleryImages, createGalleryImage, updateGalleryImage, deleteGalleryImage,
  activateGalleryImage, deactivateGalleryImage, reorderGalleryImages,
  toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, DraftBanner, PhotoUploadField,
} from "./shared";

const EMPTY_FORM = { image: null, caption: "", is_active: true };
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function GalleryTab({ showToast }) {
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
  const [togglingActive, setTogglingActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGalleryImages({ search, ordering });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load gallery images.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (img) => {
    setEditing(img);
    setForm({ image: null, caption: img.caption || "", is_active: !!img.is_active });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!editing && !form.image) {
      setFormError("An image is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { caption: form.caption, is_active: form.is_active };
      if (form.image) payload.image = form.image;

      if (editing) {
        await updateGalleryImage(editing.id, payload);
        showToast("Image updated.");
      } else {
        await createGalleryImage(payload);
        showToast("Image added.");
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
    await deleteGalleryImage(confirmDelete.id);
    showToast("Image deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (img) => {
    setTogglingActive(img.id);
    try {
      if (img.is_active) await deactivateGalleryImage(img.id);
      else await activateGalleryImage(img.id);
      showToast(img.is_active ? "Image deactivated." : "Image activated.");
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
      await reorderGalleryImages(reordered.map((i) => i.id));
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
          placeholder="Search caption…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Image</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder images.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No gallery images added yet." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {items.map((img, i) => (
            <div key={img.id} style={{ border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "140px", background: "#F1F5F9" }}>
                <img src={toAbsoluteMediaUrl(img.image)} alt={img.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <StatusPill active={img.is_active} />
                  {canReorder && (
                    <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
                  )}
                </div>
                {img.caption && <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#374151" }}>{img.caption}</p>}
                {!img.is_active && (
                  <DraftBanner onActivate={() => toggleActive(img)} busy={togglingActive === img.id} />
                )}
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  <button style={btnGhost} onClick={() => toggleActive(img)}>{img.is_active ? "Deactivate" : "Activate"}</button>
                  <button style={btnGhost} onClick={() => openEdit(img)}>Edit</button>
                  <button style={btnDanger} onClick={() => setConfirmDelete(img)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Image" : "Add Gallery Image"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Image" required={!editing}>
            <PhotoUploadField
              currentUrl={null}
              file={form.image}
              removed={false}
              onSelect={(f) => setForm((prev) => ({ ...prev, image: f }))}
              onRemove={() => setForm((prev) => ({ ...prev, image: null }))}
              hint={editing ? "Choose a new file to replace the current image." : "JPG or PNG."}
            />
          </InputField>
          <InputField label="Caption" hint="Optional.">
            <input style={inputStyle} value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} maxLength={200} />
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Image"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Image"
          message="Delete this gallery image? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}