// src/modules/manager/pages/website/PatientQueriesTab.jsx
//
// Read-only inbox of submissions from the public site's Contact form,
// with status transitions (NEW -> IN_PROGRESS -> RESOLVED).
import { useState, useEffect, useCallback } from "react";
import { getPatientQueries, updatePatientQueryStatus } from "../../api/websiteApi";
import { inputStyle, EmptyState, LoadingState, FormBanner } from "./shared";

const STATUS_OPTIONS = ["", "NEW", "IN_PROGRESS", "RESOLVED"];
const STATUS_LABEL = { NEW: "New", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
const STATUS_COLOR = {
  NEW:         { bg: "#EFF6FF", text: "#3B82F6" },
  IN_PROGRESS: { bg: "#FFFBEB", text: "#D97706" },
  RESOLVED:    { bg: "#F0FDF4", text: "#16A34A" },
};

const QUERY_TYPE_LABEL = { APPOINTMENT: "Appointment", FEEDBACK: "Feedback" };
const QUERY_TYPE_COLOR = {
  APPOINTMENT: { bg: "#F5F3FF", text: "#7C3AED" },
  FEEDBACK:    { bg: "#FDF2F8", text: "#DB2777" },
};

// Neutral color for a "General" (no preferred branch) enquiry, kept
// visually distinct from any real branch name so it reads as its own
// category rather than looking like a branch that happens to be called
// "General".
const GENERAL_BRANCH_COLOR = { bg: "#F1F5F9", text: "#64748B" };
const BRANCH_COLOR = { bg: "#ECFEFF", text: "#0891B2" };

const badgeStyle = { padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600 };

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.NEW;
  return (
    <span style={{ ...badgeStyle, background: c.bg, color: c.text }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function QueryTypeBadge({ queryType }) {
  const c = QUERY_TYPE_COLOR[queryType];
  if (!c) return null;
  return (
    <span style={{ ...badgeStyle, background: c.bg, color: c.text }}>
      {QUERY_TYPE_LABEL[queryType] || queryType}
    </span>
  );
}

function BranchBadge({ branchName }) {
  const c = branchName ? BRANCH_COLOR : GENERAL_BRANCH_COLOR;
  return (
    <span style={{ ...badgeStyle, background: c.bg, color: c.text }}>
      {branchName || "General"}
    </span>
  );
}

export default function PatientQueriesTab({ showToast }) {
  const [queries, setQueries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updating, setUpdating] = useState(null); // id currently being patched

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientQueries({ search, status: statusFilter });
      setQueries(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load patient queries.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      await updatePatientQueryStatus(id, status);
      setQueries((qs) => qs.map((q) => (q.id === id ? { ...q, status } : q)));
      showToast("Status updated.");
    } catch {
      showToast("Failed to update status.", false);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <input
          style={{ ...inputStyle, maxWidth: "280px" }}
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, maxWidth: "180px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s ? STATUS_LABEL[s] : "All statuses"}</option>
          ))}
        </select>
      </div>

      {error && <FormBanner message={error} />}

      {loading ? <LoadingState /> : queries.length === 0 ? (
        <EmptyState text="No patient queries yet." />
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {queries.map((q) => (
            <div key={q.id} style={{ padding: "14px 16px", border: "1px solid #F1F5F9", borderRadius: "12px", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{q.name}</span>
                    <QueryTypeBadge queryType={q.query_type} />
                    <BranchBadge branchName={q.preferred_branch_name} />
                    <StatusBadge status={q.status} />
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                    {q.phone}{q.email ? ` · ${q.email}` : ""} · {new Date(q.created_at).toLocaleString()}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{q.message}</p>
                </div>
                <select
                  style={{ ...inputStyle, width: "150px", flexShrink: 0, opacity: updating === q.id ? 0.6 : 1 }}
                  value={q.status}
                  disabled={updating === q.id}
                  onChange={(e) => handleStatusChange(q.id, e.target.value)}
                >
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}