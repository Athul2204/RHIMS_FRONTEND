// src/modules/admin/pages/DoctorsPage.jsx
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import { 
  getDoctorList, createStaff, patchStaff, patchDoctor, 
  deactivateStaff, reactivateStaff 
} from "../api/adminApi";

const G = "#3B82F6"; // Doctor theme blue

const Ico = ({ path, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus:   "M12 5v14 M5 12h14",
  edit:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  steth:  "M4.5 6.375a4.125 4.125 0 1 1 8.25 0v3.75a.75.75 0 0 1-.75.75h-6.75a.75.75 0 0 1-.75-.75v-3.75Z M9 15a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M4.5 9.375v3.375A6 6 0 0 0 16.5 15",
};

const EMPTY = {
  user: { first_name: "", last_name: "", email: "", username: "", password: "" },
  phone: "", date_of_birth: "", qualification: "MBBS",
  salary: "50000", joining_date: new Date().toISOString().split("T")[0], 
  address: "", role: "Doctor",
  specialization: "", registration_number: "", department: "", consultation_fee: 500
};

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000, backdropFilter: "blur(4px)" }}>
    <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "600px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "20px", color: "#64748B", lineHeight: 1 }}>&times;</span>
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children, required }) => (
  <div style={{ marginBottom: "14px" }}>
    <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "5px" }}>{label} {required && "*"}</label>
    {children}
  </div>
);

const inp = { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "14px", boxSizing: "border-box" };

export default function DoctorsPage() {
  const [doctors, setDoctors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [count, setCount]           = useState(0);
  const [next, setNext]             = useState(null);
  const [prev, setPrev]             = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);

  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [toast, showToast]        = useToast();
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback((arg = null) => {
    setLoading(true);
    getDoctorList(arg)
      .then(data => {
        const results = Array.isArray(data) ? data : data.results || [];
        setDoctors(results);
        setCount(data.count ?? results.length);
        setNext(data.next ?? null);
        setPrev(data.previous ?? null);
        setCurrentUrl(arg);
      })
      .catch(() => setError("Failed to load doctors."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = doctors.filter(p => {
    const s = p.staff || {};
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${s.user?.first_name ?? ""} ${s.user?.last_name ?? ""}`.toLowerCase();
    return name.includes(q) || s.user?.email?.toLowerCase().includes(q) || s.staff_code?.toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(EMPTY); setFormError(""); setModal("add"); };
  const openEdit = (p) => {
    const s = p.staff ?? {};
    setEditTarget(p);
    setForm({
      user: { first_name: s.user?.first_name ?? "", last_name: s.user?.last_name ?? "", email: s.user?.email ?? "", username: s.user?.username ?? "", password: "" },
      phone: s.phone ?? "", date_of_birth: s.date_of_birth ?? "", qualification: s.qualification ?? "MBBS",
      salary: s.salary ?? "", joining_date: s.joining_date ?? "", address: s.address ?? "", role: "Doctor",
      specialization: p.specialization ?? "",
      registration_number: p.registration_number ?? "",
      department: p.department ?? "",
      consultation_fee: p.consultation_fee ?? 500
    });
    setFormError(""); setModal("edit");
  };

  const handleUserChange = (f, v) => setForm(p => ({ ...p, user: { ...p.user, [f]: v } }));
  const handleChange     = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async () => {
    if (form.phone?.trim() && !isValidPhone(form.phone)) {
      setFormError(PHONE_ERROR_MESSAGE);
      return;
    }
    setSubmitting(true); 
    setFormError("");
    try {
      const { specialization, registration_number, department, consultation_fee, ...staffPayload } = form;
      
      if (modal === "edit" && !staffPayload.user.password) delete staffPayload.user.password;
      if (!staffPayload.user.username) delete staffPayload.user.username;

      if (staffPayload.salary === "" || staffPayload.salary === null) {
        delete staffPayload.salary;
      } else {
        staffPayload.salary = parseInt(staffPayload.salary, 10);
      }

      if (modal === "add") {
        const staffRes = await createStaff(staffPayload);
        const profileId = staffRes.data?.doctor_profile_id;
        if (profileId) {
            const docData = { specialization, registration_number, department, consultation_fee };
            await patchDoctor(profileId, docData);
        }
      } else {
        const staffId = editTarget?.staff?.id;
        if (staffId) await patchStaff(staffId, staffPayload);
        
        // Only patch doctor profile if role is still Doctor
        if (staffPayload.role === "Doctor") {
            const docData = { specialization, registration_number, department, consultation_fee };
            await patchDoctor(editTarget.profile_id, docData);
        }
      }
      
      setModal(null);
      showToast(modal === "add" ? "Doctor added!" : "Doctor updated!");
      load(currentUrl);
    } catch (err) {
      console.error("Doctor form error:", err);
      let msg = "Something went wrong.";
      const backendErrors = err?.response?.data?.errors || err?.response?.data;

      if (backendErrors && typeof backendErrors === "object") {
        const flatErrors = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([key, val]) => {
            const label = prefix ? `${prefix} ${key}` : key;
            if (Array.isArray(val)) {
              flatErrors.push(`${label}: ${val.join(" ")}`);
            } else if (typeof val === "object" && val !== null) {
              extract(val, label);
            } else {
              flatErrors.push(`${label}: ${val}`);
            }
          });
        };
        extract(backendErrors);
        msg = flatErrors.join(" | ");
      } else if (err.message) {
        msg = err.message;
      }
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (s) => {
    try {
      if (s.is_active) await deactivateStaff(s.id);
      else await reactivateStaff(s.id);
      load(currentUrl);
    } catch { showToast("Action failed.", false); }
  };

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", margin: "-20px -16px", padding: "24px" }}>
      <Toast toast={toast} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Doctors</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{count} registered</p>
        </div>
        <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: "7px", background: G, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add Doctor
        </button>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>}

      <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", border: "1px solid #F1F5F9", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}><Ico path={ICONS.search} size={15} color="#94A3B8" /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors…" style={{ ...inp, paddingLeft: "34px" }} />
        </div>
      </div>

      {/* card grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "16px" }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: "160px", borderRadius: "14px", background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "14px", padding: "64px", textAlign: "center", border: "1px solid #F1F5F9" }}>
          <p style={{ color: "#94A3B8" }}>No doctors found.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: "16px" }}>
          {displayed.map(p => {
            const s = p.staff || {};
            return (
              <div key={p.profile_id} style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: `1px solid ${s.is_active ? "#BFDBFE" : "#F1F5F9"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: G }}>
                      {(s.user?.first_name?.[0] ?? "D").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Dr. {s.user?.first_name} {s.user?.last_name}</div>
                      <div style={{ fontSize: "11px", color: G, fontWeight: 500 }}>{p.specialization || "General Physician"}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: s.is_active ? "#DBEAFE" : "#FEE2E2", color: s.is_active ? "#2563EB" : "#DC2626", fontWeight: 600 }}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Reg No:</strong> {p.registration_number || "—"}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Dept:</strong> {p.department || "General"}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Fee:</strong> ₹{p.consultation_fee}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Staff Code:</strong> {s.staff_code}</div>
                </div>

                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #F8FAFC", paddingTop: "12px" }}>
                  <button onClick={() => openEdit(p)} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: "1px solid #BFDBFE", background: "#EFF6FF", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: G }}>Edit</button>
                  <button onClick={() => toggleStatus(s)} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: `1px solid ${s.is_active ? "#FECACA" : "#BBF7D0"}`, background: s.is_active ? "#FEF2F2" : "#F0FDF4", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: s.is_active ? "#EF4444" : "#16A34A" }}>
                    {s.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(next || prev) && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
          <button onClick={() => prev && load(prev)} disabled={!prev} style={{ padding: "8px 18px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px" }}>&larr; Previous</button>
          <button onClick={() => next && load(next)} disabled={!next} style={{ padding: "8px 18px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px" }}>Next &rarr;</button>
        </div>
      )}

      {modal && (
        <Modal title={modal === "add" ? "Add New Doctor" : `Edit — ${editTarget?.staff?.staff_code}`} onClose={() => setModal(null)}>
          {formError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>{formError}</div>}
          
          <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px" }}>
            <h3 style={{ fontSize: "14px", color: G, marginBottom: "12px", borderBottom: `1px solid ${G}20`, paddingBottom: "4px" }}>Identity & Contact</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
              <Field label="First Name" required><input style={inp} value={form.user.first_name} onChange={e => handleUserChange("first_name", e.target.value)} /></Field>
              <Field label="Last Name" required><input style={inp} value={form.user.last_name} onChange={e => handleUserChange("last_name", e.target.value)} /></Field>
              <Field label="Email" required><input style={inp} type="email" value={form.user.email} onChange={e => handleUserChange("email", e.target.value)} /></Field>
              <Field label="Phone">
                <input style={inp} value={form.phone} maxLength={10} inputMode="numeric"
                  placeholder="Starts with 6-9, 10 digits"
                  onChange={e => handleChange("phone", sanitizePhoneInput(e.target.value))} />
              </Field>
              <Field label="Username"><input style={inp} value={form.user.username} onChange={e => handleUserChange("username", e.target.value)} placeholder="Auto-generated" /></Field>
              <Field label={modal === "add" ? "Password *" : "New Password (optional)"}><input style={inp} type="password" autoComplete="new-password" value={form.user.password} onChange={e => handleUserChange("password", e.target.value)} /></Field>
            </div>

            <h3 style={{ fontSize: "14px", color: G, marginBottom: "12px", borderBottom: `1px solid ${G}20`, paddingBottom: "4px" }}>Professional Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
              <Field label="Specialization"><input style={inp} value={form.specialization} onChange={e => handleChange("specialization", e.target.value)} placeholder="Cardiology, etc." /></Field>
              <Field label="Reg. Number"><input style={inp} value={form.registration_number} onChange={e => handleChange("registration_number", e.target.value)} /></Field>
              <Field label="Department"><input style={inp} value={form.department} onChange={e => handleChange("department", e.target.value)} /></Field>
              <Field label="Consultation Fee (₹)"><input style={inp} type="number" value={form.consultation_fee} onChange={e => handleChange("consultation_fee", e.target.value)} /></Field>
              <Field label="Qualification" required><input style={inp} value={form.qualification} onChange={e => handleChange("qualification", e.target.value)} /></Field>
              <Field label="Date of Birth"><input style={inp} type="date" value={form.date_of_birth} onChange={e => handleChange("date_of_birth", e.target.value)} /></Field>
            </div>

            <h3 style={{ fontSize: "14px", color: G, marginBottom: "12px", borderBottom: `1px solid ${G}20`, paddingBottom: "4px" }}>Administrative</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <Field label="Salary (₹)"><input style={inp} type="number" value={form.salary} onChange={e => handleChange("salary", e.target.value)} /></Field>
              <Field label="Joining Date"><input style={inp} type="date" value={form.joining_date} onChange={e => handleChange("joining_date", e.target.value)} /></Field>
              <div style={{ gridColumn: "1/-1" }}><Field label="Address"><input style={inp} value={form.address} onChange={e => handleChange("address", e.target.value)} /></Field></div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#475569" }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: submitting ? "#93C5FD" : G, cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#fff" }}>
              {submitting ? "Saving…" : modal === "add" ? "Add Doctor" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}