// src/modules/admin/pages/AdminDashboardPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDashboardStats } from "../api/adminApi";

const G = "#16A34A";

const Ico = ({ path, size = 18, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  staff:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  doctor:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  patient:  "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  lab:      "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11 M5 14H3 M21 14h-2 M9 14h6",
  medicine: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  proc:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
  audit:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4",
  pharmacy: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4 M3 9h18",
  arrow:    "M5 12h14 M12 5l7 7-7 7",
  export:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  guest:    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8l2 2 M21 6l-2 2",
};

/* ── Stat Card ── */
const StatCard = ({ label, value, sub, icon, accent = G, trend }) => (
  <div style={{
    background: "#fff", borderRadius: "14px", padding: "20px 22px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    border: "1px solid #EEF2F7",
    display: "flex", alignItems: "flex-start", gap: "16px",
  }}>
    <div style={{
      width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
      background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Ico path={icon} color={accent} size={20} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</p>
      <p style={{ fontSize: "28px", fontWeight: 700, color: "#0F172A", lineHeight: 1.1, marginBottom: "4px" }}>
        {value ?? <span style={{ color: "#CBD5E1" }}>—</span>}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "#94A3B8" }}>{sub}</p>}
    </div>
    {trend !== undefined && (
      <div style={{
        padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
        background: trend >= 0 ? "#DCFCE7" : "#FEE2E2",
        color: trend >= 0 ? "#15803D" : "#DC2626",
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
      </div>
    )}
  </div>
);

/* ── Bar Chart ── */
const MiniBarChart = ({ data = [], color = G }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 500, H = 120, barW = 36;
  const total = data.length;
  const slotW = W / total;
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: "100%", height: "auto" }}>
      {data.map((d, i) => {
        const h = ((d.value / max) * H) || 2;
        const x = i * slotW + (slotW - barW) / 2;
        const y = H - h;
        return (
          <g key={i}>
            <rect x={x} y={H} width={barW} height={0} rx={5} fill={`${color}18`} />
            <rect x={x} y={y} width={barW} height={h} rx={5} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="#94A3B8">{d.label}</text>
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
};

/* ── Action Badge ── */
const ActionBadge = ({ action }) => {
  const map = {
    CREATE:     { bg: "#DCFCE7", color: "#15803D" },
    UPDATE:     { bg: "#DBEAFE", color: "#1D4ED8" },
    DELETE:     { bg: "#FEE2E2", color: "#DC2626" },
    LOGIN:      { bg: "#F0FDF4", color: "#16A34A" },
    LOGOUT:     { bg: "#F8FAFC", color: "#64748B" },
    DEACTIVATE: { bg: "#FEF3C7", color: "#D97706" },
    REACTIVATE: { bg: "#DCFCE7", color: "#15803D" },
  };
  const s = map[action] ?? { bg: "#F1F5F9", color: "#475569" };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px",
      fontWeight: 600, background: s.bg, color: s.color,
    }}>{action}</span>
  );
};

const QUICK_LINKS = [
  { label: "Manage Staff",    to: "/admin/staff",          color: G,         icon: ICONS.staff },
  { label: "Doctors",         to: "/admin/doctors",        color: "#3B82F6", icon: ICONS.doctor },
  { label: "Guest Doctors",   to: "/admin/guest-doctors",  color: "#06B6D4", icon: ICONS.guest },
  { label: "Receptionists",   to: "/admin/receptionists",  color: "#10B981", icon: ICONS.patient },
  { label: "Lab Technicians", to: "/admin/lab-techs",      color: "#F59E0B", icon: ICONS.lab },
  { label: "Pharmacists",     to: "/admin/pharmacists",    color: "#8B5CF6", icon: ICONS.pharmacy },
  { label: "Audit Logs",      to: "/admin/audit",          color: "#EF4444", icon: ICONS.audit },
];

/* ── Skeleton ── */
const Skeleton = ({ h = 14, w = "100%", radius = 6 }) => (
  <div style={{ height: h, width: w, borderRadius: radius, background: "#E8EEF5", animation: "shimmer 1.4s infinite" }} />
);

export default function AdminDashboardPage() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const navigate = useNavigate();

  const fetchStats = useCallback(() => {
    setLoading(true);
    setError("");
    getDashboardStats()
      .then(setStats)
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 403) {
          setError("Access denied. You do not have permission to view dashboard statistics.");
        } else if (status === 404) {
          setError("Dashboard statistics endpoint not found. Please contact your administrator.");
        } else if (status === 500) {
          setError("Server error while loading statistics. Please try again later.");
        } else {
          setError("Could not load dashboard statistics. Check your connection and try again.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const chartData = stats ? [
    { label: "Staff",    value: stats.staff?.total                ?? 0 },
    { label: "Doctors",  value: stats.by_role?.doctors            ?? 0 },
    { label: "Guests",   value: stats.guest_doctors?.total        ?? 0 },
    { label: "Recep.",   value: stats.by_role?.receptionists      ?? 0 },
    { label: "Pharma.",  value: stats.by_role?.pharmacists        ?? 0 },
    { label: "Lab",      value: stats.by_role?.lab_technicians    ?? 0 },
    { label: "Patients", value: stats.patients?.total             ?? 0 },
    { label: "Meds",     value: stats.inventory?.active_medicines ?? 0 },
    { label: "Procs",    value: stats.procedures?.active          ?? 0 },
  ] : [];

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "3px" }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: "14px", color: "#94A3B8" }}>Hospital management overview</p>
        </div>
        <button
          onClick={() => navigate("/admin/audit")}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            background: G, color: "#fff", borderRadius: "10px",
            padding: "9px 18px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", border: "none", boxShadow: `0 2px 8px ${G}40`,
          }}
        >
          <Ico path={ICONS.export} size={14} color="#fff" />
          Export Report
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span>{error}</span>
          <button
            onClick={fetchStats}
            style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "16px", marginBottom: "24px" }}>
        {loading ? Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ height: "100px", borderRadius: "14px", background: "#fff", border: "1px solid #EEF2F7", padding: "20px 22px", display: "flex", gap: "16px" }}>
            <Skeleton h={46} w="46px" radius={12} />
            <div style={{ flex: 1 }}><Skeleton h={10} w="60%" /><div style={{ marginTop: "8px" }}><Skeleton h={24} w="40%" /></div></div>
          </div>
        )) : (<>
          <StatCard label="Total Staff"       value={stats?.staff?.total}                  icon={ICONS.staff}    accent={G}        sub={`${stats?.staff?.active ?? 0} active`} />
          <StatCard label="Active Staff"      value={stats?.staff?.active}                 icon={ICONS.staff}    accent="#3B82F6"  sub={`${stats?.staff?.inactive ?? 0} inactive`} />
          <StatCard label="Doctors"           value={stats?.by_role?.doctors}              icon={ICONS.doctor}   accent="#3B82F6"  sub="Registered" />
          <StatCard label="Receptionists"     value={stats?.by_role?.receptionists}        icon={ICONS.patient}  accent="#10B981"  sub="Registered" />
          <StatCard label="Lab Technicians"   value={stats?.by_role?.lab_technicians}      icon={ICONS.lab}      accent="#F59E0B"  sub="Registered" />
          <StatCard label="Pharmacists"       value={stats?.by_role?.pharmacists}          icon={ICONS.pharmacy} accent="#8B5CF6"  sub="Registered" />
          <StatCard label="Guest Doctors"     value={stats?.guest_doctors?.active}         icon={ICONS.guest}    accent="#06B6D4"  sub={`of ${stats?.guest_doctors?.total ?? 0} total`} />
          <StatCard label="Total Patients"    value={stats?.patients?.total}               icon={ICONS.patient}  accent="#EC4899"  sub="All time" />
          <StatCard label="Medicines"         value={stats?.inventory?.active_medicines}   icon={ICONS.medicine} accent="#F59E0B"  sub={`of ${stats?.inventory?.total_medicines ?? 0} total`} />
          <StatCard label="Procedures"        value={stats?.procedures?.active}            icon={ICONS.proc}     accent="#14B8A6"  sub={`of ${stats?.procedures?.total ?? 0} total`} />
          <StatCard label="Audit Events"      value={stats?.audit_total}                   icon={ICONS.audit}    accent="#EF4444"  sub="Total logged" />
        </>)}
      </div>

      {/* ── Chart + Quick Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }} className="admin-grid-2">
        {/* Chart */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #EEF2F7" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#0F172A" }}>Hospital Overview</h2>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Staff & resource counts</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: G, fontWeight: 500 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: G, display: "inline-block" }} />
              Active
            </div>
          </div>
          {loading
            ? <div style={{ height: "150px", display: "flex", alignItems: "center", justifyContent: "center" }}><Skeleton h={120} w="100%" radius={8} /></div>
            : <MiniBarChart data={chartData} color={G} />
          }
        </div>

        {/* Quick Actions */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #EEF2F7" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#0F172A", marginBottom: "16px" }}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {QUICK_LINKS.map(({ label, to, color, icon }) => (
              <Link key={to} to={to}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 12px", borderRadius: "10px",
                  textDecoration: "none", transition: "all 0.15s",
                  border: "1px solid #EEF2F7",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}28`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#EEF2F7"; }}
              >
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico path={icon} color={color} size={15} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B", flex: 1 }}>{label}</span>
                <Ico path={ICONS.arrow} color="#CBD5E1" size={14} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Audit Logs ── */}
      <div style={{ background: "#fff", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #EEF2F7" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#0F172A" }}>Recent Audit Logs</h2>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Latest system activity</p>
          </div>
          <Link to="/admin/audit" style={{ fontSize: "13px", color: G, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
            See All →
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                {["User", "Module", "Action", "Description", "Time"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={{ padding: "12px 14px" }}><Skeleton h={13} /></td>
                    ))}
                  </tr>
                ))
              ) : (stats?.recent_audit_logs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                    No audit logs yet.
                  </td>
                </tr>
              ) : (
                (stats?.recent_audit_logs ?? []).map((log) => (
                  <tr key={log.log_id}
                    style={{ borderBottom: "1px solid #F8FAFC", cursor: "default" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: G, flexShrink: 0 }}>
                          {(log.username ?? "?")[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{log.username ?? "system"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: "13px", color: "#475569" }}>{log.module}</td>
                    <td style={{ padding: "11px 14px" }}><ActionBadge action={log.action} /></td>
                    <td style={{ padding: "11px 14px", fontSize: "12px", color: "#64748B", maxWidth: "280px" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.description}</div>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap" }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @media (max-width: 900px) { .admin-grid-2 { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}