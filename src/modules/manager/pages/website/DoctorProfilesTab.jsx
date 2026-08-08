// src/modules/manager/pages/website/DoctorProfilesTab.jsx
//
// Which existing EMR doctors are published on the public website, plus
// each published doctor's schedule: date-specific hours/day-off entries
// (the primary way to set availability) and an optional recurring
// weekly fallback (the data the public /api/public/availability/
// endpoint computes booking slots from).
import { useState, useEffect, useCallback } from "react";
import {
  getWebsiteDoctorList, createWebsiteDoctor, updateWebsiteDoctor, deleteWebsiteDoctor,
  getWeeklyAvailability, createWeeklyAvailability, updateWeeklyAvailability, deleteWeeklyAvailability,
  getAvailabilityExceptions, createAvailabilityException, updateAvailabilityException, deleteAvailabilityException,
  getEmrDoctorList, toAbsoluteMediaUrl,
  searchWebsiteDoctor, attachBranchToWebsiteDoctor, detachBranchFromWebsiteDoctor,
} from "../../api/websiteApi";
import {
  Modal, InputField, inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, btnGhost,
  FormBanner, EmptyState, LoadingState, StatusPill, ConfirmDialog, extractApiError, PhotoUploadField,
  StringListField, CountSummary,
} from "./shared";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EMPTY_FORM = {
  doctor: "", is_published: true, bio: "", display_order: 0, photo: null, removePhoto: false, currentPhotoUrl: null,
  designation: "", experience_summary: "",
  area_of_expertise: [], education: [], awards: [], languages_known: [],
};

export default function DoctorProfilesTab({ showToast }) {
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [emrDoctors, setEmrDoctors] = useState([]); // for the "add doctor" picker

  const [showModal, setModal]     = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null); // profile object
  const [scheduleFor, setScheduleFor]     = useState(null); // profile object -> opens ScheduleModal

  // When adding a doctor already published under a different branch (a
  // "2nd branch" registration — see the Doctors-page "Register at another
  // branch" action), attach that branch to their EXISTING shared profile
  // instead of spinning up a duplicate. Set by the lookup effect below,
  // keyed off the picked EMR doctor's registration number.
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [checkingMatch, setCheckingMatch]   = useState(false);
  const [attachingBranch, setAttachingBranch] = useState(null); // profile object -> opens BranchPickerModal

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWebsiteDoctorList();
      setProfiles(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load doctor profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getEmrDoctorList({ all: true }).then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setEmrDoctors(list);
    }).catch(() => setEmrDoctors([]));
  }, []);

  // Look up whether the doctor just picked in the create form already has
  // a published profile via a different branch (matched by registration
  // number — the cross-branch identity key). Only runs in create mode;
  // editing an existing profile never re-triggers this.
  useEffect(() => {
    if (editing || !form.doctor) { setMatchedProfile(null); return; }
    const picked = emrDoctors.find((d) => String(d.profile_id) === String(form.doctor));
    const regNo = picked?.registration_number?.trim();
    if (!regNo) { setMatchedProfile(null); return; }
    let cancelled = false;
    setCheckingMatch(true);
    searchWebsiteDoctor({ registration_number: regNo })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : [];
        setMatchedProfile(list[0] ?? null);
      })
      .catch(() => { if (!cancelled) setMatchedProfile(null); })
      .finally(() => { if (!cancelled) setCheckingMatch(false); });
    return () => { cancelled = true; };
  }, [form.doctor, editing, emrDoctors]);

  const doctorDisplayName = (d) => {
    const u = d?.staff?.user;
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
    return name || u?.username || `Doctor #${d.profile_id}`;
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setMatchedProfile(null); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      doctor: "", is_published: !!p.is_published,
      bio: p.bio || "", display_order: p.display_order ?? 0,
      photo: null, removePhoto: false, currentPhotoUrl: p.photo ? toAbsoluteMediaUrl(p.photo) : null,
      designation: p.designation || "", experience_summary: p.experience_summary || "",
      area_of_expertise: Array.isArray(p.area_of_expertise) ? p.area_of_expertise : [],
      education: Array.isArray(p.education) ? p.education : [],
      awards: Array.isArray(p.awards) ? p.awards : [],
      languages_known: Array.isArray(p.languages_known) ? p.languages_known : [],
    });
    setFormError(null);
    setModal(true);
  };

  // Mirrors the backend rule: each list field must be an array of
  // non-empty (post-trim) strings if provided at all; empty arrays are
  // fine since the fields are optional. In practice StringListField
  // never lets a blank draft through, but we validate here too in case
  // that ever changes, and to give one clear error message up front
  // rather than relying on a server round-trip.
  const LIST_FIELD_LABELS = {
    area_of_expertise: "Area of Expertise",
    education: "Education",
    awards: "Awards",
    languages_known: "Languages Known",
  };
  const validateForm = (f) => {
    for (const [field, label] of Object.entries(LIST_FIELD_LABELS)) {
      const list = f[field];
      if (!Array.isArray(list)) continue;
      if (list.some((item) => typeof item !== "string" || !item.trim())) {
        return `${label} entries can't be blank — remove or fill in the empty row.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!editing && !form.doctor) {
      setFormError("Please select a doctor.");
      return;
    }
    // Attaching an existing branch to an already-shared profile doesn't
    // touch bio/designation/etc — those live on the shared profile and
    // were entered when it was first created — so skip the list-field
    // validation for that path.
    if (!(matchedProfile && !editing)) {
      const validationError = validateForm(form);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      if (matchedProfile && !editing) {
        await attachBranchToWebsiteDoctor(matchedProfile.id, form.doctor);
        showToast("Branch attached to the existing profile.");
        setModal(false);
        load();
        return;
      }

      const payload = {
        is_published: form.is_published,
        bio: form.bio,
        display_order: form.display_order,
        designation: form.designation,
        experience_summary: form.experience_summary,
        area_of_expertise: form.area_of_expertise,
        education: form.education,
        awards: form.awards,
        languages_known: form.languages_known,
      };
      if (!editing) payload.doctor = form.doctor;
      if (form.photo) payload.photo = form.photo;
      if (editing && form.removePhoto && !form.photo) payload.remove_photo = true;

      if (editing) {
        await updateWebsiteDoctor(editing.id, payload);
        showToast("Doctor profile updated.");
      } else {
        await createWebsiteDoctor(payload);
        showToast("Doctor profile created.");
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
    await deleteWebsiteDoctor(confirmDelete.id);
    showToast("Doctor profile removed.");
    setConfirmDelete(null);
    load();
  };

  // Doctors not yet published anywhere on the site (for the create picker).
  // `p.doctor` is write-only on this serializer (create-only — see
  // DoctorWebsiteProfileSerializer) and never present in list/read
  // responses, so filtering against it here always evaluated to "not
  // already published," letting a doctor who was already live under a
  // different branch's DoctorProfile show up again as if unpublished.
  // `branches` is the read-only field that actually reflects every
  // DoctorProfile (one per branch) currently attached to each profile.
  const availableEmrDoctors = emrDoctors.filter(
    (d) => !profiles.some((p) => p.branches?.some((b) => b.doctor_id === d.profile_id))
  );

  if (loading) return <LoadingState />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
          Only published doctors appear on the public site's Doctors page and booking flow.
        </p>
        <button style={btnPrimary()} onClick={openCreate}>+ Add Doctor to Website</button>
      </div>

      {error && <FormBanner message={error} />}

      {profiles.length === 0 ? (
        <EmptyState text="No doctor profiles yet. Click 'Add Doctor to Website' to publish one." />
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {profiles.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontWeight: 700 }}>
                {p.photo
                  ? <img src={toAbsoluteMediaUrl(p.photo)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (p.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{p.name}</span>
                  <StatusPill active={p.is_published} activeLabel="Published" inactiveLabel="Hidden" />
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                  {p.specialty || "No specialty set"} · Order {p.display_order}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {(p.branches ?? []).map((b) => (
                    <span key={b.doctor_id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8" }}>
                      {b.branch_name || b.branch_code || `Branch #${b.branch_id}`}
                      {p.branches.length > 1 && (
                        <button
                          title="Detach this branch"
                          onClick={() => detachBranch(p, b)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#1D4ED8", fontWeight: 700, padding: 0, lineHeight: 1, fontSize: "12px" }}
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  ))}
                  <button style={{ ...btnGhost, padding: "2px 8px", fontSize: "11px" }} onClick={() => setAttachingBranch(p)}>+ Branch</button>
                </div>
                <div style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "3px" }}>
                  <CountSummary
                    emptyText="Profile page fields not filled in yet"
                    parts={[
                      { label: "expertise area", count: Array.isArray(p.area_of_expertise) ? p.area_of_expertise.length : 0 },
                      { label: "degree", count: Array.isArray(p.education) ? p.education.length : 0 },
                      { label: "award", count: Array.isArray(p.awards) ? p.awards.length : 0 },
                      { label: "language", count: Array.isArray(p.languages_known) ? p.languages_known.length : 0 },
                    ]}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button style={btnGhost} onClick={() => setScheduleFor(p)}>Schedule</button>
                <button style={btnGhost} onClick={() => openEdit(p)}>Edit</button>
                <button style={btnDanger} onClick={() => setConfirmDelete(p)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Doctor Profile" : "Add Doctor to Website"} onClose={() => setModal(false)}>
          <FormBanner message={formError} />

          {!editing && (
            <InputField label="Doctor" required hint="Only EMR doctors not already published are listed.">
              <select
                style={inputStyle}
                value={form.doctor}
                onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))}
              >
                <option value="">Select a doctor…</option>
                {availableEmrDoctors.map((d) => (
                  <option key={d.profile_id} value={d.profile_id}>
                    {/* /manager/website/emr-doctors/ is served by
                        administration.serializers.DoctorProfileSerializer
                        (imported as EmrDoctorProfileSerializer in
                        manager/views.py), which now exposes specialty_name
                        (a SerializerMethodField backed by the specialty FK)
                        instead of the deprecated free-text `specialization`. */}
                    Dr. {doctorDisplayName(d)}{d.specialty_name ? ` — ${d.specialty_name}` : ""}
                  </option>
                ))}
              </select>
            </InputField>
          )}

          <InputField label="Bio">
            <textarea
              style={textareaStyle}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Short public-facing bio shown on the Doctors page…"
            />
          </InputField>

          <InputField label="Designation" hint='Public-facing title, e.g. "Senior Consultant & Director - Interventional Cardiology". Falls back to specialty if left blank.'>
            <input
              style={inputStyle}
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
            />
          </InputField>

          <InputField label="Work Experience" hint='Short headline for the profile page, e.g. "49 Years".'>
            <input
              style={inputStyle}
              value={form.experience_summary}
              onChange={(e) => setForm((f) => ({ ...f, experience_summary: e.target.value }))}
            />
          </InputField>

          <InputField label="Area of Expertise" hint="Shown as bullet points on the doctor's profile page.">
            <StringListField
              value={form.area_of_expertise}
              onChange={(v) => setForm((f) => ({ ...f, area_of_expertise: v }))}
              placeholder="e.g. Pacemaker and ICD implantation"
            />
          </InputField>

          <InputField label="Education">
            <StringListField
              value={form.education}
              onChange={(v) => setForm((f) => ({ ...f, education: v }))}
              placeholder="e.g. MBBS"
            />
          </InputField>

          <InputField label="Awards">
            <StringListField
              value={form.awards}
              onChange={(v) => setForm((f) => ({ ...f, awards: v }))}
              placeholder="e.g. Melvin Jones Award for professional achievement"
            />
          </InputField>

          <InputField label="Languages Known">
            <StringListField
              value={form.languages_known}
              onChange={(v) => setForm((f) => ({ ...f, languages_known: v }))}
              placeholder="e.g. English"
            />
          </InputField>

          <InputField label="Photo">
            <PhotoUploadField
              currentUrl={form.currentPhotoUrl}
              file={form.photo}
              removed={form.removePhoto}
              onSelect={(f) => setForm((prev) => ({ ...prev, photo: f, removePhoto: false }))}
              onRemove={() => setForm((prev) => ({ ...prev, photo: null, removePhoto: true }))}
              hint="JPG or PNG, shown on the public Doctors page."
            />
          </InputField>

          <InputField label="Display Order" hint="Lower numbers appear first on the public Doctors page.">
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
                checked={form.is_published}
                onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
              />
              Visible on the public website
            </label>
          </InputField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button style={btnSecondary} onClick={() => setModal(false)} disabled={saving}>Cancel</button>
            <button style={{ ...btnPrimary(), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add to Website"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove Doctor from Website"
          message={`Remove ${confirmDelete.name} from the public website? Their scheduled dates and any recurring weekly hours will be deleted too, and any pending bookings for them will remain but they'll disappear from the public Doctors page.`}
          confirmLabel="Remove"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {scheduleFor && (
        <ScheduleModal
          profile={scheduleFor}
          onClose={() => setScheduleFor(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Per-doctor schedule editor: weekly availability windows +
// date-specific exceptions.
// ═══════════════════════════════════════════════════════

const EMPTY_WEEKLY = { day_of_week: 0, start_time: "09:00", end_time: "13:00", slot_duration_minutes: 15 };
const EMPTY_EXCEPTION = { date: "", is_unavailable: false, start_time: "09:00", end_time: "13:00", slot_duration_minutes: 15 };

function ScheduleModal({ profile, onClose, showToast }) {
  const doctorId = profile.doctor;

  const [weekly, setWeekly]       = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [weeklyForm, setWeeklyForm]         = useState(EMPTY_WEEKLY);
  const [exceptionForm, setExceptionForm]   = useState(EMPTY_EXCEPTION);
  const [savingWeekly, setSavingWeekly]     = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [rowError, setRowError]             = useState(null);
  const [showWeeklySection, setShowWeeklySection] = useState(false);
  const [editingExceptionId, setEditingExceptionId] = useState(null);
  const [showPastExceptions, setShowPastExceptions] = useState(false);

  // Local (not UTC) YYYY-MM-DD so "today" lines up with the plain date
  // strings the API stores/returns.
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const upcomingExceptions = exceptions.filter((ex) => ex.date >= todayStr);
  const pastExceptions = exceptions.filter((ex) => ex.date < todayStr);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, ex] = await Promise.all([
        getWeeklyAvailability(doctorId),
        getAvailabilityExceptions(doctorId),
      ]);
      setWeekly(Array.isArray(w) ? w : []);
      setExceptions(Array.isArray(ex) ? ex : []);
    } catch {
      setError("Failed to load this doctor's schedule.");
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  const addWeekly = async () => {
    setSavingWeekly(true);
    setRowError(null);
    try {
      await createWeeklyAvailability(doctorId, weeklyForm);
      setWeeklyForm(EMPTY_WEEKLY);
      showToast("Weekly availability added.");
      load();
    } catch (err) {
      setRowError(extractApiError(err));
    } finally {
      setSavingWeekly(false);
    }
  };

  const removeWeekly = async (id) => {
    await deleteWeeklyAvailability(doctorId, id);
    showToast("Weekly availability removed.");
    load();
  };

  // Picking a date that already has a schedule entry loads it into the
  // form for editing, instead of letting the manager hit the (doctor,
  // date) uniqueness error on submit.
  const pickExceptionDate = (dateStr) => {
    const existing = exceptions.find((ex) => ex.date === dateStr);
    if (existing) {
      setEditingExceptionId(existing.id);
      setExceptionForm({
        date: existing.date,
        is_unavailable: existing.is_unavailable,
        start_time: existing.start_time ? existing.start_time.slice(0, 5) : "09:00",
        end_time: existing.end_time ? existing.end_time.slice(0, 5) : "13:00",
        slot_duration_minutes: existing.slot_duration_minutes || 15,
      });
    } else {
      setEditingExceptionId(null);
      setExceptionForm((f) => ({ ...f, date: dateStr }));
    }
  };

  const addException = async () => {
    if (!exceptionForm.date) {
      setRowError("Please pick a date.");
      return;
    }
    if (!exceptionForm.is_unavailable && (!exceptionForm.start_time || !exceptionForm.end_time)) {
      setRowError("Provide start and end time, or mark the day fully unavailable.");
      return;
    }
    setSavingException(true);
    setRowError(null);
    try {
      const payload = exceptionForm.is_unavailable
        ? { date: exceptionForm.date, is_unavailable: true, start_time: null, end_time: null, slot_duration_minutes: null }
        : {
            date: exceptionForm.date, is_unavailable: false,
            start_time: exceptionForm.start_time, end_time: exceptionForm.end_time,
            slot_duration_minutes: exceptionForm.slot_duration_minutes,
          };
      if (editingExceptionId) {
        await updateAvailabilityException(doctorId, editingExceptionId, payload);
        showToast(exceptionForm.is_unavailable ? "Day off updated." : "Availability updated.");
      } else {
        await createAvailabilityException(doctorId, payload);
        showToast(exceptionForm.is_unavailable ? "Day off added." : "Availability added.");
      }
      setEditingExceptionId(null);
      setExceptionForm({ ...EMPTY_EXCEPTION, date: "" });
      load();
    } catch (err) {
      setRowError(extractApiError(err));
    } finally {
      setSavingException(false);
    }
  };

  const removeException = async (id) => {
    const row = exceptions.find((ex) => ex.id === id);
    await deleteAvailabilityException(doctorId, id);
    if (editingExceptionId === id) {
      setEditingExceptionId(null);
      setExceptionForm({ ...EMPTY_EXCEPTION, date: "" });
    }
    showToast(row?.is_unavailable ? "Day off removed." : "Availability removed.");
    load();
  };

  return (
    <Modal title={`Schedule — ${profile.name}`} onClose={onClose} maxWidth="720px">
      {error && <FormBanner message={error} />}
      {rowError && <FormBanner message={rowError} />}

      {loading ? <LoadingState /> : (
        <>
          {/* Date-specific schedule — the primary, day-by-day way to set this
              doctor's hours. Each entry stands on its own (no weekly rule
              required), and "Day Off" is its own clearly separated mode
              rather than a checkbox buried among time fields. */}
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>Schedule by Date</h3>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748B" }}>
            Set this doctor's hours for a specific date, or mark a date as a day off. This is the recommended way to manage availability.
          </p>

          {(() => {
            const renderRow = (ex, muted) => (
              <div
                key={ex.id}
                onClick={() => pickExceptionDate(ex.date)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: "8px", marginBottom: "6px", fontSize: "12.5px",
                  cursor: "pointer",
                  opacity: muted ? 0.65 : 1,
                  background: ex.is_unavailable ? "#FEF2F2" : "#F0FDF4",
                  border: editingExceptionId === ex.id
                    ? "1px solid #6366F1"
                    : `1px solid ${ex.is_unavailable ? "#FECACA" : "#BBF7D0"}`,
                  boxShadow: editingExceptionId === ex.id ? "0 0 0 2px #E0E7FF" : "none",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong>{ex.date}</strong>
                  {ex.is_unavailable ? (
                    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: "#FEE2E2", color: "#B91C1C" }}>Day Off</span>
                  ) : (
                    <span style={{ color: "#166534" }}>
                      {ex.start_time.slice(0, 5)}–{ex.end_time.slice(0, 5)} · {ex.slot_duration_minutes || 15} min slots
                    </span>
                  )}
                </span>
                <button style={btnDanger} onClick={(e) => { e.stopPropagation(); removeException(ex.id); }}>Remove</button>
              </div>
            );

            return (
              <>
                {upcomingExceptions.length === 0 ? (
                  <p style={{ fontSize: "12.5px", color: "#94A3B8", marginBottom: "12px" }}>No upcoming dates scheduled.</p>
                ) : (
                  <div style={{ marginBottom: "8px" }}>
                    {upcomingExceptions.map((ex) => renderRow(ex, false))}
                  </div>
                )}

                {pastExceptions.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setShowPastExceptions((v) => !v)}
                      style={{ background: "none", border: "none", padding: "4px 0", color: "#64748B", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {showPastExceptions ? "Hide" : "Show"} {pastExceptions.length} past {pastExceptions.length === 1 ? "entry" : "entries"}
                    </button>
                    {showPastExceptions && (
                      <div style={{ marginTop: "8px" }}>
                        {pastExceptions.map((ex) => renderRow(ex, true))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          <div style={{ padding: "14px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: "10px", marginBottom: "24px" }}>
            {editingExceptionId && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "6px 10px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "6px", fontSize: "12px", color: "#4338CA" }}>
                <span>Editing {exceptionForm.date} — changes will update this entry.</span>
                <button
                  type="button"
                  onClick={() => { setEditingExceptionId(null); setExceptionForm({ ...EMPTY_EXCEPTION, date: "" }); }}
                  style={{ background: "none", border: "none", color: "#4338CA", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}
                >
                  Cancel
                </button>
              </div>
            )}
            <InputField label="Date">
              <input type="date" style={inputStyle} value={exceptionForm.date} onChange={(e) => pickExceptionDate(e.target.value)} />
            </InputField>

            <InputField label="Mode">
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setExceptionForm((f) => ({ ...f, is_unavailable: false }))}
                  style={{
                    ...btnGhost, flex: 1, padding: "9px 12px",
                    background: !exceptionForm.is_unavailable ? "#F0FDF4" : "#fff",
                    color: !exceptionForm.is_unavailable ? "#16A34A" : "#475569",
                    borderColor: !exceptionForm.is_unavailable ? "#BBF7D0" : "#E2E8F0",
                  }}
                >
                  ✓ Available
                </button>
                <button
                  type="button"
                  onClick={() => setExceptionForm((f) => ({ ...f, is_unavailable: true }))}
                  style={{
                    ...btnGhost, flex: 1, padding: "9px 12px",
                    background: exceptionForm.is_unavailable ? "#FEF2F2" : "#fff",
                    color: exceptionForm.is_unavailable ? "#B91C1C" : "#475569",
                    borderColor: exceptionForm.is_unavailable ? "#FECACA" : "#E2E8F0",
                  }}
                >
                  ✕ Day Off
                </button>
              </div>
            </InputField>

            {exceptionForm.is_unavailable ? (
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#B91C1C" }}>
                The doctor won't be bookable on this date.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <InputField label="Start">
                  <input type="time" style={inputStyle} value={exceptionForm.start_time} onChange={(e) => setExceptionForm((f) => ({ ...f, start_time: e.target.value }))} />
                </InputField>
                <InputField label="End">
                  <input type="time" style={inputStyle} value={exceptionForm.end_time} onChange={(e) => setExceptionForm((f) => ({ ...f, end_time: e.target.value }))} />
                </InputField>
                <InputField label="Slot (min)">
                  <input type="number" min="4" style={inputStyle} value={exceptionForm.slot_duration_minutes} onChange={(e) => setExceptionForm((f) => ({ ...f, slot_duration_minutes: Number(e.target.value) }))} />
                </InputField>
              </div>
            )}

            <button style={{ ...btnPrimary(), opacity: savingException ? 0.7 : 1, width: "100%", marginTop: "4px" }} onClick={addException} disabled={savingException}>
              {savingException
                ? "Saving…"
                : editingExceptionId
                  ? (exceptionForm.is_unavailable ? "Update Day Off" : "Update Availability")
                  : (exceptionForm.is_unavailable ? "Mark Day Off" : "Add Availability")}
            </button>
          </div>

          {/* Recurring weekly hours — optional fallback, only used on a
              date that has no entry above at all. Collapsed by default
              now that date-by-date scheduling is the primary workflow. */}
          <button
            type="button"
            onClick={() => setShowWeeklySection((v) => !v)}
            style={{ ...btnGhost, marginBottom: showWeeklySection ? "10px" : 0, width: "100%", textAlign: "left" }}
          >
            {showWeeklySection ? "▾" : "▸"} Recurring Weekly Hours (optional fallback{weekly.length > 0 ? `, ${weekly.length} set` : ""})
          </button>

          {showWeeklySection && (
            <div style={{ marginTop: "4px" }}>
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#94A3B8" }}>
                Only used on a date with no specific schedule or day-off entry above.
              </p>
              {weekly.length === 0 ? (
                <p style={{ fontSize: "12.5px", color: "#94A3B8", marginBottom: "12px" }}>No recurring hours set.</p>
              ) : (
                <div style={{ marginBottom: "14px" }}>
                  {weekly.map((w) => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F8FAFC", borderRadius: "8px", marginBottom: "6px", fontSize: "12.5px" }}>
                      <span>
                        <strong>{DAY_NAMES[w.day_of_week]}</strong> · {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)} · {w.slot_duration_minutes} min slots
                      </span>
                      <button style={btnDanger} onClick={() => removeWeekly(w.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                <InputField label="Day">
                  <select style={inputStyle} value={weeklyForm.day_of_week} onChange={(e) => setWeeklyForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </InputField>
                <InputField label="Start">
                  <input type="time" style={inputStyle} value={weeklyForm.start_time} onChange={(e) => setWeeklyForm((f) => ({ ...f, start_time: e.target.value }))} />
                </InputField>
                <InputField label="End">
                  <input type="time" style={inputStyle} value={weeklyForm.end_time} onChange={(e) => setWeeklyForm((f) => ({ ...f, end_time: e.target.value }))} />
                </InputField>
                <InputField label="Slot (min)">
                  <input type="number" min="4" style={inputStyle} value={weeklyForm.slot_duration_minutes} onChange={(e) => setWeeklyForm((f) => ({ ...f, slot_duration_minutes: Number(e.target.value) }))} />
                </InputField>
                <button style={{ ...btnPrimary(), opacity: savingWeekly ? 0.7 : 1, height: "37px" }} onClick={addWeekly} disabled={savingWeekly}>Add</button>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
        <button style={btnSecondary} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}