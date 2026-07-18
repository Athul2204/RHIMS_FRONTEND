// src/modules/receptionist/pages/FollowUpRemindersPage.jsx
//
// Reception view — manage follow-up reminders generated when doctors
// set a followup_date on consultations.
//
// Backend endpoints used:
//   GET  /api/doctor/followup-reminders/          → list (filters: status, due_today, overdue, from, to)
//   GET  /api/doctor/followup-reminders/summary/  → badge counts
//   PATCH /api/doctor/followup-reminders/<pk>/    → update status + reception_notes
//
// Permissions: IsAdminOrReceptionist (backend-enforced)

import { useEffect, useState, useCallback } from "react";
import {
  getFollowUpReminders,
  getFollowUpReminderSummary,
  updateFollowUpReminder,
} from "../../doctor/api/doctorApi";

// ─── Design tokens (matches receptionist green theme) ─────────────────────────
const G      = "#10B981";   // receptionist accent
const TEAL   = "#0D9488";
const AMBER  = "#D97706";
const RED    = "#DC2626";
const BLUE   = "#2563EB";
const PURPLE = "#7C3AED";
const SLATE  = "#0F172A";
const MUTED  = "#64748B";
const BORDER = "#E8EDF4";
const SURFACE = "#F8FAFC";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  PENDING:   { bg: "#FEF3C7", color: "#B45309", dot: AMBER,  label: "Pending",   next: ["CALLED","NO_ANSWER","DECLINED"] },
  CALLED:    { bg: "#DBEAFE", color: BLUE,      dot: BLUE,   label: "Called",    next: ["BOOKED","PENDING","DECLINED"] },
  BOOKED:    { bg: "#D1FAE5", color: "#059669", dot: G,      label: "Booked",    next: [] },
  DECLINED:  { bg: "#FEE2E2", color: RED,       dot: RED,    label: "Declined",  next: ["CALLED","PENDING"] },
  NO_ANSWER: { bg: "#EDE9FE", color: PURPLE,    dot: PURPLE, label: "No Answer", next: ["CALLED","PENDING"] },
};

// ─── Icon helper ──────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  calendar:  "M3 9h18 M16 3v4 M8 3v4 M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  phone:     "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.08 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z",
  user:      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  check:     "M20 6 9 17l-5-5",
  refresh:   "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  search:    "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  alert:     "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  notes:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  clock:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  filter:    "M22 3H2l8 9.46V19l4 2V12.46z",
  x:         "M18 6 6 18 M6 6l12 12",
  chev:      "M9 18l6-6-6-6",
  stethoscope: "M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v3c0 2.7 2.5 4.5 5 5.3V21h6v-1.7c2.5-.8 5-2.6 5-5.3v-3a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z",
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const c = {
    success: { bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D" },
    error:   { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626" },
    info:    { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
  }[type] || {};
  return (
    <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999,
      padding: "11px 18px", borderRadius: 10, background: c.bg,
      border: `1px solid ${c.border}`, color: c.color,
      fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
      {msg}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_CFG[status] ?? { bg: "#F1F5F9", color: MUTED, dot: "#94A3B8", label: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── Overdue / Due-today badges ───────────────────────────────────────────────
function DateBadge({ reminder }) {
  if (reminder.is_overdue) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
        background: "#FEE2E2", color: RED }}>
        <Ico d={ICONS.alert} size={10} color={RED} /> Overdue
      </span>
    );
  }
  if (reminder.is_due_today) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
        background: "#FEF3C7", color: AMBER }}>
        <Ico d={ICONS.clock} size={10} color={AMBER} /> Due Today
      </span>
    );
  }
  return null;
}

// ─── Summary counter pill ─────────────────────────────────────────────────────
function SummaryPill({ label, value, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color + "18" : "#fff",
      borderRadius: 12, border: `1.5px solid ${active ? color : BORDER}`,
      padding: "12px 18px", minWidth: 90, textAlign: "center",
      cursor: "pointer", transition: "all 0.15s",
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: active ? color : SLATE, margin: 0 }}>{value ?? "—"}</p>
      <p style={{ fontSize: 11, color: active ? color : MUTED, margin: "3px 0 0",
        fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
    </button>
  );
}

// ─── Update modal ─────────────────────────────────────────────────────────────
function UpdateModal({ reminder, onClose, onSaved }) {
  const [status, setStatus] = useState(reminder.status);
  const [notes, setNotes] = useState(reminder.reception_notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cfg = STATUS_CFG[reminder.status];
  const nextOptions = cfg?.next ?? [];

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await updateFollowUpReminder(reminder.reminder_id, {
        status,
        reception_notes: notes,
      });
      onSaved(res.data || res);
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to update reminder");
    } finally {
      setSaving(false);
    }
  };

  const ALL_STATUSES = ["PENDING","CALLED","BOOKED","DECLINED","NO_ANSWER"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: SLATE, margin: 0 }}>
              Update Follow-up Reminder
            </h2>
            <p style={{ fontSize: 12, color: MUTED, margin: "3px 0 0" }}>
              {reminder.patient_name} · MRD {reminder.patient_mrd}
            </p>
          </div>
          <button onClick={onClose} style={{ background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 8, width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ICONS.x} size={14} color={MUTED} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {/* Patient / Doctor info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div style={{ background: SURFACE, borderRadius: 10, padding: "12px 14px",
              border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 10, color: MUTED, fontWeight: 700, margin: "0 0 4px",
                textTransform: "uppercase", letterSpacing: "0.6px" }}>Phone</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: SLATE, margin: 0 }}>
                {reminder.patient_phone || "—"}
              </p>
            </div>
            <div style={{ background: SURFACE, borderRadius: 10, padding: "12px 14px",
              border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 10, color: MUTED, fontWeight: 700, margin: "0 0 4px",
                textTransform: "uppercase", letterSpacing: "0.6px" }}>Doctor</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: SLATE, margin: 0 }}>
                {reminder.doctor_name || "—"}
              </p>
            </div>
          </div>

          {/* Follow-up instructions */}
          {reminder.followup_instructions && (
            <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "12px 14px",
              border: `1px solid #FDE68A`, marginBottom: 18 }}>
              <p style={{ fontSize: 10, color: AMBER, fontWeight: 700, margin: "0 0 4px",
                textTransform: "uppercase", letterSpacing: "0.6px" }}>
                Doctor's Instructions
              </p>
              <p style={{ fontSize: 13, color: SLATE, margin: 0, lineHeight: 1.5 }}>
                {reminder.followup_instructions}
              </p>
            </div>
          )}

          {/* Status selector */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: SLATE, margin: "0 0 8px",
              textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Update Status
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_STATUSES.map(s => {
                const cfg = STATUS_CFG[s];
                const active = status === s;
                return (
                  <button key={s} onClick={() => setStatus(s)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.12s",
                    background: active ? cfg.bg : "#F8FAFC",
                    color: active ? cfg.color : MUTED,
                    border: `1.5px solid ${active ? cfg.dot : BORDER}`,
                  }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reception notes */}
          <div style={{ marginBottom: error ? 12 : 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: SLATE, margin: "0 0 6px",
              textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Notes
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add reception notes (e.g. Patient confirmed, appointment booked for…)"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${BORDER}`, fontSize: 13, color: SLATE,
                resize: "vertical", fontFamily: "inherit", outline: "none",
                background: "#fff", boxSizing: "border-box", lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: RED, fontWeight: 600, margin: "8px 0 0" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}`,
          display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9,
            border: `1.5px solid ${BORDER}`, background: "#fff", color: MUTED,
            fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 22px", borderRadius: 9, border: "none",
            background: saving ? "#D1FAE5" : G, color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}>
            {saving ? "Saving…" : "Save Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reminder card ────────────────────────────────────────────────────────────
function ReminderCard({ reminder, onUpdate }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_CFG[reminder.status] ?? {};
  const followupDate = reminder.followup_date
    ? new Date(reminder.followup_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 14,
        border: `1.5px solid ${hovered ? s.dot || G : BORDER}`,
        padding: "16px 18px",
        transition: "all 0.18s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.09)" : "0 1px 3px rgba(0,0,0,0.05)",
        position: "relative",
        overflow: "hidden",
      }}>
      {/* Left accent */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: s.dot || G, borderRadius: "14px 0 0 14px" }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Avatar */}
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: s.bg || SURFACE, color: s.color || G,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800, border: `2px solid ${s.dot || BORDER}30` }}>
          {(reminder.patient_name || "?").slice(0, 2).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
            flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: SLATE }}>
              {reminder.patient_name || "Unknown Patient"}
            </span>
            <StatusBadge status={reminder.status} />
            <DateBadge reminder={reminder} />
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: MUTED }}>
              MRD: <strong style={{ color: "#475569" }}>{reminder.patient_mrd || "—"}</strong>
            </span>
            {reminder.patient_phone && (
              <span style={{ fontSize: 11.5, color: MUTED, display: "flex", alignItems: "center", gap: 4 }}>
                <Ico d={ICONS.phone} size={11} color={MUTED} />
                {reminder.patient_phone}
              </span>
            )}
            <span style={{ fontSize: 11.5, color: MUTED, display: "flex", alignItems: "center", gap: 4 }}>
              <Ico d={ICONS.stethoscope} size={11} color={MUTED} />
              {reminder.doctor_name || "—"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Ico d={ICONS.calendar} size={12} color={reminder.is_overdue ? RED : reminder.is_due_today ? AMBER : MUTED} />
            <span style={{ fontSize: 12, fontWeight: 600,
              color: reminder.is_overdue ? RED : reminder.is_due_today ? AMBER : MUTED }}>
              Follow-up: {followupDate}
            </span>
          </div>

          {reminder.reception_notes && (
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8,
              background: SURFACE, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 11.5, color: MUTED, margin: 0, lineHeight: 1.4 }}>
                <strong>Note:</strong> {reminder.reception_notes}
              </p>
            </div>
          )}
        </div>

        {/* Action button */}
        {reminder.status !== "BOOKED" && (
          <button
            onClick={() => onUpdate(reminder)}
            style={{
              padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${hovered ? G : BORDER}`,
              background: hovered ? `${G}08` : SURFACE, color: hovered ? G : MUTED,
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
            <Ico d={ICONS.phone} size={12} color={hovered ? G : MUTED} /> Update
          </button>
        )}
        {reminder.status === "BOOKED" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            padding: "7px 14px", borderRadius: 9, background: "#D1FAE5",
            color: "#059669", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            <Ico d={ICONS.check} size={12} color="#059669" /> Booked
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function FollowUpRemindersPage() {
  const [reminders, setReminders]   = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" = all
  const [dateMode, setDateMode]     = useState("all"); // "all" | "due_today" | "overdue" | "range"
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [toast, setToast]           = useState(null);
  const [selected, setSelected]     = useState(null); // reminder for modal

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSummary = useCallback(async () => {
    try {
      const res = await getFollowUpReminderSummary();
      setSummary(res);
    } catch { /* non-critical */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter)           params.status    = statusFilter;
      if (dateMode === "due_today") params.due_today = "true";
      if (dateMode === "overdue")   params.overdue   = "true";
      if (dateMode === "range") {
        if (fromDate) params.from = fromDate;
        if (toDate)   params.to   = toDate;
      }
      const res = await getFollowUpReminders(params);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setReminders(list);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Failed to load reminders", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateMode, fromDate, toDate]);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  // ── Client-side search ──────────────────────────────────────────────────────
  const filtered = reminders.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.patient_name || "").toLowerCase().includes(q) ||
      String(r.patient_mrd || "").toLowerCase().includes(q) ||
      (r.patient_phone || "").includes(q) ||
      (r.doctor_name || "").toLowerCase().includes(q)
    );
  });

  const overdueCount  = filtered.filter(r => r.is_overdue).length;
  const dueTodayCount = filtered.filter(r => r.is_due_today && !r.is_overdue).length;
  const pendingCount  = filtered.filter(r => r.status === "PENDING").length;
  const bookedCount   = filtered.filter(r => r.status === "BOOKED").length;

  // ── After update ────────────────────────────────────────────────────────────
  const handleSaved = (updated) => {
    setReminders(prev =>
      prev.map(r => r.reminder_id === updated.reminder_id ? updated : r)
    );
    setSelected(null);
    showToast("Follow-up reminder updated", "success");
    loadSummary();
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {selected && (
        <UpdateModal
          reminder={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: SLATE, margin: "0 0 4px",
              letterSpacing: "-0.5px" }}>Follow-up Reminders</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Contact patients and help them book follow-up appointments
            </p>
          </div>
          <button onClick={() => { load(); loadSummary(); }}
            style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
              gap: 6, fontSize: 13, fontWeight: 600, color: MUTED }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.background = SURFACE; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER;    e.currentTarget.style.background = "#fff"; }}>
            <Ico d={ICONS.refresh} size={14} /> Refresh
          </button>
        </div>

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <SummaryPill label="Pending"   value={summary?.total_pending ?? "—"} color={AMBER}  active={statusFilter === "PENDING"}   onClick={() => setStatusFilter(f => f === "PENDING"   ? "" : "PENDING")} />
          <SummaryPill label="Due Today" value={summary?.due_today ?? "—"}     color={TEAL}   active={dateMode === "due_today"}      onClick={() => setDateMode(m => m === "due_today" ? "all" : "due_today")} />
          <SummaryPill label="Overdue"   value={summary?.overdue ?? "—"}       color={RED}    active={dateMode === "overdue"}        onClick={() => setDateMode(m => m === "overdue"   ? "all" : "overdue")} />
          <SummaryPill label="Booked"    value={summary?.by_status?.BOOKED ?? "—"} color={G} active={statusFilter === "BOOKED"}    onClick={() => setStatusFilter(f => f === "BOOKED"    ? "" : "BOOKED")} />
          <SummaryPill label="Called"    value={summary?.by_status?.CALLED ?? "—"} color={BLUE} active={statusFilter === "CALLED"} onClick={() => setStatusFilter(f => f === "CALLED"    ? "" : "CALLED")} />
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none" }}>
              <Ico d={ICONS.search} size={14} color="#94A3B8" />
            </span>
            <input
              placeholder="Search patient, MRD, doctor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: "8px 12px 8px 34px", borderRadius: 8,
                border: `1.5px solid ${BORDER}`, fontSize: 13, color: SLATE,
                outline: "none", background: "#fff", minWidth: 240, fontFamily: "inherit" }}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
              fontSize: 13, color: SLATE, background: "#fff", outline: "none",
              fontFamily: "inherit", cursor: "pointer" }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Date mode */}
          <select
            value={dateMode}
            onChange={e => setDateMode(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
              fontSize: 13, color: SLATE, background: "#fff", outline: "none",
              fontFamily: "inherit", cursor: "pointer" }}>
            <option value="all">All Dates</option>
            <option value="due_today">Due Today</option>
            <option value="overdue">Overdue</option>
            <option value="range">Date Range</option>
          </select>

          {dateMode === "range" && (
            <>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
                  fontSize: 13, color: SLATE, outline: "none", background: "#fff",
                  fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: MUTED }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
                  fontSize: 13, color: SLATE, outline: "none", background: "#fff",
                  fontFamily: "inherit" }} />
            </>
          )}
        </div>
      </div>

      {/* ── Alert bar for overdue/due-today ─────────────────────────────── */}
      {!loading && (overdueCount > 0 || dueTodayCount > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {overdueCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA",
              color: RED, fontSize: 13, fontWeight: 600 }}>
              <Ico d={ICONS.alert} size={15} color={RED} />
              {overdueCount} overdue reminder{overdueCount !== 1 ? "s" : ""} need attention
            </div>
          )}
          {dueTodayCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A",
              color: AMBER, fontSize: 13, fontWeight: 600 }}>
              <Ico d={ICONS.clock} size={15} color={AMBER} />
              {dueTodayCount} patient{dueTodayCount !== 1 ? "s" : ""} due today
            </div>
          )}
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`,
          padding: 56, textAlign: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%",
            border: `3px solid ${G}20`, borderTopColor: G,
            animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: MUTED }}>Loading follow-up reminders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`,
          padding: "56px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: SURFACE,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px" }}>
            <Ico d={ICONS.calendar} size={26} color="#CBD5E1" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: MUTED, margin: "0 0 4px" }}>
            No follow-up reminders found
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
            Reminders are created automatically when doctors set a follow-up date on a consultation.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 12, fontWeight: 600 }}>
            Showing {filtered.length} reminder{filtered.length !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Overdue first, then due today, then rest */}
            {[
              ...filtered.filter(r => r.is_overdue && r.status === "PENDING"),
              ...filtered.filter(r => r.is_due_today && !r.is_overdue && r.status === "PENDING"),
              ...filtered.filter(r => !r.is_overdue && !(r.is_due_today && r.status === "PENDING")),
            ].map(r => (
              <ReminderCard key={r.reminder_id} reminder={r} onUpdate={setSelected} />
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}