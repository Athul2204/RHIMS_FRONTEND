// src/modules/manager/pages/AttendancePage.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getAttendance, markAttendance, bulkMarkAttendance,
  getAttendanceSummary, getAllStaff, generateSalary,
} from "../api/managerApi";
import { toISODate } from "../utils/dateUtils";

// Shared channel — notifies SalaryPage to refresh whenever attendance is saved
const ATTENDANCE_CHANNEL = "rhims_attendance_updated";

// Silently re-sync salary for the affected month after attendance is saved
async function syncSalary(dateStr) {
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const year  = d.getFullYear();
    await generateSalary({ month, year });
    // Notify SalaryPage (same or other tab) to re-fetch updated records
    try {
      new BroadcastChannel(ATTENDANCE_CHANNEL).postMessage({ month, year });
    } catch (_) {}
  } catch (_) {
    // Salary sync is best-effort; don't block the UI
  }
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUS_OPTS = ["Present","Absent","Paid Leave","Unpaid Leave","Holiday","Half Day"];

const STATUS_STYLE = {
  "Present":      { bg: "#D1FAE5", text: "#065F46" },
  "Absent":       { bg: "#FEE2E2", text: "#991B1B" },
  "Paid Leave":   { bg: "#DBEAFE", text: "#1E40AF" },
  "Unpaid Leave": { bg: "#FEF3C7", text: "#92400E" },
  "Holiday":      { bg: "#EDE9FE", text: "#5B21B6" },
  "Half Day":     { bg: "#FCE7F3", text: "#9D174D" },
};

const ACCENT = "#6366F1";

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg: "#F1F5F9", text: "#475569" };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px",
      fontWeight: 700, background: s.bg, color: s.text, whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: wide ? "720px" : "520px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }}
        onClick={e => e.stopPropagation()}
      >
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

// ── Summary tab ──────────────────────────────────────────────
function SummaryTab({ month, year }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAttendanceSummary({ month, year });
      // Backend returns { month, year, start, end, summary: [...] }
      setData(Array.isArray(res) ? res : (res?.summary ?? []));
    } catch { setError("Failed to load summary."); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: "#94A3B8", textAlign: "center", padding: "40px" }}>Loading summary…</p>;
  if (error) return <p style={{ color: "#EF4444", textAlign: "center" }}>{error}</p>;
  if (!data.length) return <p style={{ color: "#94A3B8", textAlign: "center", padding: "40px" }}>No attendance data for this month.</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {["Staff Code", "Name", "Role", "Present", "Absent", "Paid Leave", "Unpaid Leave", "Half Day", "Holiday"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E8EDF4", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#6366F1", fontWeight: 700 }}>{row.staff_code}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A" }}>{row.name}</td>
              <td style={{ padding: "10px 12px", color: "#64748B" }}>{row.role}</td>
              <td style={{ padding: "10px 12px", color: "#10B981", fontWeight: 700 }}>{row.present ?? 0}</td>
              <td style={{ padding: "10px 12px", color: "#EF4444", fontWeight: 700 }}>{row.absent ?? 0}</td>
              <td style={{ padding: "10px 12px", color: "#3B82F6", fontWeight: 700 }}>{row.paid_leave ?? 0}</td>
              <td style={{ padding: "10px 12px", color: "#F59E0B", fontWeight: 700 }}>{row.unpaid_leave ?? 0}</td>
              <td style={{ padding: "10px 12px", color: "#EC4899", fontWeight: 700 }}>{row.half_day ?? 0}</td>
              <td style={{ padding: "10px 12px", color: "#8B5CF6", fontWeight: 700 }}>{row.holiday ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Searchable staff dropdown ──────────────────────────────────
// Type-to-filter combobox: replaces the old plain <select> for staff
// pickers. Filters by name or staff code as you type; click a result (or
// use ↑/↓ + Enter) to select. Closes on outside click.
function SearchableStaffSelect({ staff, value, onChange, placeholder = "Search staff by name or code…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const selected = staff.find(s => `${s.type}-${s.id}` === value);

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(s =>
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.staff_code || "").toLowerCase().includes(q) ||
      (s.role || "").toLowerCase().includes(q)
    );
  }, [staff, query]);

  const pick = (s) => {
    onChange(`${s.type}-${s.id}`);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={open ? query : (selected ? `${selected.full_name} (${selected.staff_code})` : "")}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => { setQuery(""); setOpen(true); setHighlight(0); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={inp}
      />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid #E2E8F0", borderRadius: "10px",
          maxHeight: "240px", overflowY: "auto", zIndex: 30,
          boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "14px", fontSize: "12.5px", color: "#94A3B8", textAlign: "center" }}>No staff match "{query}"</div>
          ) : filtered.map((s, i) => (
            <div key={`${s.type}-${s.id}`}
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "9px 14px", cursor: "pointer",
                borderBottom: "1px solid #F8FAFC",
                background: i === highlight ? "#EEF2FF" : "#fff",
              }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{s.full_name}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "#94A3B8" }}>
                {s.staff_code} — {s.role} · {s.type === "staff_profile" ? "EMR Staff" : "Support"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bulk mark modal ───────────────────────────────────────────
function BulkMarkModal({ onClose, onDone }) {
  const [allStaff, setAllStaff] = useState([]);
  const [date, setDate] = useState(toISODate(new Date()));
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllStaff().then(res => {
      const list = Array.isArray(res) ? res : [];
      setAllStaff(list);
      const init = {};
      list.forEach(s => { init[`${s.type}-${s.id}`] = { status: "Present", notes: "" }; });
      setMarks(init);
    }).catch(() => setError("Failed to load staff."));
  }, []);

  const visibleStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allStaff;
    return allStaff.filter(s =>
      (s.full_name || "").toLowerCase().includes(q) ||
      (s.staff_code || "").toLowerCase().includes(q) ||
      (s.role || "").toLowerCase().includes(q)
    );
  }, [allStaff, search]);

  const handleSubmit = async () => {
    setSaving(true); setError(null);
    try {
      const records = allStaff.map(s => {
        const key = `${s.type}-${s.id}`;
        const m = marks[key] || { status: "Present", notes: "" };
        return { staff_type: s.type, staff_id: s.id, status: m.status, notes: m.notes };
      });
      await bulkMarkAttendance({ date, records });
      syncSalary(date); // re-sync salary in background
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save attendance.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Bulk Mark Attendance — ${date}`} onClose={onClose} wide>
      <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "5px" }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, maxWidth: "200px" }} />
        </div>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "5px" }}>Search staff</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name, code, or role…" style={inp} />
        </div>
      </div>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
      <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "10px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead style={{ position: "sticky", top: 0, background: "#F8FAFC", zIndex: 1 }}>
            <tr>
              {["Name", "Role", "Status", "Notes"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E8EDF4" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStaff.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#94A3B8", fontSize: "12.5px" }}>No staff match "{search}"</td></tr>
            ) : visibleStaff.map(s => {
              const key = `${s.type}-${s.id}`;
              const m = marks[key] || { status: "Present", notes: "" };
              return (
                <tr key={key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "8px 14px" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "#0F172A", fontSize: "13px" }}>{s.full_name}</p>
                    <p style={{ margin: 0, fontSize: "10.5px", color: "#94A3B8" }}>{s.staff_code}</p>
                  </td>
                  <td style={{ padding: "8px 14px", color: "#64748B", fontSize: "12px" }}>{s.role}</td>
                  <td style={{ padding: "8px 14px" }}>
                    <select value={m.status} onChange={e => setMarks(prev => ({ ...prev, [key]: { ...m, status: e.target.value } }))}
                      style={{ ...inp, padding: "6px 10px", width: "auto", minWidth: "130px" }}>
                      {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <input value={m.notes} onChange={e => setMarks(prev => ({ ...prev, [key]: { ...m, notes: e.target.value } }))}
                      placeholder="Optional note" style={{ ...inp, padding: "6px 10px" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving} style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </Modal>
  );
}

// ── Single mark modal ─────────────────────────────────────────
function MarkModal({ onClose, onDone }) {
  const [allStaff, setAllStaff] = useState([]);
  const [form, setForm] = useState({ staff_type: "", id: "", date: toISODate(new Date()), status: "Present", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllStaff().then(res => setAllStaff(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { date: form.date, status: form.status, notes: form.notes };
      if (form.staff_type === "staff_profile") payload.staff_profile = form.id;
      else payload.support_staff = form.id;
      await markAttendance(payload);
      syncSalary(form.date); // re-sync salary in background
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to save.");
    } finally { setSaving(false); }
  };

  const selectedStaff = allStaff.find(s => `${s.type}-${s.id}` === `${form.staff_type}-${form.id}`);

  return (
    <Modal title="Mark Individual Attendance" onClose={onClose}>
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>Staff Member <span style={{ color: "#EF4444" }}>*</span></label>
        <SearchableStaffSelect
          staff={allStaff}
          value={`${form.staff_type}-${form.id}`}
          onChange={val => { const dashIdx = val.indexOf("-"); setForm(f => ({ ...f, staff_type: val.slice(0, dashIdx), id: Number(val.slice(dashIdx + 1)) })); }}
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>Date <span style={{ color: "#EF4444" }}>*</span></label>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>Status <span style={{ color: "#EF4444" }}>*</span></label>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
          {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Optional note…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving || !form.id} style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", opacity: (saving || !form.id) ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Mark Attendance"}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
export default function AttendancePage() {
  const today = new Date();
  const [tab, setTab] = useState("log"); // "log" | "summary"
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [date, setDate] = useState(toISODate(today));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMark, setShowMark] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const loadLog = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getAttendance({ date });
      setRecords(Array.isArray(res) ? res : (res?.results || []));
    } catch { setError("Failed to load attendance."); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { if (tab === "log") loadLog(); }, [tab, loadLog]);

  const counts = useMemo(() => {
    const c = {};
    STATUS_OPTS.forEach(s => { c[s] = 0; });
    records.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }, [records]);

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>Attendance Management</h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Track and manage daily attendance for all staff</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowMark(true)}
            style={{ padding: "9px 16px", borderRadius: "9px", border: `1.5px solid ${ACCENT}`, background: "#fff", color: ACCENT, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
            + Mark Individual
          </button>
          <button onClick={() => setShowBulk(true)}
            style={{ padding: "9px 16px", borderRadius: "9px", border: "none", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
            📋 Bulk Mark
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #E8EDF4" }}>
        {[["log", "Daily Log"], ["summary", "Monthly Summary"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "10px 18px", border: "none", borderBottom: tab === key ? `2px solid ${ACCENT}` : "2px solid transparent", background: "none", color: tab === key ? ACCENT : "#64748B", fontWeight: tab === key ? 700 : 500, fontSize: "13px", cursor: "pointer", marginBottom: "-1px" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <>
          {/* Date picker + status counts */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Date:</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inp, width: "auto", padding: "7px 12px" }} />
              <button onClick={loadLog} style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>↻ Refresh</button>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(counts).filter(([, v]) => v > 0).map(([s, v]) => {
                const st = STATUS_STYLE[s] || { bg: "#F1F5F9", text: "#475569" };
                return (
                  <span key={s} style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: st.bg, color: st.text }}>
                    {s}: {v}
                  </span>
                );
              })}
              {records.length > 0 && <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "#F1F5F9", color: "#475569" }}>Total: {records.length}</span>}
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#94A3B8" }}>Loading attendance…</div>
          ) : records.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", border: "1px solid #E8EDF4" }}>
              <p style={{ fontSize: "14px", color: "#94A3B8", margin: 0 }}>No attendance records for this date.</p>
              <p style={{ fontSize: "12px", color: "#CBD5E1", margin: "6px 0 0" }}>Use "Bulk Mark" to record attendance for all staff at once.</p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Staff Code", "Name", "Role", "Type", "Status", "Notes", "Marked By"].map(h => (
                        <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E8EDF4", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.attendance_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#6366F1", fontWeight: 700 }}>{r.staff_code}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0F172A" }}>{r.staff_name}</td>
                        <td style={{ padding: "10px 14px", color: "#64748B" }}>{r.staff_role}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: r.staff_type === "staff_profile" ? "#EFF6FF" : "#F0FDF4", color: r.staff_type === "staff_profile" ? "#3B82F6" : "#16A34A" }}>
                            {r.staff_type === "staff_profile" ? "EMR Staff" : "Support"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}><Badge status={r.status} /></td>
                        <td style={{ padding: "10px 14px", color: "#64748B", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: "12px" }}>{r.marked_by_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Month/year picker */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Month:</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...inp, width: "auto", padding: "7px 12px" }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Year:</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: "auto", padding: "7px 12px" }}>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4", padding: "4px", overflow: "hidden" }}>
            <SummaryTab month={month} year={year} />
          </div>
        </>
      )}

      {showMark && <MarkModal onClose={() => setShowMark(false)} onDone={() => { setShowMark(false); loadLog(); }} />}
      {showBulk && <BulkMarkModal onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); loadLog(); }} />}
    </div>
  );
}