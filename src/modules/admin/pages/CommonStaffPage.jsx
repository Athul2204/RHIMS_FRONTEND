// src/modules/admin/pages/CommonStaffPage.jsx
//
// Shared UI for the two "common staff" account types — Common Receptionist
// and Common Pharmacist. Both are login-only accounts (username + password)
// admin-managed the same way Guest Doctor accounts are, so this component
// mirrors GuestDoctorsPage.jsx exactly and is parametrized by API functions
// + labels. See CommonReceptionistsPage.jsx / CommonPharmacistsPage.jsx for
// the thin wrappers that supply those props.
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";

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
  deact:  "M18 6L6 18 M6 6l12 12",
  react:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4",
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  key:    "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  eye:    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  eyeOff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22",
};

const inp = {
  width: "100%", padding: "9px 12px", borderRadius: "9px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", background: "#fff", boxSizing: "border-box",
};

const StatusDot = ({ active }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: active ? "#16A34A" : "#EF4444", fontWeight: 500 }}>
    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: active ? "#16A34A" : "#EF4444" }} />
    {active ? "Active" : "Inactive"}
  </span>
);

const Field = ({ label, required, hint, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>
      {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: "11.5px", color: "#94A3B8", margin: 0 }}>{hint}</p>}
  </div>
);

const Modal = ({ title, subtitle, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
    <div style={{
      position: "relative", background: "#fff", borderRadius: "16px",
      width: "100%", maxWidth: "440px",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "28px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "20px", color: "#64748B", lineHeight: 1 }}>&times;</span>
        </button>
      </div>
      {children}
    </div>
  </div>
);

const EMPTY_FORM = { username: "", password: "", email: "" };

/**
 * @param {object} props
 * @param {string} props.entityLabel     Singular display label, e.g. "Common Receptionist"
 * @param {string} props.entityLabelPlural  Plural display label, e.g. "Common Receptionists"
 * @param {string} props.idField         Row primary-key field, e.g. "common_receptionist_id"
 * @param {string} props.basePath        Backend list path, e.g. "/administration/common-receptionists/"
 * @param {string} [props.accentColor]   Hex accent color (defaults to guest-doctor cyan)
 * @param {object} props.api             { list, create, patch, deactivate, reactivate }
 */
export default function CommonStaffPage({
  entityLabel,
  entityLabelPlural,
  idField,
  basePath,
  accentColor = "#06B6D4",
  api,
}) {
  const G = accentColor;
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [showAll, setShowAll]       = useState(false);
  const [count, setCount]           = useState(0);
  const [next, setNext]             = useState(null);
  const [prev, setPrev]             = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);

  const [modal, setModal]           = useState(null); // null | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [showPass, setShowPass]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [toast, showToast]        = useToast();

  // ── Build URL ───────────────────────────────────────────────────────────
  const buildUrl = useCallback(() => {
    let url = `${basePath}?`;
    if (showAll) url += "all=true&";
    if (search)  url += `search=${encodeURIComponent(search)}&`;
    return url;
  }, [showAll, search, basePath]);

  // ── Load ────────────────────────────────────────────────────────────────
  const loadRows = useCallback((url) => {
    setLoading(true);
    api.list(url)
      .then(data => {
        setRows(data.results ?? []);
        setCount(data.count ?? 0);
        setNext(data.next ?? null);
        setPrev(data.previous ?? null);
        setCurrentUrl(url);
      })
      .catch(() => setError(`Failed to load ${entityLabelPlural.toLowerCase()}.`))
      .finally(() => setLoading(false));
  }, [api, entityLabelPlural]);

  useEffect(() => { loadRows(buildUrl()); }, [buildUrl, loadRows]);

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowPass(false);
    setModal("add");
  };

  const openEdit = (r) => {
    setEditTarget(r);
    setForm({
      username: r.username ?? "",
      password: "",   // never pre-fill
      email:    r.email ?? "",
    });
    setFormError("");
    setShowPass(false);
    setModal("edit");
  };

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.username.trim()) { setFormError("Username is required."); return; }
    if (modal === "add" && !form.password.trim()) { setFormError("Password is required."); return; }

    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        // Create with the username as a placeholder name — the account
        // holder's actual name can be filled in later via edit.
        ...(modal === "add" ? { full_name: form.username.trim() } : {}),
        user_credentials: {
          username: form.username.trim(),
          email:    form.email.trim(),
          ...(form.password.trim() ? { password: form.password } : {}),
        },
      };

      if (modal === "add") {
        await api.create(payload);
      } else {
        await api.patch(editTarget[idField], payload);
      }

      setModal(null);
      showToast(modal === "add" ? `${entityLabel} added!` : `${entityLabel} updated!`);
      loadRows(currentUrl ?? buildUrl());
    } catch (err) {
      const backendErrors = err?.response?.data?.errors || err?.response?.data;
      if (backendErrors && typeof backendErrors === "object") {
        const flat = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([k, v]) => {
            const label = prefix ? `${prefix} › ${k}` : k;
            if (Array.isArray(v))                flat.push(`${label}: ${v.join(" ")}`);
            else if (typeof v === "object" && v) extract(v, label);
            else                                 flat.push(`${label}: ${v}`);
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

  // ── Toggle status ────────────────────────────────────────────────────────
  const handleToggleStatus = async (r) => {
    if (!window.confirm(`${r.is_active ? "Deactivate" : "Reactivate"} ${r.common_code}?`)) return;
    try {
      if (r.is_active) await api.deactivate(r[idField]);
      else             await api.reactivate(r[idField]);
      loadRows(currentUrl ?? buildUrl());
    } catch {
      showToast("Action failed. Please try again.", false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", margin: "-20px -16px", padding: "24px" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>{entityLabelPlural}</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{count} total records</p>
        </div>
        <button onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: "7px", background: G, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add {entityLabel}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>
      )}

      {/* Toolbar */}
      <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
            <Ico path={ICONS.search} size={15} color="#94A3B8" />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            style={{ ...inp, paddingLeft: "34px" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} style={{ accentColor: G }} />
          Show inactive
        </label>
        <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "auto" }}>{rows.length} of {count} shown</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFC" }}>
              <tr>
                {["Code", "Name", "Login", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #F8FAFC" }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={{ padding: "14px" }}>
                        <div style={{ height: "14px", borderRadius: "4px", background: "#F1F5F9", animation: "pulse 1.5s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                    <Ico path={ICONS.user} size={36} color="#CBD5E1" /><br />
                    <span style={{ marginTop: "8px", display: "block" }}>No {entityLabelPlural.toLowerCase()} found.</span>
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r[idField]}
                    style={{ borderTop: "1px solid #F8FAFC", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "12px", background: "#F0FDFA", padding: "3px 8px", borderRadius: "6px", color: "#0E7490", fontWeight: 600 }}>
                        {r.common_code}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: G, flexShrink: 0 }}>
                          {(r.full_name?.[0] ?? "?").toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>{r.full_name || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {r.username ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", background: "#DBEAFE", color: "#1D4ED8", padding: "3px 9px", borderRadius: "20px", fontWeight: 600 }}>
                          <Ico path={ICONS.key} size={11} color="#1D4ED8" />
                          @{r.username}
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#CBD5E1" }}>No login</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusDot active={r.is_active} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button onClick={() => openEdit(r)} title="Edit credentials"
                          style={{ background: "#EFF6FF", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", display: "flex" }}>
                          <Ico path={ICONS.edit} size={14} color="#3B82F6" />
                        </button>
                        <button onClick={() => handleToggleStatus(r)}
                          title={r.is_active ? "Deactivate" : "Reactivate"}
                          style={{ background: r.is_active ? "#FEF2F2" : "#F0FDF4", border: "none", borderRadius: "7px", padding: "6px", cursor: "pointer", display: "flex" }}>
                          <Ico path={r.is_active ? ICONS.deact : ICONS.react} size={14} color={r.is_active ? "#EF4444" : "#16A34A"} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(next || prev) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => prev && loadRows(prev)} disabled={!prev}
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px", color: prev ? "#1E293B" : "#CBD5E1" }}>
              ← Previous
            </button>
            <span style={{ fontSize: "13px", color: "#64748B" }}>{count} total</span>
            <button onClick={() => next && loadRows(next)} disabled={!next}
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px", color: next ? "#1E293B" : "#CBD5E1" }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {modal && (
        <Modal
          title={modal === "add" ? `Add ${entityLabel}` : `Edit Credentials — ${editTarget?.common_code}`}
          subtitle={
            modal === "add"
              ? "Only login credentials are needed. The name can be updated later."
              : `Update the login credentials for this ${entityLabel.toLowerCase()} account.`
          }
          onClose={() => setModal(null)}
        >
          {formError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Field label="Username" required>
              <input style={inp} value={form.username}
                onChange={e => set("username", e.target.value)}
                placeholder="username1"
                autoComplete="new-password" />
            </Field>

            <Field label="Email">
              <input style={inp} type="email" value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="staff@hospital.com" />
            </Field>

            <Field
              label="Password"
              required={modal === "add"}
              hint={modal === "edit" ? "Leave blank to keep the current password." : undefined}
            >
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inp, paddingRight: "40px" }}
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                >
                  <Ico path={showPass ? ICONS.eyeOff : ICONS.eye} size={15} color="#94A3B8" />
                </button>
              </div>
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)}
              style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#475569" }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: submitting ? `${G}80` : G, cursor: submitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, color: "#fff", minWidth: "120px" }}>
              {submitting ? "Saving…" : modal === "add" ? "Create Account" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  );
}