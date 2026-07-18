// src/modules/receptionist/pages/ReceptionDashboardPage.jsx
import { useEffect, useState } from "react";
import { getPatients, getBills } from "../api/receptionApi";

const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";

const Ico = ({ d, size = 16, color = "currentColor", extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  patients: { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", e: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
  today:    { d: "M8 2v4 M16 2v4 M3 10h18 M21 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" },
  pending:  { d: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2" },
  paid:     { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14", e: "M22 4 12 14.01l-3-3" },
};

const unpack = (raw) => {
  if (!raw) return { items: [], count: 0 };
  if (Array.isArray(raw)) return { items: raw, count: raw.length };
  return {
    items: raw.results ?? raw.data ?? [],
    count: raw.count  ?? raw.results?.length ?? 0,
  };
};

const StatCard = ({ label, value, icon, accent, sub, loading }) => (
  <div style={{
    background: "#fff", borderRadius: "14px", padding: "20px 22px",
    border: "1px solid #E8EDF4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    display: "flex", alignItems: "flex-start", gap: "14px",
  }}>
    <div style={{
      width: "46px", height: "46px", borderRadius: "12px",
      background: `${accent}18`, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}>
      <Ico d={icon.d} extra={icon.e} size={20} color={accent} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" }}>{label}</p>
      {loading
        ? <div style={{ height: "32px", width: "60px", borderRadius: "6px", background: "#F1F5F9", animation: "shimmer 1.5s infinite" }} />
        : <p style={{ fontSize: "30px", fontWeight: 700, color: "#0F172A", lineHeight: 1.1 }}>{value}</p>
      }
      {sub && <p style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "3px" }}>{sub}</p>}
    </div>
  </div>
);

const PayBadge = ({ status }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
    background: status === "PAID" ? LIGHT_G : "#FEF3C7",
    color:      status === "PAID" ? "#15803D" : "#D97706",
  }}>
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: status === "PAID" ? G : "#F59E0B" }} />
    {status === "PAID" ? "Paid" : "Pending"}
  </span>
);

const TypeBadge = ({ type }) => (
  <span style={{
    padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
    background: type === "NEW" ? "#EFF6FF" : "#F5F3FF",
    color:      type === "NEW" ? "#2563EB" : "#7C3AED",
  }}>{type === "REVISIT" ? "Revisit" : "New"}</span>
);

export default function ReceptionDashboardPage() {
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalPending,  setTotalPending]  = useState(0);
  const [totalPaid,     setTotalPaid]     = useState(0);
  const [recentPatients, setRecentPatients] = useState([]);
  const [todayBills, setTodayBills]         = useState([]);
  const [loading, setLoading]               = useState(true);

  const today   = new Date().toISOString().split("T")[0];
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.allSettled([
      // (A) Recent patients — page_size:8 for table; count = total
      getPatients({ page_size: 8 }),
      // (B) Today's bills
      getBills({ date: today, page_size: 200 }),
      // (C) Pending count — use backend payment_status filter + page_size:1 to read .count
      getBills({ payment_status: "PENDING", page_size: 1 }),
      // (D) Paid count
      getBills({ payment_status: "PAID", page_size: 1 }),
    ]).then(([pRes, tRes, pendRes, paidRes]) => {
      if (!active) return;
      if (pRes.status === "fulfilled") {
        const { items, count } = unpack(pRes.value);
        setRecentPatients(items);
        setTotalPatients(count);
      }
      if (tRes.status === "fulfilled") {
        const { items } = unpack(tRes.value);
        setTodayBills(items);
      }
      // Use .count from paginated response for accurate totals
      if (pendRes.status === "fulfilled") {
        setTotalPending(unpack(pendRes.value).count);
      }
      if (paidRes.status === "fulfilled") {
        setTotalPaid(unpack(paidRes.value).count);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    
    return () => { active = false; };
  }, [today]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "3px" }}>
            Reception Dashboard
          </h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>{dateStr}</p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "9px 16px", borderRadius: "10px", border: "1px solid #E8EDF4",
          background: "#F8FAFC", fontSize: "12px", fontWeight: 600, color: "#475569",
        }}>
          <Ico d={ICONS.today.d} size={14} color={G} />
          {loading ? "—" : todayBills.length} consultations today
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard label="Total Patients"  value={totalPatients}     icon={ICONS.patients} accent={G}       sub="Registered"  loading={loading} />
        <StatCard label="Today's Bills"   value={todayBills.length} icon={ICONS.today}    accent="#3B82F6"  sub="Today only"  loading={loading} />
        <StatCard label="Pending Payment" value={totalPending}      icon={ICONS.pending}  accent="#F59E0B"  sub="Awaiting"    loading={loading} />
        <StatCard label="Paid Bills"      value={totalPaid}         icon={ICONS.paid}     accent="#10B981"  sub="All time"    loading={loading} />
      </div>

      {/* Two-column tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }} className="reception-grid">

        {/* Recent Patients */}
        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Recent Patients</h2>
            <span style={{ fontSize: "11px", fontWeight: 600, color: G, background: LIGHT_G, padding: "3px 9px", borderRadius: "20px" }}>
              {totalPatients} total
            </span>
          </div>
          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: "16px", borderRadius: "6px", background: "#F1F5F9", animation: "shimmer 1.5s infinite", animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
          ) : recentPatients.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No patients yet.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentPatients.map((p, i) => (
                <li key={p.patient_id ?? i}
                  style={{ padding: "11px 20px", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "default", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${G}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: G, flexShrink: 0 }}>
                      {(p.first_name?.[0] ?? "P").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{p.first_name} {p.last_name}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>{p.mrd_number} · {p.phone}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>{p.gender ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Today's Bills */}
        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Today's Consultations</h2>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#F59E0B", background: "#FEF3C7", padding: "3px 9px", borderRadius: "20px" }}>
              {todayBills.filter(b => b.payment_status === "PENDING").length} pending
            </span>
          </div>
          {loading ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: "16px", borderRadius: "6px", background: "#F1F5F9", animation: "shimmer 1.5s infinite", animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
          ) : todayBills.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No consultations today.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {todayBills.slice(0, 8).map((b, i) => (
                <li key={b.bill_id ?? i}
                  style={{ padding: "11px 20px", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B" }}>{b.patient_name}</span>
                      <TypeBadge type={b.consultation_type} />
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#94A3B8", marginTop: "2px" }}>
                      {b.op_number} · {b.doctor_name ?? "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                      ₹{parseFloat(b.total_amount ?? b.consultation_fee ?? 0).toLocaleString("en-IN")}
                    </span>
                    <PayBadge status={b.payment_status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:680px){.reception-grid{grid-template-columns:1fr!important}}
        @keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
    </div>
  );
}