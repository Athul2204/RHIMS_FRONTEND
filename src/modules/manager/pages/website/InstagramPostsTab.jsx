// src/modules/manager/pages/website/InstagramPostsTab.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getInstagramPosts, createInstagramPost, updateInstagramPost, deleteInstagramPost,
  activateInstagramPost, deactivateInstagramPost, reorderInstagramPosts, setInstagramPostFeatured,
  toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, FeaturedPill, FeaturedToggleButton, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, LinkPreviewCard, DraftBanner, PhotoUploadField,
} from "./shared";

// New posts publish immediately by default — the checkbox in the
// create form makes hiding a post the deliberate opt-out, instead of
// activation being an easy-to-miss extra step after saving.
const EMPTY_FORM = {
  instagram_url: "", caption: "", is_active: true,
  thumbnail: null, removeThumbnail: false, currentThumbnailUrl: null,
};
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
];

export default function InstagramPostsTab({ showToast }) {
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
      const res = await getInstagramPosts({ search, ordering });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load Instagram posts.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      instagram_url: p.instagram_url, caption: p.caption || "", is_active: !!p.is_active,
      thumbnail: null, removeThumbnail: false,
      currentThumbnailUrl: p.thumbnail ? toAbsoluteMediaUrl(p.thumbnail) : null,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.instagram_url.trim()) {
      setFormError("Instagram URL is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { instagram_url: form.instagram_url, caption: form.caption, is_active: form.is_active };
      if (form.thumbnail) payload.thumbnail = form.thumbnail;
      if (editing && form.removeThumbnail && !form.thumbnail) payload.remove_thumbnail = true;
      if (editing) {
        await updateInstagramPost(editing.id, payload);
        showToast("Post updated.");
      } else {
        await createInstagramPost(payload);
        showToast("Post added.");
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
    await deleteInstagramPost(confirmDelete.id);
    showToast("Post deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (p) => {
    setTogglingActive(p.id);
    try {
      if (p.is_active) await deactivateInstagramPost(p.id);
      else await activateInstagramPost(p.id);
      showToast(p.is_active ? "Post deactivated." : "Post activated.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setTogglingActive(null);
    }
  };

  const toggleFeatured = async (p) => {
    setTogglingFeatured(p.id);
    try {
      const next = !p.is_featured;
      await setInstagramPostFeatured(p.id, next);
      setItems((prev) => prev.map((i) => (i.id === p.id ? { ...i, is_featured: next } : i)));
      showToast(next ? "Post featured." : "Post removed from featured.");
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
      await reorderInstagramPosts(reordered.map((i) => i.id));
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
          placeholder="Search caption / URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Post</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder posts.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No Instagram posts added yet." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              {canReorder && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              {p.thumbnail && (
                <div style={{ width: "56px", height: "56px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#F1F5F9" }}>
                  <img src={toAbsoluteMediaUrl(p.thumbnail)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <StatusPill active={p.is_active} />
                  <FeaturedPill featured={p.is_featured} />
                </div>
                <LinkPreviewCard
                  url={p.instagram_url}
                  label="Instagram Post"
                  icon="📷"
                  caption={p.caption}
                />
                {!p.is_active && (
                  <DraftBanner onActivate={() => toggleActive(p)} busy={togglingActive === p.id} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => toggleActive(p)}>{p.is_active ? "Deactivate" : "Activate"}</button>
                <FeaturedToggleButton featured={p.is_featured} busy={togglingFeatured === p.id} onClick={() => toggleFeatured(p)} />
                <button style={btnGhost} onClick={() => openEdit(p)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(p)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Post" : "Add Instagram Post"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Instagram URL" required hint="Must be a /p/, /reel/, or /tv/ post URL.">
            <input style={inputStyle} value={form.instagram_url} onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))} placeholder="https://www.instagram.com/p/..." />
          </InputField>
          <InputField label="Caption" hint="Optional.">
            <textarea style={textareaStyle} value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} />
          </InputField>
          <InputField label="Thumbnail">
            <PhotoUploadField
              currentUrl={form.currentThumbnailUrl}
              file={form.thumbnail}
              removed={form.removeThumbnail}
              onSelect={(f) => setForm((prev) => ({ ...prev, thumbnail: f, removeThumbnail: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, thumbnail: null, removeThumbnail: true }))}
              hint="Optional, JPG or PNG — we don't scrape Instagram for a preview image, so this is shown on the card instead."
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Post"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Instagram Post"
          message="Delete this Instagram post? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}