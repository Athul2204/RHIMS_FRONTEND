// src/modules/doctor/pages/DoctorDashboardPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  getConsultations,
  getLabRequests,
} from "../api/doctorApi";

const G = "#16A34A";

const Ico = ({ path, size = 18, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  stethoscope: "M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v3c0 2.7 2.5 4.5 5 5.3V21h6v-1.7c2.5-.8 5-2.6 5-5.3v-3a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z",
  clipboard:   "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
  lab:         "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11 M5 14H3 M21 14h-2 M9 14h6",
  rx:          "M9 3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-4H9z M14 3v4h4 M12 11v6 M9 14h6",
  check:       "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3",
  clock:       "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  flask:       "M10 2v8L3.5 20.5A2 2 0 0 0 5.34 23h13.32a2 2 0 0 0 1.84-2.5L14 10V2 M8.5 2h7",
  arrow:       "M5 12h14 M12 5l7 7-7 7",
  alert:       "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  user:        "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
};

const STATUS_CFG = {
  STARTED:           { bg: "#EFF6FF", color: "#1D4ED8", label: "Started" },
  LAB_REQUESTED:     { bg: "#FEF3C7", color: "#D97706", label: "Lab Requested" },
  WAITING_FOR_LAB:   { bg: "#FEF3C7", color: "#D97706", label: "Waiting for Lab" },
  LAB_COMPLETED:     { bg: "#F0FDF4", color: "#15803D", label: "Lab Completed" },
  FOLLOWUP_REQUIRED: { bg: "#FDF4FF", color: "#7E22CE", label: "Follow-up Required" },
  COMPLETED:         { bg: "#DCFCE7", color: "#15803D", label: "Completed" },
};

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] ?? { bg: "#F1F5F9", color: "#475569", label: status };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px",
      borderRadius:20, fontSize:11, fontWeight:600, background:s.bg, color:s.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.color }} />
      {s.label}
    </span>
  );
}

const StatCard = ({ label, value, sub, icon, accent = G, onClick }) => (
  <div onClick={onClick} style={{
    background:"#fff", borderRadius:14, padding:"20px 22px",
    boxShadow:"0 1px 3px rgba(0,0,0,0.06)", border:"1px solid #EEF2F7",
    display:"flex", alignItems:"flex-start", gap:16,
    cursor: onClick ? "pointer" : "default",
    transition:"transform 0.15s, box-shadow 0.15s",
  }}
    onMouseEnter={e => { if(onClick){ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.1)"; }}}
    onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"; }}
  >
    <div style={{ width:46, height:46, borderRadius:12, flexShrink:0,
      background:`${accent}12`, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Ico path={icon} color={accent} size={20} />
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4,
        textTransform:"uppercase", letterSpacing:"0.6px" }}>{label}</p>
      <p style={{ fontSize:28, fontWeight:700, color:"#0F172A", lineHeight:1.1, marginBottom:4 }}>
        {value ?? <span style={{ color:"#CBD5E1" }}>—</span>}
      </p>
      {sub && <p style={{ fontSize:12, color:"#94A3B8" }}>{sub}</p>}
    </div>
    {onClick && <Ico path={ICONS.arrow} size={16} color="#CBD5E1" />}
  </div>
);

export default function DoctorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, lRes] = await Promise.allSettled([
        getConsultations({ date: todayDate }),
        getLabRequests({ requested_by: "me" }),
      ]);
      if (cRes.status === "fulfilled") {
        const list = Array.isArray(cRes.value) ? cRes.value : (cRes.value?.results ?? []);
        setConsultations(list);
      }
      if (lRes.status === "fulfilled") {
        const list = Array.isArray(lRes.value) ? lRes.value : (lRes.value?.results ?? []);
        setLabs(list);
      }
    } finally {
      setLoading(false);
    }
  }, [todayDate]);

  useEffect(() => { load(); }, [load]);

  const todayConsultations = consultations.filter(c =>
    c.consultation_date === todayDate || !c.consultation_date
  );
  const pendingConsultations = consultations.filter(c =>
    !["COMPLETED"].includes(c.status)
  );
  const pendingLabs = labs.filter(l => !["DELIVERED","COMPLETED"].includes(l.status));
  const completedToday = consultations.filter(c => c.status === "COMPLETED");

  const recentActivity = [...consultations]
    .sort((a,b) => b.consultation_id - a.consultation_id)
    .slice(0, 6);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div style={{ fontFamily:"'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:6 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`${G}12`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ico path={ICONS.stethoscope} color={G} size={22} />
          </div>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:"#0F172A", margin:0 }}>
              {greeting()}, Dr. {user?.first_name || user?.username || ""}
            </h1>
            <p style={{ fontSize:13, color:"#94A3B8", margin:0, marginTop:2 }}>
              {new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16, marginBottom:28 }}>
        <StatCard label="Today's Consultations" value={loading ? "…" : todayConsultations.length}
          sub="Scheduled today" icon={ICONS.clipboard} accent={G}
          onClick={() => navigate("/doctor/consultations")} />
        <StatCard label="Pending Cases" value={loading ? "…" : pendingConsultations.length}
          sub="Awaiting completion" icon={ICONS.clock} accent="#D97706"
          onClick={() => navigate("/doctor/appointments")} />
        <StatCard label="Lab Results Pending" value={loading ? "…" : pendingLabs.length}
          sub="Awaiting results" icon={ICONS.flask} accent="#7C3AED"
          onClick={() => navigate("/doctor/lab-requests")} />
        <StatCard label="Completed Today" value={loading ? "…" : completedToday.length}
          sub="Consultations done" icon={ICONS.check} accent="#0EA5E9"
          onClick={() => navigate("/doctor/consultations")} />
      </div>

      {/* Main Content */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20 }}>
        {/* Recent Consultations */}
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #EEF2F7",
          boxShadow:"0 1px 3px rgba(0,0,0,0.06)", overflow:"hidden" }}>
          <div style={{ padding:"18px 20px", borderBottom:"1px solid #F1F5F9",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <h2 style={{ fontSize:15, fontWeight:700, color:"#0F172A", margin:0 }}>Recent Consultations</h2>
              <p style={{ fontSize:12, color:"#94A3B8", margin:"2px 0 0" }}>Your latest patient cases</p>
            </div>
            <button onClick={() => navigate("/doctor/consultations")}
              style={{ fontSize:12, fontWeight:600, color:G, background:`${G}10`,
                border:"none", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>
              View All
            </button>
          </div>

          {loading ? (
            <div style={{ padding:40, textAlign:"center" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", border:`3px solid ${G}20`,
                borderTop:`3px solid ${G}`, animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
              <p style={{ fontSize:13, color:"#94A3B8" }}>Loading consultations…</p>
            </div>
          ) : recentActivity.length === 0 ? (
            <div style={{ padding:48, textAlign:"center" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:"#F8FAFC",
                display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                <Ico path={ICONS.clipboard} color="#CBD5E1" size={22} />
              </div>
              <p style={{ fontSize:14, fontWeight:600, color:"#64748B", margin:"0 0 4px" }}>No consultations yet</p>
              <p style={{ fontSize:12, color:"#94A3B8" }}>Your consultation queue is empty</p>
            </div>
          ) : (
            <div>
              {recentActivity.map((c, i) => (
                <div key={c.consultation_id} onClick={() => navigate("/doctor/appointments")}
                  style={{ padding:"14px 20px", borderBottom: i < recentActivity.length - 1 ? "1px solid #F8FAFC" : "none",
                    display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"background 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.background="#FAFBFD"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${G}12`,
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Ico path={ICONS.user} color={G} size={16} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:"#0F172A",
                      margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {c.patient_name || "Unknown Patient"}
                    </p>
                    <p style={{ fontSize:11, color:"#94A3B8", margin:"2px 0 0" }}>
                      MRD: {c.patient_mrd || "—"} · {c.op_number || "—"}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Quick Actions */}
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #EEF2F7",
            boxShadow:"0 1px 3px rgba(0,0,0,0.06)", padding:"18px 20px" }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:"#0F172A", margin:"0 0 14px" }}>Quick Actions</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { label:"Open Appointments", icon:ICONS.clipboard, path:"/doctor/appointments", accent:G },
                { label:"View Consultations", icon:ICONS.stethoscope, path:"/doctor/consultations", accent:"#0EA5E9" },
                { label:"Lab Requests", icon:ICONS.flask, path:"/doctor/lab-requests", accent:"#7C3AED" },
                { label:"Prescriptions", icon:ICONS.rx, path:"/doctor/prescriptions", accent:"#D97706" },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                    borderRadius:10, border:"1px solid #F1F5F9", background:"#FAFBFC",
                    cursor:"pointer", transition:"all 0.12s", textAlign:"left" }}
                  onMouseEnter={e => { e.currentTarget.style.background=`${a.accent}08`; e.currentTarget.style.borderColor=`${a.accent}30`; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#FAFBFC"; e.currentTarget.style.borderColor="#F1F5F9"; }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:`${a.accent}12`,
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Ico path={a.icon} color={a.accent} size={14} />
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:"#334155" }}>{a.label}</span>
                  <Ico path={ICONS.arrow} size={13} color="#CBD5E1" />
                </button>
              ))}
            </div>
          </div>

          {/* Status Summary */}
          <div style={{ background:"#fff", borderRadius:14, border:"1px solid #EEF2F7",
            boxShadow:"0 1px 3px rgba(0,0,0,0.06)", padding:"18px 20px" }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:"#0F172A", margin:"0 0 14px" }}>Today's Status</h3>
            {loading ? (
              <p style={{ fontSize:13, color:"#94A3B8" }}>Loading…</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {Object.entries(
                  todayConsultations.reduce((acc, c) => {
                    acc[c.status] = (acc[c.status] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([status, count]) => {
                  const cfg = STATUS_CFG[status] ?? { bg:"#F1F5F9", color:"#475569", label:status };
                  return (
                    <div key={status} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:cfg.color }} />
                        <span style={{ fontSize:12, color:"#475569", fontWeight:500 }}>{cfg.label}</span>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{count}</span>
                    </div>
                  );
                })}
                {todayConsultations.length === 0 && (
                  <p style={{ fontSize:12, color:"#94A3B8", textAlign:"center", padding:"8px 0" }}>
                    No consultations today
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}