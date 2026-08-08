// src/modules/manager/pages/website/LocationsTab.jsx
//
// "Locations & Contact" — lets a manager/admin fill in the public
// Locations-page content (description, highlights, hours, map link,
// photo) for each branch they manage, and publish/unpublish it. This
// is deliberately NOT a create/delete list like Testimonials or Blogs:
// the branches themselves already exist (created from Admin > Branches
// with name/code/address/phone), so every branch the caller manages
// always shows up here — even ones with no content yet — and editing
// just fills in / updates that branch's row. See websiteApi.js's
// getWebsiteBranches / updateWebsiteBranch and the backend's
// WebsiteBranchListView / WebsiteBranchDetailView.
import { useState, useEffect, useCallback } from "react";
import { getWebsiteBranches, updateWebsiteBranch, toAbsoluteMediaUrl } from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, StringListField,
  extractApiError, PhotoUploadField,
} from "./shared";

const EMPTY_FORM = {
  is_published: false,
  branch_type: "HOSPITAL",
  description: "",
  highlights: [],
  email: "",
  hours_text: "",
  map_url: "",
  photo: null,
  removePhoto: false,
  currentPhotoUrl: null,
};

const BRANCH_TYPE_OPTIONS = [
  { value: "HOSPITAL", label: "Hospital" },
  { value: "MEDICAL_CENTRE", label: "Medical Centre" },
];

export default function LocationsTab({ showToast }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null); // the branch being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWebsiteBranches();
      setBranches(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load branches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      is_published: !!b.is_published,
      branch_type: b.branch_type || "HOSPITAL",
      description: b.description || "",
      highlights: Array.isArray(b.highlights) ? b.highlights : [],
      email: b.email || "",
      hours_text: b.hours_text || "",
      map_url: b.map_url || "",
      photo: null,
      removePhoto: false,
      currentPhotoUrl: b.photo ? toAbsoluteMediaUrl(b.photo) : null,
    });
    setFormError(null);
  };

  const closeModal = () => setEditing(null);

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        is_published: form.is_published,
        branch_type: form.branch_type,
        description: form.description,
        highlights: form.highlights,
        email: form.email,
        hours_text: form.hours_text,
        map_url: form.map_url,
      };
      if (form.photo) payload.photo = form.photo;
      if (form.removePhoto && !form.photo) payload.remove_photo = true;

      await updateWebsiteBranch(editing.branch_id, payload);
      showToast("Location content saved.");
      setEditing(null);
      load();
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle from the card itself, no need to open the modal just
  // to publish/unpublish a branch whose content is already filled in.
  const togglePublish = async (b) => {
    try {
      await updateWebsiteBranch(b.branch_id, { is_published: !b.is_published });
      showToast(b.is_published ? "Location unpublished." : "Location published.");
      load();
    } catch {
      showToast("Failed to update status.", false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "12.5px", color: "#94A3B8", marginTop: 0, marginBottom: "16px" }}>
        Branch name, code, address, and phone come from Admin &gt; Branches. Fill in the rest here —
        description, highlights, public email, hours, map link, and photo — then publish so it appears
        on the website's Locations and Contact pages.
      </p>

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : branches.length === 0 ? (
        <EmptyState text="No branches found. Add one from Admin > Branches first." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {branches.map((b) => (
            <div
              key={b.branch_id}
              style={{
                display: "flex", gap: "14px", alignItems: "flex-start",
                padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff",
              }}
            >
              <div style={{
                width: "44px", height: "44px", borderRadius: "10px", overflow: "hidden", flexShrink: 0,
                background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#94A3B8", fontWeight: 700, fontSize: "12px",
              }}>
                {b.photo
                  ? <img src={toAbsoluteMediaUrl(b.photo)} alt={b.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : b.code || b.name.slice(0, 2).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{b.name}</span>
                  {b.code && <span style={{ fontSize: "12px", color: "#94A3B8" }}>· {b.code}</span>}
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px",
                    background: "#F1F5F9", color: "#475569",
                  }}>
                    {b.branch_type === "MEDICAL_CENTRE" ? "Medical Centre" : "Hospital"}
                  </span>
                  <StatusPill active={b.is_published} activeLabel="Published" inactiveLabel="Draft" />
                  {!b.is_active && <StatusPill active={false} inactiveLabel="Branch Inactive" />}
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151" }}>
                  {b.address || <span style={{ color: "#CBD5E1" }}>No address on file</span>}
                  {b.phone && <> · {b.phone}</>}
                </p>
                {b.description ? (
                  <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#94A3B8", lineHeight: 1.5 }}>
                    {b.description.length > 140 ? `${b.description.slice(0, 140)}…` : b.description}
                  </p>
                ) : (
                  <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#CBD5E1" }}>
                    No Locations-page content yet.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => togglePublish(b)}>
                  {b.is_published ? "Unpublish" : "Publish"}
                </button>
                <button style={btnGhost} onClick={() => openEdit(b)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={`Edit — ${editing.name}`} onClose={closeModal}>
          <FormBanner message={formError} />

          <InputField label="Status">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#334155" }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
              />
              Published — visible on the public Locations & Contact pages
            </label>
          </InputField>

          <InputField label="Listing Type" hint="Hospitals get the larger banner-card section; Medical Centres get the compact grid below it.">
            <select style={inputStyle} value={form.branch_type} onChange={(e) => setForm((f) => ({ ...f, branch_type: e.target.value }))}>
              {BRANCH_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </InputField>

          <InputField label="About this branch" hint="Shown as the branch description on the Locations page.">
            <textarea style={textareaStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </InputField>

          <InputField label="Highlights" hint='Short bullet tags, e.g. "24/7 Emergency", "Free Parking", "200 Beds".'>
            <StringListField
              value={form.highlights}
              onChange={(v) => setForm((f) => ({ ...f, highlights: v }))}
              placeholder="Add a highlight…"
            />
          </InputField>

          <InputField label="Public Email" hint="Shown on the Contact page for this branch. Optional.">
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </InputField>

          <InputField label="Hours" hint='Free-text display copy, e.g. "Mon–Sat: 9:00 AM – 6:00 PM". Not used for booking.'>
            <input style={inputStyle} value={form.hours_text} onChange={(e) => setForm((f) => ({ ...f, hours_text: e.target.value }))} />
          </InputField>

          <InputField label="Map Link" hint="Google Maps (or similar) URL used for the 'Get Directions' button.">
            <input style={inputStyle} value={form.map_url} onChange={(e) => setForm((f) => ({ ...f, map_url: e.target.value }))} placeholder="https://maps.google.com/…" />
          </InputField>

          <InputField label="Photo">
            <PhotoUploadField
              currentUrl={form.currentPhotoUrl}
              file={form.photo}
              removed={form.removePhoto}
              onSelect={(f) => setForm((prev) => ({ ...prev, photo: f, removePhoto: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, photo: null, removePhoto: true }))}
              hint="Banner image shown on this branch's Locations-page card."
            />
          </InputField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button style={btnSecondary} onClick={closeModal} disabled={saving}>Cancel</button>
            <button style={{ ...btnPrimary(), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
