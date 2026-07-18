// src/modules/doctor/pages/AppointmentsPage.jsx
// Today's appointment queue — card-based, distinctly different from ConsultationsPage table.
// Clicking a card navigates to /doctor/consultations/:id (the full-page detail view).

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getConsultations } from "../api/doctorApi";

const G      = "#16A34A";
const AMBER  = "#D97706";
const SLATE  = "#0F172A";
const MUTED  = "#64748B";
const BORDER = "#E8EDF4";

// ─── Icon helper ──────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  clock:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  check:    "M20 6 9 17l-5-5",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  refresh:  "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  chev:     "M9 18l6-6-6-6",
  calendar: "M3 9h18 M16 3v4 M8 3v4 M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  flask:    "M10 2v8L3.5 20.5A2 2 0 0 0 5.34 23h13.32a2 2 0 0 0 1.84-2.5L14 10V2 M8.5 2h7",
  rx:       "M9 3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-4H9z M14 3v4h4 M12 11v6 M9 14h6",
  open:     "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
};

const STATUS_CFG = {
  STARTED:           { bg:"#EFF6FF", color:"#1D4ED8", dot:"#3B82F6", label:"Started",          ring:"#BFDBFE" },
  LAB_REQUESTED:     { bg:"#FEF3C7", color:"#B45309", dot:AMBER,     label:"Lab Requested",    ring:"#FDE68A" },
  WAITING_FOR_LAB:   { bg:"#FEF3C7", color:"#B45309", dot:AMBER,     label:"Waiting for Lab",  ring:"#FDE68A" },
  LAB_COMPLETED:     { bg:"#F0FDF4", color:"#15803D", dot:G,          label:"Lab Completed",    ring:"#BBF7D0" },
  FOLLOWUP_REQUIRED: { bg:"#FDF4FF", color:"#7E22CE", dot:"#A855F7", label:"Follow-up",        ring:"#E9D5FF" },
  COMPLETED:         { bg:"#DCFCE7", color:"#15803D", dot:G,          label:"Completed",        ring:"#BBF7D0" },
};

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] ?? { bg:"#F1F5F9", color:MUTED, dot:"#94A3B8", label:status };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:20, fontSize:11, fontWeight:700, background:s.bg, color:s.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const c = { success:{bg:"#F0FDF4",border:"#BBF7D0",color:"#15803D"}, error:{bg:"#FEF2F2",border:"#FECACA",color:"#DC2626"} }[type] || {};
  return (
    <div style={{ position:"fixed", top:20, right:24, zIndex:9999, padding:"11px 18px",
      borderRadius:10, background:c.bg, border:`1px solid ${c.border}`, color:c.color,
      fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,0.1)" }}>
      {msg}
    </div>
  );
}

// ─── Patient avatar letter ────────────────────────────────────────────────────
function Avatar({ name, status }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const s = STATUS_CFG[status] ?? { bg:"#E2E8F0", color:MUTED };
  return (
    <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
      background:s.bg, color:s.color, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:15, fontWeight:800, border:`2px solid ${s.ring||BORDER}` }}>
      {initials}
    </div>
  );
}

// ─── Single queue card ────────────────────────────────────────────────────────
function QueueCard({ c, onOpen, index }) {
  const [hovered, setHovered] = useState(false);
  const s = STATUS_CFG[c.status] ?? {};

  return (
    <div
      onClick={() => onOpen(c.consultation_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:"#fff",
        borderRadius:14,
        border:`1.5px solid ${hovered ? s.ring||G : BORDER}`,
        padding:"16px 18px",
        cursor:"pointer",
        transition:"all 0.18s",
        transform:hovered ? "translateY(-2px)" : "none",
        boxShadow:hovered ? "0 8px 24px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.05)",
        display:"flex",
        alignItems:"center",
        gap:14,
        position:"relative",
        overflow:"hidden",
      }}>

      {/* Left accent line */}
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4,
        background:s.dot||G, borderRadius:"14px 0 0 14px" }} />

      {/* Queue number */}
      <div style={{ width:28, height:28, borderRadius:8, background:"#F8FAFC",
        border:`1px solid ${BORDER}`, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:12, fontWeight:800, color:MUTED, flexShrink:0 }}>
        {String(index + 1).padStart(2, "0")}
      </div>

      <Avatar name={c.patient_name} status={c.status} />

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <span style={{ fontSize:14, fontWeight:700, color:SLATE,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {c.patient_name || "Unknown Patient"}
          </span>
          <StatusBadge status={c.status} />
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:11.5, color:MUTED }}>
            MRD: <strong style={{ color:"#475569" }}>{c.patient_mrd || "—"}</strong>
          </span>
          <span style={{ fontSize:11.5, color:MUTED }}>
            OP: <strong style={{ color:"#475569" }}>{c.op_number || "—"}</strong>
          </span>
          {c.consultation_date && (
            <span style={{ fontSize:11.5, color:MUTED }}>
              {c.consultation_date}
            </span>
          )}
          {(c.lab_requests_count > 0) && (
            <span style={{ fontSize:11, color:"#0369A1", display:"flex", alignItems:"center", gap:3 }}>
              <Ico d={ICONS.flask} size={11} color="#0369A1" /> {c.lab_requests_count} lab
            </span>
          )}
          {(c.prescriptions_count > 0) && (
            <span style={{ fontSize:11, color:G, display:"flex", alignItems:"center", gap:3 }}>
              <Ico d={ICONS.rx} size={11} color={G} /> {c.prescriptions_count} Rx
            </span>
          )}
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ textAlign:"right" }}>
          <p style={{ fontSize:10, color:MUTED, margin:"0 0 2px", textTransform:"uppercase",
            letterSpacing:"0.5px", fontWeight:600 }}>Consult</p>
          <p style={{ fontSize:12, fontWeight:700, color:SLATE, margin:0 }}>
            #{c.consultation_id}
          </p>
        </div>
        <div style={{ width:28, height:28, borderRadius:8, background:hovered?`${G}10`:"#F8FAFC",
          border:`1px solid ${hovered?`${G}30`:BORDER}`, display:"flex",
          alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          <Ico d={ICONS.chev} size={14} color={hovered?G:MUTED} />
        </div>
      </div>
    </div>
  );
}

// ─── Completed compact row ────────────────────────────────────────────────────
function CompletedRow({ c, onOpen, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={() => onOpen(c.consultation_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
        borderRadius:10, cursor:"pointer", transition:"all 0.12s",
        background:hovered?"#F8FAFC":"transparent",
        border:`1px solid ${hovered?BORDER:"transparent"}` }}>
      <span style={{ fontSize:11, fontWeight:700, color:"#CBD5E1", width:24, flexShrink:0 }}>
        {String(index+1).padStart(2,"0")}
      </span>
      <div style={{ width:32, height:32, borderRadius:8, background:"#F1F5F9",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:12, fontWeight:800, color:MUTED, flexShrink:0 }}>
        {(c.patient_name||"?").slice(0,2).toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:13, fontWeight:600, color:MUTED,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>
          {c.patient_name || "Unknown"}
        </span>
        <span style={{ fontSize:11, color:"#94A3B8" }}>
          MRD {c.patient_mrd||"—"} · {c.op_number||"—"}
        </span>
      </div>
      <span style={{ fontSize:11, color:"#94A3B8", flexShrink:0 }}>
        {c.completed_at
          ? new Date(c.completed_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
          : c.consultation_date}
      </span>
      <Ico d={ICONS.chev} size={14} color={hovered?G:"#CBD5E1"} />
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, border:`1px solid ${BORDER}`,
      padding:"14px 20px", minWidth:100, textAlign:"center" }}>
      <p style={{ fontSize:22, fontWeight:800, color:color||SLATE, margin:0 }}>{value}</p>
      <p style={{ fontSize:11, color:MUTED, margin:"3px 0 0", fontWeight:600,
        textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</p>
    </div>
  );
}


export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10));
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type="info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      const res = await getConsultations(params);
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setConsultations(list);
    } catch(e) {
      showToast("Failed to load appointments", "error");
    } finally { setLoading(false); }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const PENDING_STATUSES = ["STARTED","LAB_REQUESTED","WAITING_FOR_LAB","LAB_COMPLETED","FOLLOWUP_REQUIRED"];

  const filtered = consultations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.patient_name||"").toLowerCase().includes(q) ||
      String(c.patient_mrd||"").toLowerCase().includes(q) ||
      (c.op_number||"").toLowerCase().includes(q)
    );
  });

  const pendingList   = filtered.filter(c => PENDING_STATUSES.includes(c.status));
  const completedList = filtered.filter(c => c.status === "COMPLETED");

  const openConsultation = (id) => navigate(`/doctor/consultations/${id}`);

  const todayLabel = (() => {
    try { return new Date(dateFilter + "T00:00:00").toLocaleDateString("en-IN",
      { weekday:"long", year:"numeric", month:"long", day:"numeric" }); }
    catch { return dateFilter; }
  })();

  return (
    <div style={{ fontFamily:"'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:SLATE, margin:"0 0 4px",
              letterSpacing:"-0.5px" }}>Today's Queue</h1>
            <p style={{ fontSize:13, color:MUTED, margin:0, display:"flex",
              alignItems:"center", gap:6 }}>
              <Ico d={ICONS.calendar} size={13} color={MUTED} />
              {todayLabel}
            </p>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <input type="date" value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ padding:"8px 12px", borderRadius:8, border:`1.5px solid ${BORDER}`,
                fontSize:13, color:SLATE, outline:"none", background:"#fff",
                fontFamily:"inherit" }} />
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                <Ico d={ICONS.search} size={14} color="#94A3B8" />
              </span>
              <input placeholder="Search patient or MRD…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding:"8px 12px 8px 34px", borderRadius:8,
                  border:`1.5px solid ${BORDER}`, fontSize:13, color:SLATE,
                  outline:"none", background:"#fff", minWidth:210, fontFamily:"inherit" }} />
            </div>
            <button onClick={load}
              style={{ padding:"8px 14px", borderRadius:8, border:`1.5px solid ${BORDER}`,
                background:"#fff", cursor:"pointer", display:"flex", alignItems:"center",
                gap:6, fontSize:13, fontWeight:600, color:MUTED, transition:"all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#CBD5E1"; e.currentTarget.style.background="#F8FAFC"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.background="#fff"; }}>
              <Ico d={ICONS.refresh} size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <StatPill label="Total" value={filtered.length} />
            <StatPill label="Pending" value={pendingList.length} color={AMBER} />
            <StatPill label="Completed" value={completedList.length} color={G} />
          </div>
        )}
      </div>

      {/* ── Pending queue ───────────────────────────────────────────────── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:AMBER,
            boxShadow:`0 0 0 3px ${AMBER}30` }} />
          <h2 style={{ fontSize:14, fontWeight:700, color:SLATE, margin:0 }}>
            Pending — {pendingList.length} patient{pendingList.length !== 1 ? "s" : ""}
          </h2>
        </div>

        {loading ? (
          <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`,
            padding:48, textAlign:"center" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${G}20`,
              borderTopColor:G, animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
            <p style={{ fontSize:13, color:MUTED }}>Loading queue…</p>
          </div>
        ) : pendingList.length === 0 ? (
          <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`,
            padding:"48px 24px", textAlign:"center" }}>
            <div style={{ width:56, height:56, borderRadius:16, background:"#F8FAFC",
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 14px" }}>
              <Ico d={ICONS.clock} size={26} color="#CBD5E1" />
            </div>
            <p style={{ fontSize:14, fontWeight:700, color:MUTED, margin:"0 0 4px" }}>
              {consultations.length === 0 ? "No appointments for this date" : "All done for today!"}
            </p>
            <p style={{ fontSize:12, color:"#94A3B8", margin:0 }}>
              {consultations.length > 0 ? "All consultations have been completed." : "Try selecting a different date."}
            </p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pendingList.map((c, i) => (
              <QueueCard key={c.consultation_id} c={c} index={i} onOpen={openConsultation} />
            ))}
          </div>
        )}
      </div>

      {/* ── Completed section ────────────────────────────────────────────── */}
      {completedList.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:G,
              boxShadow:`0 0 0 3px ${G}30` }} />
            <h2 style={{ fontSize:14, fontWeight:700, color:SLATE, margin:0 }}>
              Completed — {completedList.length}
            </h2>
          </div>
          <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`,
            padding:"8px 4px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            {completedList.map((c, i) => (
              <CompletedRow key={c.consultation_id} c={c} index={i} onOpen={openConsultation} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}