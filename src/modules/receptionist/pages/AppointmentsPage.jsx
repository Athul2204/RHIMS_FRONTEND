// src/modules/receptionist/pages/AppointmentsPage.jsx
// Shows all consultation bills as a "Schedule" view.
// Replaced the previous DEMO-data implementation with live API data.

import { useEffect, useState, useCallback } from "react";
import { getBills } from "../api/receptionApi";

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
  calendar: "M8 2v4 M16 2v4 M3 10h18 M21 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  filter:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  close:    "M18 6 6 18 M6 6l12 12",
  refresh:  "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
};

const PayBadge = ({ status, cancelled }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
    background: cancelled ? "#F1F5F9" : (status === "PAID" ? LIGHT_G : "#FEF3C7"),
    color:      cancelled ? "#64748B" : (status === "PAID" ? "#15803D" : "#D97706"),
  }}>
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cancelled ? "#94A3B8" : (status === "PAID" ? G : "#F59E0B") }} />
    {cancelled ? "Cancelled" : (status === "PAID" ? "Paid" : "Pending")}
  </span>
);

const TypeBadge = ({ type }) => (
  <span style={{
    padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
    background: type === "NEW" ? "#EFF6FF" : "#F5F3FF",
    color:      type === "NEW" ? "#2563EB" : "#7C3AED",
  }}>
    {type === "REVISIT" ? "Revisit" : "New"}
  </span>
);

export default function AppointmentsPage() {
  // Local YYYY-MM-DD for today. Avoids toISOString(), which converts to UTC
  // first and can roll the date back/forward a day depending on the user's
  // timezone offset (e.g. early-morning IST).
  const todayISO = () => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [bills, setBills]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState(""); // "" | "PENDING" | "PAID"
  const [count, setCount]       = useState(0);
  const [next, setNext]         = useState(null);
  const [prev, setPrev]         = useState(null);
  const [currentArg, setCurrentArg] = useState(null);

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const buildParams = useCallback(() => {
    const params = { page_size: 20 };
    if (dateFilter) params.date = dateFilter;
    if (statusFilter) params.payment_status = statusFilter;
    return params;
  }, [dateFilter, statusFilter]);

  const load = useCallback((arg = null) => {
    setLoading(true); setError("");
    const call = arg ?? buildParams();
    getBills(call)
      .then(d => {
        setBills(Array.isArray(d) ? d : (d?.results ?? []));
        setCount(Array.isArray(d) ? d.length : (d?.count ?? 0));
        setNext(d?.next ?? null);
        setPrev(d?.previous ?? null);
        setCurrentArg(arg);
      })
      .catch(() => setError("Failed to load consultations."))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  // Client-side search on top of server-side filters
  const displayed = bills.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (b.patient_name ?? "").toLowerCase().includes(q) ||
      (b.doctor_name  ?? "").toLowerCase().includes(q) ||
      (b.patient_mrd  ?? "").toLowerCase().includes(q) ||
      (b.op_number    ?? "").toLowerCase().includes(q) ||
      (b.bill_number  ?? "").toLowerCase().includes(q)
    );
  });

  const srchInp = {
    padding: "8px 12px 8px 36px", borderRadius: "10px", border: "1.5px solid #E8EDF4",
    fontSize: "13px", color: "#475569", background: "#F8FAFC", outline: "none",
    boxSizing: "border-box", width: "100%",
  };
  const selInp = {
    padding: "8px 12px", borderRadius: "10px", border: "1.5px solid #E8EDF4",
    fontSize: "12px", fontWeight: 600, color: "#475569", background: "#F8FAFC",
    cursor: "pointer", outline: "none",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: LIGHT_G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d={ICONS.calendar} size={20} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>Schedule</h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>{todayStr} · {count} consultation{count !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => load()}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 16px", borderRadius: "10px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Ico d={ICONS.refresh} size={14} color="#475569" /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>
      )}

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "340px" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}>
              <Ico d={ICONS.search} size={14} />
            </span>
            <input style={srchInp} placeholder="Search by name, MRD, OP no..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "2px" }}>
                <Ico d={ICONS.close} size={13} />
              </button>
            )}
          </div>

          {/* Date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ ...selInp, minWidth: "140px" }}
            title="Filter by date"
          />

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selInp}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>

          {/* Clear filters */}
          {(dateFilter || statusFilter) && (
            <button
              onClick={() => { setDateFilter(""); setStatusFilter(""); }}
              style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Column Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.9fr 1.2fr 0.8fr 0.8fr", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
          {["Patient", "MRD / OP No.", "Date", "Doctor", "Type", "Status"].map((h, i) => (
            <div key={i} style={{ fontSize: "11.5px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "20px" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ height: "52px", borderRadius: "8px", background: "#F1F5F9", marginBottom: "8px", animation: "shimmer 1.5s infinite", animationDelay: `${i*0.08}s` }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
            <Ico d={ICONS.calendar} size={36} color="#E2E8F0" />
            <p style={{ marginTop: "12px" }}>No consultations found.</p>
            {(search || dateFilter || statusFilter) && (
              <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "4px" }}>Try clearing the search or filters.</p>
            )}
          </div>
        ) : (
          displayed.map((b, i) => (
            <div key={b.bill_id ?? i}
              style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.9fr 1.2fr 0.8fr 0.8fr", padding: "13px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center", transition: "background 0.1s", cursor: "default", opacity: b.consultation_status === "CANCELLED" ? 0.6 : 1 }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Patient */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${G}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: G, flexShrink: 0 }}>
                  {(b.patient_name?.[0] ?? "P").toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B" }}>{b.patient_name}</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                    ₹{parseFloat(b.total_amount ?? b.consultation_fee ?? 0).toLocaleString("en-IN")}
                    {parseFloat(b.registration_fee ?? 0) > 0 && (
                      <> · incl. ₹{parseFloat(b.registration_fee).toLocaleString("en-IN")} MRD fee</>
                    )}
                  </div>
                </div>
              </div>
              {/* MRD / OP */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "#475569" }}>{b.patient_mrd}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{b.op_number}</div>
              </div>
              {/* Date */}
              <span style={{ fontSize: "13px", color: "#475569" }}>
                {b.consultation_date
                  ? new Date(b.consultation_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"}
              </span>
              {/* Doctor */}
              <span style={{ fontSize: "13px", color: "#475569" }}>
                {b.doctor_name
                  ? (b.doctor_name.toLowerCase().startsWith("dr") ? b.doctor_name : `Dr. ${b.doctor_name}`)
                  : "—"}
              </span>
              {/* Type */}
              <TypeBadge type={b.consultation_type} />
              {/* Status */}
              <PayBadge status={b.payment_status} cancelled={b.consultation_status === "CANCELLED"} />
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {(next || prev) && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
          <button onClick={() => prev && load(prev)} disabled={!prev}
            style={{ padding: "8px 18px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px", color: "#475569" }}>
            ← Previous
          </button>
          <button onClick={() => next && load(next)} disabled={!next}
            style={{ padding: "8px 18px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px", color: "#475569" }}>
            Next →
          </button>
        </div>
      )}

      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}