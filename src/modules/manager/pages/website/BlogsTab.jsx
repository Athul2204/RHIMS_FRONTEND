// src/modules/manager/pages/website/BlogsTab.jsx
//
// Blog/article posts, optionally scoped to a specialty and attributed
// to an EMR doctor. Unlike Specialities/Procedures, GET .../blogs/ IS
// paginated ({ count, page, page_size, results }), same shape as
// testimonials — this tab follows TestimonialsTab's pagination pattern
// rather than the plain-array pattern the other two new tabs use.
//
// No rich-text editor for `body` — plain textarea, per the backend task
// (rich text editing was explicitly out of scope there).
import { useState, useEffect, useCallback } from "react";
import {
  getBlogs, createBlog, updateBlog, deleteBlog,
  activateBlog, deactivateBlog, reorderBlogs, getSpecialityOptions, getEmrDoctorList, toAbsoluteMediaUrl,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ReorderButtons, ConfirmDialog,
  moveItem, extractApiError, PhotoUploadField,
} from "./shared";

const PAGE_SIZE = 20;
const EMPTY_FORM = {
  title: "", slug: "", excerpt: "", body: "",
  cover_image: null, removeCoverImage: false, currentCoverImageUrl: null,
  specialty: "", author_doctor: "", display_order: 0,
};
const ORDERING_OPTIONS = [
  { value: "display_order", label: "Display order" },
  { value: "-created_at",   label: "Newest first" },
  { value: "created_at",    label: "Oldest first" },
  { value: "title",         label: "Title (A–Z)" },
  { value: "-title",        label: "Title (Z–A)" },
];

export default function BlogsTab({ showToast }) {
  const [items, setItems]     = useState([]);
  const [count, setCount]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [ordering, setOrdering] = useState("display_order");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);

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
      const params = { search, ordering, page, page_size: PAGE_SIZE };
      if (specialtyFilter) params.specialty = specialtyFilter;
      const res = await getBlogs(params);
      setItems(res.results || []);
      setCount(res.count || 0);
    } catch {
      setError("Failed to load blogs.");
    } finally {
      setLoading(false);
    }
  }, [search, ordering, page, specialtyFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getSpecialityOptions().then((res) => {
      setSpecialties(Array.isArray(res) ? res : []);
    }).catch(() => setSpecialties([]));
    getEmrDoctorList({ all: true }).then((res) => {
      setDoctors(Array.isArray(res) ? res : (res?.results ?? []));
    }).catch(() => setDoctors([]));
  }, []);

  const specialtyLabel = (s) => (s.parent_name ? `${s.parent_name} — ${s.name}` : s.name);
  const doctorName = (d) => {
    const u = d?.staff?.user;
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim() || u?.username || `Doctor #${d.profile_id}`;
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit = (b) => {
    setEditing(b);
    setForm({
      title: b.title, slug: b.slug || "", excerpt: b.excerpt || "", body: b.body || "",
      cover_image: null, removeCoverImage: false,
      currentCoverImageUrl: b.cover_image ? toAbsoluteMediaUrl(b.cover_image) : null,
      specialty: b.specialty ?? "", author_doctor: b.author_doctor ?? "",
      display_order: b.display_order ?? 0,
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
        slug: form.slug,
        excerpt: form.excerpt,
        body: form.body,
        specialty: form.specialty === "" ? null : form.specialty,
        author_doctor: form.author_doctor === "" ? null : form.author_doctor,
        display_order: form.display_order,
      };
      if (form.cover_image) payload.cover_image = form.cover_image;
      if (editing && form.removeCoverImage && !form.cover_image) payload.remove_cover_image = true;

      if (editing) {
        await updateBlog(editing.id, payload);
        showToast("Blog updated.");
      } else {
        await createBlog(payload);
        showToast("Blog created.");
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
    await deleteBlog(confirmDelete.id);
    showToast("Blog deleted.");
    setConfirmDelete(null);
    load();
  };

  const toggleActive = async (b) => {
    setTogglingActive(b.id);
    try {
      if (b.is_published) await deactivateBlog(b.id);
      else await activateBlog(b.id);
      showToast(b.is_published ? "Blog unpublished." : "Blog published.");
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
      await reorderBlogs(reordered.map((i) => i.id));
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
          placeholder="Search title / excerpt…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
        <select style={{ ...inputStyle, maxWidth: "220px" }} value={specialtyFilter} onChange={(e) => { setPage(1); setSpecialtyFilter(e.target.value); }}>
          <option value="">All specialties</option>
          {specialties.map((s) => <option key={s.id} value={s.id}>{specialtyLabel(s)}</option>)}
        </select>
        <select style={{ ...inputStyle, maxWidth: "180px" }} value={ordering} onChange={(e) => { setPage(1); setOrdering(e.target.value); }}>
          {ORDERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={btnPrimary()} onClick={openCreate}>+ Add Blog Post</button>
      </div>

      {!canReorder && (
        <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "-8px", marginBottom: "12px" }}>
          Switch to "Display order" with no search active to reorder blogs.
        </p>
      )}

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState text="No blog posts found." />
      ) : (
        <>
          <div style={{ display: "grid", gap: "10px" }}>
            {items.map((b, i) => (
              <div key={b.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
                {canReorder && (
                  <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
                )}
                <div style={{ width: "64px", height: "44px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 700, fontSize: "12px" }}>
                  {b.cover_image
                    ? <img src={toAbsoluteMediaUrl(b.cover_image)} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "No image"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{b.title}</span>
                    <StatusPill active={b.is_published} activeLabel="Published" inactiveLabel="Draft" />
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                    {b.specialty_name ? `${b.specialty_name} · ` : ""}{b.author_doctor_name ? `Dr. ${b.author_doctor_name}` : "No author set"}
                  </div>
                  {b.excerpt && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{b.excerpt}</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  <button style={btnGhost} onClick={() => toggleActive(b)} disabled={togglingActive === b.id}>
                    {b.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button style={btnGhost} onClick={() => openEdit(b)}>Edit</button>
                  <button style={btnDanger} onClick={() => setConfirmDelete(b)}>Delete</button>
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
        <Modal title={editing ? "Edit Blog Post" : "Add Blog Post"} maxWidth="640px" onClose={() => setModal(false)}>
          <FormBanner message={formError} />
          <InputField label="Title" required>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </InputField>
          <InputField label="Slug" hint="Auto-generated if left blank.">
            <input style={inputStyle} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </InputField>
          <InputField label="Excerpt" hint="Short card summary, up to 300 characters.">
            <input style={inputStyle} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} maxLength={300} />
          </InputField>
          <InputField label="Body" required>
            <textarea style={{ ...textareaStyle, minHeight: "160px" }} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </InputField>
          <InputField label="Cover Image">
            <PhotoUploadField
              currentUrl={form.currentCoverImageUrl}
              file={form.cover_image}
              removed={form.removeCoverImage}
              onSelect={(f) => setForm((prev) => ({ ...prev, cover_image: f, removeCoverImage: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, cover_image: null, removeCoverImage: true }))}
              hint="JPG or PNG, shown on the blog card and detail page."
            />
          </InputField>
          <InputField label="Specialty" hint="Optional — a blog post may not always map to one specialty.">
            <select style={inputStyle} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}>
              <option value="">— None —</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{specialtyLabel(s)}</option>)}
            </select>
          </InputField>
          <InputField label="Author Doctor" hint="Optional.">
            <select style={inputStyle} value={form.author_doctor} onChange={(e) => setForm((f) => ({ ...f, author_doctor: e.target.value }))}>
              <option value="">— None —</option>
              {doctors.map((d) => (
                <option key={d.profile_id} value={d.profile_id}>Dr. {doctorName(d)}</option>
              ))}
            </select>
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Blog Post"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Blog Post"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}