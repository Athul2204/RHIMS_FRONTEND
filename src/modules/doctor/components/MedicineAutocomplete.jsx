// src/modules/doctor/components/MedicineAutocomplete.jsx
//
// Enterprise-grade Medicine Autocomplete for Doctor Prescription Module
//
// Usage:
//   import MedicineAutocomplete from "../components/MedicineAutocomplete";
//
//   <MedicineAutocomplete
//     value={selectedMedicine}          // null or medicine object
//     onChange={(med) => { ... }}       // called with full medicine object or null
//     recentIds={[3, 7, 12]}            // optional: doctor's recent medicine IDs
//     error={errorMessage}              // optional: validation error string
//     disabled={false}                  // optional
//   />
//
// The `medicine` object passed to onChange has shape:
//   {
//     id, name, generic_name, category, unit,
//     stock_quantity, stock_status,
//     default_dosage, route, is_active, is_recent
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import { searchMedicines } from "../api/doctorApi";

// ── Constants ─────────────────────────────────────────────────────────────────
const MIN_CHARS   = 2;   // start searching after this many chars
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 12;

// ── Stock badge config ────────────────────────────────────────────────────────
const STOCK_CONFIG = {
  AVAILABLE:    { dot: "#16A34A", bg: "#F0FDF4", text: "#15803D", label: "In Stock" },
  LOW:          { dot: "#D97706", bg: "#FFFBEB", text: "#B45309", label: "Low Stock" },
  OUT_OF_STOCK: { dot: "#DC2626", bg: "#FEF2F2", text: "#B91C1C", label: "Out of Stock" },
};

// ── Tiny icons ────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 15, color = "currentColor", strokeWidth = 1.8 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke={color}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d={d} />
  </svg>
);

// Spinner
const Spinner = ({ size = 14, color = "#16A34A" }) => (
  <span style={{
    display: "inline-block",
    width: size, height: size,
    border: `2px solid #E2E8F0`,
    borderTopColor: color,
    borderRadius: "50%",
    animation: "rhims_spin 0.65s linear infinite",
    flexShrink: 0,
  }} />
);

// ── Stock badge ────────────────────────────────────────────────────────────────
function StockBadge({ status, quantity, compact = false }) {
  const cfg = STOCK_CONFIG[status] || STOCK_CONFIG.AVAILABLE;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: compact ? "1px 6px" : "2px 8px",
      borderRadius: 20,
      background: cfg.bg,
      fontSize: compact ? 10 : 10.5,
      fontWeight: 600,
      color: cfg.text,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      {compact ? cfg.label : (status === "OUT_OF_STOCK" ? "Out of Stock" : `${cfg.label}: ${quantity}`)}
    </span>
  );
}

// ── Category pill ──────────────────────────────────────────────────────────────
function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: "1px 7px", borderRadius: 20,
      background: "#EFF6FF", color: "#1D4ED8",
      letterSpacing: "0.01em", whiteSpace: "nowrap",
    }}>
      {category}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MedicineDropdownItem
// ══════════════════════════════════════════════════════════════════════════════
function MedicineDropdownItem({ med, isHighlighted, onSelect, onHover }) {
  const cfg = STOCK_CONFIG[med.stock_status] || STOCK_CONFIG.AVAILABLE;
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onSelect(med); }}
      onMouseEnter={() => onHover()}
      style={{
        width: "100%", textAlign: "left",
        padding: "10px 14px",
        background: isHighlighted ? "#F0FDF4" : "transparent",
        border: "none", borderBottom: "1px solid #F1F5F9",
        cursor: "pointer",
        display: "flex", gap: 10, alignItems: "flex-start",
        transition: "background 0.08s ease",
        outline: "none",
      }}
    >
      {/* Left: colored stock indicator bar */}
      <span style={{
        width: 3, borderRadius: 8, alignSelf: "stretch", flexShrink: 0,
        background: cfg.dot, opacity: 0.7,
        minHeight: 36,
      }} />

      {/* Content */}
      <span style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name + badges */}
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          flexWrap: "wrap", marginBottom: 3,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: isHighlighted ? "#15803D" : "#0F172A",
            lineHeight: 1.3,
          }}>
            {med.name}
          </span>
          {med.is_recent && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 5px",
              borderRadius: 20, background: "#FFF7ED", color: "#C2410C",
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              Recent
            </span>
          )}
          <CategoryBadge category={med.category} />
        </span>

        {/* Row 2: generic name + unit */}
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          flexWrap: "wrap", marginBottom: 4,
        }}>
          {med.generic_name && (
            <span style={{ fontSize: 11, color: "#64748B" }}>
              Generic: <strong style={{ fontWeight: 600 }}>{med.generic_name}</strong>
            </span>
          )}
          {med.unit && (
            <span style={{ fontSize: 11, color: "#94A3B8" }}>· {med.unit}</span>
          )}
        </span>

        {/* Row 3: stock */}
        <StockBadge status={med.stock_status} quantity={med.stock_quantity} />
      </span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SelectedMedicineCard
// ══════════════════════════════════════════════════════════════════════════════
function SelectedMedicineCard({ medicine, onClear, disabled }) {
  const cfg = STOCK_CONFIG[medicine.stock_status] || STOCK_CONFIG.AVAILABLE;
  return (
    <div style={{
      border: `1.5px solid ${cfg.dot}30`,
      borderLeft: `3px solid ${cfg.dot}`,
      borderRadius: 10,
      background: medicine.stock_status === "OUT_OF_STOCK" ? "#FEF2F2" : "#F0FDF4",
      padding: "12px 14px",
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 10,
    }}>
      {/* Left: check icon + details */}
      <span style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
        {/* Check icon */}
        <span style={{
          width: 24, height: 24, borderRadius: "50%",
          background: cfg.dot, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 1,
        }}>
          <Icon
            d="M20 6 9 17l-5-5"
            size={11} color="#fff" strokeWidth={2.5}
          />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          {/* Medicine name */}
          <span style={{
            display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
              {medicine.name}
            </span>
            <CategoryBadge category={medicine.category} />
          </span>

          {/* Meta row */}
          <span style={{
            display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", marginBottom: 5,
          }}>
            {medicine.generic_name && (
              <span style={{ fontSize: 11.5, color: "#475569" }}>
                Generic: <span style={{ fontWeight: 600 }}>{medicine.generic_name}</span>
              </span>
            )}
            {medicine.unit && (
              <span style={{ fontSize: 11.5, color: "#64748B" }}>Unit: {medicine.unit}</span>
            )}
            {medicine.default_dosage && (
              <span style={{ fontSize: 11.5, color: "#64748B" }}>Dosage: {medicine.default_dosage}</span>
            )}
          </span>

          {/* Stock */}
          <StockBadge status={medicine.stock_status} quantity={medicine.stock_quantity} />

          {/* Out of stock warning */}
          {medicine.stock_status === "OUT_OF_STOCK" && (
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              marginTop: 6, fontSize: 11.5, color: "#B91C1C",
            }}>
              <Icon d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={12} color="#DC2626" />
              This medicine is currently out of stock. Prescription can still be written.
            </span>
          )}
        </span>
      </span>

      {/* Change button */}
      {!disabled && (
        <button
          type="button"
          onClick={onClear}
          style={{
            fontSize: 11.5, fontWeight: 600,
            color: "#64748B",
            background: "rgba(255,255,255,0.8)",
            border: "1px solid #E2E8F0",
            borderRadius: 7,
            padding: "4px 10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" size={11} color="#64748B" />
          Change
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MedicineAutocomplete  (main export)
// ══════════════════════════════════════════════════════════════════════════════
export default function MedicineAutocomplete({
  value,           // selected medicine object or null
  onChange,        // (medicine | null) => void
  recentIds = [],  // array of recently-used medicine IDs
  error,           // validation error string
  disabled = false,
  placeholder = "Type medicine name, generic or brand…",
  autoFocus = false,
}) {
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [searched, setSearched]       = useState(false); // true after first search attempt

  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);
  const debounce  = useRef(null);
  const abortRef  = useRef(null);

  // ── Close on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  // ── Search function (debounced) ──────────────────────────────────
  const runSearch = useCallback((q) => {
    if (debounce.current) clearTimeout(debounce.current);
    const delay = q.trim().length >= MIN_CHARS ? DEBOUNCE_MS : 0;

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const recent = recentIds.join(",");
        const data = await searchMedicines(q.trim(), recent, MAX_RESULTS);
        const list = data?.results ?? data?.data ?? (Array.isArray(data) ? data : []);
        setResults(list.filter((m) => m.is_active !== false));
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, delay);
  }, [recentIds]);

  // ── Input handlers ───────────────────────────────────────────────
  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setHighlighted(-1);
    setOpen(true);

    if (v.trim().length < MIN_CHARS && v.trim().length > 0) {
      // Fewer than MIN_CHARS typed — clear results but keep open
      setResults([]);
      setLoading(false);
    } else {
      runSearch(v);
    }
  };

  const handleFocus = () => {
    setOpen(true);
    // On initial focus with no query, load recent/top medicines
    if (!searched || results.length === 0) {
      runSearch(query);
    }
  };

  const handleSelect = (med) => {
    onChange(med);
    setQuery("");
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setSearched(false);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Keyboard navigation ──────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        if (highlighted >= 0 && results[highlighted]) {
          e.preventDefault();
          handleSelect(results[highlighted]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  // ── Has text but not enough chars yet ────────────────────────────
  const tooShort = query.trim().length > 0 && query.trim().length < MIN_CHARS;

  // ── Dropdown sections ────────────────────────────────────────────
  const recentResults = results.filter((m) => m.is_recent);
  const otherResults  = results.filter((m) => !m.is_recent);
  const hasResults    = results.length > 0;
  const isEmpty       = searched && !loading && !hasResults && !tooShort;
  const showInitial   = !query.trim() && hasResults; // initial top/recent list

  return (
    <>
      {/* Global keyframe */}
      <style>{`
        @keyframes rhims_spin { to { transform: rotate(360deg); } }
        @keyframes rhims_dropdown_in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div ref={wrapRef} style={{ position: "relative" }}>
        {/* ── Selected state: show card ── */}
        {value ? (
          <SelectedMedicineCard
            medicine={value}
            onClear={handleClear}
            disabled={disabled}
          />
        ) : (
          /* ── Search input ── */
          <div style={{ position: "relative" }}>
            {/* Left icon: spinner or search */}
            <span style={{
              position: "absolute", left: 11, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
              display: "flex", alignItems: "center",
            }}>
              {loading
                ? <Spinner size={14} />
                : <Icon d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={14} color="#94A3B8" />
              }
            </span>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              autoFocus={autoFocus}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                borderRadius: 9,
                border: `1.5px solid ${error ? "#FCA5A5" : open ? "#16A34A" : "#E5E7EB"}`,
                fontSize: 13,
                color: "#1E293B",
                background: disabled ? "#F8FAFC" : "#fff",
                outline: "none",
                boxSizing: "border-box",
                boxShadow: open ? "0 0 0 3px rgba(22,163,74,0.08)" : "none",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            />

            {/* Right: clear button */}
            {query && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); setOpen(false); }}
                style={{
                  position: "absolute", right: 9, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: 3, borderRadius: 5, color: "#94A3B8",
                  display: "flex", alignItems: "center",
                }}
                tabIndex={-1}
              >
                <Icon d="M18 6 6 18 M6 6l12 12" size={12} />
              </button>
            )}

            {/* ── Dropdown ── */}
            {open && (
              <div style={{
                position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0,
                background: "#fff",
                border: "1.5px solid #E2E8F0",
                borderRadius: 11,
                boxShadow: "0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
                zIndex: 999,
                maxHeight: 320, overflowY: "auto",
                animation: "rhims_dropdown_in 0.12s ease",
              }}>

                {/* ── Too short hint ── */}
                {tooShort && (
                  <div style={{
                    padding: "13px 16px",
                    fontSize: 12.5, color: "#94A3B8", textAlign: "center",
                  }}>
                    Type at least <strong style={{ color: "#475569" }}>{MIN_CHARS} characters</strong> to search…
                  </div>
                )}

                {/* ── Loading ── */}
                {loading && (
                  <div style={{
                    padding: "14px 16px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontSize: 12.5, color: "#64748B",
                  }}>
                    <Spinner size={13} /> Searching pharmacy stock…
                  </div>
                )}

                {/* ── Results ── */}
                {!loading && hasResults && !tooShort && (
                  <>
                    {/* Sticky header */}
                    <div style={{
                      padding: "6px 14px 5px",
                      background: "#F8FAFC",
                      borderBottom: "1px solid #F1F5F9",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      position: "sticky", top: 0, zIndex: 1,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "#94A3B8",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>
                        {showInitial ? "Available Medicines" : `Pharmacy Stock — ${results.length} result${results.length !== 1 ? "s" : ""}`}
                      </span>
                      <span style={{ fontSize: 10, color: "#CBD5E1" }}>
                        ↑↓ navigate · Enter select
                      </span>
                    </div>

                    {/* Recently used section */}
                    {recentResults.length > 0 && (
                      <>
                        <div style={{
                          padding: "5px 14px 3px",
                          fontSize: 9.5, fontWeight: 700, color: "#C2410C",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          background: "#FFF7ED",
                          borderBottom: "1px solid #FED7AA",
                        }}>
                          Recently Prescribed
                        </div>
                        {recentResults.map((med) => {
                          const idx = results.indexOf(med);
                          return (
                            <MedicineDropdownItem
                              key={med.id}
                              med={med}
                              isHighlighted={idx === highlighted}
                              onSelect={handleSelect}
                              onHover={() => setHighlighted(idx)}
                            />
                          );
                        })}
                      </>
                    )}

                    {/* Other results */}
                    {otherResults.length > 0 && recentResults.length > 0 && (
                      <div style={{
                        padding: "5px 14px 3px",
                        fontSize: 9.5, fontWeight: 700, color: "#64748B",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        background: "#F8FAFC",
                        borderBottom: "1px solid #F1F5F9",
                        borderTop: "1px solid #F1F5F9",
                      }}>
                        Other Medicines
                      </div>
                    )}
                    {otherResults.map((med) => {
                      const idx = results.indexOf(med);
                      return (
                        <MedicineDropdownItem
                          key={med.id}
                          med={med}
                          isHighlighted={idx === highlighted}
                          onSelect={handleSelect}
                          onHover={() => setHighlighted(idx)}
                        />
                      );
                    })}

                    {/* Footer */}
                    <div style={{
                      padding: "5px 14px",
                      background: "#FAFBFD",
                      borderTop: "1px solid #F1F5F9",
                      fontSize: 10.5, color: "#94A3B8",
                    }}>
                      Showing {results.length} active medicines from pharmacy inventory
                    </div>
                  </>
                )}

                {/* ── Empty state ── */}
                {!loading && isEmpty && (
                  <div style={{
                    padding: "20px 16px",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 8, textAlign: "center",
                  }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "#F1F5F9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={18} color="#94A3B8" />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                      No medicines found
                    </span>
                    <span style={{ fontSize: 11.5, color: "#94A3B8", maxWidth: 240 }}>
                      No active medicines match &ldquo;{query}&rdquo; in pharmacy stock.
                      Try a different name or generic.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Validation error ── */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            marginTop: 5, fontSize: 11.5, color: "#DC2626",
          }}>
            <Icon d="M12 9v4m0 4h.01" size={12} color="#DC2626" />
            {error}
          </div>
        )}
      </div>
    </>
  );
}