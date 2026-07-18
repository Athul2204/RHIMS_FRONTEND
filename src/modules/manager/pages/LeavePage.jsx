// src/modules/manager/pages/LeavePage.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getLeaveRequests, createLeaveRequest, patchLeaveRequest, approveLeave, rejectLeave,
  getAllStaff,
} from "../api/managerApi";

const ACCENT = "#6366F1";

const STATUS_STYLE = {
  "Pending":  { bg: "#FEF3C7", text: "#92400E" },
  "Approved": { bg: "#D1FAE5", text: "#065F46" },
  "Rejected": { bg: "#FEE2E2", text: "#991B1B" },
};

const LEAVE_TYPE_STYLE = {
  "Paid":   { bg: "#DBEAFE", text: "#1E40AF" },
  "Unpaid": { bg: "#F1F5F9", text: "#475569" },
};

function Badge({ label, style }) {
  const s = style || { bg: "#F1F5F9", text: "#475569" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: s.bg, color: s.text }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#94A3B8", lineHeight: 1, padding: "2px 6px" }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

const inp = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", boxSizing: "border-box", background: "#F8FAFC",
};

function Lbl({ children, required }) {
  return (
    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>
      {children}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
  );
}

// ── Add Leave Modal ────────────────────────────────────────────
function AddLeaveModal({ onClose, onDone }) {
  const [allStaff, setAllStaff] = useState([]);
  const [form, setForm] = useState({
    staff_type: "", id: "", leave_type: "Paid",
    start_date: "", end_date: "", reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllStaff().then(res => setAllStaff(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const totalDays = (() => {
    if (form.start_date && form.end_date) {
      const d = (new Date(form.end_date) - new Date(form.start_date)) / 86400000 + 1;
      return d > 0 ? d : 0;
    }
    return 0;
  })();

  const handleSubmit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, reason: form.reason };
      if (form.staff_type === "staff_profile") payload.staff_profile = form.id;
      else payload.support_staff = form.id;
      await createLeaveRequest(payload);
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to submit leave.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Add Leave Request" onClose={onClose}>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

      <div style={{ marginBottom: "14px" }}>
        <Lbl required>Staff Member</Lbl>
        <select value={`${form.staff_type}-${form.id}`}
          onChange={e => { const val = e.target.value; const idx = val.lastIndexOf("-"); setForm(f => ({ ...f, staff_type: val.slice(0, idx), id: Number(val.slice(idx + 1)) })); }}
          style={inp}>
          <option value="-">— Select staff —</option>
          {allStaff.map(s => <option key={`${s.type}-${s.id}`} value={`${s.type}-${s.id}`}>{s.full_name} ({s.staff_code}) — {s.role}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <Lbl required>Leave Type</Lbl>
        <div style={{ display: "flex", gap: "10px" }}>
          {["Paid", "Unpaid"].map(t => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "8px 14px", borderRadius: "8px", border: `1.5px solid ${form.leave_type === t ? ACCENT : "#E2E8F0"}`, background: form.leave_type === t ? `${ACCENT}10` : "#F8FAFC", flex: 1, justifyContent: "center" }}>
              <input type="radio" name="leave_type" value={t} checked={form.leave_type === t} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={{ display: "none" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: form.leave_type === t ? ACCENT : "#64748B" }}>
                {t === "Paid" ? "✅ Paid Leave" : "📋 Unpaid Leave"}
              </span>
            </label>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: form.leave_type === "Paid" ? "#3B82F6" : "#94A3B8", margin: "6px 0 0" }}>
          {form.leave_type === "Paid" ? "Salary will be paid for these days (counted as working days)" : "No salary for these days (deducted from pay)"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <div>
          <Lbl required>Start Date</Lbl>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
        </div>
        <div>
          <Lbl required>End Date</Lbl>
          <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
        </div>
      </div>

      {totalDays > 0 && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
          <p style={{ fontSize: "13px", color: "#0369A1", fontWeight: 600, margin: 0 }}>
            📅 Total: {totalDays} day{totalDays !== 1 ? "s" : ""}
            {form.leave_type === "Paid" ? " (Paid — no salary deduction)" : " (Unpaid — salary will be deducted)"}
          </p>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <Lbl>Reason</Lbl>
        <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Reason for leave…" style={{ ...inp, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving || !form.id || !form.start_date || !form.end_date}
          style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: (saving || !form.id || !form.start_date || !form.end_date) ? 0.6 : 1 }}>
          {saving ? "Submitting…" : "Submit Leave"}
        </button>
      </div>
    </Modal>
  );
}

// ── Edit Leave Modal (PATCH — pending requests only) ────────────
function EditLeaveModal({ leave, onClose, onDone }) {
  const [form, setForm] = useState({
    leave_type: leave.leave_type || "Paid",
    start_date: leave.start_date || "",
    end_date: leave.end_date || "",
    reason: leave.reason || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totalDays = (() => {
    if (form.start_date && form.end_date) {
      const d = (new Date(form.end_date) - new Date(form.start_date)) / 86400000 + 1;
      return d > 0 ? d : 0;
    }
    return 0;
  })();

  const handleSubmit = async () => {
    setSaving(true); setError(null);
    try {
      await patchLeaveRequest(leave.leave_id, {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
      });
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to update leave.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Edit Leave Request" onClose={onClose}>
      <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        Editing leave for <strong>{leave.staff_name}</strong>
      </p>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

      <div style={{ marginBottom: "14px" }}>
        <Lbl required>Leave Type</Lbl>
        <div style={{ display: "flex", gap: "10px" }}>
          {["Paid", "Unpaid"].map(t => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "8px 14px", borderRadius: "8px", border: `1.5px solid ${form.leave_type === t ? ACCENT : "#E2E8F0"}`, background: form.leave_type === t ? `${ACCENT}10` : "#F8FAFC", flex: 1, justifyContent: "center" }}>
              <input type="radio" name="edit_leave_type" value={t} checked={form.leave_type === t} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={{ display: "none" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: form.leave_type === t ? ACCENT : "#64748B" }}>
                {t === "Paid" ? "✅ Paid Leave" : "📋 Unpaid Leave"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <div>
          <Lbl required>Start Date</Lbl>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
        </div>
        <div>
          <Lbl required>End Date</Lbl>
          <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
        </div>
      </div>

      {totalDays > 0 && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
          <p style={{ fontSize: "13px", color: "#0369A1", fontWeight: 600, margin: 0 }}>
            📅 Total: {totalDays} day{totalDays !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <Lbl>Reason</Lbl>
        <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Reason for leave…" style={{ ...inp, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving || !form.start_date || !form.end_date}
          style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: (saving || !form.start_date || !form.end_date) ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}

// ── Reject Modal ───────────────────────────────────────────────
function RejectModal({ leave, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleReject = async () => {
    setSaving(true); setError(null);
    try {
      await rejectLeave(leave.leave_id, reason);
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to reject.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Reject Leave Request" onClose={onClose}>
      <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        Rejecting leave for <strong>{leave.staff_name}</strong> ({leave.total_days} day{leave.total_days !== 1 ? "s" : ""}: {leave.start_date} to {leave.end_date})
      </p>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
      <div style={{ marginBottom: "20px" }}>
        <Lbl>Rejection Reason</Lbl>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Reason for rejection…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleReject} disabled={saving}
          style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Rejecting…" : "Reject Leave"}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
export default function LeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.leave_type = typeFilter;
      const res = await getLeaveRequests(params);
      setLeaves(Array.isArray(res) ? res : (res?.results || []));
    } catch { setError("Failed to load leave requests."); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try { await approveLeave(id); load(); }
    catch (e) { alert(e?.response?.data?.error || "Failed to approve."); }
    finally { setActionLoading(null); }
  };

  const pending = leaves.filter(l => l.status === "Pending").length;
  const approved = leaves.filter(l => l.status === "Approved").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>Leave Management</h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Manage paid leave, unpaid leave and approvals</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: "9px 18px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
          + Add Leave Request
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total Requests", value: leaves.length, icon: "📋", color: "#6366F1" },
          { label: "Pending", value: pending, icon: "⏳", color: "#F59E0B" },
          { label: "Approved", value: approved, icon: "✅", color: "#10B981" },
          { label: "Rejected", value: leaves.filter(l => l.status === "Rejected").length, icon: "❌", color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "1px solid #E8EDF4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase" }}>{s.label}</p>
                <p style={{ fontSize: "22px", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
              <span style={{ fontSize: "22px" }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Leave type info box */}
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" }}>
        <p style={{ fontSize: "12.5px", color: "#065F46", margin: 0 }}>
          <strong>✅ Paid Leave</strong> — Salary is paid for these days (counted as present). &nbsp;|&nbsp;
          <strong>📋 Unpaid Leave</strong> — Salary is deducted for these days (absent without pay).
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#fff", cursor: "pointer" }}>
          <option value="">All Status</option>
          {["Pending", "Approved", "Rejected"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#fff", cursor: "pointer" }}>
          <option value="">All Types</option>
          <option value="Paid">Paid Leave</option>
          <option value="Unpaid">Unpaid Leave</option>
        </select>
        <button onClick={load} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94A3B8" }}>Loading leave requests…</div>
      ) : leaves.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", border: "1px solid #E8EDF4" }}>
          <p style={{ fontSize: "14px", color: "#94A3B8", margin: 0 }}>No leave requests found.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {leaves.map(l => (
            <div key={l.leave_id} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{l.staff_name}</p>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#6366F1", fontWeight: 700 }}>{l.staff_code}</span>
                    <Badge label={l.leave_type === "Paid" ? "✅ Paid Leave" : "📋 Unpaid Leave"} style={LEAVE_TYPE_STYLE[l.leave_type]} />
                    <Badge label={l.status} style={STATUS_STYLE[l.status]} />
                  </div>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Duration</p>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B", margin: 0 }}>{l.start_date} → {l.end_date} ({l.total_days} day{l.total_days !== 1 ? "s" : ""})</p>
                    </div>
                    {l.reason && (
                      <div>
                        <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Reason</p>
                        <p style={{ fontSize: "13px", color: "#64748B", margin: 0, maxWidth: "300px" }}>{l.reason}</p>
                      </div>
                    )}
                    {l.rejection_reason && (
                      <div>
                        <p style={{ fontSize: "10.5px", color: "#EF4444", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Rejection Reason</p>
                        <p style={{ fontSize: "13px", color: "#EF4444", margin: 0 }}>{l.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
                {l.status === "Pending" && (
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button
                      onClick={() => setEditTarget(l)}
                      disabled={actionLoading === l.leave_id}
                      style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#EFF6FF", color: "#3B82F6", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: actionLoading === l.leave_id ? 0.7 : 1 }}>
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => handleApprove(l.leave_id)}
                      disabled={actionLoading === l.leave_id}
                      style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: actionLoading === l.leave_id ? 0.7 : 1 }}>
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(l)}
                      disabled={actionLoading === l.leave_id}
                      style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "#FEE2E2", color: "#991B1B", fontWeight: 700, fontSize: "12px", cursor: "pointer", opacity: actionLoading === l.leave_id ? 0.7 : 1 }}>
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddLeaveModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {editTarget && <EditLeaveModal leave={editTarget} onClose={() => setEditTarget(null)} onDone={() => { setEditTarget(null); load(); }} />}
      {rejectTarget && <RejectModal leave={rejectTarget} onClose={() => setRejectTarget(null)} onDone={() => { setRejectTarget(null); load(); }} />}
    </div>
  );
}