// src/modules/pharmacist/pages/PharmacistDashboardPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { getBills, getMedicines, getStockAlerts, getDashboardSummary }  from "../api/pharmacistApi";

const G = "#8B5CF6";
const INP = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", background: "#fff", boxSizing: "border-box" };

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const ICONS = {
  bill:    "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  rx:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  pill:    "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  alert:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  arrow:   "M5 12h14 M12 5l7 7-7 7",
  check:   "M20 6 9 17l-5-5",
  clock:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  box:     "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  rupee:   "M6 3h12 M6 8h12 M6 13c5.523 0 10 2.239 10 5s-4.477 5-10 5",
};

const BILL_STATUS = {
  OPEN:      { label: "Open",      bg: "#EFF6FF", color: "#1D4ED8" },
  PAID:      { label: "Paid",      bg: "#F0FDF4", color: "#15803D" },
  COMPLETED: { label: "Completed", bg: "#F5F3FF", color: "#6D28D9" },
  CANCELLED: { label: "Cancelled", bg: "#FEF2F2", color: "#B91C1C" },
};

function StatCard({ icon, label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico d={icon} size={18} color={accent} />
        </div>
        {sub && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{sub}</span>}
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", margin: 0, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>{label}</p>
      </div>
    </div>
  );
}

function AlertBadge({ count, type }) {
  if (!count) return null;
  const isExpiry = type === "expiry";
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: isExpiry ? "#FFF7ED" : "#FEF2F2", color: isExpiry ? "#C2410C" : "#B91C1C" }}>
      {count} {isExpiry ? "expiring" : "low stock"}
    </span>
  );
}

export default function PharmacistDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch dashboard summary first (if available)
      let dashboardData = null;
      try {
        dashboardData = await getDashboardSummary();
      } catch (e) {
        console.warn("Dashboard summary not available, falling back to individual calls");
      }

      // Fetch individual data in parallel
        // NEW (CORRECT):
const [billData, alertData, medData] = await Promise.all([
  getBills({}),
  getStockAlerts()
    .then(alerts => ({ results: alerts }))
    .catch(() => ({ results: [] })),
  getMedicines({ show_inactive: false }).catch(() => ({ results: [] })),
]);
 
 

      // Parse responses
      const billList = Array.isArray(billData) ? billData : (billData?.results ?? billData?.data ?? []);
      const alertList = Array.isArray(alertData) ? alertData : (alertData?.results ?? alertData?.data ?? []);
      const medList = Array.isArray(medData) ? medData : (medData?.results ?? medData?.data ?? []);

      setBills(billList);
      setAlerts(alertList);
      setMedicines(medList);

    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  // Derived stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayBills = bills.filter(b => b.bill_date === todayStr);
  const openBills = bills.filter(b => b.bill_status === "OPEN");
  const completedBills = bills.filter(b => b.bill_status === "COMPLETED");
  const paidToday = todayBills.filter(b => b.bill_status === "PAID");

  // Calculate revenue safely
  const revenueToday = paidToday.reduce((s, b) => {
    const amount = parseFloat(b.total_amount || 0);
    return s + (isNaN(amount) ? 0 : amount);
  }, 0);

  const pendingAction = openBills.length + completedBills.length;
  const lowStockAlerts = alerts.filter(a => a.alert_type === "LOW_STOCK");
  const expiryAlerts = alerts.filter(a => a.alert_type === "EXPIRY");

  // Low medicines - medicines with stock between 1 and 10 units
  const lowMedicines = medicines.filter(m => {
    const stock = m.total_stock ?? 0;
    return stock > 0 && stock <= 10;
  });

  const recentBills = [...bills]
    .sort((a, b) => (b.bill_id || 0) - (a.bill_id || 0))
    .slice(0, 6);

  const QUICK_LINKS = [
    { label: "View Prescriptions", path: "/pharmacy/prescriptions", icon: ICONS.rx, accent: G },
    { label: "Manage Bills", path: "/pharmacy/bills", icon: ICONS.bill, accent: "#0EA5E9" },
    { label: "Medicine Inventory", path: "/pharmacy/medicines", icon: ICONS.pill, accent: "#10B981" },
    { label: "Stock & Alerts", path: "/pharmacy/stock", icon: ICONS.alert, accent: "#F59E0B" },
  ];

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 1100, margin: "0 auto", padding: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Pharmacy Dashboard</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "4px 0 0" }}>{today}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B", opacity: refreshing ? 0.6 : 1 }}>
          <Ico d={ICONS.refresh} size={14} color={refreshing ? G : "#64748B"} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Alerts Banner */}
      {(lowStockAlerts.length > 0 || expiryAlerts.length > 0) && (
        <div onClick={() => navigate("/pharmacy/stock")}
          style={{ background: "#FFF7ED", border: "1px solid #FFD966", borderRadius: 10, padding: "12px 16px", marginBottom: 20, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#92400E", fontWeight: 600 }}>
            ⚠️ Stock alerts:
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AlertBadge count={lowStockAlerts.length} type="low" />
            <AlertBadge count={expiryAlerts.length} type="expiry" />
            <span style={{ marginLeft: 8, fontSize: 12, color: "#C2410C", fontWeight: 600 }}>View →</span>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 100, background: "#F8FAFC", borderRadius: 14, border: "1px solid #EEF2F7", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          <StatCard
            icon={ICONS.bill}
            label="Bills today"
            value={todayBills.length}
            sub="today"
            accent="#8B5CF6"
            onClick={() => navigate("/pharmacy/bills")}
          />
          <StatCard
            icon={ICONS.clock}
            label="Pending action"
            value={pendingAction}
            sub="open+completed"
            accent="#0EA5E9"
            onClick={() => navigate("/pharmacy/bills")}
          />
          <StatCard
            icon={ICONS.rupee}
            label="Revenue today"
            value={`₹${revenueToday.toFixed(0)}`}
            sub="paid bills"
            accent="#10B981"
          />
          <StatCard
            icon={ICONS.alert}
            label="Stock alerts"
            value={alerts.length}
            sub="unresolved"
            accent="#F59E0B"
            onClick={() => navigate("/pharmacy/stock")}
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>

        {/* Quick Links */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 14px" }}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK_LINKS.map(q => (
              <button key={q.path} onClick={() => navigate(q.path)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 9, border: "1px solid #F1F5F9", background: "#FAFBFC", cursor: "pointer", textAlign: "left", transition: "border-color 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = q.accent; e.currentTarget.style.background = `${q.accent}08`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#F1F5F9"; e.currentTarget.style.background = "#FAFBFC"; }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${q.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico d={q.icon} size={15} color={q.accent} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{q.label}</span>
                <Ico d={ICONS.arrow} size={13} color="#CBD5E1" style={{ marginLeft: "auto" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Low Stock Medicines */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Low Stock Medicines</h2>
            <button onClick={() => navigate("/pharmacy/stock")}
              style={{ fontSize: 12, color: G, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              View all →
            </button>
          </div>
          {loading ? (
            <div style={{ padding: "28px 0", textAlign: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${G}20`, borderTop: `2px solid ${G}`, animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
            </div>
          ) : lowMedicines.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                <Ico d={ICONS.check} size={16} color="#15803D" />
              </div>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontWeight: 500 }}>All medicines have adequate stock</p>
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {lowMedicines.map(m => {
                const stock = m.total_stock || m.stock || 0;
                return (
                  <div key={m.medicine_id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F8FAFC" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: 0 }}>{m.name}</p>
                      <p style={{ fontSize: 11, color: "#94A3B8", margin: "1px 0 0" }}>{m.category || "Uncategorized"}</p>
                    </div>
                    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: stock === 0 ? "#FEF2F2" : "#FFF7ED", color: stock === 0 ? "#B91C1C" : "#C2410C" }}>
                      {stock === 0 ? "Out of stock" : `${stock} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Recent Bills</h2>
          <button onClick={() => navigate("/pharmacy/bills")}
            style={{ fontSize: 12, color: G, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
            View all →
          </button>
        </div>
        {loading ? (
          <div style={{ padding: "28px 0", textAlign: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${G}20`, borderTop: `2px solid ${G}`, animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          </div>
        ) : recentBills.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No bills yet today.</div>
        ) : (
          <div>
            {/* Column Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1fr 1fr 80px", padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", background: "#F8FAFC", borderRadius: 8, marginBottom: 4 }}>
              <span>Bill #</span>
              <span>Patient</span>
              <span>Date</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {recentBills.map(b => {
              const s = BILL_STATUS[b.bill_status] || { label: b.bill_status, bg: "#F1F5F9", color: "#64748B" };
              const amount = parseFloat(b.total_amount || 0);
              return (
                <div key={b.bill_id} onClick={() => navigate("/pharmacy/bills")}
                  style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1fr 1fr 80px", padding: "9px 12px", fontSize: 13, alignItems: "center", cursor: "pointer", borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 12 }}>{b.bill_number || "—"}</span>
                  <span style={{ color: "#475569" }}>{b.patient_info?.name || b.patient_name || "—"}</span>
                  <span style={{ color: "#94A3B8", fontSize: 12 }}>{b.bill_date ? new Date(b.bill_date).toLocaleDateString("en-IN") : "—"}</span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: "#0F172A" }}>₹{isNaN(amount) ? 0 : amount.toFixed(0)}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}