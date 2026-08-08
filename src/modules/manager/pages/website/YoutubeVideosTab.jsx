// src/modules/manager/pages/website/YoutubeVideosTab.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getYoutubeVideos, createYoutubeVideo, updateYoutubeVideo, deleteYoutubeVideo,
  activateYoutubeVideo, deactivateYoutubeVideo, reorderYoutubeVideos, setYoutubeVideoFeatured, getEmrDoctorList,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, FeaturedPill, FeaturedToggleButton, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, DraftBanner,
} from "./shared";

// New videos publish immediately by default — the checkbox in the
// create form makes hiding a video the deliberate opt-out, instead of
// activation being an easy-to-miss extra step after saving.
const EMPTY_FORM = { youtube_url: "", title: "", description: "", doctor: "", is_active: true };
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
  { value: "title",         label: "Title (A–Z)" },
];

export default function YoutubeVideosTab({ showToast }) {
  const [items, setItems]     = useState([]);
  const [search, setSearch]   = useState("");
  const [ordering, setOrdering] = useState("display_order");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [doctors, setDoctors] = useState([]);

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
      const res = await getYoutubeVideos({ search, ordering });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load YouTube videos.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getEmrDoctorList({ all: true }).then((res) => {
      setDoctors(Array.isArray(res) ? res : (res?.results ?? []));
    }).catch(() => setDoctors([]));
  }, []);

  const doctorName = (d) => {
    const u = d?.staff?.user;
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim() || u?.username || `Doctor #${d.profile_id}`;
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (v) => {
    setEditing(v);
    setForm({ youtube_url: v.youtube_url, title: v.title || "", description: v.description || "", doctor: v.doctor || "", is_active: !!v.is_active });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.youtube_url.trim()) {
      setFormError("YouTube URL is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        youtube_url: form.youtube_url,
        title: form.title,
        description: form.description,
        doctor: form.doctor || null,
        is_active: form.is_active,
      };
      if (editing) {
        await updateYoutubeVideo(editing.id, payload);
        showToast("Video updated.");
      } else {
        await createYoutubeVideo(payload);
        showToast("Video added.");
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
    await deleteYoutubeVideo(confirmDelete.id);
    showToast("Video deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (v) => {
    setTogglingActive(v.id);
    try {
      if (v.is_active) await deactivateYoutubeVideo(v.id);
      else await activateYoutubeVideo(v.id);
      showToast(v.is_active ? "Video deactivated." : "Video activated.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setTogglingActive(null);
    }
  };

  const toggleFeatured = async (v) => {
    setTogglingFeatured(v.id);
    try {
      const next = !v.is_featured;
      await setYoutubeVideoFeatured(v.id, next);
      setItems((prev) => prev.map((i) => (i.id === v.id ? { ...i, is_featured: next } : i)));
      showToast(next ? "Video featured." : "Video removed from featured.");
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
      await reorderYoutubeVideos(reordered.map((i) => i.id));
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
          style={{ ...inputStyle, maxWidth: "240px" }}
          placeholder="Search title / description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Video</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder videos.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No YouTube videos added yet." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {items.map((v, i) => (
            <div key={v.id} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              {canReorder && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              <img src={v.thumbnail_url} alt={v.title} style={{ width: "96px", height: "54px", objectFit: "cover", borderRadius: "8px", flexShrink: 0, background: "#F1F5F9" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{v.title || "(untitled)"}</span>
                  <StatusPill active={v.is_active} />
                  <FeaturedPill featured={v.is_featured} />
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                  {v.doctor_name ? `Featuring Dr. ${v.doctor_name} · ` : ""}{v.description || "No description"}
                </div>
                {!v.is_active && (
                  <DraftBanner onActivate={() => toggleActive(v)} busy={togglingActive === v.id} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => toggleActive(v)}>{v.is_active ? "Deactivate" : "Activate"}</button>
                <FeaturedToggleButton featured={v.is_featured} busy={togglingFeatured === v.id} onClick={() => toggleFeatured(v)} />
                <button style={btnGhost} onClick={() => openEdit(v)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(v)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Video" : "Add YouTube Video"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="YouTube URL" required hint="Any format: youtube.com/watch?v=, youtu.be/, /embed/, /shorts/.">
            <input style={inputStyle} value={form.youtube_url} onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
          </InputField>
          <InputField label="Title">
            <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </InputField>
          <InputField label="Description">
            <textarea style={textareaStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </InputField>
          <InputField label="Featured Doctor" hint="Optional.">
            <select style={inputStyle} value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}>
              <option value="">None</option>
              {doctors.map((d) => (
                <option key={d.profile_id} value={d.profile_id}>Dr. {doctorName(d)}</option>
              ))}
            </select>
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Video"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Video"
          message={`Delete "${confirmDelete.title || confirmDelete.video_id}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}