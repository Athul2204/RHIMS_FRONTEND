// src/modules/admin/pages/StaffPage.jsx
import { useEffect, useState, useCallback } from "react";
import {
  getStaffList, createStaff, patchStaff,
  deactivateStaff, reactivateStaff,
} from "../api/adminApi";
import { Toast, useToast } from "../../../components/shared/Toast";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";

const G = "#16A34A";

const Ico = ({ path, size = 16, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus:   "M12 5v14 M5 12h14",
  edit:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  deact:  "M18 6L6 18 M6 6l12 12",
  react:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4",
  close:  "M18 6L6 18 M6 6l12 12",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  chev:   "M9 18l6-6-6-6",
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
};

const ROLE_COLORS = {
  Doctor:           { bg: "#DBEAFE", color: "#1D4ED8" },
  Receptionist:     { bg: "#DCFCE7", color: "#15803D" },
  Pharmacist:       { bg: "#EDE9FE", color: "#6D28D9" },
  "Lab Technician": { bg: "#FEF3C7", color: "#D97706" },
  Admin:            { bg: "#FCE7F3", color: "#BE185D" },
  Manager:          { bg: "#FFEDD5", color: "#C2410C" },
};

const RoleBadge = ({ role }) => {
  const s = ROLE_COLORS[role] ?? { bg: "#F1F5F9", color: "#475569" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: s.bg, color: s.color }}>
      {role}
    </span>
  );
};

const StatusDot = ({ active }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: active ? G : "#EF4444", fontWeight: 500 }}>
    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: active ? G : "#EF4444" }} />
    {active ? "Active" : "Inactive"}
  </span>
);

/* ── Input ── */
const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>
      {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
    {children}
  </div>
);

const inp = {
  width: "100%", padding: "9px 12px", borderRadius: "9px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", background: "#fff", boxSizing: "border-box",
};

const ROLES = ["Doctor", "Receptionist", "Pharmacist", "Lab Technician", "Admin", "Manager"];
const SALARY_TYPES = ["Monthly", "Weekly", "Daily"];
const EMPTY_FORM = {
  user: { username: "", first_name: "", last_name: "", email: "", password: "" },
  role: "Doctor", phone: "", date_of_birth: "", address: "",
  qualification: "", salary: "25000", joining_date: new Date().toISOString().split("T")[0],
  salary_type: "Monthly", daily_rate: "", weekly_rate: "",
};

/* ── Modal ── */
const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
    <div style={{
      position: "relative", background: "#fff", borderRadius: "16px",
      width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "28px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "20px", color: "#64748B", lineHeight: 1 }}>&times;</span>
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function StaffPage() {
  const [staff, setStaff]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showAll, setShowAll]       = useState(false);
  const [next, setNext]             = useState(null);
  const [prev, setPrev]             = useState(null);
  const [count, setCount]           = useState(0);
  const [currentUrl, setCurrentUrl] = useState(null);

  const [modal, setModal]           = useState(null); // null | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [toast, showToast]          = useToast();

  const buildUrl = useCallback(() => {
    let url = `/administration/staff/?`;
    if (showAll) url += "all=true&";
    if (roleFilter) url += `role=${encodeURIComponent(roleFilter)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    return url;
  }, [showAll, roleFilter, search]);

  const loadStaff = useCallback((url) => {
    setLoading(true);
    getStaffList(url)
      .then(data => {
        setStaff(data.results ?? []);
        setCount(data.count ?? 0);
        setNext(data.next ?? null);
        setPrev(data.previous ?? null);
        setCurrentUrl(url);
      })
      .catch(() => setError("Failed to load staff list."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStaff(buildUrl()); }, [buildUrl]);

  /* -- filtered locally (search applied server-side via url if supported, otherwise client-side) */
  const displayed = staff.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${s.user?.first_name ?? ""} ${s.user?.last_name ?? ""}`.toLowerCase();
    return name.includes(q) || s.user?.username?.toLowerCase().includes(q)
      || s.user?.email?.toLowerCase().includes(q) || s.staff_code?.toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(EMPTY_FORM); setFormError(""); setModal("add"); };
  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      user: {
        username: s.user?.username ?? "", first_name: s.user?.first_name ?? "",
        last_name: s.user?.last_name ?? "", email: s.user?.email ?? "", password: "",
      },
      role: s.role ?? "Doctor",
      phone: s.phone ?? "", date_of_birth: s.date_of_birth ?? "",
      address: s.address ?? "", qualification: s.qualification ?? "",
      salary: s.salary ?? "", joining_date: s.joining_date ?? "",
      salary_type: s.salary_type ?? "Monthly",
      daily_rate: s.daily_rate ?? "", weekly_rate: s.weekly_rate ?? "",
    });
    setFormError("");
    setModal("edit");
  };

  const handleFormChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const handleUserChange = (field, value) => setForm(f => ({ ...f, user: { ...f.user, [field]: value } }));

  const handleSubmit = async () => {
    if (form.phone?.trim() && !isValidPhone(form.phone)) {
      setFormError(PHONE_ERROR_MESSAGE);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = { ...form };

      // Clean payload: remove empty strings for numeric/date fields or nested objects
      if (!payload.user.password && modal === "edit") delete payload.user.password;
      if (!payload.user.username) delete payload.user.username;

      if (payload.role === "Lab Technician") {
        // Lab Technicians are only issued login credentials to mark
        // attendance and record their work — the hospital does not pay
        // their salary through this system, so none of these are sent.
        delete payload.salary;
        delete payload.salary_type;
        delete payload.daily_rate;
        delete payload.weekly_rate;
      } else if (payload.salary === "" || payload.salary === null) {
        delete payload.salary; // let backend use default
      } else {
        payload.salary = parseInt(payload.salary, 10);
      }

      // Reference rate fields — send 0.00 rather than blank strings.
      if (payload.role !== "Lab Technician") {
        payload.daily_rate  = payload.daily_rate === ""  ? "0.00" : payload.daily_rate;
        payload.weekly_rate = payload.weekly_rate === "" ? "0.00" : payload.weekly_rate;
      }

      if (modal === "add") {
        await createStaff(payload);
      } else {
        await patchStaff(editTarget.id, payload);
      }
      setModal(null);
      showToast(modal === "add" ? "Staff member added!" : "Staff member updated!");
      loadStaff(currentUrl ?? buildUrl());
    } catch (err) {
      console.error("Form error:", err);
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
      } else if (typeof err === "string") {
        msg = err;
      } else if (err.message) {
        msg = err.message;
      }
      
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (s) => {
    if (!window.confirm(`${s.is_active ? "Deactivate" : "Reactivate"} ${s.staff_code}?`)) return;
    try {
      if (s.is_active) await deactivateStaff(s.id);
      else await reactivateStaff(s.id);
      loadStaff(currentUrl ?? buildUrl());
    } catch {
      showToast("Action failed. Please try again.", false);
    }
  };

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", margin: "-20px -16px", padding: "24px" }}>
      <Toast toast={toast} />

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Staff Management</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{count} total records</p>
        </div>
        <button onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: "7px", background: G, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add Staff
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>
      )}

      {/* toolbar */}
      <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
            <Ico path={ICONS.search} size={15} color="#94A3B8" />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, code…"
            style={{ ...inp, paddingLeft: "34px" }} />
        </div>

        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ ...inp, width: "auto", minWidth: "150px", cursor: "pointer" }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}
            style={{ accentColor: G }} />
          Show inactive
        </label>

        <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "auto" }}>
          {displayed.length} of {count} shown
        </span>
      </div>

      {/* table */}
      <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFC" }}>
              <tr>
                {["Staff Code", "Name", "Role", "Phone", "Email", "Joined", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #F8FAFC" }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} style={{ padding: "14px" }}>
                        <div style={{ height: "14px", borderRadius: "4px", background: "#F1F5F9", animation: "pulse 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                    <Ico path={ICONS.user} size={36} color="#CBD5E1" /><br />
                    <span style={{ marginTop: "8px", display: "block" }}>No staff found.</span>
                  </td>
                </tr>
              ) : (
                displayed.map(s => (
                  <tr key={s.id} style={{ borderTop: "1px solid #F8FAFC", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "12px", background: "#F1F5F9", padding: "3px 8px", borderRadius: "6px", color: "#475569", fontWeight: 600 }}>
                        {s.staff_code}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                          background: `${ROLE_COLORS[s.role]?.bg ?? "#F1F5F9"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: 700,
                          color: ROLE_COLORS[s.role]?.color ?? "#475569",
                        }}>
                          {(s.user?.first_name?.[0] ?? s.user?.username?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                            {s.user?.first_name} {s.user?.last_name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>@{s.user?.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}><RoleBadge role={s.role} /></td>
                    <td style={{ padding: "12px 14px", fontSize: "13px", color: "#475569" }}>{s.phone ?? "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: "13px", color: "#475569" }}>{s.user?.email ?? "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap" }}>
                      {s.joining_date ? new Date(s.joining_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusDot active={s.is_active} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button onClick={() => openEdit(s)} title="Edit"
                          style={{ background: "#EFF6FF", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", display: "flex" }}>
                          <Ico path={ICONS.edit} size={14} color="#3B82F6" />
                        </button>
                        <button onClick={() => handleToggleStatus(s)}
                          title={s.is_active ? "Deactivate" : "Reactivate"}
                          style={{ background: s.is_active ? "#FEF2F2" : "#F0FDF4", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", display: "flex" }}>
                          <Ico path={s.is_active ? ICONS.deact : ICONS.react} size={14} color={s.is_active ? "#EF4444" : G} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {(next || prev) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => prev && loadStaff(prev)} disabled={!prev}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px", color: prev ? "#1E293B" : "#CBD5E1" }}>
              ← Previous
            </button>
            <span style={{ fontSize: "13px", color: "#64748B" }}>{count} total</span>
            <button onClick={() => next && loadStaff(next)} disabled={!next}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px", color: next ? "#1E293B" : "#CBD5E1" }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {modal && (
        <Modal title={modal === "add" ? "Add New Staff Member" : `Edit — ${editTarget?.staff_code}`} onClose={() => setModal(null)}>
          {formError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>{formError}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Field label="First Name" required>
              <input style={inp} value={form.user.first_name}
                onChange={e => handleUserChange("first_name", e.target.value)} placeholder="John" />
            </Field>
            <Field label="Last Name" required>
              <input style={inp} value={form.user.last_name}
                onChange={e => handleUserChange("last_name", e.target.value)} placeholder="Doe" />
            </Field>
            <Field label="Email" required>
              <input style={inp} type="email" value={form.user.email}
                onChange={e => handleUserChange("email", e.target.value)} placeholder="john@hospital.com" />
            </Field>
            <Field label="Username">
              <input style={inp} value={form.user.username}
                onChange={e => handleUserChange("username", e.target.value)} placeholder="Auto-generated from email" />
            </Field>
            <Field label={modal === "add" ? "Password *" : "Password (leave blank to keep)"}>
              <input style={inp} type="password" autoComplete="new-password" value={form.user.password}
                onChange={e => handleUserChange("password", e.target.value)} placeholder="Min 8 characters" />
            </Field>
            <Field label="Role" required>
              <select style={{ ...inp, cursor: "pointer" }} value={form.role}
                onChange={e => handleFormChange("role", e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Phone">
              <input style={inp} value={form.phone} maxLength={10} inputMode="numeric"
                onChange={e => handleFormChange("phone", sanitizePhoneInput(e.target.value))} placeholder="Starts with 6-9, 10 digits" />
            </Field>
            <Field label="Date of Birth">
              <input style={inp} type="date" value={form.date_of_birth}
                onChange={e => handleFormChange("date_of_birth", e.target.value)} />
            </Field>
            <Field label="Qualification" required>
              <input style={inp} value={form.qualification}
                onChange={e => handleFormChange("qualification", e.target.value)}
                placeholder={form.role === "Doctor" ? "MBBS / MD" : form.role === "Pharmacist" ? "B.Pharm" : "Degree"} />
            </Field>
            {form.role === "Lab Technician" ? (
              <div style={{ gridColumn: "1/-1", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#92400E" }}>
                Lab Technicians are only given login credentials to mark attendance and record their work — the hospital does not process their salary through this system, so no salary field is collected here.
              </div>
            ) : (
              <>
                <Field label="Pay Basis" required>
                  <select style={{ ...inp, cursor: "pointer" }} value={form.salary_type}
                    onChange={e => handleFormChange("salary_type", e.target.value)}>
                    {SALARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Salary (₹) — Monthly">
                  <input style={inp} type="number" value={form.salary}
                    onChange={e => handleFormChange("salary", e.target.value)} placeholder="30000" />
                </Field>
                {form.salary_type === "Daily" && (
                  <Field label="Daily Rate (₹)">
                    <input style={inp} type="number" min="0" value={form.daily_rate}
                      onChange={e => handleFormChange("daily_rate", e.target.value)} placeholder="e.g. 1200" />
                  </Field>
                )}
                {form.salary_type === "Weekly" && (
                  <Field label="Weekly Rate (₹)">
                    <input style={inp} type="number" min="0" value={form.weekly_rate}
                      onChange={e => handleFormChange("weekly_rate", e.target.value)} placeholder="e.g. 7000" />
                  </Field>
                )}
              </>
            )}
            <Field label="Joining Date">
              <input style={inp} type="date" value={form.joining_date}
                onChange={e => handleFormChange("joining_date", e.target.value)} />
            </Field>
            <Field label="Address">
              <input style={inp} value={form.address}
                onChange={e => handleFormChange("address", e.target.value)} placeholder="City, State" />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)}
              style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#475569" }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: submitting ? "#86EFAC" : G, cursor: submitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, color: "#fff", minWidth: "110px" }}>
              {submitting ? "Saving…" : modal === "add" ? "Create Staff" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  );
}