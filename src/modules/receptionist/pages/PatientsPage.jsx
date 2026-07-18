// src/modules/receptionist/pages/PatientsPage.jsx
import { useEffect, useState, useCallback } from "react";
import { getPatients, createPatient, updatePatient, getPatientHistory, toArray } from "../api/receptionApi";
import BillingPage from "./BillingPage";
import { isValidPhone, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";

const G = "#16A34A";
const LIGHT_G = "#DCFCE7";

// ─── Icons ───────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor", extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const inp = {
  padding: "10px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4",
  fontSize: "13px", color: "#1E293B", outline: "none", width: "100%",
  boxSizing: "border-box", background: "#fff", transition: "border-color 0.15s",
};

const Field = ({ label, required, children, hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>
      {label}{required && <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>{hint}</p>}
  </div>
);

// ─── Toast ───────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      padding: "10px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: 500,
      background: toast.err ? "#FEF2F2" : "#F0FDF4",
      color: toast.err ? "#DC2626" : "#15803D",
      border: `1px solid ${toast.err ? "#FECACA" : "#BBF7D0"}`,
      display: "flex", alignItems: "center", gap: "8px",
      margin: "14px 0 0",
    }}>
      <Ico d={toast.err ? "M12 8v4m0 4h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" : "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3"} size={14} color={toast.err ? "#DC2626" : G} />
      {toast.msg}
    </div>
  );
};

// ─── Create / Edit Patient Modal ─────────────────────────────────
function PatientFormModal({ show, onClose, onSaved, editPatient }) {
  const isEdit = !!editPatient;
  const blank = { first_name: "", last_name: "", phone: "", age: "", date_of_birth: "", gender: "Male", blood_group: "", place: "", address: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (show) {
      if (editPatient) {
        setForm({ first_name: editPatient.first_name, last_name: editPatient.last_name, phone: editPatient.phone, age: editPatient.age ?? "", date_of_birth: editPatient.date_of_birth ?? "", gender: editPatient.gender ?? "Male", blood_group: editPatient.blood_group ?? "", place: editPatient.place ?? "", address: editPatient.address ?? "" });
      } else {
        setForm({ first_name: "", last_name: "", phone: "", age: "", date_of_birth: "", gender: "Male", blood_group: "", place: "", address: "" });
      }
    }
  }, [show, editPatient]);

  useEffect(() => {
    if (show) setToast(null);
  }, [show]);

  if (!show) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.first_name.trim()) { setToast({ msg: "First name is required.", err: true }); return; }
    if (!form.last_name.trim())  { setToast({ msg: "Last name is required.", err: true }); return; }
    if (!isValidPhone(form.phone)) { setToast({ msg: PHONE_ERROR_MESSAGE, err: true }); return; }
    if (form.age === "" || isNaN(form.age) || Number(form.age) < 0 || Number(form.age) > 130) { setToast({ msg: "Please enter a valid age.", err: true }); return; }

    setSaving(true);
    try {
      const payload = { ...form };
      payload.age = Number(payload.age);
      if (!payload.date_of_birth) delete payload.date_of_birth;
      if (!payload.place) delete payload.place;
      if (!payload.address) delete payload.address;
      if (!payload.blood_group) delete payload.blood_group;

      if (isEdit) {
        await updatePatient(editPatient.patient_id, payload);
      } else {
        await createPatient(payload);
      }
      setToast({ msg: isEdit ? "Patient updated successfully." : "Patient registered successfully." });
      setTimeout(() => { onSaved(); onClose(); }, 900);
    } catch (e) {
      const d = e?.response?.data;
      let msg = "Failed to save. Please try again.";
      if (d) msg = typeof d === "string" ? d : Object.values(d).flat().join(", ");
      setToast({ msg: msg.slice(0, 180), err: true });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "560px", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: LIGHT_G, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={18} color={G} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{isEdit ? "Edit Patient" : "New Patient"}</h2>
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>{isEdit ? `MRD: ${editPatient.mrd_number}` : "Fill in patient details below"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "4px" }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 26px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {toast && <Toast toast={toast} />}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="First Name" required>
              <input style={inp} placeholder="e.g. Ravi" value={form.first_name} onChange={e => set("first_name", e.target.value)}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
            </Field>
            <Field label="Last Name" required>
              <input style={inp} placeholder="e.g. Kumar" value={form.last_name} onChange={e => set("last_name", e.target.value)}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
            </Field>
          </div>

          <Field label="Phone Number" required hint="10 digits, must start with 6, 7, 8, or 9">
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}>
                <Ico d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.07 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 15z" size={14} />
              </span>
              <input style={{ ...inp, paddingLeft: "36px" }} placeholder="9876543210" maxLength={10}
                value={form.phone} onChange={e => set("phone", e.target.value.replace(/\D/g, ""))}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Age" required>
              <input type="number" min="0" max="130" style={inp} placeholder="e.g. 32" value={form.age} onChange={e => set("age", e.target.value)}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
            </Field>
            <Field label="Date of Birth" hint="Optional — if entered, age is auto-calculated from this">
              <input type="date" style={inp} value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)}
                onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Gender">
              <select style={{ ...inp, cursor: "pointer" }} value={form.gender} onChange={e => set("gender", e.target.value)}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Blood Group" hint="Optional">
              <select style={{ ...inp, cursor: "pointer" }} value={form.blood_group} onChange={e => set("blood_group", e.target.value)}>
                <option value="">— Not specified —</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg}>{bg}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Place / City">
            <input style={inp} placeholder="e.g. Ernakulam" value={form.place} onChange={e => set("place", e.target.value)}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
          </Field>

          <Field label="Address">
            <textarea rows={2} style={{ ...inp, resize: "none", lineHeight: "1.5" }} placeholder="Full address (optional)"
              value={form.address} onChange={e => set("address", e.target.value)}
              onFocus={e => e.target.style.borderColor = G} onBlur={e => e.target.style.borderColor = "#E8EDF4"} />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 26px 22px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: "10px", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "10px 22px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: "7px", padding: "10px 22px",
            borderRadius: "9px", border: "none", background: saving ? "#86EFAC" : G,
            color: "#fff", fontSize: "13px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px #16a34a33",
          }}>
            <Ico d={saving ? "M12 6v6l4 2" : "M20 6 9 17l-5-5"} size={14} color="#fff" />
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Register Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Patient History Modal ────────────────────────────────────────
function PatientHistoryModal({ patient, onClose }) {
  const [bills, setBills]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient) return;
    getPatientHistory(patient.patient_id)
      .then(d => setBills(toArray(d)))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [patient]);

  if (!patient) return null;

  const TypeBadge = ({ type }) => (
    <span style={{
      padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
      background: type === "NEW" ? "#EFF6FF" : "#F5F3FF",
      color: type === "NEW" ? "#2563EB" : "#7C3AED",
    }}>{type === "REVISIT" ? "Revisit" : "New"}</span>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "620px", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1, maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Consultation History</h2>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
              {patient.full_name ?? `${patient.first_name} ${patient.last_name}`} · {patient.mrd_number}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={18} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "6px 0" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>Loading history…</div>
          ) : bills.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No consultation history found.</div>
          ) : bills.map((b, i) => {
            const isCancelled = b.consultation_status === "CANCELLED";
            return (
            <div key={b.bill_id ?? i} style={{ padding: "14px 26px", borderBottom: "1px solid #F8FAFC", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "center", opacity: isCancelled ? 0.6 : 1 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                  <TypeBadge type={b.consultation_type} />
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                  {b.bill_number}
                  {parseFloat(b.registration_fee ?? 0) > 0 && (
                    <> · MRD fee incl.</>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{b.doctor_name ?? "—"}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>Doctor</div>
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>₹{b.consultation_fee ?? "0"}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{formatDate(b.consultation_date)}</div>
              </div>
              {isCancelled ? (
                <span style={{
                  padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                  background: "#F1F5F9", color: "#64748B",
                }}>
                  Cancelled
                </span>
              ) : (
                <span style={{
                  padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                  background: b.payment_status === "PAID" ? LIGHT_G : "#FEF3C7",
                  color: b.payment_status === "PAID" ? "#15803D" : "#D97706",
                }}>
                  {b.payment_status}
                </span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Patient Row ──────────────────────────────────────────────────
function PatientRow({ p, onEdit, onHistory, onBook }) {
  const name = p.full_name ?? `${p.first_name} ${p.last_name}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 0.9fr 0.9fr 0.8fr 150px", padding: "13px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center", transition: "background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `${G}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: G, flexShrink: 0 }}>
          {name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B" }}>{name}</div>
          <div style={{ fontSize: "11px", color: "#94A3B8" }}>{p.phone}</div>
        </div>
      </div>
      <span style={{ fontSize: "12.5px", fontFamily: "monospace", color: "#475569", background: "#F1F5F9", padding: "3px 8px", borderRadius: "6px", display: "inline-block" }}>{p.mrd_number}</span>
      <span style={{ fontSize: "13px", color: "#475569" }}>{p.gender ?? "—"}</span>
      <span style={{ fontSize: "13px", color: "#475569" }}>{p.age != null ? `${p.age} yrs` : "—"}</span>
      <span style={{ fontSize: "13px", color: "#475569" }}>{p.blood_group ?? "—"}</span>
      <div style={{ display: "flex", gap: "5px" }}>
        {/* Book Consultation */}
        <button onClick={() => onBook(p)} title="Book consultation"
          style={{ height: "32px", padding: "0 10px", borderRadius: "8px", border: "none", background: G, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 600, boxShadow: "0 1px 4px #16a34a28", whiteSpace: "nowrap" }}>
          <Ico d="M12 5v14 M5 12h14" size={12} color="#fff" /> Book
        </button>
        <button onClick={() => onHistory(p)} title="View history"
          style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1.5px solid #E8EDF4", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = G}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#E8EDF4"}>
          <Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" extra="M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" size={14} color="#475569" />
        </button>
        <button onClick={() => onEdit(p)} title="Edit patient"
          style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1.5px solid #E8EDF4", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = G}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#E8EDF4"}>
          <Ico d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} color="#475569" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function PatientsPage() {
  const [patients, setPatients]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [searchField, setSearchField] = useState("name");
  const [showCreate, setShowCreate] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [historyPatient, setHistoryPatient] = useState(null);
  const [bookPatient, setBookPatient] = useState(null); // triggers inline billing
  const [page, setPage]             = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      // ✅ FIX: was sending the field name itself as the param key
      // (e.g. `place=Kochi`), which the backend never read — it only
      // recognizes `search` (+ optional `field` to scope which column).
      // That's why searching by MRD/phone/place silently returned nothing.
      if (search.trim()) { params.search = search.trim(); params.field = searchField; }
      const data = await getPatients(params);
      setPatients(toArray(data));
      setTotalCount(data?.count ?? (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setPatients([]);
    }
    setLoading(false);
  }, [search, searchField, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when search changes is handled gracefully without effects
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };
  const handleSearchFieldChange = (val) => {
    setSearchField(val);
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const searchFieldLabels = { name: "Name", mrd: "MRD No.", phone: "Phone", place: "Place" };

  // ── If booking was triggered from a patient row, render BillingPage inline ──
  if (bookPatient) {
    return (
      <BillingPage
        quickBookPatient={bookPatient}
        onQuickBookClose={() => setBookPatient(null)}
      />
    );
  }

  return (
    <div>
      {/* Modals */}
      <PatientFormModal show={showCreate} onClose={() => setShowCreate(false)} onSaved={load} />
      <PatientFormModal show={!!editPatient} onClose={() => setEditPatient(null)} onSaved={load} editPatient={editPatient} />
      <PatientHistoryModal patient={historyPatient} onClose={() => setHistoryPatient(null)} />

      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: LIGHT_G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={20} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>Patients</h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>{totalCount} registered patients</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: "flex", alignItems: "center", gap: "7px", padding: "10px 18px",
          borderRadius: "10px", border: "none", background: G, color: "#fff",
          fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px #16a34a33",
        }}>
          <Ico d="M12 5v14 M5 12h14" size={14} color="#fff" />
          New Patient
        </button>
      </div>

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Search field selector */}
          <select
            value={searchField}
            onChange={e => handleSearchFieldChange(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "12px", fontWeight: 600, color: "#475569", background: "#F8FAFC", cursor: "pointer", outline: "none" }}>
            {Object.entries(searchFieldLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "360px" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}>
              <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={14} />
            </span>
            <input
              style={{ padding: "8px 12px 8px 36px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#475569", background: "#F8FAFC", outline: "none", boxSizing: "border-box", width: "100%" }}
              placeholder={`Search by ${searchFieldLabels[searchField].toLowerCase()}…`}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
            {search && (
              <button onClick={() => handleSearchChange("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "2px" }}>
                <Ico d="M18 6 6 18 M6 6l12 12" size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Column Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr 0.9fr 0.9fr 0.8fr 150px", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
          {["Patient", "MRD Number", "Gender", "Age", "Blood Group", "Actions"].map((h, i) => (
            <div key={i} style={{ fontSize: "11.5px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: "20px" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ height: "52px", borderRadius: "8px", background: "#F1F5F9", marginBottom: "8px", animation: "shimmer 1.5s infinite", animationDelay: `${i*0.08}s` }} />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ marginBottom: "12px" }}><Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={40} color="#E2E8F0" /></div>
            <p style={{ color: "#94A3B8", fontSize: "14px", fontWeight: 500 }}>No patients found</p>
            {search && <p style={{ color: "#CBD5E1", fontSize: "12px" }}>Try a different search term.</p>}
          </div>
        ) : (
          patients.map((p, i) => (
            <PatientRow key={p.patient_id ?? i} p={p} onEdit={setEditPatient} onHistory={setHistoryPatient} onBook={setBookPatient} />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12.5px", color: "#94A3B8" }}>
              Page {page} of {totalPages} · {totalCount} patients
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "6px 14px", borderRadius: "8px", border: "1.5px solid #E8EDF4", background: page === 1 ? "#F8FAFC" : "#fff", color: page === 1 ? "#CBD5E1" : "#475569", fontSize: "12px", fontWeight: 600, cursor: page === 1 ? "not-allowed" : "pointer" }}>
                ← Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "6px 14px", borderRadius: "8px", border: "1.5px solid #E8EDF4", background: page === totalPages ? "#F8FAFC" : "#fff", color: page === totalPages ? "#CBD5E1" : "#475569", fontSize: "12px", fontWeight: 600, cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}