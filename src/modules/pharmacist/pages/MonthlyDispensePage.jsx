// src/modules/pharmacist/pages/MonthlyDispensePage.jsx
// Full monthly dispense report — reads ONLY from getBills({ bill_status: "PAID" })
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getBills } from "../api/pharmacistApi";
import { flattenFormError } from "../../../utils/formErrors";

/* ─── brand colour ─────────────────────────────────────────── */
const G = "#8B5CF6";

/* ─── tiny SVG icon helper ─────────────────────────────────── */
const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  calendar: "M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
  arrow_l:  "M15 18l-6-6 6-6",
  arrow_r:  "M9 18l6-6-6-6",
  rupee:    "M6 3h12 M6 8h12 M6 13c5.523 0 10 2.239 10 5s-4.477 5-10 5",
  pill:     "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  bill:     "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  print:    "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  refresh:  "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  check:    "M20 6 9 17l-5-5",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  tag:      "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01",
  chart:    "M18 20V10 M12 20V4 M6 20v-6",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  sort_asc: "M8 10l4-4 4 4 M8 14l4 4 4-4",
  rx:       "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  trend:    "M22 7l-8.5 8.5-5-5L1 18",
};

const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

const PAY_COLORS = {
  CASH:  { bg: "#F0FDF4", color: "#15803D", dot: "#22C55E" },
  CARD:  { bg: "#EFF6FF", color: "#1D4ED8", dot: "#3B82F6" },
  UPI:   { bg: "#FDF4FF", color: "#7C3AED", dot: "#A855F7" },
  OTHER: { bg: "#F8FAFC", color: "#475569", dot: "#94A3B8" },
};

/* ─── format helpers ────────────────────────────────────────── */
const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v.toFixed(0)}`;
};
const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

/* ─── mini bar ──────────────────────────────────────────────── */
function MiniBar({ value, max, color = G }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#F1F5F9", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

/* ─── skeleton loader ───────────────────────────────────────── */
function Skeleton({ h = 110, r = 14 }) {
  return (
    <div style={{ height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
}

/* ─── KPI card ──────────────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, accent = G, trend }) {
  const trendUp = trend > 0;
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico d={icon} size={18} color={accent} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: trendUp ? "#15803D" : "#B91C1C", background: trendUp ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: 99 }}>
            {trendUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─── day-by-day heatmap ────────────────────────────────────── */
function WeekHeatmap({ bills, year, month }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = {};
  bills.forEach(b => {
    if (!b.bill_date) return;
    const d = new Date(b.bill_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = (byDay[d.getDate()] || 0) + parseFloat(b.total_amount || 0);
    }
  });
  const maxVal = Math.max(...Object.values(byDay), 1);

  const opacity = (v) => {
    if (!v) return 0.05;
    const r = v / maxVal;
    if (r > 0.75) return 1;
    if (r > 0.5)  return 0.7;
    if (r > 0.25) return 0.45;
    return 0.2;
  };

  // First day of month (0=Sun…6=Sat) for offset
  const firstDow = new Date(year, month, 1).getDay();

  return (
    <div>
      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 28px)", gap: 4, marginBottom: 4 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ width: 28, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#CBD5E1" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 28px)", gap: 4 }}>
        {/* leading empty cells */}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`e${i}`} style={{ width: 28, height: 28 }} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const val = byDay[day] || 0;
          const billCount = bills.filter(b => {
            if (!b.bill_date) return false;
            const d = new Date(b.bill_date);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
          }).length;
          return (
            <div key={day}
              title={`${day} ${MONTH_NAMES[month]}: ${val ? `${fmt(val)} · ${billCount} bill${billCount !== 1 ? "s" : ""}` : "No sales"}`}
              style={{ width: 28, height: 28, borderRadius: 6, background: G, opacity: opacity(val), cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: val ? "#fff" : "transparent", fontWeight: 700 }}>
              {day}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12 }}>
        {[0.05, 0.2, 0.45, 0.7, 1].map((o, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: G, opacity: o }} />
        ))}
        <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 4 }}>Lower → Higher revenue</span>
      </div>
    </div>
  );
}

/* ─── daily revenue bar chart ───────────────────────────────── */
function DailyBarChart({ bills, year, month }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = {};
  bills.forEach(b => {
    if (!b.bill_date) return;
    const d = new Date(b.bill_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = (byDay[d.getDate()] || 0) + parseFloat(b.total_amount || 0);
    }
  });
  const maxVal = Math.max(...Object.values(byDay), 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "0 2px" }}>
      {days.map(d => {
        const val = byDay[d] || 0;
        const h = maxVal > 0 ? Math.max(2, Math.round((val / maxVal) * 76)) : 2;
        return (
          <div key={d} title={`${d}: ${val ? fmt(val) : "—"}`}
            style={{ flex: 1, height: h, borderRadius: "3px 3px 0 0", background: val ? G : "#F1F5F9", opacity: val ? 0.85 : 1, transition: "height 0.4s ease", cursor: "default" }} />
        );
      })}
    </div>
  );
}

/* ─── payment method breakdown ──────────────────────────────── */
function PaymentBreakdown({ bills }) {
  const totals = {};
  bills.forEach(b => {
    const m = b.payment_method || "OTHER";
    totals[m] = (totals[m] || 0) + parseFloat(b.total_amount || 0);
  });
  const grand = Object.values(totals).reduce((a, v) => a + v, 0) || 1;
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map(([method, amount]) => {
        const cfg = PAY_COLORS[method] || PAY_COLORS.OTHER;
        const pct = ((amount / grand) * 100).toFixed(1);
        return (
          <div key={method} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, width: 46 }}>{method}</span>
            <MiniBar value={amount} max={grand} color={cfg.dot} />
            <span style={{ fontSize: 11, color: "#94A3B8", width: 38, textAlign: "right" }}>{pct}%</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", width: 78, textAlign: "right" }}>{fmtShort(amount)}</span>
          </div>
        );
      })}
      {entries.length === 0 && <p style={{ fontSize: 12, color: "#94A3B8" }}>No payment data</p>}
    </div>
  );
}

/* ─── top medicines table ───────────────────────────────────── */
function TopMedicines({ bills }) {
  const [sortBy, setSortBy] = useState("revenue"); // revenue | qty
  const [search, setSearch] = useState("");

  const medMap = {};
  bills.forEach(b => {
    (b.medicine_items || []).forEach(item => {
      const name = item.medicine_name || "Unknown";
      if (!medMap[name]) medMap[name] = { qty: 0, revenue: 0, bills: 0 };
      medMap[name].qty     += Number(item.quantity || 0);
      medMap[name].revenue += parseFloat(item.item_total || 0);
      medMap[name].bills   += 1;
    });
  });

  const totalRevenue = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0.01);

  const allMeds = Object.entries(medMap)
    .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (sortBy === "qty" ? b[1].qty - a[1].qty : b[1].revenue - a[1].revenue));

  const maxVal = allMeds[0]?.[1]?.[sortBy] || 1;

  if (Object.keys(medMap).length === 0) return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
      No medicines dispensed this month.
    </div>
  );

  return (
    <div>
      {/* controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8" />
          </div>
          <input placeholder="Search medicine…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["revenue", "qty"].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              style={{ padding: "7px 14px", borderRadius: 7, border: sortBy === s ? `2px solid ${G}` : "1.5px solid #E2E8F0", background: sortBy === s ? `${G}10` : "#fff", color: sortBy === s ? G : "#64748B", fontWeight: sortBy === s ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
              {s === "revenue" ? "By Revenue" : "By Quantity"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>{allMeds.length} medicines</span>
      </div>

      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 100px 90px 100px 100px", gap: 8, padding: "6px 8px 10px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #F1F5F9" }}>
        <span>#</span>
        <span>Medicine</span>
        <span style={{ textAlign: "center" }}>Qty Dispensed</span>
        <span style={{ textAlign: "right" }}>Revenue</span>
        <span style={{ textAlign: "right" }}>Avg/Bill</span>
        <span style={{ textAlign: "right" }}>Rev Share</span>
      </div>

      {allMeds.map(([name, { qty, revenue, bills: cnt }], idx) => {
        const pct = ((revenue / totalRevenue) * 100).toFixed(1);
        const barW = Math.round((sortBy === "qty" ? qty / maxVal : revenue / maxVal) * 100);
        return (
          <div key={name}
            style={{ display: "grid", gridTemplateColumns: "22px 1fr 100px 90px 100px 100px", gap: 8, padding: "10px 8px", borderBottom: "1px solid #F8FAFC", alignItems: "center", fontSize: 13 }}
            onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#CBD5E1" }}>{idx + 1}</span>
            <div>
              <p style={{ fontWeight: 600, color: "#0F172A", margin: 0, fontSize: 13 }}>{name}</p>
              <div style={{ height: 3, borderRadius: 99, background: "#F1F5F9", marginTop: 4, overflow: "hidden" }}>
                <div style={{ width: `${barW}%`, height: "100%", background: G, borderRadius: 99, transition: "width 0.4s ease" }} />
              </div>
            </div>
            <span style={{ textAlign: "center", color: "#475569", fontSize: 12, fontWeight: 600 }}>{qty.toLocaleString("en-IN")}</span>
            <span style={{ textAlign: "right", fontWeight: 600, color: "#0F172A", fontSize: 12 }}>{fmtShort(revenue)}</span>
            <span style={{ textAlign: "right", color: "#64748B", fontSize: 12 }}>{cnt > 0 ? fmtShort(revenue / cnt) : "—"}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${G}15`, color: G }}>{pct}%</span>
            </div>
          </div>
        );
      })}

      {/* totals footer */}
      {allMeds.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 100px 90px 100px 100px", gap: 8, padding: "10px 8px", borderTop: "2px solid #EEF2F7", background: "#F8FAFC", fontSize: 13, alignItems: "center", fontWeight: 700, color: "#0F172A" }}>
          <span />
          <span>Total</span>
          <span style={{ textAlign: "center" }}>{allMeds.reduce((s,[,v]) => s + v.qty, 0).toLocaleString("en-IN")}</span>
          <span style={{ textAlign: "right" }}>{fmtShort(allMeds.reduce((s,[,v]) => s + v.revenue, 0))}</span>
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

/* ─── full bill table ──────────────────────────────────────── */
function BillTable({ bills, navigate }) {
  const [search, setSearch]     = useState("");
  const [payFilter, setPayFilter] = useState("ALL");
  const [sortKey, setSortKey]   = useState("date_desc");
  const [page, setPage]         = useState(1);
  const PER_PAGE = 20;

  const methods = useMemo(() => [...new Set(bills.map(b => b.payment_method || "OTHER"))], [bills]);

  const sorted = useMemo(() => {
    let list = [...bills];
    if (payFilter !== "ALL") list = list.filter(b => b.payment_method === payFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => {
        const patientName = (b.patient_info?.name || b.patient_name || "").toLowerCase();
        return patientName.includes(q) || (b.bill_number || "").toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case "date_desc": return new Date(b.bill_date) - new Date(a.bill_date);
        case "date_asc":  return new Date(a.bill_date) - new Date(b.bill_date);
        case "amt_desc":  return parseFloat(b.total_amount) - parseFloat(a.total_amount);
        case "amt_asc":   return parseFloat(a.total_amount) - parseFloat(b.total_amount);
        default:          return 0;
      }
    });
    return list;
  }, [bills, search, payFilter, sortKey]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // reset page when filters change
  const prevFilter = useRef({ search, payFilter, sortKey });
  useEffect(() => {
    if (prevFilter.current.search !== search || prevFilter.current.payFilter !== payFilter || prevFilter.current.sortKey !== sortKey) {
      setPage(1);
      prevFilter.current = { search, payFilter, sortKey };
    }
  }, [search, payFilter, sortKey]);

  const SortBtn = ({ label, asc, desc }) => {
    const active = sortKey === asc || sortKey === desc;
    return (
      <button onClick={() => setSortKey(sortKey === desc ? asc : desc)}
        style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: active ? G : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label} {active ? (sortKey === desc ? "↓" : "↑") : "↕"}
      </button>
    );
  };

  return (
    <div>
      {/* filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8" />
          </div>
          <input placeholder="Search patient or bill number…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["ALL", ...methods].map(m => (
            <button key={m} onClick={() => setPayFilter(m)}
              style={{ padding: "7px 12px", borderRadius: 7, border: payFilter === m ? `2px solid ${G}` : "1.5px solid #E2E8F0", background: payFilter === m ? `${G}10` : "#fff", color: payFilter === m ? G : "#64748B", fontWeight: payFilter === m ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
              {m}
            </button>
          ))}
        </div>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, cursor: "pointer", outline: "none" }}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amt_desc">Highest amount</option>
          <option value="amt_asc">Lowest amount</option>
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #EEF2F7", overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr 80px 110px 90px 80px 70px", padding: "9px 16px", background: "#F8FAFC", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bill #</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Patient</span>
          <SortBtn label="Date" asc="date_asc" desc="date_desc" />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Medicines</span>
          <SortBtn label="Amount" asc="amt_asc" desc="amt_desc" />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>Pay</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Action</span>
        </div>

        {paged.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            {search || payFilter !== "ALL" ? "No bills match your filters." : "No paid bills this month."}
          </div>
        ) : paged.map((b, idx) => {
          const cfg = PAY_COLORS[b.payment_method] || PAY_COLORS.OTHER;
          const medCount = (b.medicine_items || []).length;
          const medQty   = (b.medicine_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
          return (
            <div key={b.bill_id}
              style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr 80px 110px 90px 80px 70px", padding: "11px 16px", fontSize: 13, borderTop: "1px solid #F8FAFC", alignItems: "center", gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 12 }}>{b.bill_number}</span>
              <div>
                <p style={{ fontWeight: 500, color: "#0F172A", margin: 0, fontSize: 13 }}>{b.patient_info?.name || b.patient_name || "—"}</p>
                {b.prescription && (
                  <p style={{ fontSize: 10, color: G, margin: "1px 0 0", fontWeight: 600 }}>
                    <Ico d={ICONS.rx} size={9} color={G} /> Rx #{b.prescription}
                  </p>
                )}
              </div>
              <span style={{ color: "#64748B", fontSize: 12 }}>{fmtDate(b.bill_date)}</span>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>{medCount} medicine{medCount !== 1 ? "s" : ""}</p>
                <p style={{ margin: 0, fontSize: 10, color: "#94A3B8" }}>{medQty} units</p>
              </div>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                {fmt(b.total_amount)}
              </span>
              <div style={{ textAlign: "center" }}>
                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                  {b.payment_method || "—"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <button onClick={() => navigate(`/pharmacy/bills/print/${b.bill_id}`)}
                  style={{ padding: "5px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#64748B", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Ico d={ICONS.eye} size={11} color="#94A3B8" /> View
                </button>
              </div>
            </div>
          );
        })}

        {/* footer totals */}
        {sorted.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr 80px 110px 90px 80px 70px", padding: "10px 16px", borderTop: "2px solid #EEF2F7", background: "#F8FAFC", fontSize: 13, gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#0F172A", gridColumn: "1 / 4", fontSize: 12 }}>
              {sorted.length} bill{sorted.length !== 1 ? "s" : ""}
              {sorted.length !== bills.length ? ` (filtered from ${bills.length})` : ""}
            </span>
            <span style={{ textAlign: "right" }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{sorted.reduce((s,b) => s + (b.medicine_items||[]).reduce((x,i)=>x+Number(i.quantity||0),0), 0).toLocaleString("en-IN")} units</span>
            </span>
            <span style={{ textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
              {fmt(sorted.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0))}
            </span>
            <span /><span />
          </div>
        )}
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14, alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: 12, color: "#64748B" }}>
            ← Prev
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let pg;
            if (totalPages <= 7) { pg = i + 1; }
            else if (page <= 4)  { pg = i + 1; if (i === 6) pg = totalPages; }
            else if (page >= totalPages - 3) { pg = totalPages - 6 + i; }
            else { const offsets = [-3,-2,-1,0,1,2,3]; pg = page + offsets[i]; }
            return (
              <button key={pg} onClick={() => setPage(pg)}
                style={{ width: 34, height: 34, borderRadius: 7, border: page === pg ? `2px solid ${G}` : "1.5px solid #E2E8F0", background: page === pg ? G : "#fff", color: page === pg ? "#fff" : "#64748B", fontWeight: page === pg ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
                {pg}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: 12, color: "#64748B" }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── month-over-month comparison panel ─────────────────────── */
function MonthComparison({ allBills, year, month }) {
  const getData = (y, m) => {
    const bills = allBills.filter(b => {
      if (!b.bill_date) return false;
      const d = new Date(b.bill_date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    const revenue = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
    const units   = bills.reduce((s, b) => s + (b.medicine_items || []).reduce((x, i) => x + Number(i.quantity || 0), 0), 0);
    return { revenue, units, count: bills.length };
  };

  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    if (m < 0) { m += 12; y -= 1; }
    months.push({ label: `${MONTH_NAMES[m].slice(0, 3)} ${y}`, ...getData(y, m), isCurrent: i === 0 });
  }

  const maxRev = Math.max(...months.map(m => m.revenue), 1);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100, marginBottom: 12 }}>
        {months.map((m, i) => {
          const h = Math.max(4, Math.round((m.revenue / maxRev) * 90));
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>{m.revenue > 0 ? fmtShort(m.revenue) : ""}</span>
              <div title={`${m.label}: ${fmt(m.revenue)}`}
                style={{ width: "100%", height: h, borderRadius: "4px 4px 0 0", background: m.isCurrent ? G : `${G}50`, transition: "height 0.4s ease" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 9, color: m.isCurrent ? G : "#94A3B8", fontWeight: m.isCurrent ? 700 : 400, margin: 0 }}>{m.label}</p>
            <p style={{ fontSize: 9, color: "#CBD5E1", margin: "1px 0 0" }}>{m.count}b</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────────── */
export default function MonthlyDispensePage() {
  const navigate = useNavigate();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [allBills, setAllBills] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [tab, setTab]           = useState("overview"); // overview | medicines | bills | compare

  /* fetch all PAID bills once; filter client-side by month */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBills({ bill_status: "PAID" });
      setAllBills(Array.isArray(data) ? data : (data?.results ?? []));
    } catch (e) {
      setError(flattenFormError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* bills filtered to selected month */
  const monthBills = useMemo(() => allBills.filter(b => {
    if (!b.bill_date) return false;
    const d = new Date(b.bill_date);
    return d.getFullYear() === year && d.getMonth() === month;
  }), [allBills, year, month]);

  /* previous month bills for trend comparison */
  const prevMonthBills = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    return allBills.filter(b => {
      if (!b.bill_date) return false;
      const d = new Date(b.bill_date);
      return d.getFullYear() === py && d.getMonth() === pm;
    });
  }, [allBills, year, month]);

  /* derived stats */
  const stats = useMemo(() => {
    const revenue    = monthBills.reduce((s, b) => s + parseFloat(b.total_amount  || 0), 0);
    const gst        = monthBills.reduce((s, b) => s + parseFloat(b.gst_amount    || 0), 0);
    const subtotal   = monthBills.reduce((s, b) => s + parseFloat(b.subtotal      || 0), 0);
    const totalUnits = monthBills.reduce((s, b) =>
      s + (b.medicine_items || []).reduce((x, i) => x + Number(i.quantity || 0), 0), 0);
    const uniquePts  = new Set(monthBills.map(b => b.patient_name || b.patient?.name || b.patient?.full_name).filter(Boolean)).size;
    const avgBill    = monthBills.length > 0 ? revenue / monthBills.length : 0;
    return { revenue, gst, subtotal, totalUnits, uniquePts, avgBill };
  }, [monthBills]);

  /* prev month stats for trends */
  const prevStats = useMemo(() => {
    const revenue = prevMonthBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
    const totalUnits = prevMonthBills.reduce((s, b) =>
      s + (b.medicine_items || []).reduce((x, i) => x + Number(i.quantity || 0), 0), 0);
    return { revenue, totalUnits, count: prevMonthBills.length };
  }, [prevMonthBills]);

  const trendPct = (cur, prev) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : undefined;

  /* navigation */
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const cur  = new Date(year, month);
    const now2 = new Date(now.getFullYear(), now.getMonth());
    if (cur >= now2) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const rows = [
      ["Bill Number","Patient","Date","Payment Method","Subtotal","GST","Total","Medicines (count)","Units Dispensed"],
      ...monthBills.map(b => [
        b.bill_number,
        b.patient_info?.name || b.patient_name || "",
        b.bill_date    || "",
        b.payment_method || "",
        parseFloat(b.subtotal    || 0).toFixed(2),
        parseFloat(b.gst_amount  || 0).toFixed(2),
        parseFloat(b.total_amount|| 0).toFixed(2),
        (b.medicine_items || []).length,
        (b.medicine_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
      ])
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `dispense-${MONTH_NAMES[month]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TAB_STYLE = (active) => ({
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500,
    background: active ? G : "transparent",
    color: active ? "#fff" : "#64748B",
    border: "none", cursor: "pointer", transition: "all 0.15s",
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: 1160 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>Monthly Dispense Report</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "4px 0 0" }}>
            Full dispensing record for {MONTH_NAMES[month]} {year}
            {!loading && ` · ${allBills.length} total paid bills loaded`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleExportCSV} disabled={loading || monthBills.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B", opacity: (loading || monthBills.length === 0) ? 0.5 : 1 }}>
            <Ico d={ICONS.download} size={13} color="#64748B" /> Export CSV
          </button>
          <button onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B" }}>
            <Ico d={ICONS.print} size={13} color="#64748B" /> Print
          </button>
          <button onClick={load} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: loading ? G : "#64748B" }}>
            <Ico d={ICONS.refresh} size={13} color={loading ? G : "#64748B"} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Month navigator ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "14px 18px", flexWrap: "wrap" }}>
        <button onClick={prevMonth}
          style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico d={ICONS.arrow_l} size={16} color="#475569" />
        </button>

        <div style={{ flex: "0 0 auto", textAlign: "center", minWidth: 160 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}>
            {MONTH_NAMES[month]} {year}
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
            {loading
              ? "Loading…"
              : `${monthBills.length} bill${monthBills.length !== 1 ? "s" : ""} · ${stats.totalUnits.toLocaleString("en-IN")} units`}
          </p>
        </div>

        <button onClick={nextMonth} disabled={isCurrentMonth}
          style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #E2E8F0", background: isCurrentMonth ? "#F8FAFC" : "#fff", cursor: isCurrentMonth ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isCurrentMonth ? 0.4 : 1 }}>
          <Ico d={ICONS.arrow_r} size={16} color="#475569" />
        </button>

        {/* quick month picker */}
        <div style={{ display: "flex", gap: 4, marginLeft: 8, flexWrap: "wrap" }}>
          {MONTH_NAMES.map((m, i) => {
            const future = new Date(year, i) > new Date(now.getFullYear(), now.getMonth());
            if (future) return null;
            return (
              <button key={i} onClick={() => setMonth(i)}
                style={{ padding: "4px 8px", borderRadius: 6, border: month === i ? `2px solid ${G}` : "1px solid #E2E8F0", background: month === i ? `${G}10` : "#fff", color: month === i ? G : "#64748B", fontSize: 11, fontWeight: month === i ? 700 : 400, cursor: "pointer" }}>
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 20, fontSize: 13, color: "#B91C1C" }}>
          ⚠ {error}
          <button onClick={load} style={{ marginLeft: 12, fontWeight: 600, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} />)
        ) : (
          <>
            <KpiCard icon={ICONS.rupee} label="Total Revenue"   value={fmtShort(stats.revenue)}
              sub={`GST: ${fmtShort(stats.gst)}`} accent="#8B5CF6"
              trend={trendPct(stats.revenue, prevStats.revenue)} />
            <KpiCard icon={ICONS.bill}  label="Bills Dispensed" value={monthBills.length}
              sub={`Avg: ${fmtShort(stats.avgBill)}/bill`} accent="#0EA5E9"
              trend={trendPct(monthBills.length, prevStats.count)} />
            <KpiCard icon={ICONS.pill}  label="Units Dispensed" value={stats.totalUnits.toLocaleString("en-IN")}
              sub="medicine units" accent="#10B981"
              trend={trendPct(stats.totalUnits, prevStats.totalUnits)} />
            <KpiCard icon={ICONS.user}  label="Unique Patients" value={stats.uniquePts}
              sub="served this month" accent="#F59E0B" />
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#F8FAFC", borderRadius: 10, padding: 4, width: "fit-content" }}>
        <button style={TAB_STYLE(tab === "overview")}  onClick={() => setTab("overview")}>Overview</button>
        <button style={TAB_STYLE(tab === "medicines")} onClick={() => setTab("medicines")}>
          Top Medicines
        </button>
        <button style={TAB_STYLE(tab === "bills")}     onClick={() => setTab("bills")}>
          All Bills {!loading && monthBills.length > 0 && `(${monthBills.length})`}
        </button>
        <button style={TAB_STYLE(tab === "compare")}   onClick={() => setTab("compare")}>Trend</button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

          {/* Daily heatmap */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Daily activity</h2>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Revenue intensity by day</span>
            </div>
            <WeekHeatmap bills={allBills} year={year} month={month} />
          </div>

          {/* Payment breakdown */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>Payment methods</h2>
            <PaymentBreakdown bills={monthBills} />
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Net revenue (excl. GST)", fmt(stats.subtotal)],
                ["GST collected",           fmt(stats.gst)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Gross total</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: G }}>{fmt(stats.revenue)}</span>
              </div>
            </div>
          </div>

          {/* Daily bar chart */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Daily revenue</h2>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Every day of {MONTH_NAMES[month]}</span>
            </div>
            {monthBills.length === 0
              ? <p style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No data</p>
              : <DailyBarChart bills={monthBills} year={year} month={month} />
            }
          </div>

          {/* Recent bills preview */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Recent bills</h2>
              <button onClick={() => setTab("bills")}
                style={{ fontSize: 12, color: G, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                View all {monthBills.length} →
              </button>
            </div>
            {monthBills.length === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                No dispensed bills for {MONTH_NAMES[month]} {year}.
              </div>
            ) : (
              <div>
                {[...monthBills].sort((a, b) => b.bill_id - a.bill_id).slice(0, 7).map((b, idx) => {
                  const cfg = PAY_COLORS[b.payment_method] || PAY_COLORS.OTHER;
                  const medQty = (b.medicine_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
                  return (
                    <div key={b.bill_id} onClick={() => navigate(`/pharmacy/bills/print/${b.bill_id}`)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: idx < 6 ? "1px solid #F8FAFC" : "none", cursor: "pointer", borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", flexShrink: 0 }}>{fmtDate(b.bill_date)}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: "#0F172A", margin: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.patient_info?.name || b.patient_name || "—"}</p>
                          <p style={{ fontSize: 10, color: "#94A3B8", margin: "1px 0 0" }}>{b.bill_number} · {medQty} units</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>{fmt(b.total_amount)}</span>
                        <span style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{b.payment_method}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MEDICINES TAB ── */}
      {tab === "medicines" && !loading && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 18px" }}>
            Medicines dispensed — {MONTH_NAMES[month]} {year}
          </h2>
          <TopMedicines bills={monthBills} />
        </div>
      )}

      {/* ── BILLS TAB ── */}
      {tab === "bills" && !loading && (
        <BillTable bills={monthBills} navigate={navigate} />
      )}

      {/* ── TREND TAB ── */}
      {tab === "compare" && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* 6-month revenue chart */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "20px 22px", gridColumn: "1 / -1" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: "0 0 18px" }}>
              6-month revenue trend
            </h2>
            <MonthComparison allBills={allBills} year={year} month={month} />
          </div>

          {/* prev vs current comparison table */}
          {[
            { label: "Revenue",      cur: fmt(stats.revenue),    prev: fmt(prevStats.revenue),    trend: trendPct(stats.revenue, prevStats.revenue) },
            { label: "Bills",        cur: monthBills.length,     prev: prevStats.count,            trend: trendPct(monthBills.length, prevStats.count) },
            { label: "Units",        cur: stats.totalUnits,      prev: prevStats.totalUnits,        trend: trendPct(stats.totalUnits, prevStats.totalUnits) },
            { label: "Avg Bill",     cur: fmt(stats.avgBill),    prev: prevStats.count > 0 ? fmt(prevStats.revenue / prevStats.count) : "—", trend: undefined },
            { label: "Patients",     cur: stats.uniquePts,       prev: "—",                         trend: undefined },
          ].map(row => (
            <div key={row.label} style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>{row.label}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>{row.cur}</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>prev: {row.prev}</p>
                </div>
                {row.trend !== undefined && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.trend >= 0 ? "#15803D" : "#B91C1C", background: row.trend >= 0 ? "#F0FDF4" : "#FEF2F2", padding: "4px 10px", borderRadius: 99 }}>
                    {row.trend >= 0 ? "▲" : "▼"} {Math.abs(row.trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* loading skeleton for tabs */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <Skeleton h={220} /><Skeleton h={220} />
            <Skeleton h={160} /><Skeleton h={220} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @media print {
          button { display: none !important; }
          body   { margin: 0; }
        }
      `}</style>
    </div>
  );
}