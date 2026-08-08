// src/modules/admin/pages/ReceptionistsPage.jsx
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import {
  getReceptionistList, createStaff, patchStaff,
  deactivateStaff, reactivateStaff, patchReceptionist
} from "../api/adminApi";
import useBranchScope from "../hooks/useBranchScope";

const G = "#10B981"; // Reception theme green

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
  close:  "M18 6L6 18 M6 6l12 12",
  recept: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
};

const EMPTY = {
  user: { first_name: "", last_name: "", email: "", username: "", password: "" },
  role: "Receptionist", phone: "", date_of_birth: "", qualification: "Graduation",
  salary: "20000", joining_date: new Date().toISOString().split("T")[0], address: "",
  branch: "",
};

const Modal = ({ title, children, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000, backdropFilter: "blur(4px)" }}>
    <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "620px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico path={ICONS.close} size={18} color="#64748B" />
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

const inp = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", outline: "none", fontSize: "14px", boxSizing: "border-box" };

export default function ReceptionistsPage() {
  const { isGroupAdmin, branches, selectedBranch, listParams } = useBranchScope();
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
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
    const request = arg ?? listParams;
    getReceptionistList(request)
      .then(d => {
        setList(d.results ?? []);
        setCount(d.count ?? 0);
        setNext(d.next);
        setPrev(d.previous);
        setCurrentUrl(arg);
      })
      .catch(() => setError("Failed to load receptionists."))
      .finally(() => setLoading(false));
  }, [listParams]);

  useEffect(() => { load(); }, [load]);

  const displayed = list.filter(r => {
    const q = search.toLowerCase();
    if (!q) return true;
    const s = r.staff ?? {};
    const name = `${s.user?.first_name ?? ""} ${s.user?.last_name ?? ""}`.toLowerCase();
    return name.includes(q) || s.user?.email?.toLowerCase().includes(q) || s.staff_code?.toLowerCase().includes(q);
  });

  const openAdd = () => {
    // Default (and see below: lock) the new record's branch to whatever
    // is currently narrowed in the header switcher, so "viewing Madathara"
    // can't silently create a record under Trivandrum.
    setForm({ ...EMPTY, branch: selectedBranch ?? "" });
    setFormError("");
    setModal("add");
  };
  const openEdit = (rec) => {
    const s = rec.staff ?? {};
    setEditTarget(rec);
    setForm({
      user: { first_name: s.user?.first_name ?? "", last_name: s.user?.last_name ?? "", email: s.user?.email ?? "", username: s.user?.username ?? "", password: "" },
      role: "Receptionist", phone: s.phone ?? "", date_of_birth: s.date_of_birth ?? "",
      qualification: s.qualification ?? "Graduation", salary: s.salary ?? "", joining_date: s.joining_date ?? "", address: s.address ?? "",
      branch: s.branch ?? "",
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
      const payload = { ...form };
      if (modal === "edit" && !payload.user.password) delete payload.user.password;
      if (!payload.user.username) delete payload.user.username;

      if (payload.salary === "" || payload.salary === null) delete payload.salary;
      else payload.salary = parseInt(payload.salary, 10);

      // Branch is only ever picked explicitly by a group admin — a
      // branch-scoped admin's staff always belongs to their own branch,
      // resolved automatically server-side.
      if (!isGroupAdmin || !payload.branch) {
        delete payload.branch;
      } else {
        payload.branch = Number(payload.branch);
      }

      if (modal === "add") {
        await createStaff(payload);
      } else {
        const staffId = editTarget?.staff?.id;
        if (staffId) await patchStaff(staffId, payload);
        
        // Conditional patch for profile if role is still Receptionist
        if (payload.role === "Receptionist") {
           await patchReceptionist(editTarget.profile_id, {}); // No extra fields yet, but keeps it consistent
        }
      }

      setModal(null);
      showToast(modal === "add" ? "Receptionist added!" : "Receptionist updated!");
      load(currentUrl);
    } catch (err) {
      console.error("Receptionist form error:", err);
      let msg = "Something went wrong.";
      const backendErrors = err?.response?.data?.errors || err?.response?.data;

      if (backendErrors && typeof backendErrors === "object") {
        const flatErrors = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([key, val]) => {
            const label = prefix ? `${prefix} ${key}` : key;
            if (Array.isArray(val)) flatErrors.push(`${label}: ${val.join(" ")}`);
            else if (typeof val === "object" && val !== null) extract(val, label);
            else flatErrors.push(`${label}: ${val}`);
          });
        };
        extract(backendErrors);
        msg = flatErrors.join(" | ");
      } else if (err.message) msg = err.message;
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
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Receptionists</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{count} total</p>
        </div>
        <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: "7px", background: G, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add Receptionist
        </button>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>}

      <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", border: "1px solid #F1F5F9", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}><Ico path={ICONS.search} size={15} color="#94A3B8" /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or code…" style={{ ...inp, paddingLeft: "34px" }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "16px" }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: "160px", borderRadius: "14px", background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "14px", padding: "64px", textAlign: "center", border: "1px solid #F1F5F9" }}>
          <p style={{ color: "#94A3B8" }}>No receptionists found.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "16px" }}>
          {displayed.map(r => {
            const s = r.staff || {};
            return (
              <div key={r.profile_id} style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: `1px solid ${s.is_active ? "#F1F5F9" : "#FEE2E2"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: G }}>
                      {(s.user?.first_name?.[0] ?? "R").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{s.user?.first_name} {s.user?.last_name}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>{s.staff_code}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: s.is_active ? "#D1FAE5" : "#FEE2E2", color: s.is_active ? "#065F46" : "#DC2626", fontWeight: 600 }}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Qualification:</strong> {s.qualification}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Phone:</strong> {s.phone ?? "—"}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}><strong>Salary:</strong> ₹{s.salary}</div>
                  {isGroupAdmin && (
                    <div style={{ fontSize: "12px", color: "#64748B" }}>
                      <strong>Branch:</strong> {(() => {
                        const b = branches.find(b => b.branch_id === s.branch);
                        return b ? `${b.name} (${b.code})` : "—";
                      })()}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #F8FAFC", paddingTop: "12px" }}>
                  <button onClick={() => openEdit(r)} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: `1px solid #D1FAE5`, background: "#ECFDF5", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: G }}>Edit</button>
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
        <Modal title={modal === "add" ? "Add New Receptionist" : `Edit — ${editTarget?.staff?.staff_code}`} onClose={() => setModal(null)}>
          {formError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>{formError}</div>}
          
          <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px" }}>
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
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
              <Field label="Qualification" required><input style={inp} value={form.qualification} onChange={e => handleChange("qualification", e.target.value)} /></Field>
              <Field label="Salary (₹)"><input style={inp} type="number" value={form.salary} onChange={e => handleChange("salary", e.target.value)} /></Field>
              <Field label="Joining Date"><input style={inp} type="date" value={form.joining_date} onChange={e => handleChange("joining_date", e.target.value)} /></Field>
              <Field label="Date of Birth"><input style={inp} type="date" value={form.date_of_birth} onChange={e => handleChange("date_of_birth", e.target.value)} /></Field>
              {isGroupAdmin && (
                <Field label="Branch" required>
                  {modal === "add" && selectedBranch ? (
                    <div style={{ ...inp, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", color: "#475569" }}>
                      <span>{branches.find(b => b.branch_id === selectedBranch)?.name ?? "Selected branch"}</span>
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>locked to header selection</span>
                    </div>
                  ) : (
                    <select style={{ ...inp, cursor: "pointer" }} value={form.branch} onChange={e => handleChange("branch", e.target.value)}>
                      <option value="">— Select a branch —</option>
                      {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.name} ({b.code})</option>)}
                    </select>
                  )}
                </Field>
              )}
              <div style={{ gridColumn: "1/-1" }}><Field label="Address"><input style={inp} value={form.address} onChange={e => handleChange("address", e.target.value)} /></Field></div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#475569" }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: submitting ? "#6EE7B7" : G, cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#fff" }}>
              {submitting ? "Saving…" : modal === "add" ? "Add Receptionist" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}