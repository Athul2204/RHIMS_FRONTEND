// src/modules/admin/pages/ManagersPage.jsx
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import {
  getManagerList, createStaff, patchStaff,
  deactivateStaff, reactivateStaff,
} from "../api/adminApi";

const ACCENT = "#EA580C"; // manager orange

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
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
};

const EMPTY = {
  user: { first_name: "", last_name: "", email: "", username: "", password: "" },
  role: "Manager",
  phone: "", date_of_birth: "",
  qualification: "Degree",
  salary: "30000",
  joining_date: new Date().toISOString().split("T")[0],
  address: "",
};

/* ── Helpers ── */
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid #E2E8F0", outline: "none",
  fontSize: "14px", boxSizing: "border-box",
};

const Modal = ({ title, children, onClose }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px", zIndex: 1000, backdropFilter: "blur(4px)",
  }}>
    <div style={{
      background: "#fff", borderRadius: "16px", width: "100%",
      maxWidth: "640px", padding: "24px",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
      maxHeight: "90vh", display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", flexShrink: 0 }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{
          background: "#F1F5F9", border: "none", borderRadius: "8px",
          width: "32px", height: "32px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Ico path={ICONS.close} size={18} color="#64748B" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children, required, span }) => (
  <div style={{ gridColumn: span ? "1/-1" : undefined, marginBottom: 0 }}>
    <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "5px" }}>
      {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════ */
export default function ManagersPage() {
  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const [showAll,    setShowAll]    = useState(false);
  const [count,      setCount]      = useState(0);
  const [next,       setNext]       = useState(null);
  const [prev,       setPrev]       = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);

  const [modal,       setModal]       = useState(null); // null | "add" | "edit"
  const [form,        setForm]        = useState(EMPTY);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState("");
  const [toast, showToast]        = useToast();
  const [editTarget,  setEditTarget]  = useState(null);

  /* ── Load ── */
  const load = useCallback((arg) => {
    setLoading(true);
    setError("");
    const params = typeof arg === "string" ? undefined : { role: "Manager", all: showAll ? "true" : undefined };
    const url    = typeof arg === "string" ? arg : undefined;
    getManagerList(url ?? params)
      .then(d => {
        setList(d.results ?? []);
        setCount(d.count ?? 0);
        setNext(d.next);
        setPrev(d.previous);
        setCurrentUrl(url ?? null);
      })
      .catch(() => setError("Failed to load managers."))
      .finally(() => setLoading(false));
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  /* ── Filter ── */
  const displayed = list.filter(m => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${m.user?.first_name ?? ""} ${m.user?.last_name ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      m.user?.email?.toLowerCase().includes(q) ||
      m.staff_code?.toLowerCase().includes(q)
    );
  });

  /* ── Modal open ── */
  const openAdd = () => {
    setForm(EMPTY);
    setFormError("");
    setEditTarget(null);
    setModal("add");
  };

  const openEdit = (m) => {
    setEditTarget(m);
    setForm({
      user: {
        first_name: m.user?.first_name ?? "",
        last_name:  m.user?.last_name  ?? "",
        email:      m.user?.email      ?? "",
        username:   m.user?.username   ?? "",
        password:   "",
      },
      role:           "Manager",
      phone:          m.phone          ?? "",
      date_of_birth:  m.date_of_birth  ?? "",
      qualification:  m.qualification  ?? "Degree",
      salary:         m.salary         ?? "30000",
      joining_date:   m.joining_date   ?? "",
      address:        m.address        ?? "",
    });
    setFormError("");
    setModal("edit");
  };

  /* ── Handlers ── */
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
      const payload = { ...form, role: "Manager" };
      if (modal === "edit" && !payload.user.password) delete payload.user.password;
      if (!payload.user.username) delete payload.user.username;
      if (payload.salary === "" || payload.salary === null) delete payload.salary;
      else payload.salary = parseInt(payload.salary, 10);

      if (modal === "add") {
        await createStaff(payload);
      } else {
        await patchStaff(editTarget.id, payload);
      }

      setModal(null);
      showToast(modal === "add" ? "Manager added successfully!" : "Manager updated successfully!");
      load(currentUrl);
    } catch (err) {
      const backendErrors = err?.response?.data?.errors || err?.response?.data;
      if (backendErrors && typeof backendErrors === "object") {
        const flat = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([k, v]) => {
            const label = prefix ? `${prefix} → ${k}` : k;
            if (Array.isArray(v))                   flat.push(`${label}: ${v.join(" ")}`);
            else if (typeof v === "object" && v)    extract(v, label);
            else                                    flat.push(`${label}: ${v}`);
          });
        };
        extract(backendErrors);
        setFormError(flat.join(" | "));
      } else {
        setFormError(err?.message ?? "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (m) => {
    try {
      if (m.is_active) await deactivateStaff(m.id);
      else             await reactivateStaff(m.id);
      load(currentUrl);
    } catch {
      showToast("Action failed. Please try again.", false);
    }
  };

  /* ══════════════════════════════════════ RENDER ══════════════════════════════════════ */
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", margin: "-20px -16px", padding: "24px" }}>
      <Toast toast={toast} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Managers</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px", margin: "3px 0 0" }}>
            {count} manager{count !== 1 ? "s" : ""} total
          </p>
        </div>
        <button onClick={openAdd} style={{
          display: "flex", alignItems: "center", gap: "7px",
          background: ACCENT, color: "#fff", border: "none",
          borderRadius: "10px", padding: "10px 18px",
          fontSize: "13px", fontWeight: 600, cursor: "pointer",
        }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add Manager
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{
        background: "#fff", borderRadius: "14px", padding: "14px 16px",
        border: "1px solid #F1F5F9", marginBottom: "16px",
        display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
            <Ico path={ICONS.search} size={15} color="#94A3B8" />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or staff code…"
            style={{ ...inp, paddingLeft: "34px" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", color: "#475569", cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}
            style={{ accentColor: ACCENT }} />
          Show inactive
        </label>
        <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "auto" }}>
          {displayed.length} of {count} shown
        </span>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: "16px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: "180px", borderRadius: "14px", background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "14px", padding: "64px", textAlign: "center", border: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>👔</div>
          <p style={{ color: "#94A3B8", fontSize: "14px", margin: 0 }}>No managers found.</p>
          <p style={{ color: "#CBD5E1", fontSize: "13px", marginTop: "6px" }}>Add a manager using the button above.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: "16px" }}>
          {displayed.map(m => (
            <div key={m.id} style={{
              background: "#fff", borderRadius: "14px", padding: "20px",
              border: `1px solid ${m.is_active ? "#F1F5F9" : "#FEE2E2"}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: "#FFEDD5", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "17px", fontWeight: 700, color: ACCENT,
                  }}>
                    {(m.user?.first_name?.[0] ?? "M").toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>
                      {m.user?.first_name} {m.user?.last_name}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{m.staff_code}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: "11px", padding: "3px 9px", borderRadius: "20px",
                  background: m.is_active ? "#FFEDD5" : "#FEE2E2",
                  color:      m.is_active ? "#C2410C" : "#DC2626",
                  fontWeight: 600,
                }}>
                  {m.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Card body */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px" }}>
                <Row label="Email"         value={m.user?.email  ?? "—"} />
                <Row label="Phone"         value={m.phone        ?? "—"} />
                <Row label="Qualification" value={m.qualification ?? "—"} />
                <Row label="Salary"        value={m.salary ? `₹${Number(m.salary).toLocaleString()}` : "—"} />
                <Row label="Joining"       value={m.joining_date ?? "—"} />
              </div>

              {/* Card actions */}
              <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #F8FAFC", paddingTop: "12px" }}>
                <button onClick={() => openEdit(m)} style={{
                  flex: 1, padding: "7px", borderRadius: "8px",
                  border: `1px solid #FED7AA`, background: "#FFF7ED",
                  cursor: "pointer", fontSize: "12px", fontWeight: 500, color: ACCENT,
                }}>Edit</button>
                <button onClick={() => toggleStatus(m)} style={{
                  flex: 1, padding: "7px", borderRadius: "8px",
                  border: `1px solid ${m.is_active ? "#FECACA" : "#BBF7D0"}`,
                  background: m.is_active ? "#FEF2F2" : "#F0FDF4",
                  cursor: "pointer", fontSize: "12px", fontWeight: 500,
                  color: m.is_active ? "#EF4444" : "#16A34A",
                }}>
                  {m.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {(next || prev) && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
          <button onClick={() => prev && load(prev)} disabled={!prev}
            style={{ padding: "8px 18px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px" }}>
            ← Previous
          </button>
          <button onClick={() => next && load(next)} disabled={!next}
            style={{ padding: "8px 18px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px" }}>
            Next →
          </button>
        </div>
      )}

      {/* ══ Modal ══ */}
      {modal && (
        <Modal
          title={modal === "add" ? "Add New Manager" : `Edit — ${editTarget?.staff_code ?? editTarget?.user?.username}`}
          onClose={() => setModal(null)}
        >
          {formError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", flexShrink: 0 }}>
              {formError}
            </div>
          )}

          <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <Field label="First Name" required>
                <input style={inp} value={form.user.first_name}
                  onChange={e => handleUserChange("first_name", e.target.value)}
                  placeholder="First name" />
              </Field>
              <Field label="Last Name" required>
                <input style={inp} value={form.user.last_name}
                  onChange={e => handleUserChange("last_name", e.target.value)}
                  placeholder="Last name" />
              </Field>
              <Field label="Email" required>
                <input style={inp} type="email" value={form.user.email}
                  onChange={e => handleUserChange("email", e.target.value)}
                  placeholder="email@hospital.com" />
              </Field>
              <Field label="Phone">
                <input style={inp} value={form.phone} maxLength={10} inputMode="numeric"
                  onChange={e => handleChange("phone", sanitizePhoneInput(e.target.value))}
                  placeholder="Starts with 6-9, 10 digits" />
              </Field>
              <Field label="Username">
                <input style={inp} value={form.user.username}
                  onChange={e => handleUserChange("username", e.target.value)}
                  placeholder="Auto-generated if blank" />
              </Field>
              <Field label={modal === "add" ? "Password *" : "New Password (leave blank to keep)"}>
                <input style={inp} type="password" autoComplete="new-password" value={form.user.password}
                  onChange={e => handleUserChange("password", e.target.value)}
                  placeholder={modal === "add" ? "Min 8 characters" : "Leave blank to keep current"} />
              </Field>
              <Field label="Qualification" required>
                <input style={inp} value={form.qualification}
                  onChange={e => handleChange("qualification", e.target.value)}
                  placeholder="e.g. MBA, BBA, Graduation" />
              </Field>
              <Field label="Salary (₹)">
                <input style={inp} type="number" value={form.salary}
                  onChange={e => handleChange("salary", e.target.value)}
                  placeholder="30000" />
              </Field>
              <Field label="Date of Birth">
                <input style={inp} type="date" value={form.date_of_birth}
                  onChange={e => handleChange("date_of_birth", e.target.value)} />
              </Field>
              <Field label="Joining Date">
                <input style={inp} type="date" value={form.joining_date}
                  onChange={e => handleChange("joining_date", e.target.value)} />
              </Field>
              <Field label="Address" span>
                <input style={inp} value={form.address}
                  onChange={e => handleChange("address", e.target.value)}
                  placeholder="Full address" />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
            <button onClick={() => setModal(null)} style={{
              padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0",
              background: "#fff", cursor: "pointer", fontSize: "13px", color: "#475569",
            }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} style={{
              padding: "9px 22px", borderRadius: "9px", border: "none",
              background: submitting ? "#FED7AA" : ACCENT,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: 600, color: "#fff",
            }}>
              {submitting ? "Saving…" : modal === "add" ? "Add Manager" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

/* small helper row */
function Row({ label, value }) {
  return (
    <div style={{ fontSize: "12px", color: "#64748B" }}>
      <strong style={{ color: "#475569" }}>{label}:</strong> {value}
    </div>
  );
}