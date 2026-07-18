// src/modules/manager/pages/ManagerDashboardPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getFinanceDashboard } from "../api/managerApi";

const ACCENT = "#6366F1";
const GREEN  = "#16A34A";
const RED    = "#EF4444";
const TEAL   = "#0891B2";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week",  label: "Week" },
  { value: "month", label: "Month" },
  { value: "year",  label: "Year" },
];

const PERIOD_SUB = { today: "Today", week: "This Week", month: "This Month", year: "This Year" };

const QUICK_LINKS = [
  { label: "Support Staff", icon: "🧑‍⚕️", path: "/manager/support-staff", color: "#3B82F6" },
  { label: "Salary",        icon: "💰",   path: "/manager/salary",        color: "#8B5CF6" },
  { label: "Attendance",    icon: "🗓️",   path: "/manager/attendance",    color: "#16A34A" },
  { label: "Leaves",        icon: "🌴",   path: "/manager/leaves",        color: "#EA580C" },
  { label: "Expenses",      icon: "💸",   path: "/manager/expenses",      color: "#EF4444" },
  { label: "Bills",         icon: "🧾",   path: "/manager/bills",         color: "#0891B2" },
];

const cardStyle = {
  background: "#fff", borderRadius: "14px", padding: "20px 22px",
  border: "1px solid #E8EDF4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

// ════════════════════════════════════════════════════════
// Headline stat card
// ════════════════════════════════════════════════════════
function StatCard({ title, value, sub, icon, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>{title}</p>
          <p style={{ fontSize: "23px", fontWeight: 800, color, margin: 0 }}>{value}</p>
          {sub && <p style={{ fontSize: "12px", color: "#64748B", margin: "5px 0 0" }}>{sub}</p>}
        </div>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "20px" }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Expense breakdown — 4 buckets, amount + % bars
// ════════════════════════════════════════════════════════
function ExpenseBreakdown({ expenses, navigate }) {
  if (!expenses) return null;
  const buckets = [
    { label: "Manual Expenses",     value: expenses.manual?.total            || 0, color: "#F59E0B" },
    { label: "Salary Paid",         value: expenses.salary_paid?.amount      || 0, color: "#8B5CF6" },
    { label: "Medicine Purchases",  value: expenses.medicine_purchases?.amount || 0, color: "#EC4899" },
    { label: "Supply Purchases",    value: expenses.supply_purchases?.amount   || 0, color: "#16A34A" },
  ];
  const gross = expenses.gross_total || buckets.reduce((s, b) => s + b.value, 0) || 1;

  return (
    <div style={cardStyle}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>Where the money is going</p>
      <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 16px" }}>Breakdown of the {fmt(gross)} Total Expenses above — see Profit card for the figure after refunds</p>
      {buckets.map(b => {
        const pct = gross > 0 ? (b.value / gross) * 100 : 0;
        return (
          <div
            key={b.label}
            onClick={() => navigate("/manager/expenses")}
            style={{ marginBottom: "14px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>{b.label}</span>
              <span style={{ fontSize: "12.5px", color: "#64748B" }}>
                {fmt(b.value)} <span style={{ color: "#94A3B8" }}>({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: b.color, borderRadius: "4px", transition: "width 0.5s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Trend chart — hand-rolled inline SVG (no charting library)
// Bars: revenue vs expenses. Line overlay: profit.
// ════════════════════════════════════════════════════════
function TrendChart({ trend }) {
  if (!trend || trend.length === 0) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Revenue vs Expenses Trend</p>
        <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", padding: "40px 0" }}>No trend data for this period.</p>
      </div>
    );
  }

  const n = trend.length;
  const VB_W = Math.max(500, n * 42);
  const VB_H = 220;
  const y0 = 155;     // baseline for bars (value = 0)
  const barH = 120;   // max bar height (top of tallest bar sits at y0-barH)
  const topPad = y0 - barH; // = 35

  const maxVal = Math.max(1, ...trend.map(d => Math.max(d.revenue || 0, d.expenses || 0)));
  const groupW = VB_W / n;
  const barW = Math.min(groupW * 0.32, 26);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const points = trend.map((d, i) => {
    const gx = i * groupW;
    const revH = ((d.revenue || 0) / maxVal) * barH;
    const expH = ((d.expenses || 0) / maxVal) * barH;
    const profit = d.profit ?? ((d.revenue || 0) - (d.expenses || 0));
    const cy = clamp(y0 - (profit / maxVal) * barH, 18, 200);
    return {
      revX: gx + groupW * 0.16, revY: y0 - revH, revH,
      expX: gx + groupW * 0.16 + barW + 3, expY: y0 - expH, expH,
      cx: gx + groupW / 2, cy,
      label: d.label || d.month, d,
    };
  });

  // thin labels if there are too many points
  const labelStep = n <= 14 ? 1 : Math.ceil(n / 10);

  const polyline = points.map(p => `${p.cx},${p.cy}`).join(" ");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Revenue vs Expenses Trend</p>
      </div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="220" preserveAspectRatio="none">
        {/* reference gridlines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={0} x2={VB_W} y1={y0 - barH * f} y2={y0 - barH * f} stroke="#F1F5F9" strokeWidth="1" />
        ))}
        {/* baseline (zero) */}
        <line x1={0} x2={VB_W} y1={y0} y2={y0} stroke="#E2E8F0" strokeWidth="1.5" />

        {/* bars */}
        {points.map((p, i) => (
          <g key={i}>
            <rect x={p.revX} y={p.revY} width={barW} height={Math.max(p.revH, 1)} rx="2.5" fill={ACCENT}>
              <title>{`${p.label} · Revenue: ${fmt(p.d.revenue)}`}</title>
            </rect>
            <rect x={p.expX} y={p.expY} width={barW} height={Math.max(p.expH, 1)} rx="2.5" fill="#F87171">
              <title>{`${p.label} · Expenses: ${fmt(p.d.expenses)}`}</title>
            </rect>
          </g>
        ))}

        {/* profit overlay line */}
        <polyline points={polyline} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const profitVal = p.d.profit ?? ((p.d.revenue || 0) - (p.d.expenses || 0));
          return (
            <circle key={i} cx={p.cx} cy={p.cy} r="3" fill={profitVal >= 0 ? GREEN : RED}>
              <title>{`${p.label} · Profit: ${fmt(profitVal)}`}</title>
            </circle>
          );
        })}

        {/* x-axis labels */}
        {points.map((p, i) => (
          i % labelStep === 0 && (
            <text key={i} x={p.cx} y={y0 + 16} fontSize="9" fill="#94A3B8" textAnchor="end"
              transform={`rotate(-40 ${p.cx} ${y0 + 16})`}>
              {p.label}
            </text>
          )
        ))}
      </svg>
      <div style={{ display: "flex", gap: "16px", marginTop: "6px", flexWrap: "wrap" }}>
        {[[ACCENT, "Revenue"], ["#F87171", "Expenses"], [GREEN, "Profit"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: c }} />
            <span style={{ fontSize: "11px", color: "#64748B" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Recent expenses (left column)
// ════════════════════════════════════════════════════════
function RecentExpenses({ expenses, navigate }) {
  const list = expenses?.recent || [];
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Recent Expenses</p>
        <span onClick={() => navigate("/manager/expenses")} style={{ fontSize: "12px", fontWeight: 600, color: ACCENT, cursor: "pointer" }}>
          View all →
        </span>
      </div>
      {list.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>No expenses recorded for this period.</p>
      ) : list.map(e => (
        <div key={e.expense_id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F8FAFC" }}>
          <div>
            <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#1E293B", margin: 0 }}>{e.title}</p>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{e.category} · {e.date}</p>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#DC2626" }}>{fmt(e.amount)}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Revenue split (right column) — Consultation / Pharmacy / Laboratory
// ════════════════════════════════════════════════════════
function RevenueSplit({ revenue }) {
  if (!revenue) return null;
  const items = [
    { key: "consultation", label: "Consultation", icon: "🏥", color: "#6366F1" },
    { key: "pharmacy",     label: "Pharmacy",      icon: "💊", color: "#16A34A" },
    { key: "laboratory",   label: "Laboratory",    icon: "🔬", color: "#F59E0B" },
  ];
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", margin: "0 0 14px" }}>Revenue Split</p>
      {items.map(it => {
        const d = revenue[it.key] || { amount: 0, count: 0 };
        return (
          <div key={it.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "10px", background: `${it.color}0C`, marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>{it.icon}</span>
              <div>
                <p style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A", margin: 0 }}>{it.label}</p>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: "1px 0 0" }}>
                  {d.count} bill{d.count === 1 ? "" : "s"}
                  {it.key === "laboratory" && <span style={{ marginLeft: "5px", color: "#CBD5E1" }}>(not included in total)</span>}
                </p>
              </div>
            </div>
            <span style={{ fontSize: "13.5px", fontWeight: 800, color: it.color }}>{fmt(d.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Quick links row
// ════════════════════════════════════════════════════════
function QuickLinks({ navigate }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
      {QUICK_LINKS.map(q => (
        <div
          key={q.path}
          onClick={() => navigate(q.path)}
          style={{
            background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4",
            padding: "16px", display: "flex", alignItems: "center", gap: "10px",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `${q.color}55`; e.currentTarget.style.background = `${q.color}08`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8EDF4"; e.currentTarget.style.background = "#fff"; }}
        >
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${q.color}16`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "16px" }}>{q.icon}</span>
          </div>
          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155" }}>{q.label}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Root page
// ════════════════════════════════════════════════════════
export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("month");
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFinanceDashboard({ period });
      setData(res);
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const pl = data ? data.profit_loss : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>Finance Dashboard</h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Overview of hospital revenue, expenses & profitability</p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                border: period === p.value ? "none" : "1px solid #E8EDF4",
                background: period === p.value ? ACCENT : "#fff",
                color: period === p.value ? "#fff" : "#64748B",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
          <button onClick={load} style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: "1px solid #E8EDF4", background: "#fff", color: "#64748B", cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#94A3B8", fontSize: "14px" }}>
          Loading financial data…
        </div>
      )}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "14px 18px", color: "#DC2626", marginBottom: "16px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* 1. Headline stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "20px" }}>
            <StatCard
              title="Revenue" icon="💰" color={GREEN}
              value={fmt(data.revenue?.total)}
              sub="Consultation + Pharmacy"
            />
            <StatCard
              title="Total Expenses" icon="💸" color={RED}
              value={fmt(data.expenses?.gross_total)}
              sub="incl. salary + purchases, before refunds"
            />
            <StatCard
              title="Refunds" icon="↩️" color={TEAL}
              value={fmt(data.refunds?.total)}
              sub="Medicine + Supply returns"
            />
            <StatCard
              title={pl >= 0 ? "Profit" : "Loss"} icon={pl >= 0 ? "📈" : "📉"} color={pl >= 0 ? GREEN : RED}
              value={fmt(Math.abs(pl))}
              sub={PERIOD_SUB[period] || "This period"}
            />
          </div>

          {/* 2. Expense breakdown */}
          <div style={{ marginBottom: "20px" }}>
            <ExpenseBreakdown expenses={data.expenses} navigate={navigate} />
          </div>

          {/* 3. Trend chart */}
          <div style={{ marginBottom: "20px" }}>
            <TrendChart trend={data.trend} />
          </div>

          {/* 4. Two-column row: recent expenses + revenue split */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px", marginBottom: "20px" }}>
            <RecentExpenses expenses={data.expenses} navigate={navigate} />
            <RevenueSplit revenue={data.revenue} />
          </div>

          {/* 5. Quick links */}
          <QuickLinks navigate={navigate} />
        </>
      )}
    </div>
  );
}