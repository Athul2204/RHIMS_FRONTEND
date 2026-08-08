// src/modules/receptionist/pages/PharmacyBillsPage.jsx
//
// Lists pharmacy bills a pharmacist has sent here via the pharmacy
// module's "Send to Reception" action (only PAID — i.e. paid AND
// dispensed — bills can be sent). Reception reviews and prints them
// from this page; filters: Today / This Week / This Month / All.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getPharmacyBillsForReception, toArray } from "../api/receptionApi";
import { flattenFormError } from "../../../utils/formErrors";

const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  print:  "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.35-4.35",
  pill:   "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  bill:   "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
};

// YYYY-MM-DD in local time (not UTC — avoids off-by-one-day near midnight)
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FILTERS = [
  {
    key: "today", label: "Today",
    range: () => { const t = new Date(); return { date_from: toISODate(t), date_to: toISODate(t) }; },
  },
  {
    key: "week", label: "This Week",
    range: () => {
      const t = new Date();
      const day = (t.getDay() + 6) % 7; // days since Monday
      const monday = new Date(t); monday.setDate(t.getDate() - day);
      return { date_from: toISODate(monday), date_to: toISODate(t) };
    },
  },
  {
    key: "month", label: "This Month",
    range: () => {
      const t = new Date();
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      return { date_from: toISODate(first), date_to: toISODate(t) };
    },
  },
  { key: "all", label: "All", range: () => ({}) },
];

export default function PharmacyBillsPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("today");
  const [search, setSearch]             = useState("");
  const [bills, setBills]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = FILTERS.find(f => f.key === activeFilter) || FILTERS[0];
      const params = { ...filter.range() };
      if (search.trim()) params.search = search.trim();
      const res = await getPharmacyBillsForReception(params);
      setBills(toArray(res));
    } catch (e) {
      setError(flattenFormError(e));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0); // debounce typing, not the filter clicks
    return () => clearTimeout(t);
  }, [load, search]);

  const totalAmount = bills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Ico d={ICONS.pill} size={22} color={G} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>Pharmacy Bills</h1>
      </div>
      <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 20px" }}>
        Paid &amp; dispensed pharmacy bills forwarded here for review and printing.
      </p>

      {/* Filters + search */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6, background: "#F1F5F9", padding: 4, borderRadius: 10 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: activeFilter === f.key ? "#fff" : "transparent",
                color: activeFilter === f.key ? G : "#64748B",
                boxShadow: activeFilter === f.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 320 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <Ico d={ICONS.search} size={14} color="#94A3B8" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill no. or patient name…"
            style={{
              width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
              border: "1.5px solid #E2E8F0", fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>

        {!loading && (
          <div style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748B" }}>
            {bills.length} bill{bills.length === 1 ? "" : "s"} · <span style={{ fontWeight: 700, color: "#0F172A" }}>₹{totalAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div style={{ padding: 30, textAlign: "center", color: "#DC2626", fontSize: 13 }}>{error}</div>
      ) : bills.length === 0 ? (
        <div style={{ padding: "50px 20px", textAlign: "center", color: "#94A3B8" }}>
          <Ico d={ICONS.bill} size={32} color="#CBD5E1" />
          <p style={{ marginTop: 10, fontSize: 13.5 }}>No pharmacy bills sent to reception for this period.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {bills.map((bill) => {
            const patientName = bill.patient_info?.name || bill.patient_name || bill.walkin_name || "—";
            const isWalkin = bill.is_walkin || bill.patient_info?.type === "walk-in";
            const sentAt = bill.sent_to_reception_at
              ? new Date(bill.sent_to_reception_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
              : null;
            return (
              <div key={bill.bill_id} style={{
                display: "flex", alignItems: "center", gap: 16, padding: "14px 16px",
                border: "1px solid #F1F5F9", borderRadius: 12, background: "#fff",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: LIGHT_G,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Ico d={ICONS.pill} size={18} color={G} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{bill.bill_number}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                      background: LIGHT_G, color: G,
                    }}>
                      Paid &amp; Dispensed
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                    {patientName}{isWalkin ? " (Walk-in)" : ""} · {bill.bill_date}
                    {sentAt && <span style={{ color: "#CBD5E1" }}> · sent {sentAt}</span>}
                  </div>
                </div>

                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
                  ₹{parseFloat(bill.total_amount || 0).toFixed(2)}
                </div>

                <button
                  onClick={() => navigate(`/reception/pharmacy-bills/print/${bill.bill_id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                    borderRadius: 8, border: "none", background: G, color: "#fff",
                    fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0,
                  }}>
                  <Ico d={ICONS.print} size={13} color="#fff" /> Print
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}