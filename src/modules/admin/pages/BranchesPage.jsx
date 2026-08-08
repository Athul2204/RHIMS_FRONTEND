// src/modules/admin/pages/BranchesPage.jsx
//
// New in the multi-branch rebuild (build spec §2.6) — there was no
// equivalent page in the old single-hospital frontend. Lets a group admin
// list, create, and edit branches. GET/POST /administration/branches/,
// GET/PATCH /administration/branches/<id>/ (no PUT — detail is GET/PATCH
// only, per the API reference in the build spec §4).
//
// Group-admin (or superuser) only — an ordinary branch-scoped admin has no
// use for this page (their one branch can't be edited from here), so the
// nav link is hidden for them (DashboardLayout) and this component redirects
// away if they land on the route directly, e.g. via a stale/typed URL.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getBranchList, createBranch, patchBranch } from "../api/adminApi";
import { useAuth } from "../../../context/AuthContext";
import { Toast, useToast } from "../../../components/shared/Toast";

const G = "#16A34A";

const Ico = ({ path, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const ICONS = {
  plus:     "M12 5v14 M5 12h14",
  edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  building: "M3 21h18 M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14 M9 9h1 M14 9h1 M9 13h1 M14 13h1 M9 17h1 M14 17h1",
  phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  pin:      "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  close:    "M18 6L6 18 M6 6l12 12",
};

const inp = {
  width: "100%", padding: "9px 12px", borderRadius: "9px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", background: "#fff", boxSizing: "border-box",
};

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>
      {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
    {children}
  </div>
);

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
    <div style={{ position: "relative", background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", padding: "28px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico path={ICONS.close} size={16} color="#64748B" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const EMPTY_FORM = { name: "", code: "", address: "", phone: "", is_active: true };

export default function BranchesPage() {
  const { isGroupAdmin, refreshBranches, selectedBranch, setSelectedBranch } = useAuth();
  const navigate = useNavigate();

  // Group-admin (or superuser) only — bounce anyone else back to the
  // dashboard rather than showing them a page with nothing they can do.
  useEffect(() => {
    if (!isGroupAdmin) navigate("/admin", { replace: true });
  }, [isGroupAdmin, navigate]);

  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [toast, showToast]      = useToast();

  const [modal, setModal]           = useState(null); // null | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getBranchList()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setBranches(list);
      })
      .catch(() => setError("Failed to load branches."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setFormError(""); setModal("add"); };
  const openEdit = (b) => {
    setEditTarget(b);
    setForm({
      name: b.name ?? "", code: b.code ?? "",
      address: b.address ?? "", phone: b.phone ?? "",
      is_active: b.is_active ?? true,
    });
    setFormError("");
    setModal("edit");
  };

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const extractError = (err) => {
    const data = err?.response?.data?.errors || err?.response?.data;
    if (data && typeof data === "object") {
      const msgs = [];
      const walk = (obj, prefix = "") => {
        Object.entries(obj).forEach(([k, v]) => {
          const label = prefix ? `${prefix} ${k}` : k;
          if (Array.isArray(v)) msgs.push(`${label}: ${v.join(" ")}`);
          else if (typeof v === "object" && v !== null) walk(v, label);
          else msgs.push(`${label}: ${v}`);
        });
      };
      walk(data);
      return msgs.join(" | ");
    }
    return err?.message || "Something went wrong.";
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setFormError("Name and code are required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase() };
      if (modal === "add") {
        await createBranch(payload);
      } else {
        await patchBranch(editTarget.branch_id, payload);
      }
      setModal(null);
      showToast(modal === "add" ? "Branch created!" : "Branch updated!");
      load();
      // The group-admin switcher / branch list in AuthContext should pick
      // up the new/edited branch immediately rather than on next login.
      refreshBranches();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // When a group admin has narrowed the header BranchSwitcher to one
  // branch, this page (like every other admin-module list) shows only
  // that branch rather than the full org-wide list. The branches
  // endpoint itself has no ?branch= server param, so this is a client-side
  // filter over the already-fetched list. "All Branches" (selectedBranch
  // === null) shows everything, same as before.
  const displayedBranches = (isGroupAdmin && selectedBranch)
    ? branches.filter((b) => b.branch_id === selectedBranch)
    : branches;

  const handleToggleActive = async (b) => {
    if (!window.confirm(`${b.is_active ? "Deactivate" : "Reactivate"} ${b.name}?`)) return;
    try {
      await patchBranch(b.branch_id, { is_active: !b.is_active });
      showToast(`Branch ${b.is_active ? "deactivated" : "reactivated"}.`);
      load();
      refreshBranches();
    } catch (err) {
      showToast(extractError(err), false);
    }
  };

  if (!isGroupAdmin) return null; // redirecting — see effect above

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", margin: "-20px -16px", padding: "24px" }}>
      <Toast toast={toast} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Branch Management</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
            {displayedBranches.length} branch{displayedBranches.length === 1 ? "" : "es"}
            {isGroupAdmin && selectedBranch ? ` (filtered from ${branches.length})` : ""}
          </p>
        </div>
        {isGroupAdmin && (
          <button onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: G, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            <Ico path={ICONS.plus} size={15} color="#fff" /> Add Branch
          </button>
        )}
      </div>

      {isGroupAdmin && selectedBranch && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span>Showing only the branch selected in the header switcher.</span>
          <button onClick={() => setSelectedBranch(null)}
            style={{ background: "#fff", border: "1px solid #BBF7D0", borderRadius: "7px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, color: "#15803D", cursor: "pointer", flexShrink: 0 }}>
            Show All Branches
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "16px" }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: "150px", borderRadius: "14px", background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />
          ))
        ) : displayedBranches.length === 0 ? (
          <div style={{ gridColumn: "1/-1", background: "#fff", borderRadius: "14px", padding: "48px", textAlign: "center", border: "1px solid #F1F5F9", color: "#94A3B8" }}>
            No branches found.
          </div>
        ) : (
          displayedBranches.map((b) => (
            <div key={b.branch_id} style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: `1px solid ${b.is_active ? "#BBF7D0" : "#F1F5F9"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico path={ICONS.building} size={18} color={G} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{b.name}</div>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", background: "#F1F5F9", padding: "2px 7px", borderRadius: "6px", color: "#475569", fontWeight: 600 }}>
                      {b.code}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: b.is_active ? "#DCFCE7" : "#FEE2E2", color: b.is_active ? "#15803D" : "#DC2626", fontWeight: 600, flexShrink: 0 }}>
                  {b.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#64748B" }}>
                  <Ico path={ICONS.pin} size={13} color="#94A3B8" /> {b.address || "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "#64748B" }}>
                  <Ico path={ICONS.phone} size={13} color="#94A3B8" /> {b.phone || "—"}
                </div>
              </div>

              {isGroupAdmin && (
                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #F8FAFC", paddingTop: "12px" }}>
                  <button onClick={() => openEdit(b)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "7px", borderRadius: "8px", border: "1px solid #BBF7D0", background: "#F0FDF4", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: G }}>
                    <Ico path={ICONS.edit} size={13} color={G} /> Edit
                  </button>
                  <button onClick={() => handleToggleActive(b)}
                    style={{ flex: 1, padding: "7px", borderRadius: "8px", border: `1px solid ${b.is_active ? "#FECACA" : "#BBF7D0"}`, background: b.is_active ? "#FEF2F2" : "#F0FDF4", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: b.is_active ? "#EF4444" : "#16A34A" }}>
                    {b.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {modal && (
        <Modal title={modal === "add" ? "Add New Branch" : `Edit — ${editTarget?.code}`} onClose={() => setModal(null)}>
          {formError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>{formError}</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Field label="Branch Name" required>
              <input style={inp} value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="e.g. Trivandrum Main" />
            </Field>
            <Field label="Code" required>
              <input style={{ ...inp, textTransform: "uppercase" }} value={form.code} maxLength={10}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())} placeholder="e.g. TVM" />
            </Field>
            <Field label="Address">
              <input style={inp} value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="City, State" />
            </Field>
            <Field label="Phone">
              <input style={inp} value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="Branch contact number" />
            </Field>
            {modal === "edit" && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => handleChange("is_active", e.target.checked)} style={{ accentColor: G }} />
                Active
              </label>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)}
              style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#475569" }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: "9px 22px", borderRadius: "9px", border: "none", background: submitting ? "#86EFAC" : G, cursor: submitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, color: "#fff", minWidth: "110px" }}>
              {submitting ? "Saving…" : modal === "add" ? "Create Branch" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>
    </div>
  );
}