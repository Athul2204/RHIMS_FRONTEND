// src/modules/doctor/pages/PrescriptionsPage.jsx
//
// Backend endpoints used:
//   GET    /api/doctor/consultations/                               → list doctor's consultations
//   GET    /api/doctor/consultations/{id}/prescriptions/           → list prescriptions
//   POST   /api/doctor/consultations/{id}/prescriptions/           → create prescription
//   DELETE /api/doctor/prescriptions/{id}/                         → delete prescription
//   POST   /api/doctor/prescriptions/{id}/items/                   → add medicine item
//   DELETE /api/doctor/prescription-items/{id}/                    → remove item
//   GET    /api/pharmacist/medicines/search/?q=&recent=&limit=     → medicine autocomplete
//
// FIXED:
//   • STAT removed from frequency options
//   • Meal timing keys FULLY fixed: now use backend values "", "BEFORE_MEALS", "WITH_MEALS", "AFTER_MEALS"
//     (was ["NONE","BEFORE","AFTER","WITH"] — none of which matched Django MealTimingChoices)
//     Root cause of 400 Bad Request on /api/doctor/prescriptions/{id}/items/
//   • dose_quantity field (was incorrectly named dosage)
//   • Route auto-populated from medicine master (read-only by default, override option)
//   • Auto quantity calculation: dose × freq_per_day × duration_days
//   • Manual quantity override with visual indicator + recalculate button
//   • PRN/SOS specific fields: reason, max_daily_dose
//   • Correct payload sent to backend

import { useEffect, useState, useRef } from "react";
import {
  getConsultations,
  getPrescriptions,
  createPrescription,
  deletePrescription,
  createPrescriptionItem,
  deletePrescriptionItem,
  searchMedicines,
} from "../api/doctorApi";

// ─── Theme ───────────────────────────────────────────────────────────────────
const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";
const PURPLE  = "#A855F7";

// ─── Status colours ──────────────────────────────────────────────────────────
const STATUS_STYLE = {
  STARTED:           { bg: "#EFF6FF", color: "#2563EB", label: "Started" },
  LAB_REQUESTED:     { bg: "#FEF3C7", color: "#D97706", label: "Lab Requested" },
  WAITING_FOR_LAB:   { bg: "#FFF7ED", color: "#EA580C", label: "Waiting for Lab" },
  LAB_COMPLETED:     { bg: "#F0FDF4", color: "#16A34A", label: "Lab Completed" },
  FOLLOWUP_REQUIRED: { bg: "#F5F3FF", color: "#7C3AED", label: "Follow-up Required" },
  COMPLETED:         { bg: "#F1F5F9", color: "#64748B", label: "Completed" },
};

// ─── Choices (must match backend exactly) ────────────────────────────────────
// STAT removed — clinic prescription workflow only
const FREQUENCY_OPTS = ["OD", "BD", "TDS", "QID", "SOS", "HS"];

// Meal timing keys match backend MealTimingChoices
const MEAL_TIMING_OPTS = ["", "BEFORE_MEALS", "WITH_MEALS", "AFTER_MEALS"];

const ROUTE_OPTS = ["ORAL", "IV", "IM", "SC", "TOPICAL", "NASAL", "RECTAL", "OTHER"];

const PRN_REASON_OPTS = ["FEVER", "PAIN", "ALLERGY", "COUGH", "OTHER"];

const FREQ_LABELS = {
  OD: "Once Daily", BD: "Twice Daily", TDS: "Three Times Daily",
  QID: "Four Times Daily", SOS: "As Needed", HS: "At Bedtime",
};

const MEAL_TIMING_LABELS = {
  "": "Not Specified", BEFORE_MEALS: "Before Meals", AFTER_MEALS: "After Meals", WITH_MEALS: "With Meals",
};

const ROUTE_LABELS = {
  ORAL: "Oral", IV: "Intravenous", IM: "Intramuscular",
  SC: "Subcutaneous", TOPICAL: "Topical", NASAL: "Nasal",
  RECTAL: "Rectal", OTHER: "Other",
};

const PRN_REASON_LABELS = {
  FEVER: "Fever", PAIN: "Pain", ALLERGY: "Allergy", COUGH: "Cough", OTHER: "Other",
};

// Doses per day for quantity calculation (SOS returns null → manual entry)
const DOSES_PER_DAY = { OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1, SOS: null };

// ─── Stock config ─────────────────────────────────────────────────────────────
const STOCK_CFG = {
  AVAILABLE:    { dot: "#16A34A", bg: "#F0FDF4", text: "#15803D", label: "In Stock"     },
  LOW:          { dot: "#D97706", bg: "#FFFBEB", text: "#B45309", label: "Low Stock"    },
  OUT_OF_STOCK: { dot: "#DC2626", bg: "#FEF2F2", text: "#B91C1C", label: "Out of Stock" },
};

// ─── Recent medicine IDs (session storage) ───────────────────────────────────
const RECENT_KEY = "rhims_recent_meds";
const getRecentIds = () => {
  try { return JSON.parse(sessionStorage.getItem(RECENT_KEY) || "[]").slice(0, 10); }
  catch { return []; }
};
const saveRecentId = (id) => {
  try {
    const prev = getRecentIds().filter(x => x !== id);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, 10)));
  } catch {}
};

// ─── Auto-quantity calculation ────────────────────────────────────────────────
const calcQuantity = (doseQty, freq, durationDays) => {
  const dosesPerDay = DOSES_PER_DAY[freq];
  const dose = parseFloat(doseQty);
  const days = parseInt(durationDays, 10);
  if (!dosesPerDay || !dose || dose <= 0 || !days || days <= 0) return null;
  return Math.ceil(dose * dosesPerDay * days);
};

// ─── SVG icon helper ─────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 4000,
      padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: toast.ok ? "#F0FDF4" : "#FEF2F2",
      color:      toast.ok ? "#166534" : "#B91C1C",
      border: `1px solid ${toast.ok ? "#BBF7D0" : "#FECACA"}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <Ico d={toast.ok ? "M20 6 9 17l-5-5" : "M18 6 6 18 M6 6l12 12"} size={14}
        color={toast.ok ? G : "#DC2626"} />
      {toast.msg}
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────
const INP = {
  padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB",
  fontSize: 13, color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box",
};

// ─── ToggleButton group ───────────────────────────────────────────────────────
function ToggleGroup({ options, labels, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} style={{
            padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
            cursor: "pointer",
            border: active ? `1.5px solid ${G}` : "1.5px solid #E5E7EB",
            background: active ? LIGHT_G : "#F8FAFC",
            color: active ? "#15803D" : "#475569",
            transition: "all 0.12s", whiteSpace: "nowrap",
          }}>
            {labels ? labels[opt] ?? opt : opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── StockBadge ──────────────────────────────────────────────────────────────
function StockBadge({ status, quantity, compact = false }) {
  const cfg = STOCK_CFG[status] || STOCK_CFG.AVAILABLE;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: compact ? "1px 6px" : "2px 8px", borderRadius: 20,
      background: cfg.bg, fontSize: compact ? 10 : 10.5,
      fontWeight: 600, color: cfg.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {compact ? cfg.label : (status === "OUT_OF_STOCK" ? "Out of Stock" : `${cfg.label}: ${quantity}`)}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MedicineAutocomplete
// ══════════════════════════════════════════════════════════════════════════════
const MIN_SEARCH_CHARS = 2;
const DEBOUNCE_MS      = 300;

function MedicineAutocomplete({ value, onChange, recentIds = [], error, disabled = false, autoFocus = false }) {
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [searched,    setSearched]    = useState(false);

  const inputRef = useRef(null);
  const wrapRef  = useRef(null);
  const debTimer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      if (debTimer.current) clearTimeout(debTimer.current);
    };
  }, []);

  const runSearch = (q) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    const delay = q.trim().length >= MIN_SEARCH_CHARS ? DEBOUNCE_MS : 0;
    debTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const recent = recentIds.join(",");
        const data = await searchMedicines(q.trim(), recent, 12);
        const list = data?.results ?? data?.data ?? (Array.isArray(data) ? data : []);
        setResults(list.filter(m => m.is_active !== false));
        setSearched(true);
      } catch {
        setResults([]); setSearched(true);
      } finally { setLoading(false); }
    }, delay);
  };

  const handleChange = (e) => {
    const v = e.target.value; setQuery(v); setHighlighted(-1); setOpen(true);
    if (v.trim().length < MIN_SEARCH_CHARS && v.trim().length > 0) setResults([]);
    else runSearch(v);
  };

  const handleFocus = () => {
    setOpen(true);
    if (!searched || results.length === 0) runSearch(query);
  };

  const handleSelect = (med) => {
    onChange(med); setQuery(""); setResults([]); setOpen(false); setHighlighted(-1);
  };

  const handleClear = () => {
    onChange(null); setQuery(""); setResults([]); setSearched(false); setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp")    { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && highlighted >= 0 && results[highlighted]) { e.preventDefault(); handleSelect(results[highlighted]); }
    if (e.key === "Escape")     setOpen(false);
  };

  const tooShort   = query.trim().length > 0 && query.trim().length < MIN_SEARCH_CHARS;
  const hasResults = results.length > 0;
  const isEmpty    = searched && !loading && !hasResults && !tooShort;
  const recent     = results.filter(m => m.is_recent);
  const others     = results.filter(m => !m.is_recent);

  // Selected card
  if (value) {
    const cfg = STOCK_CFG[value.stock_status] || STOCK_CFG.AVAILABLE;
    return (
      <div style={{
        border: `1.5px solid ${cfg.dot}40`, borderLeft: `3px solid ${cfg.dot}`,
        borderRadius: 10,
        background: value.stock_status === "OUT_OF_STOCK" ? "#FEF2F2" : "#F0FDF4",
        padding: "12px 14px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
      }}>
        <span style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <span style={{
            width: 24, height: 24, borderRadius: "50%", background: cfg.dot, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
          }}>
            <Ico d="M20 6 9 17l-5-5" size={11} color="#fff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{value.name}</span>
              {value.strength && (
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "#F0FDF4", color: "#15803D" }}>
                  {value.strength}
                </span>
              )}
              {value.medicine_type_display && (
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8" }}>
                  {value.medicine_type_display}
                </span>
              )}
            </span>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
              {value.generic_name && <span style={{ fontSize: 11.5, color: "#475569" }}>Generic: <strong style={{ fontWeight: 600 }}>{value.generic_name}</strong></span>}
              {value.route && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#7C3AED" }}>
                  Route: {ROUTE_LABELS[value.route] ?? value.route}
                </span>
              )}
            </span>
            <StockBadge status={value.stock_status} quantity={value.stock_quantity} />
            {value.stock_status === "OUT_OF_STOCK" && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11.5, color: "#B91C1C" }}>
                <Ico d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={12} color="#DC2626" />
                Currently out of stock — prescription can still be written.
              </span>
            )}
          </span>
        </span>
        {!disabled && (
          <button type="button" onClick={handleClear} style={{
            fontSize: 11.5, fontWeight: 600, color: "#64748B",
            background: "rgba(255,255,255,0.8)", border: "1px solid #E2E8F0",
            borderRadius: 7, padding: "4px 10px", cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <Ico d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" size={11} color="#64748B" />
            Change
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes rhims_med_spin  { to { transform: rotate(360deg); } }
        @keyframes rhims_drop_in   { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            {loading
              ? <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid #E2E8F0", borderTopColor: G, borderRadius: "50%", animation: "rhims_med_spin 0.65s linear infinite" }} />
              : <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={14} color="#94A3B8" />
            }
          </span>
          <input
            ref={inputRef} type="text" value={query}
            onChange={handleChange} onFocus={handleFocus} onKeyDown={handleKeyDown}
            disabled={disabled} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
            placeholder="Type to search pharmacy stock…"
            style={{
              ...INP, paddingLeft: 34, paddingRight: query ? 32 : 12,
              border: `1.5px solid ${error ? "#FCA5A5" : open ? G : "#E5E7EB"}`,
              boxShadow: open ? `0 0 0 3px rgba(22,163,74,0.08)` : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />
          {query && (
            <button type="button" onMouseDown={e => { e.preventDefault(); setQuery(""); setResults([]); setOpen(false); }}
              style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, color: "#94A3B8", display: "flex", alignItems: "center" }}
              tabIndex={-1}>
              <Ico d="M18 6 6 18 M6 6l12 12" size={12} />
            </button>
          )}
          {open && (
            <div style={{
              position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0,
              background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 11,
              boxShadow: "0 12px 40px rgba(0,0,0,0.14)", zIndex: 999,
              maxHeight: 320, overflowY: "auto",
              animation: "rhims_drop_in 0.12s ease",
            }}>
              {tooShort && (
                <div style={{ padding: "13px 16px", fontSize: 12.5, color: "#94A3B8", textAlign: "center" }}>
                  Type at least <strong style={{ color: "#475569" }}>{MIN_SEARCH_CHARS} characters</strong> to search…
                </div>
              )}
              {loading && (
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12.5, color: "#64748B" }}>
                  <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid #E2E8F0", borderTopColor: G, borderRadius: "50%", animation: "rhims_med_spin 0.65s linear infinite" }} />
                  Searching pharmacy stock…
                </div>
              )}
              {!loading && hasResults && !tooShort && (
                <>
                  <div style={{ padding: "6px 14px 5px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {!query.trim() ? "Available Medicines" : `${results.length} result${results.length !== 1 ? "s" : ""}`}
                    </span>
                    <span style={{ fontSize: 10, color: "#CBD5E1" }}>↑↓ navigate · Enter select</span>
                  </div>
                  {recent.length > 0 && (
                    <>
                      <div style={{ padding: "5px 14px 3px", fontSize: 9.5, fontWeight: 700, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF7ED", borderBottom: "1px solid #FED7AA" }}>
                        Recently Prescribed
                      </div>
                      {recent.map(med => {
                        const idx = results.indexOf(med); const isHl = idx === highlighted;
                        const cfg = STOCK_CFG[med.stock_status] || STOCK_CFG.AVAILABLE;
                        return (
                          <button key={med.id} type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelect(med); }}
                            onMouseEnter={() => setHighlighted(idx)}
                            style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: isHl ? "#F0FDF4" : "transparent", border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", transition: "background 0.08s" }}>
                            <span style={{ width: 3, borderRadius: 8, alignSelf: "stretch", flexShrink: 0, background: cfg.dot, opacity: 0.7, minHeight: 36 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isHl ? "#15803D" : "#0F172A" }}>{med.name}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C", textTransform: "uppercase" }}>Recent</span>
                                {med.strength && <span style={{ fontSize: 10, color: "#64748B" }}>{med.strength}</span>}
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                                {med.generic_name && <span style={{ fontSize: 11, color: "#64748B" }}>Generic: <strong style={{ fontWeight: 600 }}>{med.generic_name}</strong></span>}
                                {med.route && <span style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600 }}>· {ROUTE_LABELS[med.route] ?? med.route}</span>}
                              </span>
                              <StockBadge status={med.stock_status} quantity={med.stock_quantity} />
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {recent.length > 0 && others.length > 0 && (
                    <div style={{ padding: "5px 14px 3px", fontSize: 9.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
                      Other Medicines
                    </div>
                  )}
                  {others.map(med => {
                    const idx = results.indexOf(med); const isHl = idx === highlighted;
                    const cfg = STOCK_CFG[med.stock_status] || STOCK_CFG.AVAILABLE;
                    return (
                      <button key={med.id} type="button"
                        onMouseDown={e => { e.preventDefault(); handleSelect(med); }}
                        onMouseEnter={() => setHighlighted(idx)}
                        style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: isHl ? "#F0FDF4" : "transparent", border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", transition: "background 0.08s" }}>
                        <span style={{ width: 3, borderRadius: 8, alignSelf: "stretch", flexShrink: 0, background: cfg.dot, opacity: 0.7, minHeight: 36 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isHl ? "#15803D" : "#0F172A" }}>{med.name}</span>
                            {med.strength && <span style={{ fontSize: 10, color: "#64748B" }}>{med.strength}</span>}
                            {med.medicine_type_display && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8" }}>{med.medicine_type_display}</span>}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                            {med.generic_name && <span style={{ fontSize: 11, color: "#64748B" }}>Generic: <strong style={{ fontWeight: 600 }}>{med.generic_name}</strong></span>}
                            {med.route && <span style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600 }}>· {ROUTE_LABELS[med.route] ?? med.route}</span>}
                          </span>
                          <StockBadge status={med.stock_status} quantity={med.stock_quantity} />
                        </span>
                      </button>
                    );
                  })}
                  <div style={{ padding: "5px 14px", background: "#FAFBFD", borderTop: "1px solid #F1F5F9", fontSize: 10.5, color: "#94A3B8" }}>
                    Showing {results.length} active medicines from pharmacy inventory
                  </div>
                </>
              )}
              {!loading && isEmpty && (
                <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ico d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={18} color="#94A3B8" />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No medicines found</span>
                  <span style={{ fontSize: 11.5, color: "#94A3B8", maxWidth: 240 }}>
                    No active medicines match &ldquo;{query}&rdquo; in pharmacy stock.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11.5, color: "#DC2626" }}>
            <Ico d="M12 9v4m0 4h.01" size={12} color="#DC2626" />
            {error}
          </div>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AddItemModal — fully fixed
// ══════════════════════════════════════════════════════════════════════════════
function AddItemModal({ prescriptionId, onClose, onAdded }) {
  const [selectedMed, setSelectedMed] = useState(null);
  const [form, setForm] = useState({
    medicine_id:        null,
    medicine_name:      "",
    dose_quantity:      "1",
    frequency:          "OD",
    meal_timing:        "NONE",
    route:              "ORAL",
    is_route_overridden: false,
    duration_days:      "7",
    quantity:           "",
    is_manual_quantity: false,
    prn_reason:         "",
    prn_reason_other:   "",
    max_daily_dose:     "",
    instructions:       "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const recentIds = getRecentIds();

  // ── Auto-calculate quantity whenever inputs change ──────────────────────────
  useEffect(() => {
    if (form.is_manual_quantity) return;
    const calc = calcQuantity(form.dose_quantity, form.frequency, form.duration_days);
    // For SOS, keep quantity blank by default (manual entry encouraged)
    if (form.frequency === "SOS") {
      setForm(f => ({ ...f, quantity: f.quantity }));
    } else if (calc !== null) {
      setForm(f => ({ ...f, quantity: String(calc) }));
    } else {
      setForm(f => ({ ...f, quantity: "" }));
    }
  }, [form.dose_quantity, form.frequency, form.duration_days, form.is_manual_quantity]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Medicine selected → auto-populate route from master ────────────────────
  const handleMedicineSelect = (med) => {
    if (!med) {
      setSelectedMed(null);
      setForm(f => ({ ...f, medicine_id: null, medicine_name: "", route: "ORAL", is_route_overridden: false }));
      return;
    }
    setSelectedMed(med);
    setForm(f => ({
      ...f,
      medicine_id:         med.id,
      medicine_name:       med.name,
      route:               med.route || "ORAL",  // auto from medicine master
      is_route_overridden: false,                // reset on new medicine
    }));
  };

  const handleManualQtyChange = (v) => {
    setForm(f => ({ ...f, quantity: v, is_manual_quantity: true }));
  };

  const handleRecalculate = () => {
    const calc = calcQuantity(form.dose_quantity, form.frequency, form.duration_days);
    setForm(f => ({ ...f, is_manual_quantity: false, quantity: calc !== null ? String(calc) : "" }));
  };

  const calcPreview = calcQuantity(form.dose_quantity, form.frequency, form.duration_days);

  const handleSave = async () => {
    if (!form.medicine_id) {
      setError("Please select a medicine from pharmacy stock.");
      return;
    }
    if (form.frequency === "SOS" && !form.prn_reason) {
      setError("Reason for use is required for As Needed (PRN/SOS) medicines.");
      return;
    }
    if (form.frequency === "SOS" && form.prn_reason === "OTHER" && !form.prn_reason_other.trim()) {
      setError("Please specify the reason when 'Other' is selected.");
      return;
    }

    setSaving(true); setError("");
    try {
      const payload = {
        medicine_id:        form.medicine_id,
        dose_quantity:      form.dose_quantity ? parseFloat(form.dose_quantity) : undefined,
        frequency:          form.frequency,
        meal_timing:        (form.meal_timing === "NONE" || !form.meal_timing) ? "" : form.meal_timing,
        instructions:       form.instructions.trim() || undefined,
        is_manual_quantity: form.is_manual_quantity,
      };

      if (form.duration_days && parseInt(form.duration_days, 10) > 0) {
        payload.duration_days = parseInt(form.duration_days, 10);
      }

      // Only send manual quantity if overridden
      if (form.is_manual_quantity && form.quantity && parseInt(form.quantity, 10) > 0) {
        payload.quantity = parseInt(form.quantity, 10);
      }

      // Route override — only send if doctor overrode the auto-populated route
      if (form.is_route_overridden) {
        payload.route             = form.route;
        payload.is_route_overridden = true;
      }

      // PRN-specific fields
      if (form.frequency === "SOS") {
        payload.prn_reason = form.prn_reason;
        if (form.prn_reason === "OTHER" && form.prn_reason_other.trim()) {
          payload.prn_reason_other = form.prn_reason_other.trim();
        }
        if (form.max_daily_dose.trim()) {
          payload.max_daily_dose = form.max_daily_dose.trim();
        }
      }

      await createPrescriptionItem(prescriptionId, payload);
      if (form.medicine_id) saveRecentId(form.medicine_id);
      onAdded(); onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to add item.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }} onClick={onClose} />

      <div style={{
        position: "relative", background: "#fff", borderRadius: 16,
        width: "100%", maxWidth: 540, margin: "0 16px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", zIndex: 1,
        maxHeight: "94vh", display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M13 2v6h6 M12 11v6 M9 14h6" size={15} color={G} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>Add Medicine Item</h3>
              <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Select from pharmacy inventory</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={16} />
          </button>
        </div>

        {error && (
          <div style={{ margin: "12px 24px 0", padding: "9px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", fontSize: 12.5, border: "1px solid #FECACA" }}>
            {error}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "16px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Medicine Search */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              Medicine Name <span style={{ color: "#EF4444" }}>*</span>
              <span style={{ fontWeight: 400, color: "#94A3B8", fontSize: 11 }}>— live search from pharmacy stock</span>
            </label>
            <MedicineAutocomplete
              value={selectedMed} onChange={handleMedicineSelect}
              recentIds={recentIds}
              error={!selectedMed && error ? error : undefined}
              autoFocus
            />
          </div>

          {/* Route (auto from master, read-only by default) */}
          {selectedMed && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: form.is_route_overridden ? "#FFF7ED" : "#F0FDF4", border: `1px solid ${form.is_route_overridden ? "#FED7AA" : "#BBF7D0"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ico d="M17 8l4 4m0 0l-4 4m4-4H3" size={14} color={form.is_route_overridden ? "#C2410C" : G} />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Route</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: form.is_route_overridden ? "#C2410C" : "#0F172A", marginTop: 1 }}>
                      {ROUTE_LABELS[form.route] ?? form.route}
                      {!form.is_route_overridden && (
                        <span style={{ fontSize: 10.5, fontWeight: 400, color: "#16A34A", marginLeft: 6 }}>— auto from medicine master</span>
                      )}
                      {form.is_route_overridden && (
                        <span style={{ fontSize: 10.5, fontWeight: 400, color: "#C2410C", marginLeft: 6 }}>— manually overridden</span>
                      )}
                    </div>
                  </div>
                </div>
                {!form.is_route_overridden ? (
                  <button type="button" onClick={() => set("is_route_overridden", true)}
                    style={{ fontSize: 11, fontWeight: 600, color: "#64748B", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Override
                  </button>
                ) : (
                  <button type="button" onClick={() => { set("is_route_overridden", false); set("route", selectedMed?.route || "ORAL"); }}
                    style={{ fontSize: 11, fontWeight: 600, color: "#16A34A", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Reset
                  </button>
                )}
              </div>
              {form.is_route_overridden && (
                <div style={{ marginTop: 10 }}>
                  <ToggleGroup options={ROUTE_OPTS} labels={ROUTE_LABELS} value={form.route} onChange={v => set("route", v)} />
                </div>
              )}
            </div>
          )}

          {/* Dose Quantity */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
              Dose per Administration
              <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>e.g. 1 tablet, 5 ml</span>
            </label>
            <input type="number" style={INP} placeholder="e.g. 1" min="0.01" step="0.01"
              value={form.dose_quantity} onChange={e => set("dose_quantity", e.target.value)} />
          </div>

          {/* Frequency */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Frequency <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <ToggleGroup options={FREQUENCY_OPTS} labels={FREQ_LABELS} value={form.frequency}
              onChange={v => { set("frequency", v); if (v !== "SOS") set("prn_reason", ""); }} />
          </div>

          {/* PRN / SOS specific fields */}
          {form.frequency === "SOS" && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#C2410C", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Ico d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={13} color="#C2410C" />
                As Needed (PRN) — Additional Fields Required
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Reason for Use <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <ToggleGroup options={PRN_REASON_OPTS} labels={PRN_REASON_LABELS} value={form.prn_reason}
                  onChange={v => set("prn_reason", v)} />
              </div>
              {form.prn_reason === "OTHER" && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
                    Specify Reason <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input style={INP} placeholder="Describe the reason…"
                    value={form.prn_reason_other} onChange={e => set("prn_reason_other", e.target.value)} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
                  Max Daily Dose (optional)
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>e.g. Not more than 4 tablets/day</span>
                </label>
                <input style={INP} placeholder="e.g. Not more than 4 tablets/day"
                  value={form.max_daily_dose} onChange={e => set("max_daily_dose", e.target.value)} />
              </div>
            </div>
          )}

          {/* Meal Timing */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Meal Timing</label>
            <ToggleGroup options={MEAL_TIMING_OPTS} labels={MEAL_TIMING_LABELS} value={form.meal_timing}
              onChange={v => set("meal_timing", v)} />
          </div>

          {/* Duration + Quantity row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Duration (days)</label>
              <input type="number" style={INP} placeholder="e.g. 7" min="1" max="30"
                value={form.duration_days} onChange={e => set("duration_days", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                Quantity
                {form.is_manual_quantity ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>Manual</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: LIGHT_G, color: "#15803D" }}>Auto</span>
                )}
              </label>
              <div style={{ position: "relative" }}>
                <input type="number" style={{ ...INP, paddingRight: form.is_manual_quantity ? 70 : 12 }}
                  min="1" value={form.quantity}
                  onChange={e => handleManualQtyChange(e.target.value)}
                  placeholder={form.frequency === "SOS" ? "Enter qty" : "Auto-calculated"}
                />
                {form.is_manual_quantity && (
                  <button type="button" onClick={handleRecalculate}
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 600, color: G, background: LIGHT_G, border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    Recalc
                  </button>
                )}
              </div>
              {!form.is_manual_quantity && calcPreview !== null && form.frequency !== "SOS" && (
                <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 3 }}>
                  = {form.dose_quantity} × {DOSES_PER_DAY[form.frequency]}×/day × {form.duration_days}d = <strong style={{ color: G }}>{calcPreview}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Special Instructions</label>
            <textarea rows={2} style={{ ...INP, resize: "none" }} placeholder="e.g. Take with a full glass of water…"
              value={form.instructions} onChange={e => set("instructions", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: "9px 20px", borderRadius: 9, border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, boxShadow: "0 2px 8px #16a34a33" }}>
            {saving ? "Adding…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { AddItemModal };

// ─── New Prescription Modal ───────────────────────────────────────────────────
function NewPrescriptionModal({ consultationId, onClose, onCreated }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await createPrescription(consultationId, { prescription_type: "FINAL", notes: notes.trim() || undefined });
      onCreated(); onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to create prescription.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, margin: "0 16px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", zIndex: 1 }}>
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>New Prescription</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={16} />
          </button>
        </div>
        {error && <div style={{ margin: "12px 24px 0", padding: "9px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", fontSize: 12.5, border: "1px solid #FECACA" }}>{error}</div>}
        <div style={{ padding: "16px 24px" }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Notes (optional)</label>
          <textarea rows={3} style={{ ...INP, resize: "none" }} placeholder="Optional notes…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 9, border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, boxShadow: "0 2px 8px #16a34a33" }}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Prescription Card ────────────────────────────────────────────────────────
function PrescriptionCard({ rx, onAddItem, onDeleteRx, onDeleteItem, deletingRx, deletingItem }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      {/* Card header */}
      <div style={{ padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Prescription #{rx.prescription_id}</span>
          <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: LIGHT_G, color: "#15803D" }}>Final</span>
          {rx.prescribed_by_username && <span style={{ fontSize: 12, color: "#94A3B8" }}>by {rx.prescribed_by_username}</span>}
          {rx.is_sent_to_pharmacy && (
            <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8" }}>
              Sent to Pharmacy
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => onAddItem(rx.prescription_id)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: G, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px #16a34a22" }}>
            <Ico d="M12 5v14 M5 12h14" size={12} color="#fff" />
            Add Item
          </button>
          <button onClick={() => onDeleteRx(rx.prescription_id)} disabled={deletingRx === rx.prescription_id}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: deletingRx === rx.prescription_id ? "not-allowed" : "pointer", opacity: deletingRx === rx.prescription_id ? 0.6 : 1 }}>
            {deletingRx === rx.prescription_id ? "…" : "Delete Rx"}
          </button>
        </div>
      </div>

      {rx.notes && <div style={{ padding: "8px 18px", borderBottom: "1px solid #F8FAFC", fontSize: 13, color: "#475569", fontStyle: "italic" }}>{rx.notes}</div>}

      {/* Items */}
      {(rx.items ?? []).length === 0 ? (
        <div style={{ padding: "22px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
          No medicine items yet — click <strong>Add Item</strong> to start.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 1.4fr 0.9fr 0.7fr 0.6fr 0.55fr 28px", padding: "7px 18px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
            {["Medicine", "Dose", "Frequency", "Route", "Duration", "Qty", "Source", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
            ))}
          </div>
          {rx.items.map(item => {
            const mealLabel = item.meal_timing && item.meal_timing !== "NONE" && item.meal_timing !== "" ? MEAL_TIMING_LABELS[item.meal_timing] ?? item.meal_timing : null;
            const isManual = item.is_manual_quantity;
            return (
              <div key={item.item_id}
                style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 1.4fr 0.9fr 0.7fr 0.6fr 0.55fr 28px", padding: "10px 18px", borderBottom: "1px solid #F8FAFC", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{item.medicine_name}</span>
                  {item.prn_reason && (
                    <div style={{ fontSize: 10.5, color: "#C2410C", marginTop: 2 }}>
                      PRN: {PRN_REASON_LABELS[item.prn_reason] ?? item.prn_reason}
                      {item.prn_reason === "OTHER" && item.prn_reason_other && ` — ${item.prn_reason_other}`}
                    </div>
                  )}
                </div>

                <span style={{ fontSize: 12.5, color: "#475569" }}>
                  {item.dose_quantity != null ? `${item.dose_quantity}` : "—"}
                </span>

                <span style={{ fontSize: 12, color: "#475569" }}>
                  <span style={{ fontWeight: 500 }}>{FREQ_LABELS[item.frequency] ?? item.frequency}</span>
                  {mealLabel && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{mealLabel}</div>}
                </span>

                <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>
                  {ROUTE_LABELS[item.route] ?? item.route ?? "—"}
                  {item.is_route_overridden && <div style={{ fontSize: 10, color: "#C2410C", fontWeight: 400 }}>Overridden</div>}
                </span>

                <span style={{ fontSize: 12.5, color: "#475569" }}>{item.duration_days ? `${item.duration_days}d` : "—"}</span>

                <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{item.quantity ?? "—"}</span>

                <span>
                  {isManual ? (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>Manual</span>
                  ) : (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 20, background: LIGHT_G, color: "#15803D" }}>Auto</span>
                  )}
                </span>

                <button onClick={() => onDeleteItem(item.item_id)} disabled={deletingItem === item.item_id}
                  style={{ background: "none", border: "none", cursor: deletingItem === item.item_id ? "not-allowed" : "pointer", color: "#EF4444", padding: 3, borderRadius: 6, display: "flex", alignItems: "center", opacity: deletingItem === item.item_id ? 0.5 : 1 }}
                  title="Remove item">
                  <Ico d="M18 6 6 18 M6 6l12 12" size={12} color="#EF4444" />
                </button>
              </div>
            );
          })}

          {/* Instructions footer */}
          {(rx.items ?? []).some(i => i.instructions) && (
            <div style={{ padding: "10px 18px", background: "#FAFBFD", borderTop: "1px solid #F1F5F9" }}>
              {rx.items.filter(i => i.instructions).map(i => (
                <p key={i.item_id} style={{ fontSize: 12, color: "#475569", margin: "0 0 4px" }}>
                  <strong>{i.medicine_name}:</strong> {i.instructions}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Consultation Card ────────────────────────────────────────────────────────
function ConsultationCard({ c, selected, onSelect }) {
  const st = STATUS_STYLE[c.status] ?? { bg: "#F1F5F9", color: "#64748B", label: c.status };
  const isSelected = String(c.consultation_id) === String(selected);
  return (
    <button onClick={() => onSelect(c.consultation_id)}
      style={{
        display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 16px", borderRadius: 12, width: "100%", textAlign: "left",
        border: isSelected ? `2px solid ${G}` : "1.5px solid #E8EDF4",
        background: isSelected ? "#F0FDF4" : "#fff",
        cursor: "pointer",
        boxShadow: isSelected ? `0 0 0 3px #16a34a22` : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.15s",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
          {c.patient_name ?? `Patient #${c.patient}`}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: st.bg, color: st.color, flexShrink: 0 }}>
          {st.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748B" }}>#{c.consultation_id}</span>
        {c.patient_mrd && <span style={{ fontSize: 12, color: "#64748B" }}>MRD: {c.patient_mrd}</span>}
        <span style={{ fontSize: 12, color: "#64748B" }}>{c.consultation_date}</span>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrescriptionsPage() {
  const [consultations, setConsultations] = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingC,      setLoadingC]      = useState(true);
  const [loadingP,      setLoadingP]      = useState(false);
  const [toast,         setToast]         = useState(null);
  const [showNewRx,     setShowNewRx]     = useState(false);
  const [addItemFor,    setAddItemFor]    = useState(null);
  const [deletingRx,    setDeletingRx]    = useState(null);
  const [deletingItem,  setDeletingItem]  = useState(null);
  const [search,        setSearch]        = useState("");

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    getConsultations()
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.results ?? d?.data ?? []);
        setConsultations(list.filter(c => c.status !== "COMPLETED"));
      })
      .catch(() => showToast("Failed to load consultations.", false))
      .finally(() => setLoadingC(false));
  }, []);

  const loadPrescriptions = (id) => {
    if (!id) return;
    setLoadingP(true);
    getPrescriptions(id)
      .then(d => setPrescriptions(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => showToast("Failed to load prescriptions.", false))
      .finally(() => setLoadingP(false));
  };

  const handleSelectConsultation = (id) => {
    setSelectedId(id); setPrescriptions([]); loadPrescriptions(id);
  };

  const handleDeleteRx = async (id) => {
    if (!window.confirm("Delete this prescription and all its items?")) return;
    setDeletingRx(id);
    try {
      await deletePrescription(id);
      showToast("Prescription deleted.", true);
      loadPrescriptions(selectedId);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Failed to delete.", false);
    } finally { setDeletingRx(null); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Remove this medicine item?")) return;
    setDeletingItem(itemId);
    try {
      await deletePrescriptionItem(itemId);
      showToast("Item removed.", true);
      loadPrescriptions(selectedId);
    } catch (e) {
      showToast(typeof e === "string" ? e : "Failed to remove.", false);
    } finally { setDeletingItem(null); }
  };

  const filtered = consultations.filter(c => {
    const q = search.toLowerCase();
    return (
      String(c.consultation_id).includes(q) ||
      (c.patient_name ?? "").toLowerCase().includes(q) ||
      (c.patient_mrd  ?? "").toLowerCase().includes(q) ||
      (c.consultation_date ?? "").includes(q)
    );
  });

  const selectedConsultation = consultations.find(c => String(c.consultation_id) === String(selectedId));

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <Toast toast={toast} />

      {showNewRx && selectedId && (
        <NewPrescriptionModal consultationId={selectedId}
          onClose={() => setShowNewRx(false)}
          onCreated={() => { loadPrescriptions(selectedId); showToast("Prescription created.", true); }} />
      )}
      {addItemFor !== null && (
        <AddItemModal prescriptionId={addItemFor}
          onClose={() => setAddItemFor(null)}
          onAdded={() => { setAddItemFor(null); loadPrescriptions(selectedId); showToast("Item added.", true); }} />
      )}

      {/* LEFT PANEL: consultation picker */}
      <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, border: "1px solid #E8EDF4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>Active Consultations</p>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <Ico d="M21 21l-4.35-4.35 M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" size={14} color="#94A3B8" />
            </div>
            <input style={{ ...INP, paddingLeft: 32, fontSize: 12.5 }}
              placeholder="Search patient, ID, date…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
          {loadingC ? (
            <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "20px 0" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "20px 0" }}>
              {search ? "No matches." : "No active consultations."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(c => (
                <ConsultationCard key={c.consultation_id} c={c} selected={selectedId} onSelect={handleSelectConsultation} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: prescriptions */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexShrink: 0, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FDF4FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico d="M9 12h6 M9 16h6 M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={20} color={PURPLE} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>Prescriptions</h1>
              {selectedConsultation ? (
                <p style={{ fontSize: 12.5, color: "#64748B" }}>
                  {selectedConsultation.patient_name ?? `Patient #${selectedConsultation.patient}`}
                  {" · "}#{selectedConsultation.consultation_id}
                  {" · "}{selectedConsultation.consultation_date}
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: "#94A3B8" }}>Select a consultation from the left panel</p>
              )}
            </div>
          </div>
          {selectedId && (
            <button onClick={() => setShowNewRx(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px #16a34a33" }}>
              <Ico d="M12 5v14 M5 12h14" size={14} color="#fff" />
              New Prescription
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {!selectedId ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "2px dashed #E2E8F0", padding: "70px 32px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#F8FAFC", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ico d="M9 12h6 M9 16h6 M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" size={24} color="#CBD5E1" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 6 }}>No Consultation Selected</p>
              <p style={{ fontSize: 13, color: "#94A3B8" }}>Pick an active consultation from the left panel to manage its prescriptions.</p>
            </div>
          ) : loadingP ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E8EDF4", padding: "40px 32px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
              Loading prescriptions…
            </div>
          ) : prescriptions.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "2px dashed #E2E8F0", padding: "56px 32px", textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 6 }}>No prescriptions yet</p>
              <p style={{ fontSize: 13, color: "#94A3B8" }}>Click <strong>New Prescription</strong> above to create the first one.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
              {prescriptions.map(rx => (
                <PrescriptionCard key={rx.prescription_id} rx={rx}
                  onAddItem={setAddItemFor}
                  onDeleteRx={handleDeleteRx}
                  onDeleteItem={handleDeleteItem}
                  deletingRx={deletingRx}
                  deletingItem={deletingItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}