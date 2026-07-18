// src/modules/manager/pages/SupportStaffPage.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getSupportStaffList, createSupportStaff, updateSupportStaff,
  deactivateSupportStaff, activateSupportStaff,
} from "../api/managerApi";
import ExportButtons from "../../../components/shared/ExportButtons";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";

const ROLES = ["Nurse", "Cleaning Staff", "Security", "Cook", "Driver", "Ward Boy", "Other"];
const SALARY_TYPES = ["Monthly", "Weekly", "Daily"];

const EMPTY_FORM = {
  full_name: "", role: "Nurse", department: "", phone: "",
  date_of_birth: "", address: "", joining_date: "",
  notes: "",
  salary_type: "Monthly", monthly_salary: "", daily_rate: "", weekly_rate: "",
  mandatory_working_days: "26",
};

const BADGE_COLOR = {
  "Nurse":          { bg: "#EFF6FF", text: "#3B82F6" },
  "Cleaning Staff": { bg: "#F0FDF4", text: "#16A34A" },
  "Security":       { bg: "#FFF7ED", text: "#EA580C" },
  "Cook":           { bg: "#FDF4FF", text: "#9333EA" },
  "Driver":         { bg: "#F0F9FF", text: "#0284C7" },
  "Ward Boy":       { bg: "#FFF1F2", text: "#E11D48" },
  "Other":          { bg: "#F8FAFC", text: "#64748B" },
};

function Badge({ role }) {
  const c = BADGE_COLOR[role] || BADGE_COLOR["Other"];
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: c.bg, color: c.text }}>
      {role}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94A3B8", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

function InputField({ label, required, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", boxSizing: "border-box", background: "#F8FAFC",
};

// ════════════════════════════════════════════════════════
export default function SupportStaffPage() {
  const [staff, setStaff]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [roleFilter, setFilter] = useState("");
  const [showModal, setModal]   = useState(false);
  const [editing, setEditing]   = useState(null); // staff object when editing
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSupportStaffList({ search, role: roleFilter });
      setStaff(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); setModal(true); };
  const openEdit   = (s) => {
    setEditing(s);
    setForm({
      full_name: s.full_name || "", role: s.role || "Nurse",
      department: s.department || "", phone: s.phone || "",
      date_of_birth: s.date_of_birth || "", address: s.address || "",
      joining_date: s.joining_date || "",
      notes: s.notes || "",
      salary_type: s.salary_type || "Monthly",
      monthly_salary: s.monthly_salary ?? "",
      daily_rate: s.daily_rate ?? "",
      weekly_rate: s.weekly_rate ?? "",
      mandatory_working_days: s.mandatory_working_days ?? "26",
    });
    setFormError(null);
    setModal(true);
  };

  const handleSave = async () => {
    if (form.phone?.trim() && !isValidPhone(form.phone)) {
      setFormError(PHONE_ERROR_MESSAGE);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...form };
      if (!payload.joining_date) delete payload.joining_date;

      // Numeric rate fields — send 0 rather than blank strings, and only
      // the field matching the chosen pay basis is required; the others
      // are still stored as reference figures if the manager fills them in.
      payload.monthly_salary = payload.monthly_salary === "" ? "0.00" : payload.monthly_salary;
      payload.daily_rate     = payload.daily_rate === ""     ? "0.00" : payload.daily_rate;
      payload.weekly_rate    = payload.weekly_rate === "" ? "0.00" : payload.weekly_rate;
      payload.mandatory_working_days = payload.mandatory_working_days === "" ? 26 : Number(payload.mandatory_working_days);

      if (editing) {
        await updateSupportStaff(editing.staff_id, payload);
      } else {
        await createSupportStaff(payload);
      }
      setModal(false);
      load();
    } catch (e) {
      const data = e?.response?.data;
      if (typeof data === "object") {
        setFormError(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | "));
      } else {
        setFormError("Save failed. Please check your inputs.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s) => {
    try {
      if (s.is_active) {
        await deactivateSupportStaff(s.staff_id);
      } else {
        await activateSupportStaff(s.staff_id);
      }
      load();
    } catch {
      alert("Action failed.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>Support Staff</h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Manage nurses, cleaning staff & other non-EMR personnel</p>
        </div>
        <button onClick={openCreate} style={{ padding: "9px 18px", borderRadius: "9px", background: "#6366F1", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          + Add Staff
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, code, phone…"
          style={{ ...inputStyle, maxWidth: "280px" }}
        />
        <select value={roleFilter} onChange={e => setFilter(e.target.value)} style={{ ...inputStyle, maxWidth: "160px" }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <ExportButtons
          rows={staff}
          columns={[
            { header: "Staff Code", accessor: "staff_code" },
            { header: "Name", accessor: "full_name" },
            { header: "Role", accessor: "role" },
            { header: "Department", accessor: "department" },
            { header: "Phone", accessor: "phone" },
            { header: "Pay Basis", accessor: "salary_type" },
            { header: "Rate", accessor: s => s.salary_type === "Weekly" ? Number(s.weekly_rate || 0) : s.salary_type === "Daily" ? Number(s.daily_rate || 0) : Number(s.monthly_salary || 0) },
            { header: "Min Duty Days", accessor: s => s.mandatory_working_days ?? 26 },
            { header: "Status", accessor: s => s.is_active ? "Active" : "Inactive" },
          ]}
          filename={`support_staff_roster_${new Date().toISOString().split("T")[0]}`}
          title="Support Staff Roster"
          dateRange={`As of ${new Date().toISOString().split("T")[0]}`}
        />
      </div>

      {/* Error */}
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", marginBottom: "14px", fontSize: "13px" }}>{error}</div>}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E8EDF4" }}>
                {["Code", "Name", "Role", "Pay Basis", "Phone", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>Loading…</td></tr>
              )}
              {!loading && staff.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>No staff found.</td></tr>
              )}
              {staff.map(s => (
                <tr key={s.staff_id} style={{ borderBottom: "1px solid #F8FAFC" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "#6366F1", fontWeight: 600 }}>{s.staff_code}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1E293B" }}>{s.full_name}</td>
                  <td style={{ padding: "12px 16px" }}><Badge role={s.role} /></td>
                  <td style={{ padding: "12px 16px", color: "#64748B", fontSize: "12px" }}>
                    {s.salary_type || "Monthly"}
                    {" · "}
                    ₹{s.salary_type === "Weekly" ? (s.weekly_rate || "0") : s.salary_type === "Daily" ? (s.daily_rate || "0") : (s.monthly_salary || "0")}
                    <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "2px" }}>Min {s.mandatory_working_days || 26} days/mo</div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#64748B" }}>{s.phone || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                      background: s.is_active ? "#F0FDF4" : "#FEF2F2",
                      color: s.is_active ? "#16A34A" : "#DC2626",
                    }}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => openEdit(s)} style={{ padding: "5px 12px", borderRadius: "6px", background: "#EFF6FF", color: "#3B82F6", border: "none", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleToggle(s)} style={{
                        padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                        background: s.is_active ? "#FEF2F2" : "#F0FDF4",
                        color: s.is_active ? "#DC2626" : "#16A34A",
                      }}>
                        {s.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editing ? "Edit Support Staff" : "Add Support Staff"} onClose={() => setModal(false)}>
          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "-8px 0 16px" }}>
            The rate below is a reference figure only — the manager still enters the final amount by hand each period in the Salary section.
          </p>
          {formError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", marginBottom: "14px", fontSize: "12px" }}>
              {formError}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <InputField label="Full Name" required>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={inputStyle} placeholder="Full name" />
              </InputField>
            </div>
            <InputField label="Role" required>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </InputField>
            <InputField label="Department">
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={inputStyle} placeholder="e.g. ICU" />
            </InputField>
            <InputField label="Phone">
              <input value={form.phone} maxLength={10} inputMode="numeric"
                onChange={e => setForm(f => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))} style={inputStyle} placeholder="Starts with 6-9, 10 digits" />
            </InputField>
            <InputField label="Date of Birth">
              <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} style={inputStyle} />
            </InputField>
            <InputField label="Joining Date">
              <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} style={inputStyle} />
            </InputField>
            <InputField label="Pay Basis" required>
              <select value={form.salary_type} onChange={e => setForm(f => ({ ...f, salary_type: e.target.value }))} style={inputStyle}>
                {SALARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </InputField>
            {form.salary_type === "Monthly" && (
              <InputField label="Monthly Salary (₹)">
                <input type="number" min="0" value={form.monthly_salary} onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))} style={inputStyle} placeholder="e.g. 18000" />
              </InputField>
            )}
            {form.salary_type === "Weekly" && (
              <InputField label="Weekly Rate (₹)">
                <input type="number" min="0" value={form.weekly_rate} onChange={e => setForm(f => ({ ...f, weekly_rate: e.target.value }))} style={inputStyle} placeholder="e.g. 3500" />
              </InputField>
            )}
            {form.salary_type === "Daily" && (
              <InputField label="Daily Rate (₹)">
                <input type="number" min="0" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} style={inputStyle} placeholder="e.g. 600" />
              </InputField>
            )}
            <InputField label="Minimum Duty Days / Month" required>
              <input
                type="number" min="1" max="31"
                value={form.mandatory_working_days}
                onChange={e => setForm(f => ({ ...f, mandatory_working_days: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. 26"
              />
            </InputField>
            <div style={{ gridColumn: "1 / -1" }}>
              <InputField label="Address">
                <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} placeholder="Address" />
              </InputField>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <InputField label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} placeholder="Any additional notes" />
              </InputField>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button onClick={() => setModal(false)} style={{ padding: "9px 20px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#64748B", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "9px 20px", borderRadius: "8px", background: "#6366F1", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Staff"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}