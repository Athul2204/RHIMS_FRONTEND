// src/modules/manager/pages/BillsPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAllBills, getBillDetail, getFinanceDashboard } from "../api/managerApi";
import ExportButtons from "../../../components/shared/ExportButtons";

const ACCENT = "#6366F1";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const SOURCE_STYLE = {
  "Reception":   { bg: "#EFF6FF", text: "#3B82F6", icon: "🏥" },
  "Pharmacy":    { bg: "#F0FDF4", text: "#16A34A", icon: "💊" },
  "Laboratory":  { bg: "#FFF7ED", text: "#EA580C", icon: "🔬" },
  "Prebooking":  { bg: "#FDF4FF", text: "#A21CAF", icon: "📅" },
};

// Backend source labels ↔ the short tab values used for filtering/API calls.
const SOURCE_LABEL_TO_TAB = { Reception: "reception", Pharmacy: "pharmacy", Laboratory: "lab", Prebooking: "prebooking" };

// Values a bill's status can actually take:
//  - Reception / Lab: PharmacyBill.payment_status-style PAID / PENDING
//  - Pharmacy: bill_status lifecycle (DRAFT/OPEN/READY/COMPLETED/PAID/CANCELLED),
//    surfaced here as `payment_status` for consistency with Finance Dashboard revenue recognition.
// No model in this system supports a PARTIAL status, so it isn't offered as a filter option.
const PAY_STATUS_STYLE = {
  "PAID":      { bg: "#D1FAE5", text: "#065F46" },
  "PENDING":   { bg: "#FEF3C7", text: "#92400E" },
  "DRAFT":     { bg: "#F1F5F9", text: "#475569" },
  "OPEN":      { bg: "#E0E7FF", text: "#3730A3" },
  "READY":     { bg: "#FEF9C3", text: "#854D0E" },
  "COMPLETED": { bg: "#DBEAFE", text: "#1E40AF" },
  "CANCELLED": { bg: "#FEE2E2", text: "#991B1B" },
};

export default function BillsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  // Format as YYYY-MM-DD using LOCAL date components. toISOString() converts
  // to UTC first, which can silently roll the date back/forward a day
  // depending on the user's timezone offset (e.g. early-morning IST) — using
  // getFullYear/getMonth/getDate keeps it anchored to what the user actually sees.
  const toISO = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Quick date-range presets. Each returns { start, end } as YYYY-MM-DD strings.
  // "week" = Monday of the current week through today; "custom" leaves the
  // existing start/end untouched (the user picks dates manually).
  const PRESET_RANGES = {
    today: () => {
      const t = new Date();
      return { start: toISO(t), end: toISO(t) };
    },
    week: () => {
      const t = new Date();
      const day = t.getDay(); // 0 = Sun ... 6 = Sat
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(t);
      monday.setDate(t.getDate() - diffToMonday);
      return { start: toISO(monday), end: toISO(t) };
    },
    month: () => {
      const t = new Date();
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      return { start: toISO(first), end: toISO(t) };
    },
    year: () => {
      const t = new Date();
      const first = new Date(t.getFullYear(), 0, 1);
      return { start: toISO(first), end: toISO(t) };
    },
  };

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [failedSources, setFailedSources] = useState([]);
  // Other Income isn't a "bill" — it lives in a separate model with no
  // source/status shape AllBillsView returns — so it can't be derived from
  // `bills` like the other cards. Pulled from the same Finance Dashboard
  // endpoint the manager dashboard uses, over the same date range, so this
  // page's revenue figure matches FinanceDashboardView's total_revenue
  // (Reception + Pharmacy + Other Income) instead of silently omitting it.
  const [otherIncome, setOtherIncome] = useState({ amount: 0, count: 0, lab_commission: 0 });
  const [datePreset, setDatePreset] = useState("month");
  const [start, setStart] = useState(toISO(firstOfMonth));
  const [end, setEnd] = useState(toISO(today));
  const [source, setSource] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  // Sub-filter within the Lab / Pharmacy tabs only: '' (all), 'walk-in', or
  // 'registered' (registered = came in via a doctor's consultation / MRD
  // registration). Reception has no walk-in concept, so it's not offered there.
  const [patientTypeFilter, setPatientTypeFilter] = useState("");

  const selectSource = (v) => {
    setSource(v);
    if (v !== "lab" && v !== "pharmacy") setPatientTypeFilter("");
  };

  // Apply a preset: recompute the range and mark it active. Manually editing
  // either date input switches the mode to "custom" so presets and manual
  // dates never fight each other.
  const applyPreset = (preset) => {
    setDatePreset(preset);
    const { start: s, end: e } = PRESET_RANGES[preset]();
    setStart(s);
    setEnd(e);
  };

  // Bill detail modal state
  const [selectedBill, setSelectedBill] = useState(null); // the row clicked (list-shaped)
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const openBill = async (b) => {
    const tab = SOURCE_LABEL_TO_TAB[b.source];
    setSelectedBill(b);
    setDetail(null);
    setDetailError(null);

    if (!tab || !b.id) {
      // This means the bill row came from a stale/older bills list that
      // doesn't include the numeric `id` field — refresh the page to
      // re-fetch from the backend.
      setDetailError("This bill is missing an ID needed to load details. Try refreshing the page.");
      console.error("openBill: missing tab or id", { source: b.source, id: b.id, tab });
      return;
    }

    setDetailLoading(true);
    try {
      const data = await getBillDetail(tab, b.id);
      setDetail(data);
    } catch (err) {
      console.error("getBillDetail failed:", err);
      setDetailError(err?.response?.data?.error || "Failed to load bill details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeBill = () => {
    setSelectedBill(null);
    setDetail(null);
    setDetailError(null);
  };

  // Always fetch the full dataset (all sources) — the `source` tab only controls
  // what's shown in the table below, not what's fetched. This lets the summary
  // cards reflect totals across every source regardless of which tab is active.
  //
  // Guard against incomplete dates: while a <input type="date"> is being
  // edited (or cleared) its value can briefly be "", which would otherwise
  // fire off a request with an empty start/end and the backend would 400 on
  // it. Wait until both are complete, valid YYYY-MM-DD values before fetching.
  const isValidDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

  const load = useCallback(async () => {
    if (!isValidDate(start) || !isValidDate(end)) return;
    if (start > end) { setError("'From' date must be before 'To' date."); return; }
    setLoading(true); setError(null);
    try {
      const [billsRes, financeRes] = await Promise.all([
        getAllBills({ start, end, source: "all" }),
        // Other Income has no per-row source in AllBillsView, so it's fetched
        // from the Finance Dashboard instead, over the same custom range.
        getFinanceDashboard({ period: "custom", start, end }).catch(() => null),
      ]);
      setBills(billsRes?.bills || []);
      setFailedSources(billsRes?.failed_sources || []);
      const oi = financeRes?.revenue?.other_income;
      setOtherIncome(oi ? { amount: Number(oi.amount || 0), count: oi.count || 0, lab_commission: Number(oi.lab_commission || 0) } : { amount: 0, count: 0, lab_commission: 0 });
    } catch { setError("Failed to load bills."); }
    finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  // Base set for KPI/summary cards: search + status filters apply, but NOT the
  // source tab, so switching tabs never zeroes out other sources' totals.
  const searchStatusFiltered = bills.filter(b => {
    if (statusFilter && b.payment_status !== statusFilter) return false;
    if (methodFilter && (b.payment_method || "").toUpperCase() !== methodFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.bill_number?.toLowerCase().includes(q) ||
        b.patient?.toLowerCase().includes(q) ||
        b.source?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Table set: same as above, plus the active source tab.
  // Tab values are short ("lab") but backend source labels are full ("Laboratory"),
  // so map explicitly instead of relying on substring/lowercase equality.
  //
  // "All" here means "all bills the hospital itself collects" — Reception +
  // Pharmacy — so Laboratory is excluded from it by default, same as it's
  // excluded from Revenue Collected/Pending above. Selecting the Lab tab
  // explicitly still shows lab bills for reference. Prebooking gets the same
  // treatment: it's an advance against a future ConsultationBill rather than
  // a finalized bill itself (and once converted, it disappears from this
  // list entirely in favor of the resulting Reception row — see the backend
  // comment in AllBillsView), so it's reference-only here too.
  const filtered = searchStatusFiltered.filter(b => {
    if (source === 'all') return b.source !== 'Laboratory' && b.source !== 'Prebooking';
    if (SOURCE_LABEL_TO_TAB[b.source] !== source) return false;
    if ((source === 'lab' || source === 'pharmacy') && patientTypeFilter && b.patient_type !== patientTypeFilter) return false;
    return true;
  });

  // Total revenue = Reception + Pharmacy (PAID only). Lab is tracked separately —
  // the hospital doesn't collect lab payments itself, so lab figures are shown
  // purely for reference and excluded from every "hospital revenue" total below,
  // including Pending (which should only reflect money the hospital is owed).
  // Computed from searchStatusFiltered (all sources) so these cards stay accurate
  // no matter which source tab is selected.
  const paidBills = searchStatusFiltered.filter(b => b.payment_status === "PAID");
  const billsRevenue = paidBills
    .filter(b => b.source === "Reception" || b.source === "Pharmacy")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  // Matches FinanceDashboardView's total_revenue = Reception + Pharmacy + Other Income.
  const totalRevenue = billsRevenue + otherIncome.amount;
  const labRevenue = paidBills
    .filter(b => b.source === "Laboratory")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const pendingAmount = searchStatusFiltered
    .filter(b => b.payment_status === "PENDING" && b.source !== "Laboratory" && b.source !== "Prebooking")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const labPendingAmount = searchStatusFiltered
    .filter(b => b.payment_status === "PENDING" && b.source === "Laboratory")
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  // Prebooking advances: reference only, same reasoning as Lab above. These
  // rows never overlap with a Reception row for the same money — the backend
  // excludes CONVERTED bookings from this list entirely once that money is
  // reflected as a real ConsultationBill — so summing PAID ones here can't
  // double-count against totalRevenue.
  const prebookingRevenue = paidBills
    .filter(b => b.source === "Prebooking")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const prebookingPendingAmount = searchStatusFiltered
    .filter(b => b.payment_status === "PENDING" && b.source === "Prebooking")
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const bySource = ["Reception", "Pharmacy", "Laboratory"].map(src => {
    const srcBills = searchStatusFiltered.filter(b => b.source === src && b.payment_status === "PAID");
    return { src, total: srcBills.reduce((s, b) => s + Number(b.amount || 0), 0), count: srcBills.length };
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "22px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0 }}>All Bills</h1>
          <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Consolidated view of all hospital bills — Consultation, Pharmacy & Lab, plus Other Income</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/manager/income")}
            style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#16A34A", fontWeight: 700, fontSize: "12.5px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            View Other Income →
          </button>
          <button
            onClick={() => navigate("/manager/expenses")}
            style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: ACCENT, fontWeight: 700, fontSize: "12.5px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            View Expenses & Purchases →
          </button>
        </div>
      </div>

      {/* Date filters */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4", padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Period</label>
            <div style={{ display: "flex", gap: "4px" }}>
              {[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["year", "This Year"]].map(([v, l]) => (
                <button key={v} onClick={() => applyPreset(v)}
                  style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: datePreset === v ? "none" : "1px solid #E8EDF4", background: datePreset === v ? ACCENT : "#fff", color: datePreset === v ? "#fff" : "#64748B", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>From</label>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); setDatePreset(""); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>To</label>
            <input type="date" value={end} onChange={e => { setEnd(e.target.value); setDatePreset(""); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Source</label>
            <div style={{ display: "flex", gap: "4px" }}>
              {[["all", "All"], ["reception", "🏥 Consult"], ["pharmacy", "💊 Pharmacy"], ["lab", "🔬 Lab"]].map(([v, l]) => (
                <button key={v} onClick={() => selectSource(v)}
                  style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: source === v ? "none" : "1px solid #E8EDF4", background: source === v ? ACCENT : "#fff", color: source === v ? "#fff" : "#64748B", cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>
            {/* Lab / Pharmacy sub-filter: a bill either came from a walk-in
                patient (no doctor/MRD involved) or from a doctor-linked
                consultation / registered patient. Reception has no walk-in
                concept, so this row is hidden for that tab. */}
            {(source === "lab" || source === "pharmacy") && (() => {
              const c = source === "lab" ? { active: "#EA580C", border: "#FED7AA", bg: "#FFF7ED", text: "#C2410C" }
                                          : { active: "#16A34A", border: "#BBF7D0", bg: "#F0FDF4", text: "#15803D" };
              return (
                <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                  {[["", "All"], ["walk-in", "🚶 Walk-in"], ["registered", "🩺 Doctor-linked"]].map(([v, l]) => (
                    <button key={v} onClick={() => setPatientTypeFilter(v)}
                      style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "11px", fontWeight: 600, border: patientTypeFilter === v ? "none" : `1px solid ${c.border}`, background: patientTypeFilter === v ? c.active : c.bg, color: patientTypeFilter === v ? "#fff" : c.text, cursor: "pointer" }}>
                      {l}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#fff" }}>
              <option value="">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="READY">Ready</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Payment Mode</label>
            <div style={{ display: "flex", gap: "4px" }}>
              {[["", "All"], ["CASH", "💵 Cash"], ["UPI", "📱 UPI"]].map(([v, l]) => (
                <button key={v} onClick={() => setMethodFilter(v)}
                  style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: methodFilter === v ? "none" : "1px solid #E8EDF4", background: methodFilter === v ? ACCENT : "#fff", color: methodFilter === v ? "#fff" : "#64748B", cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Bill no, patient…"
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none", width: "160px" }} />
          </div>
          <button onClick={load} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>↻ Refresh</button>
          <ExportButtons
            rows={filtered}
            columns={[
              { header: "Date", accessor: "date" },
              { header: "Bill No.", accessor: "bill_number" },
              { header: "Source", accessor: "source" },
              { header: "Patient", accessor: "patient" },
              { header: "Amount", accessor: b => Number(b.amount || 0) },
              { header: "Status", accessor: "payment_status" },
              { header: "Payment Mode", accessor: "payment_method" },
            ]}
            filename={`bills_overview_${start}_to_${end}`}
            title="Bills Overview"
            dateRange={{ from: start, to: end }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {/* Total bills */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "1px solid #E8EDF4" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase" }}>Total Bills</p>
          <p style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: 0 }}>{filtered.length}</p>
          {source === 'all' && <p style={{ fontSize: "10px", color: "#94A3B8", margin: "2px 0 0" }}>🏥 Reception + 💊 Pharmacy</p>}
        </div>

        {/* Revenue = Reception + Pharmacy + Other Income */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "2px solid #D1FAE5" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase" }}>Revenue Collected</p>
          <p style={{ fontSize: "9.5px", color: "#10B981", fontWeight: 600, margin: "0 0 4px" }}>🏥 Reception + 💊 Pharmacy + 📥 Other Income</p>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#10B981", margin: 0 }}>{fmt(totalRevenue)}</p>
          {otherIncome.amount > 0 && (
            <p style={{ fontSize: "10px", color: "#16A34A", margin: "3px 0 0" }}>includes {fmt(otherIncome.amount)} other income</p>
          )}
        </div>

        {/* Other Income — separate model from bills, folded into Revenue Collected above */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "1px solid #E8EDF4" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase" }}>📥 Other Income</p>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#16A34A", margin: 0 }}>{fmt(otherIncome.amount)}</p>
          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{otherIncome.count} records</p>
          {otherIncome.lab_commission > 0 && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #E8EDF4" }}>
              <p style={{ fontSize: "10px", color: "#EA580C", fontWeight: 700, margin: 0 }}>
                🔬 Lab Commission: {fmt(otherIncome.lab_commission)}
              </p>
            </div>
          )}
        </div>

        {/* Lab Revenue — reference only, the hospital doesn't collect lab payments itself */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "2px solid #FED7AA" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 2px", textTransform: "uppercase" }}>Lab Revenue</p>
          <p style={{ fontSize: "9.5px", color: "#EA580C", fontWeight: 600, margin: "0 0 4px" }}>🔬 Reference only — not hospital revenue</p>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#EA580C", margin: 0 }}>{fmt(labRevenue)}</p>
          {labPendingAmount > 0 && (
            <p style={{ fontSize: "10px", color: "#B45309", margin: "3px 0 0" }}>{fmt(labPendingAmount)} pending (lab)</p>
          )}
        </div>

        {/* Pending — Reception + Pharmacy only, same scope as Revenue Collected above */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "1px solid #E8EDF4" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase" }}>Pending</p>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#F59E0B", margin: 0 }}>{fmt(pendingAmount)}</p>
        </div>

        {/* Per-source breakdown. Prebooking isn't given its own card — it's an
            advance against a future Reception bill, not a separate revenue
            source — so its total is folded into Reception's card as a
            sub-field instead of shown twice. */}
        {bySource.map(s => (
          <div key={s.src} style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", border: "1px solid #E8EDF4" }}>
            <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase" }}>
              {SOURCE_STYLE[s.src]?.icon} {s.src}
            </p>
            <p style={{ fontSize: "16px", fontWeight: 800, color: SOURCE_STYLE[s.src]?.text || "#0F172A", margin: 0 }}>{fmt(s.total)}</p>
            <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>
              {s.count} paid bills{s.src === "Laboratory" && " · reference only"}
            </p>
            {s.src === "Reception" && (prebookingRevenue > 0 || prebookingPendingAmount > 0) && (
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #E8EDF4" }}>
                <p style={{ fontSize: "10px", color: "#A21CAF", fontWeight: 700, margin: 0 }}>
                  📅 Prebooking advance: {fmt(prebookingRevenue)}
                </p>
                {prebookingPendingAmount > 0 && (
                  <p style={{ fontSize: "10px", color: "#A21CAF", margin: "2px 0 0" }}>{fmt(prebookingPendingAmount)} unpaid bookings</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#DC2626", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}

      {failedSources.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "12px 16px", color: "#92400E", fontSize: "13px", marginBottom: "16px" }}>
          ⚠️ Couldn't load {failedSources.join(", ")} bills — those totals/rows below may be incomplete. This is a backend error, not necessarily "no data"; check server logs or try refreshing.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94A3B8" }}>Loading bills…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", border: "1px solid #E8EDF4" }}>
          <p style={{ fontSize: "14px", color: "#94A3B8", margin: 0 }}>No bills found for the selected filters.</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E8EDF4", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Bill No.", "Date", "Source", "Patient / Details", "Method", "Amount", "Status (Invoice / Payment)", ""].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E8EDF4", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const srcStyle = SOURCE_STYLE[b.source] || { bg: "#F1F5F9", text: "#475569", icon: "📄" };
                  const payStyle = PAY_STATUS_STYLE[b.payment_status] || { bg: "#F1F5F9", text: "#475569" };
                  return (
                    <tr
                      key={i}
                      onClick={() => openBill(b)}
                      style={{ borderBottom: "1px solid #F1F5F9", cursor: b.id ? "pointer" : "default" }}
                    >
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#6366F1", fontWeight: 700, fontSize: "12px" }}>{b.bill_number || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#64748B", whiteSpace: "nowrap" }}>{b.date}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: srcStyle.bg, color: srcStyle.text }}>
                          {srcStyle.icon} {b.source}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0F172A", fontWeight: 500 }}>
                        {b.patient || "—"}
                        {b.patient_type === "walk-in" && (
                          <span style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "#94A3B8", textTransform: "none" }}>Walk-in</span>
                        )}
                        {b.consultation_type === "HOME_VISIT" && (
                          <span style={{ display: "inline-block", marginTop: "3px", padding: "1px 7px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, background: "#FDF4FF", color: "#A21CAF" }}>
                            🏠 Home Visit
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748B", textTransform: "capitalize" }}>{b.payment_method ? b.payment_method.replace("_", " ") : "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 800, color: "#0F172A", fontSize: "13px" }}>{fmt(b.amount)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: payStyle.bg, color: payStyle.text }}>
                          {b.payment_status}
                        </span>
                        {/* Pharmacy: invoice status (bill_status) drives revenue recognition and can
                            differ from the underlying payment_status field — surface both so nothing
                            is hidden. */}
                        {b.source === "Pharmacy" && b.raw_payment_status && b.raw_payment_status !== b.payment_status && (
                          <span style={{ display: "block", marginTop: "3px", fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                            Payment: {b.raw_payment_status}
                          </span>
                        )}
                        {b.source === "Prebooking" && b.booking_status && (
                          <span style={{ display: "block", marginTop: "3px", fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>
                            Booking: {b.booking_status}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openBill(b); }}
                          style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #E2E8F0", background: "#fff", color: ACCENT, fontWeight: 700, fontSize: "11.5px", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC" }}>
                  <td colSpan={5} style={{ padding: "12px 14px", fontWeight: 700, color: "#0F172A", fontSize: "13px" }}>Total ({filtered.length} bills)</td>
                  <td style={{ padding: "12px 14px", fontWeight: 800, color: "#6366F1", fontSize: "14px" }}>{fmt(filtered.reduce((s, b) => s + Number(b.amount || 0), 0))}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {selectedBill && (
        <div
          onClick={closeBill}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "520px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}
          >
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #E8EDF4", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: SOURCE_STYLE[selectedBill.source]?.text || "#64748B", margin: "0 0 2px", textTransform: "uppercase" }}>
                  {SOURCE_STYLE[selectedBill.source]?.icon} {selectedBill.source}
                  {selectedBill.consultation_type === "HOME_VISIT" && (
                    <span style={{ marginLeft: "8px", padding: "1px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, background: "#FDF4FF", color: "#A21CAF", textTransform: "none" }}>
                      🏠 Home Visit
                    </span>
                  )}
                </p>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0, fontFamily: "monospace" }}>{selectedBill.bill_number}</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {detail && !detailLoading && (
                  <button
                    onClick={() => navigate(`/manager/bills/print/${SOURCE_LABEL_TO_TAB[selectedBill.source]}/${selectedBill.id}`, { state: { listRow: selectedBill } })}
                    style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid #E2E8F0", background: "#fff", color: ACCENT, fontWeight: 700, fontSize: "11.5px", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    🖨 Print
                  </button>
                )}
                <button onClick={closeBill} style={{ border: "none", background: "transparent", color: "#94A3B8", fontSize: "20px", cursor: "pointer", lineHeight: 1, padding: "4px" }}>×</button>
              </div>
            </div>

            <div style={{ padding: "20px 22px" }}>
              {detailLoading && <div style={{ textAlign: "center", padding: "30px", color: "#94A3B8", fontSize: "13px" }}>Loading bill details…</div>}
              {detailError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "10px 14px", color: "#DC2626", fontSize: "12.5px" }}>{detailError}</div>}

              {detail && !detailLoading && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: "18px" }}>
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Patient</p>
                      <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0 }}>{detail.patient?.name || "—"}</p>
                      {detail.patient?.type === "walk-in" && (
                        <p style={{ fontSize: "10.5px", color: "#94A3B8", margin: "1px 0 0" }}>Walk-in</p>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Date</p>
                      <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0 }}>{detail.date}</p>
                    </div>
                    {detail.doctor_name && (
                      <div>
                        <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Doctor</p>
                        <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0 }}>{detail.doctor_name}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Payment</p>
                      <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0, textTransform: "capitalize" }}>
                        {detail.payment_method ? detail.payment_method.replace("_", " ") : "—"} · {detail.payment_status}
                      </p>
                    </div>
                    {detail.bill_status && (
                      <div>
                        <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Invoice Status</p>
                        <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0 }}>{detail.bill_status}</p>
                      </div>
                    )}
                    {detail.booking_status && (
                      <div>
                        <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 2px" }}>Booking Status</p>
                        <p style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, margin: 0 }}>{detail.booking_status}</p>
                      </div>
                    )}
                  </div>

                  {selectedBill.consultation_type === "HOME_VISIT" && (
                    <div style={{ border: "1px solid #F5D0FE", background: "#FDF4FF", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                      <p style={{ fontSize: "10.5px", color: "#A21CAF", fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>🏠 Home Visit Breakdown</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                        <span style={{ color: "#701A75" }}>Home Visit Fee</span>
                        <span style={{ color: "#701A75", fontWeight: 700 }}>{fmt(selectedBill.home_visit_fee)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                        <span style={{ color: "#701A75" }}>Travel Charge</span>
                        <span style={{ color: "#701A75", fontWeight: 700 }}>{fmt(selectedBill.travel_charge)}</span>
                      </div>
                    </div>
                  )}

                  {detail.converted_bill_id && (
                    <div style={{ background: "#FDF4FF", border: "1px solid #F5D0FE", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", fontSize: "12.5px", color: "#A21CAF" }}>
                      Converted to Reception bill #{detail.converted_bill_id}.
                    </div>
                  )}

                  {detail.line_items?.length > 0 && (
                    <div style={{ border: "1px solid #E8EDF4", borderRadius: "10px", overflow: "hidden", marginBottom: "16px" }}>
                      {detail.line_items.map((li, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: idx < detail.line_items.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: "12.5px" }}>
                          <span style={{ color: "#374151" }}>{li.label}</span>
                          <span style={{ color: "#0F172A", fontWeight: 700 }}>{fmt(li.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detail.notes && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", margin: "0 0 3px" }}>Notes</p>
                      <p style={{ fontSize: "12.5px", color: "#374151", margin: 0 }}>{detail.notes}</p>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Total</span>
                    <span style={{ fontSize: "17px", fontWeight: 800, color: ACCENT }}>{fmt(detail.total_amount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}