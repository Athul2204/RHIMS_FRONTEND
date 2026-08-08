// src/modules/manager/pages/website/TestimonialsTab.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial,
  activateTestimonial, deactivateTestimonial, reorderTestimonials, setTestimonialFeatured, toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, FeaturedPill, FeaturedToggleButton, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, PhotoUploadField,
} from "./shared";

const PAGE_SIZE = 20;
const EMPTY_FORM = { patient_name: "", designation: "", review: "", rating: "", photo: null, removePhoto: false, currentPhotoUrl: null };
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
  { value: "-rating",       label: "Highest rated" },
  { value: "patient_name",  label: "Patient name (A–Z)" },
];

export default function TestimonialsTab({ showToast }) {
  const [items, setItems]     = useState([]);
  const [count, setCount]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [ordering, setOrdering] = useState("display_order");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [reordering, setReordering] = useState(false);

  const [showModal, setModal]     = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [togglingFeatured, setTogglingFeatured] = useState(null); // id currently being patched

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTestimonials({ search, ordering, page, page_size: PAGE_SIZE });
      setItems(res.results || []);
      setCount(res.count || 0);
    } catch {
      setError("Failed to load testimonials.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      patient_name: t.patient_name, designation: t.designation || "", review: t.review, rating: t.rating ?? "",
      photo: null, removePhoto: false, currentPhotoUrl: t.photo ? toAbsoluteMediaUrl(t.photo) : null,
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.patient_name.trim() || !form.review.trim()) {
      setFormError("Patient name and review are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        patient_name: form.patient_name,
        designation: form.designation,
        review: form.review,
        rating: form.rating === "" ? null : Number(form.rating),
      };
      if (form.photo) payload.photo = form.photo;
      if (editing && form.removePhoto && !form.photo) payload.remove_photo = true;

      if (editing) {
        await updateTestimonial(editing.id, payload);
        showToast("Testimonial updated.");
      } else {
        await createTestimonial(payload);
        showToast("Testimonial added.");
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
    await deleteTestimonial(confirmDelete.id);
    showToast("Testimonial deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (t) => {
    try {
      if (t.is_active) await deactivateTestimonial(t.id);
      else await activateTestimonial(t.id);
      showToast(t.is_active ? "Testimonial deactivated." : "Testimonial activated.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    }
  };

  const toggleFeatured = async (t) => {
    setTogglingFeatured(t.id);
    try {
      const next = !t.is_featured;
      await setTestimonialFeatured(t.id, next);
      setItems((prev) => prev.map((i) => (i.id === t.id ? { ...i, is_featured: next } : i)));
      showToast(next ? "Testimonial featured." : "Testimonial removed from featured.");
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
    setItems(reordered); // optimistic
    setReordering(true);
    try {
      await reorderTestimonials(reordered.map((i) => i.id));
    } catch {
      showToast("Failed to save new order.", false);
      load();
    } finally {
      setReordering(false);
    }
  };

  const canReorder = ordering === "display_order" && !search;

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, maxWidth: "240px" }}
          placeholder="Search patient name / review…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
        <select style={{ ...inputStyle, maxWidth: "200px" }} value={ordering} onChange={(e) => { setPage(1); setOrdering(e.target.value); }}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Testimonial</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder testimonials.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No testimonials found." />
      ) : (
        <>
          <div style={{ display: "grid", gap: "10px" }}>
            {items.map((t, i) => (
              <div key={t.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
                {canReorder && (
                  <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
                )}
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 700 }}>
                  {t.photo
                    ? <img src={toAbsoluteMediaUrl(t.photo)} alt={t.patient_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : t.patient_name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{t.patient_name}</span>
                    {t.designation && <span style={{ fontSize: "12px", color: "#94A3B8" }}>· {t.designation}</span>}
                    {t.rating && <span style={{ fontSize: "12px", color: "#D97706" }}>{"★".repeat(t.rating)}</span>}
                    <StatusPill active={t.is_active} />
                    <FeaturedPill featured={t.is_featured} />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{t.review}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  <button style={btnGhost} onClick={() => toggleActive(t)}>{t.is_active ? "Deactivate" : "Activate"}</button>
                  <FeaturedToggleButton featured={t.is_featured} busy={togglingFeatured === t.id} onClick={() => toggleFeatured(t)} />
                  <button style={btnGhost} onClick={() => openEdit(t)}>Edit</button>
                  <button style={btnDanger} onClick={() => setConfirmDelete(t)}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94A3B8" }}>{count} total · Page {page} of {totalPages}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button style={btnGhost} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Testimonial" : "Add Testimonial"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Patient Name" required>
            <input style={inputStyle} value={form.patient_name} onChange={(e) => setForm((f) => ({ ...f, patient_name: e.target.value }))} />
          </InputField>
          <InputField label="Designation" hint="Optional, e.g. 'Cardiac patient'.">
            <input style={inputStyle} value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
          </InputField>
          <InputField label="Review" required>
            <textarea style={textareaStyle} value={form.review} onChange={(e) => setForm((f) => ({ ...f, review: e.target.value }))} />
          </InputField>
          <InputField label="Rating" hint="1-5 stars, optional.">
            <select style={inputStyle} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}>
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} star{r > 1 ? "s" : ""}</option>)}
            </select>
          </InputField>
          <InputField label="Photo">
            <PhotoUploadField
              currentUrl={form.currentPhotoUrl}
              file={form.photo}
              removed={form.removePhoto}
              onSelect={(f) => setForm((prev) => ({ ...prev, photo: f, removePhoto: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, photo: null, removePhoto: true }))}
              hint="JPG or PNG, shown next to the testimonial."
            />
          </InputField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button style={btnSecondary} onClick={() => setModal(false)} disabled={saving}>Cancel</button>
            <button style={{ ...btnPrimary(), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Testimonial"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Testimonial"
          message={`Delete the testimonial from ${confirmDelete.patient_name}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}