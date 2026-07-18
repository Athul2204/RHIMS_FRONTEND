import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  getSuppliesDashboard,
  getSupplyItems,
  createSupplyItem,
  getSupplyItemDetail,
  updateSupplyItem,
  addStock,
  useStock,
  returnToProvider,
  getAlerts,
  resolveAlert,
  getUsageLogs,
} from "../api/suppliesApi";

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  primary:      "#8B5CF6",
  primaryLight: "#F5F3FF",
  success:      "#10B981",
  successLight: "#D1FAE5",
  danger:       "#EF4444",
  dangerLight:  "#FEE2E2",
  warning:      "#F59E0B",
  warningLight: "#FEF3C7",
  info:         "#3B82F6",
  infoLight:    "#DBEAFE",
  gray: {
    50: "#F9FAFB", 100: "#F3F4F6", 200: "#E5E7EB", 300: "#D1D5DB",
    400: "#9CA3AF", 500: "#6B7280", 600: "#4B5563",
    700: "#374151", 800: "#1F2937", 900: "#111827",
  },
};

const INPUT = {
  padding: "9px 12px", borderRadius: 8,
  border: `1.5px solid ${C.gray[200]}`, fontSize: 13,
  color: C.gray[800], outline: "none", background: "#fff",
  width: "100%", boxSizing: "border-box",
};

const LABEL = {
  fontSize: 11, fontWeight: 600, color: C.gray[600],
  textTransform: "uppercase", letterSpacing: "0.5px",
  display: "block", marginBottom: 4,
};

const TH = {
  padding: "10px 12px", fontSize: 11.5, fontWeight: 700,
  color: C.gray[500], textTransform: "uppercase", letterSpacing: 0.4,
};
const TD = { padding: "11px 12px", color: C.gray[700] };

const ghostBtn = {
  display: "flex", alignItems: "center", gap: 5,
  border: `1.5px solid ${C.gray[200]}`, background: "#fff",
  color: C.gray[700], borderRadius: 7, padding: "6px 11px",
  fontSize: 12, fontWeight: 600, cursor: "pointer",
};

// ─────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "ALL",          label: "All",             icon: "📦" },
  { key: "INJECTION",   label: "Injection & IV",   icon: "💉" },
  { key: "WOUND_CARE",  label: "Wound Care",       icon: "🩹" },
  { key: "RESPIRATORY", label: "Respiratory",      icon: "😷" },
  { key: "PPE",         label: "PPE",              icon: "🧤" },
  { key: "URINARY",     label: "Urinary & Drain",  icon: "🏥" },
  { key: "COLLECTION",  label: "Collection",       icon: "🧪" },
  { key: "SURGICAL",    label: "Surgical",         icon: "🔬" },
  { key: "HOUSEKEEPING",label: "Housekeeping",     icon: "🧴" },
  { key: "OTHER",       label: "Other",            icon: "🗂️"  },
];

const UNITS = [
  "PIECES","BOXES","PACKETS","ROLLS","PAIRS","LITRES","ML",
  "CYLINDERS","VIALS","SETS","STRIPS","METRES","KG","GRAMS",
];

const DEPARTMENTS = [
  "OPD","IPD","Emergency","ICU","NICU","OT","Labour Room",
  "Radiology","Laboratory","Pharmacy","Male Ward","Female Ward",
  "Paediatric Ward","Isolation Ward","Casualty","Physiotherapy",
];

const RETURN_REASONS = [
  { key: "EXPIRED",   label: "Expired" },
  { key: "DAMAGED",   label: "Damaged" },
  { key: "DEFECTIVE", label: "Defective" },
  { key: "RECALL",    label: "Recall" },
  { key: "EXCESS",    label: "Excess / Over-ordered" },
  { key: "OTHER",     label: "Other" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────
// ICON
// ─────────────────────────────────────────────────────────────
function Icon({ d, size = 16, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  search:      "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus:        "M12 5v14 M5 12h14",
  minus:       "M5 12h14",
  box:         "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  alert:       "M12 8v4 M12 16h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp:   "M18 15l-6-6-6 6",
  close:       "M18 6L6 18M6 6l12 12",
  edit:        "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  refresh:     "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  calendar:    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  filter:      "M22 3H2l8 9.46V19l4 2V12.46L22 3",
  undo:        "M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 1 1 0 11H11",
  receipt:     "M9 14l2 2 4-4 M4 4h16v17l-3-2-3 2-3-2-3 2-3-2-3 2V4z",
};

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
function Toast({ msg, ok, warn }) {
  if (!msg) return null;
  const bg    = warn ? "#FFFBEB" : ok ? "#F0FDF4" : "#FEF2F2";
  const color = warn ? "#92400E" : ok ? "#166534" : "#B91C1C";
  const brd   = warn ? "#FDE68A" : ok ? "#BBF7D0" : "#FECACA";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: bg, color, border: `1px solid ${brd}`,
      boxShadow: "0 8px 28px rgba(0,0,0,0.14)", maxWidth: 380,
    }}>{msg}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// STOCK STATUS
// ─────────────────────────────────────────────────────────────
function stockStatus(item) {
  const stock = item.total_stock ?? 0;
  const thr   = item.low_stock_threshold ?? 10;
  if (stock === 0)      return { label: "OUT OF STOCK", bg: C.dangerLight,  color: C.danger  };
  if (stock < thr)      return { label: "LOW STOCK",    bg: C.warningLight, color: C.warning };
  if (stock < thr * 2)  return { label: "ADEQUATE",     bg: C.infoLight,    color: C.info    };
  return                       { label: "WELL STOCKED", bg: C.successLight, color: C.success };
}
function StatusBadge({ item }) {
  const s = stockStatus(item);
  return (
    <span style={{
      padding: "3px 9px", background: s.bg, color: s.color,
      borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDT = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

function expiryStyle(dt, qty) {
  if (!dt) return {};
  const days = (new Date(dt) - new Date()) / 86400000;
  if (days < 0)   return { color: C.danger,  fontWeight: 700, textDecoration: qty ? "line-through" : "none" };
  if (days <= 30) return { color: C.warning, fontWeight: 700 };
  return {};
}

// ─────────────────────────────────────────────────────────────
// CATEGORY SELECT (compact dropdown — replaces the old chip row
// everywhere to keep each page's toolbar to a single tidy line)
// ─────────────────────────────────────────────────────────────
function CategorySelect({ value, onChange, style }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...INPUT, width: "auto", minWidth: 168, cursor: "pointer", ...style }}>
      {CATEGORIES.map((c) => (
        <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// DRAWER FORM VALIDATION
// ─────────────────────────────────────────────────────────────
function validateDrawer(mode, data, ctx) {
  const e = {};
  const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

  if (mode === "addItem" || mode === "editItem") {
    if (isBlank(data.name)) e.name = "Name is required.";
    if (isBlank(data.category)) e.category = "Category is required.";
    if (isBlank(data.unit)) e.unit = "Unit is required.";
    if (data.low_stock_threshold !== undefined && data.low_stock_threshold !== "" && Number(data.low_stock_threshold) < 0) {
      e.low_stock_threshold = "Threshold cannot be negative.";
    }
  }

  if (mode === "addStock") {
    if (isBlank(data.batch_number)) e.batch_number = "Batch number is required.";
    if (isBlank(data.quantity)) e.quantity = "Quantity is required.";
    else if (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) < 1) e.quantity = "Quantity must be at least 1.";
    if (isBlank(data.unit_cost)) e.unit_cost = "Unit cost is required.";
    else if (Number(data.unit_cost) < 0) e.unit_cost = "Unit cost cannot be negative.";
    if (isBlank(data.supplier_name)) e.supplier_name = "Supplier name is required.";
    if (isBlank(data.supplier_contact)) e.supplier_contact = "Supplier contact is required.";
    if (isBlank(data.invoice_number)) e.invoice_number = "Invoice number is required.";
    const purchase = data.purchase_date || todayStr();
    if (isBlank(data.purchase_date)) e.purchase_date = "Purchase date is required.";
    else if (purchase > todayStr()) e.purchase_date = "Purchase date cannot be in the future.";
    if (isBlank(data.expiry_date)) e.expiry_date = "Expiry date is required.";
    else if (data.expiry_date <= todayStr()) e.expiry_date = "Expiry date must be in the future.";
    else if (data.expiry_date <= purchase) e.expiry_date = "Expiry date must be after the purchase date.";
    if (isBlank(data.notes)) e.notes = "Notes are required — add a short receiving note.";
  }

  if (mode === "useStock") {
    if (isBlank(data.quantity_used)) e.quantity_used = "Quantity is required.";
    else if (!Number.isFinite(Number(data.quantity_used)) || Number(data.quantity_used) < 1) e.quantity_used = "Quantity must be at least 1.";
    else if (ctx && Number(data.quantity_used) > (ctx.total_stock ?? 0)) e.quantity_used = `Only ${ctx.total_stock ?? 0} units available.`;
    if (isBlank(data.department)) e.department = "Department is required for audit tracking.";
  }

  if (mode === "returnStock") {
    if (isBlank(data.quantity_returned)) e.quantity_returned = "Quantity is required.";
    else if (!Number.isFinite(Number(data.quantity_returned)) || Number(data.quantity_returned) < 1) e.quantity_returned = "Quantity must be at least 1.";
    else if (ctx && Number(data.quantity_returned) > (ctx.quantity ?? 0)) e.quantity_returned = `Only ${ctx.quantity ?? 0} units remain in this batch.`;
    if (isBlank(data.reason)) e.reason = "Reason is required.";
    if (isBlank(data.reason_details)) e.reason_details = "Please add a short detail note.";
  }

  return e;
}

// ─────────────────────────────────────────────────────────────
// FIELD
// ─────────────────────────────────────────────────────────────
function inputStyle(hasError) {
  return hasError ? { ...INPUT, borderColor: C.danger, background: "#FFFBFB" } : INPUT;
}

function Field({ label, children, help, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL}>{label}</label>
      {children}
      {error ? (
        <p style={{ fontSize: 11, color: C.danger, margin: "4px 0 0", fontWeight: 600 }}>{error}</p>
      ) : help ? (
        <p style={{ fontSize: 11, color: C.gray[500], margin: "4px 0 0" }}>{help}</p>
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// BATCH ROW (inline adjust + return-to-provider trigger)
// ═════════════════════════════════════════════════════════════
function BatchRow({ batch, onReturn }) {
  return (
    <tr style={{
      borderBottom: `1px solid ${C.gray[100]}`, fontSize: 12.5,
      opacity: batch.quantity === 0 ? 0.55 : 1,
    }}>
      <td style={{ padding: "7px 10px", fontWeight: 700, color: C.gray[800] }}>
        {batch.batch_number || <span style={{ color: C.gray[400], fontWeight: 500, fontStyle: "italic" }}>legacy #{batch.batch_id}</span>}
      </td>
      <td style={{ padding: "7px 10px" }}>{fmtDate(batch.purchase_date)}</td>
      <td style={{ padding: "7px 10px" }}>{batch.supplier_name || "—"}</td>
      <td style={{ padding: "7px 10px" }}>{batch.invoice_number || "—"}</td>
      <td style={{ padding: "7px 10px", color: C.gray[500] }}>{batch.received_by_name || "—"}</td>
      <td style={{ padding: "7px 10px", textAlign: "right" }}>{batch.original_quantity}</td>
      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700 }}>{batch.quantity}</td>
      <td style={{ padding: "7px 10px", textAlign: "right" }}>₹{Number(batch.unit_cost).toFixed(2)}</td>
      <td style={{ padding: "7px 10px", textAlign: "right", color: C.gray[600] }}>₹{Number(batch.total_cost ?? (batch.original_quantity * batch.unit_cost)).toFixed(2)}</td>
      <td style={{ padding: "7px 10px", ...expiryStyle(batch.expiry_date, batch.quantity) }}>
        {fmtDate(batch.expiry_date)}
        {batch.is_expiring_soon && batch.quantity > 0 && (
          <span style={{ marginLeft: 5, fontSize: 10, color: C.warning, fontWeight: 700 }}>⚠ SOON</span>
        )}
      </td>
      <td style={{ padding: "7px 10px" }}>
        <button
          onClick={() => onReturn(batch)}
          disabled={batch.quantity === 0}
          title="Return this batch to the supplier"
          style={{
            border: `1px solid ${C.danger}`, background: "#fff", color: C.danger,
            borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600,
            cursor: batch.quantity === 0 ? "default" : "pointer",
            opacity: batch.quantity === 0 ? 0.4 : 1,
            display: "flex", alignItems: "center", gap: 4,
          }}>
          <Icon d={ICONS.undo} size={11} color={C.danger} /> Return
        </button>
      </td>
    </tr>
  );
}

// ═════════════════════════════════════════════════════════════
// DRAWER
// ═════════════════════════════════════════════════════════════
function Drawer({ mode, item, batch, data, setData, saving, onClose, onSubmit, dealers = [] }) {
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { setAttempted(false); }, [mode, item, batch]);

  if (!mode) return null;
  const set = (f) => (e) => setData((d) => ({ ...d, [f]: e.target.value }));
  const setB = (f) => (e) => setData((d) => ({ ...d, [f]: e.target.checked }));
  const isItemForm = mode === "addItem" || mode === "editItem";

  const ctx = mode === "returnStock" ? batch : item;
  const errors = validateDrawer(mode, data, ctx);
  const hasErrors = Object.keys(errors).length > 0;
  const shown = (field) => (attempted ? errors[field] : undefined);

  const TITLE = {
    addItem:     "Add Supply Item",
    editItem:    `Edit — ${item?.name ?? ""}`,
    addStock:    `Add Stock — ${item?.name ?? ""}`,
    returnStock: `Return to Provider — ${item?.name ?? ""}`,
    useStock:    `Issue Stock — ${item?.name ?? ""}`,
  };

  const handleSubmitClick = () => {
    setAttempted(true);
    if (Object.keys(validateDrawer(mode, data, ctx)).length > 0) return;
    onSubmit();
  };

  const accent =
    mode === "useStock" ? C.warning :
    mode === "returnStock" ? C.danger : C.primary;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 998,
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100vh",
        width: 440, maxWidth: "93vw", background: "#fff",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.16)", zIndex: 999,
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: `1px solid ${C.gray[200]}`,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.gray[900], margin: 0 }}>
            {TITLE[mode]}
          </h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
            <Icon d={ICONS.close} size={18} color={C.gray[500]} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {attempted && hasErrors && (
            <div style={{
              background: C.dangerLight, border: `1px solid #FECACA`, borderRadius: 8,
              padding: "9px 12px", marginBottom: 14, fontSize: 12, fontWeight: 600, color: C.danger,
            }}>
              Please fix the {Object.keys(errors).length} highlighted field{Object.keys(errors).length !== 1 ? "s" : ""} below.
            </div>
          )}

          {isItemForm && (
            <>
              <Field label="Name *" error={shown("name")}>
                <input style={inputStyle(shown("name"))} value={data.name ?? ""} onChange={set("name")} placeholder="e.g. Syringe 5ml" />
              </Field>
              <Field label="Category *" error={shown("category")}>
                <select style={{ ...inputStyle(shown("category")), cursor: "pointer" }} value={data.category ?? ""} onChange={set("category")}>
                  <option value="">Select category</option>
                  {CATEGORIES.filter((c) => c.key !== "ALL").map((c) => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unit *" error={shown("unit")}>
                <select style={{ ...inputStyle(shown("unit")), cursor: "pointer" }} value={data.unit ?? ""} onChange={set("unit")}>
                  <option value="">Select unit</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" help="Spec, size, brand notes">
                <textarea style={{ ...INPUT, minHeight: 70, fontFamily: "inherit", resize: "vertical" }}
                  value={data.description ?? ""} onChange={set("description")}
                  placeholder="Optional notes about this item" />
              </Field>
              <Field label="Low Stock Threshold" error={shown("low_stock_threshold")} help="Alert fires when total stock drops below this">
                <input type="number" min="0" style={inputStyle(shown("low_stock_threshold"))}
                  value={data.low_stock_threshold ?? 10} onChange={set("low_stock_threshold")} />
              </Field>
              {mode === "editItem" && (
                <Field label="Status">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!data.is_active} onChange={setB("is_active")} />
                    Active (uncheck to deactivate this item)
                  </label>
                </Field>
              )}
            </>
          )}

          {mode === "addStock" && (
            <>
              <div style={{
                background: C.gray[50], borderRadius: 8, padding: "10px 12px",
                marginBottom: 16, fontSize: 12.5, color: C.gray[600],
              }}>
                Current stock:{" "}
                <strong style={{ color: C.gray[900] }}>{item?.total_stock ?? 0}</strong>
              </div>
              <Field label="Batch / Lot Number *" error={shown("batch_number")} help="From the supplier invoice or packaging label">
                <input style={inputStyle(shown("batch_number"))} value={data.batch_number ?? ""} onChange={set("batch_number")} placeholder="e.g. LOT-2026-0731" />
              </Field>
              <Field label="Quantity *" error={shown("quantity")}>
                <input type="number" min="1" style={inputStyle(shown("quantity"))} value={data.quantity ?? ""} onChange={set("quantity")} />
              </Field>
              <Field label="Unit Cost (₹) *" error={shown("unit_cost")}>
                <input type="number" min="0" step="0.01" style={inputStyle(shown("unit_cost"))}
                  value={data.unit_cost ?? ""} onChange={set("unit_cost")} placeholder="0.00" />
              </Field>
              <Field label="Supplier Name *" error={shown("supplier_name")}>
                <input style={inputStyle(shown("supplier_name"))} value={data.supplier_name ?? ""} onChange={set("supplier_name")} />
              </Field>
              <Field label="Supplier Contact *" error={shown("supplier_contact")}>
                <input style={inputStyle(shown("supplier_contact"))} value={data.supplier_contact ?? ""} onChange={set("supplier_contact")} />
              </Field>
              <Field label="Invoice No. *" error={shown("invoice_number")}>
                <input style={inputStyle(shown("invoice_number"))} value={data.invoice_number ?? ""} onChange={set("invoice_number")} />
              </Field>
              <Field label="Purchase Date *" error={shown("purchase_date")}>
                <input type="date" max={todayStr()} style={inputStyle(shown("purchase_date"))}
                  value={data.purchase_date ?? todayStr()} onChange={set("purchase_date")} />
              </Field>
              <Field label="Expiry Date *" error={shown("expiry_date")}>
                <input type="date" style={inputStyle(shown("expiry_date"))} value={data.expiry_date ?? ""} onChange={set("expiry_date")} />
              </Field>
              <Field label="Notes *" error={shown("notes")} help="e.g. Received in good condition, stored in Pharmacy store room">
                <textarea style={{ ...inputStyle(shown("notes")), minHeight: 60, fontFamily: "inherit", resize: "vertical" }}
                  value={data.notes ?? ""} onChange={set("notes")} />
              </Field>

              {/* OPTIONAL dealer link — entirely optional, mirrors the
                  medicine/general-item add-stock flows. Leaving it blank
                  behaves exactly as before this field existed. */}
              <div style={{ borderTop: `1px dashed ${C.gray[200]}`, paddingTop: 14, marginTop: 4 }}>
                <Field label="Dealer" help="Optional — links this purchase to the Dealers ledger">
                  <select style={{ ...INPUT, cursor: "pointer" }} value={data.dealer_id ?? ""} onChange={set("dealer_id")}>
                    <option value="">No dealer — plain stock entry</option>
                    {dealers.map((d) => (
                      <option key={d.dealer_id} value={d.dealer_id}>
                        {d.name}{d.balance ? ` (balance: ₹${Number(d.balance).toFixed(2)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {data.dealer_id && (
                  <p style={{ fontSize: 10.5, color: C.gray[400], margin: "-8px 0 12px" }}>
                    This purchase will be sent to the Manager's Dealers page for review.
                    The Manager decides the settlement (Pay Now / Pay Later — Credit) when
                    confirming it — this is not set by the pharmacist.
                  </p>
                )}
              </div>
            </>
          )}

          {mode === "returnStock" && (
            <>
              <div style={{
                background: C.gray[50], borderRadius: 8, padding: "10px 12px",
                marginBottom: 16, fontSize: 12.5, color: C.gray[600],
              }}>
                Batch <strong style={{ color: C.gray[900] }}>{batch?.batch_number || `#${batch?.batch_id}`}</strong>
                {" · "}Supplier <strong style={{ color: C.gray[900] }}>{batch?.supplier_name || "—"}</strong>
                {" · "}Remaining:{" "}
                <strong style={{ color: C.gray[900] }}>{batch?.quantity ?? 0}</strong>
              </div>
              <Field label="Quantity to Return *" error={shown("quantity_returned")}>
                <input type="number" min="1" style={inputStyle(shown("quantity_returned"))}
                  value={data.quantity_returned ?? ""} onChange={set("quantity_returned")} />
              </Field>
              <Field label="Reason *" error={shown("reason")}>
                <select style={{ ...inputStyle(shown("reason")), cursor: "pointer" }} value={data.reason ?? ""} onChange={set("reason")}>
                  <option value="">Select reason</option>
                  {RETURN_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Reason Details *" error={shown("reason_details")} help="Short note for the audit trail">
                <textarea style={{ ...inputStyle(shown("reason_details")), minHeight: 60, fontFamily: "inherit", resize: "vertical" }}
                  value={data.reason_details ?? ""} onChange={set("reason_details")}
                  placeholder="e.g. Batch found leaking on inspection" />
              </Field>
              <Field label="Supplier Credit Note / RMA No." help="Optional reference from the supplier">
                <input style={INPUT} value={data.reference_number ?? ""} onChange={set("reference_number")} />
              </Field>
            </>
          )}

          {mode === "useStock" && (
            <>
              <div style={{
                background: C.gray[50], borderRadius: 8, padding: "10px 12px",
                marginBottom: 16, fontSize: 12.5, color: C.gray[600],
              }}>
                Available stock:{" "}
                <strong style={{ color: C.gray[900] }}>{item?.total_stock ?? 0}</strong>
              </div>
              <Field label="Quantity to Issue *" error={shown("quantity_used")}>
                <input type="number" min="1"
                  style={inputStyle(shown("quantity_used"))}
                  value={data.quantity_used ?? ""} onChange={set("quantity_used")} />
              </Field>
              <Field label="Department *" error={shown("department")} help="Required so issued stock can be traced and audited">
                <input style={inputStyle(shown("department"))} list="dept-list"
                  value={data.department ?? ""} onChange={set("department")} placeholder="e.g. ICU" />
                <datalist id="dept-list">
                  {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </Field>
              <Field label="Notes">
                <textarea style={{ ...INPUT, minHeight: 60, fontFamily: "inherit", resize: "vertical" }}
                  value={data.notes ?? ""} onChange={set("notes")} />
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.gray[200]}`, display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            border: `1.5px solid ${C.gray[200]}`, background: "#fff",
            color: C.gray[700], fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Cancel</button>
          <button
            onClick={handleSubmitClick}
            disabled={saving}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
              background: accent,
              color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? "Saving…"
              : mode === "useStock" ? "Issue Stock"
              : mode === "returnStock" ? "Return Stock"
              : mode === "addStock" ? "Add to Stock"
              : "Save Item"}
          </button>
        </div>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// ITEMS TAB — catalogue only. Just add / edit items. Nothing
// about stock quantities or actions lives here anymore; that's
// the Stock and Usage tabs' job, so this page stays a simple list.
// ═════════════════════════════════════════════════════════════
function ItemsTab({ items: propItems, loading, showToast, onRefreshSummary, addItemRef }) {
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [showInactive,   setShowInactive]   = useState(false);
  const [drawerMode,     setDrawerMode]     = useState(null);
  const [drawerItem,     setDrawerItem]     = useState(null);
  const [drawerData,     setDrawerData]     = useState({});
  const [saving,         setSaving]         = useState(false);
  const [localItems,     setLocalItems]     = useState(propItems);

  useEffect(() => { setLocalItems(propItems); }, [propItems]);

  // Let parent header trigger "Add Item" via a ref
  useEffect(() => {
    if (!addItemRef) return;
    addItemRef.current = () => {
      setDrawerMode("addItem");
      setDrawerItem(null);
      setDrawerData({ low_stock_threshold: 10, is_active: true });
    };
  }, [addItemRef]);

  const filtered = useMemo(() => {
    let list = localItems;
    if (!showInactive) list = list.filter((i) => i.is_active !== false);
    if (activeCategory !== "ALL") list = list.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(t) || (i.description || "").toLowerCase().includes(t)
      );
    }
    return list;
  }, [localItems, showInactive, activeCategory, search]);

  const patchItem = (id, patch) =>
    setLocalItems((p) => p.map((i) => (i.item_id === id ? { ...i, ...patch } : i)));

  const closeDrawer = () => { setDrawerMode(null); setDrawerItem(null); setDrawerData({}); };
  const openEdit     = (item) => { setDrawerMode("editItem"); setDrawerItem(item); setDrawerData({ ...item }); };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (drawerMode === "addItem") {
        const created = await createSupplyItem({
          name: drawerData.name.trim(), category: drawerData.category,
          unit: drawerData.unit, description: drawerData.description || "",
          low_stock_threshold: Number(drawerData.low_stock_threshold) || 10,
        });
        setLocalItems((p) => [...p, created]);
        showToast(`'${created.name}' added.`); onRefreshSummary();
      }

      if (drawerMode === "editItem") {
        const updated = await updateSupplyItem(drawerItem.item_id, {
          name: drawerData.name?.trim(), category: drawerData.category,
          unit: drawerData.unit, description: drawerData.description || "",
          low_stock_threshold: Number(drawerData.low_stock_threshold) || 10,
          is_active: !!drawerData.is_active,
        });
        patchItem(drawerItem.item_id, updated);
        showToast("Item updated."); onRefreshSummary();
      }

      setTimeout(closeDrawer, 500);
    } catch (e) {
      showToast(e.message || "Something went wrong.", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <p style={{ textAlign: "center", color: C.gray[400], padding: 40, fontSize: 13 }}>Loading supplies…</p>
  );

  return (
    <>
      {/* Toolbar — one tidy line: search, category, inactive toggle */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 440 }}>
          <Icon d={ICONS.search} size={15} color={C.gray[400]}
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Search by name or description…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 33 }} />
        </div>
        <CategorySelect value={activeCategory} onChange={setActiveCategory} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.gray[500], cursor: "pointer" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid #EEF2F7`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.gray[50], textAlign: "left" }}>
              <th style={TH}>Item Name</th>
              <th style={TH}>Category</th>
              <th style={TH}>Unit</th>
              <th style={{ ...TH, textAlign: "right" }}>Low Stock Threshold</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.gray[400], fontSize: 13 }}>
                  No supply items found.
                </td>
              </tr>
            ) : filtered.map((item) => {
              const cat      = CATEGORIES.find((c) => c.key === item.category);
              const inactive = item.is_active === false;

              return (
                <tr key={item.item_id} style={{
                  borderTop: `1px solid ${C.gray[100]}`,
                  background: inactive ? C.gray[50] : "#fff",
                  opacity: inactive ? 0.65 : 1,
                }}>
                  <td style={{ ...TD, fontWeight: 600, color: C.gray[900] }}>
                    {item.name}
                    {inactive && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, padding: "1px 6px",
                        background: C.gray[200], color: C.gray[500],
                        borderRadius: 4, fontWeight: 700,
                      }}>INACTIVE</span>
                    )}
                    {item.description && (
                      <div style={{ fontSize: 11.5, color: C.gray[500], fontStyle: "italic", marginTop: 2 }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td style={TD}>{cat ? `${cat.icon} ${cat.label}` : item.category_display}</td>
                  <td style={{ ...TD, color: C.gray[600] }}>{item.unit_display}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{item.low_stock_threshold}</td>
                  <td style={TD}>
                    <span style={{
                      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: inactive ? C.gray[200] : C.successLight,
                      color: inactive ? C.gray[600] : C.success,
                    }}>{inactive ? "INACTIVE" : "ACTIVE"}</span>
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <button onClick={() => openEdit(item)} style={ghostBtn}>
                      <Icon d={ICONS.edit} size={12} color={C.gray[600]} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 12, color: C.gray[400], textAlign: "right" }}>
        {filtered.length} item{filtered.length !== 1 ? "s" : ""} shown
        {localItems.length !== filtered.length ? ` of ${localItems.length} total` : ""}
      </p>

      <Drawer
        mode={drawerMode} item={drawerItem} data={drawerData}
        setData={setDrawerData} saving={saving}
        onClose={closeDrawer} onSubmit={handleSubmit}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// VALUE TAB — every item's current stock value (qty × unit cost,
// summed across its batches), sorted highest-value first, with a
// running grand total. Uses the `total_stock_value` figure that
// the items API already returns per item, so no new backend
// endpoint is needed.
// ═════════════════════════════════════════════════════════════
function ValueTab({ items, loading }) {
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [sortDir,        setSortDir]        = useState("desc"); // "desc" | "asc"

  const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const rows = useMemo(() => {
    let list = items.filter((i) => i.is_active !== false);
    if (activeCategory !== "ALL") list = list.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(t));
    }
    list = [...list].sort((a, b) => {
      const av = Number(a.total_stock_value || 0);
      const bv = Number(b.total_stock_value || 0);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [items, activeCategory, search, sortDir]);

  const grandTotal = useMemo(
    () => rows.reduce((sum, i) => sum + Number(i.total_stock_value || 0), 0),
    [rows]
  );

  if (loading) return (
    <p style={{ textAlign: "center", color: C.gray[400], padding: 40, fontSize: 13 }}>Loading supplies…</p>
  );

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 440 }}>
          <Icon d={ICONS.search} size={15} color={C.gray[400]}
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Search by name…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 33 }} />
        </div>
        <CategorySelect value={activeCategory} onChange={setActiveCategory} />
        <button
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          style={ghostBtn}
          title="Toggle sort order"
        >
          <Icon d={sortDir === "desc" ? ICONS.chevronDown : ICONS.chevronUp} size={13} color={C.gray[600]} />
          Value {sortDir === "desc" ? "High → Low" : "Low → High"}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: C.primaryLight, border: `1px solid #EDE9FE`, borderRadius: 10,
        padding: "10px 16px", marginBottom: 16,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.gray[600] }}>
          {rows.length} item{rows.length !== 1 ? "s" : ""} in view
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>
          Total: {money(grandTotal)}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: `1px solid #EEF2F7`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.gray[50], textAlign: "left" }}>
              <th style={TH}>Item Name</th>
              <th style={TH}>Category</th>
              <th style={{ ...TH, textAlign: "right" }}>Current Stock</th>
              <th style={TH}>Unit</th>
              <th style={{ ...TH, textAlign: "right" }}>Total Value</th>
              <th style={{ ...TH, textAlign: "right" }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.gray[400], fontSize: 13 }}>
                  No supply items found.
                </td>
              </tr>
            ) : rows.map((item) => {
              const cat   = CATEGORIES.find((c) => c.key === item.category);
              const value = Number(item.total_stock_value || 0);
              const pct   = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
              return (
                <tr key={item.item_id} style={{ borderTop: `1px solid ${C.gray[100]}` }}>
                  <td style={{ ...TD, fontWeight: 600, color: C.gray[900] }}>{item.name}</td>
                  <td style={TD}>{cat ? `${cat.icon} ${cat.label}` : item.category_display}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{item.total_stock ?? 0}</td>
                  <td style={{ ...TD, color: C.gray[600] }}>{item.unit_display}</td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: C.success }}>{money(value)}</td>
                  <td style={{ ...TD, textAlign: "right", color: C.gray[500] }}>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.gray[200]}`, background: C.gray[50] }}>
                <td colSpan={4} style={{ ...TD, fontWeight: 700, color: C.gray[900] }}>Grand Total</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: C.primary }}>{money(grandTotal)}</td>
                <td style={TD} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// STOCK TAB — receiving stock. Pick an item, add a purchase
// batch, or return an existing batch to the supplier. Issuing
// stock for day-to-day usage lives in the separate Usage tab.
// ═════════════════════════════════════════════════════════════
function StockTab({ items, loading, showToast, onRefreshSummary }) {
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [lowStockOnly,   setLowStockOnly]   = useState(false);
  const [selectedId,     setSelectedId]     = useState(null);
  const [detail,         setDetail]         = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [drawerMode,     setDrawerMode]     = useState(null);
  const [drawerBatch,    setDrawerBatch]    = useState(null);
  const [drawerData,     setDrawerData]     = useState({});
  const [saving,         setSaving]         = useState(false);
  const [localItems,     setLocalItems]     = useState(items);
  const [dealers,        setDealers]        = useState([]);

  useEffect(() => { setLocalItems(items); }, [items]);

  useEffect(() => {
    let cancelled = false;
    import("../api/pharmacistApi").then(({ getDealers }) => {
      getDealers().then((list) => { if (!cancelled) setDealers(list || []); }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = localItems.filter((i) => i.is_active !== false);
    if (activeCategory !== "ALL") list = list.filter((i) => i.category === activeCategory);
    if (lowStockOnly) list = list.filter((i) => i.is_low_stock);
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(t));
    }
    return list;
  }, [localItems, activeCategory, lowStockOnly, search]);

  const selectedItem = localItems.find((i) => i.item_id === selectedId) || null;

  const loadDetail = useCallback(async (itemId) => {
    if (!itemId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const d = await getSupplyItemDetail(itemId);
      setDetail(d);
      setLocalItems((p) => p.map((i) => (i.item_id === itemId ? { ...i, total_stock: d.total_stock, is_low_stock: d.is_low_stock } : i)));
    } catch (e) { showToast(e.message || "Failed to load item detail.", false); }
    finally { setDetailLoading(false); }
  }, [showToast]);

  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

  const closeDrawer  = () => { setDrawerMode(null); setDrawerBatch(null); setDrawerData({}); };
  const openAddStock = () => { setDrawerMode("addStock"); setDrawerData({ purchase_date: todayStr() }); };
  const openReturn   = (batch) => { setDrawerMode("returnStock"); setDrawerBatch(batch); setDrawerData({}); };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      if (drawerMode === "addStock") {
        const res = await addStock(selectedItem.item_id, {
          batch_number: drawerData.batch_number.trim(),
          quantity: Number(drawerData.quantity),
          unit_cost: Number(drawerData.unit_cost) || 0,
          supplier_name: drawerData.supplier_name.trim(),
          supplier_contact: drawerData.supplier_contact.trim(),
          invoice_number: drawerData.invoice_number.trim(),
          purchase_date: drawerData.purchase_date || todayStr(),
          expiry_date: drawerData.expiry_date,
          notes: drawerData.notes || "",
          dealer_id: drawerData.dealer_id || "",
        });
        setLocalItems((p) => p.map((i) => (i.item_id === selectedItem.item_id ? { ...i, total_stock: res.total_stock, is_low_stock: false } : i)));
        await loadDetail(selectedItem.item_id);
        onRefreshSummary();
        showToast(res.message || "Stock added.");
      }

      if (drawerMode === "returnStock") {
        const res = await returnToProvider(drawerBatch.batch_id, {
          quantity_returned: Number(drawerData.quantity_returned),
          reason: drawerData.reason,
          reason_details: drawerData.reason_details.trim(),
          reference_number: drawerData.reference_number || "",
        });
        setLocalItems((p) => p.map((i) => (i.item_id === selectedItem.item_id ? { ...i, total_stock: res.total_stock, is_low_stock: res.is_low_stock } : i)));
        await loadDetail(selectedItem.item_id);
        onRefreshSummary();
        showToast(res.message || "Stock returned to provider.");
      }

      setTimeout(closeDrawer, 500);
    } catch (e) {
      showToast(e.message || "Something went wrong.", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <p style={{ textAlign: "center", color: C.gray[400], padding: 40, fontSize: 13 }}>Loading supplies…</p>
  );

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      {/* ── Item picker ── */}
      <div style={{ flex: "0 0 280px", border: `1px solid #EEF2F7`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.gray[100]}` }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Icon d={ICONS.search} size={14} color={C.gray[400]}
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search items…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...INPUT, paddingLeft: 28, fontSize: 12.5, padding: "7px 10px 7px 28px" }} />
          </div>
          <CategorySelect value={activeCategory} onChange={setActiveCategory}
            style={{ fontSize: 11.5, padding: "5px 7px", minWidth: 0, width: "100%" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.gray[600], marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            ⚠ Low stock only
          </label>
        </div>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12, padding: 20 }}>No items found.</p>
          ) : filtered.map((item) => {
            const s = stockStatus(item);
            const active = selectedId === item.item_id;
            return (
              <button key={item.item_id} onClick={() => setSelectedId(item.item_id)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                border: "none", borderBottom: `1px solid ${C.gray[100]}`,
                background: active ? C.primaryLight : "#fff", cursor: "pointer",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? C.primary : C.gray[900] }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: C.gray[500] }}>{item.total_stock}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected item detail ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedItem ? (
          <div style={{
            border: `1px dashed ${C.gray[300]}`, borderRadius: 12, padding: 60,
            textAlign: "center", color: C.gray[400], fontSize: 13,
          }}>
            Select an item on the left to add stock or return a batch.
          </div>
        ) : (
          <div style={{ border: `1px solid #EEF2F7`, borderRadius: 12, background: "#fff", padding: 18 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.gray[900] }}>{selectedItem.name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.gray[500] }}>
                  Current stock: <strong style={{ color: C.gray[900] }}>{selectedItem.total_stock}</strong>
                  {"  ·  "}<StatusBadge item={selectedItem} />
                </p>
              </div>
              <button onClick={openAddStock} style={{
                ...ghostBtn, background: C.primary, color: "#fff", borderColor: C.primary,
              }}>
                <Icon d={ICONS.plus} size={12} color="#fff" /> Add Stock
              </button>
            </div>

            {/* Batch table */}
            {detailLoading || !detail || detail.item_id !== selectedItem.item_id ? (
              <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12.5, padding: 20 }}>Loading batches…</p>
            ) : detail.batches.length === 0 ? (
              <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12.5, padding: 20 }}>
                No stock batches yet — click "Add Stock" to record a purchase.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", fontSize: 11, color: C.gray[500], textTransform: "uppercase" }}>
                      {["Batch #","Purchased","Supplier","Invoice","Received By","Original","Remaining","Unit Cost","Value","Expiry",""].map((h) => (
                        <th key={h} style={{ padding: "4px 10px", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.batches.map((b) => (
                      <BatchRow key={b.batch_id} batch={b} onReturn={openReturn} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recent returns */}
            {detail?.recent_returns?.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.gray[200]}` }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: C.gray[500],
                  textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6,
                }}>Recent Returns to Provider</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 11, color: C.gray[500], textTransform: "uppercase" }}>
                        {["Date","Batch #","Qty Returned","Refund","Reason","Reference","Returned By"].map((h) => (
                          <th key={h} style={{ padding: "4px 10px", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recent_returns.slice(0, 5).map((r) => (
                        <tr key={r.return_id} style={{ borderTop: `1px solid ${C.gray[100]}`, fontSize: 12.5 }}>
                          <td style={{ padding: "7px 10px", color: C.gray[500], whiteSpace: "nowrap" }}>{fmtDT(r.returned_at)}</td>
                          <td style={{ padding: "7px 10px", color: C.gray[600] }}>{r.batch_number || "—"}</td>
                          <td style={{ padding: "7px 10px", fontWeight: 700, color: C.danger }}>−{r.quantity_returned}</td>
                          <td style={{ padding: "7px 10px", fontWeight: 700, color: C.success }}>₹{Number(r.refund_amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px",
                              background: C.dangerLight, color: C.danger,
                              borderRadius: 5, fontSize: 11.5, fontWeight: 600,
                            }}>{r.reason_display || r.reason}</span>
                          </td>
                          <td style={{ padding: "7px 10px", color: C.gray[600] }}>{r.reference_number || "—"}</td>
                          <td style={{ padding: "7px 10px", color: C.gray[600] }}>{r.returned_by_name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Drawer
        mode={drawerMode} item={selectedItem} batch={drawerBatch} data={drawerData}
        setData={setDrawerData} saving={saving} dealers={dealers}
        onClose={closeDrawer} onSubmit={handleSubmit}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// USAGE TAB — issue stock to a department. This is the tab that
// actually changes item values/quantities as they're consumed
// day-to-day, kept separate from Stock (which only receives).
// ═════════════════════════════════════════════════════════════
function UsageTab({ items, loading, showToast, onRefreshSummary }) {
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [selectedId,     setSelectedId]     = useState(null);
  const [detail,         setDetail]         = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [drawerMode,     setDrawerMode]     = useState(null);
  const [drawerData,     setDrawerData]     = useState({});
  const [saving,         setSaving]         = useState(false);
  const [localItems,     setLocalItems]     = useState(items);

  useEffect(() => { setLocalItems(items); }, [items]);

  const filtered = useMemo(() => {
    let list = localItems.filter((i) => i.is_active !== false);
    if (activeCategory !== "ALL") list = list.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const t = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(t));
    }
    return list;
  }, [localItems, activeCategory, search]);

  const selectedItem = localItems.find((i) => i.item_id === selectedId) || null;

  const loadDetail = useCallback(async (itemId) => {
    if (!itemId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const d = await getSupplyItemDetail(itemId);
      setDetail(d);
      setLocalItems((p) => p.map((i) => (i.item_id === itemId ? { ...i, total_stock: d.total_stock, is_low_stock: d.is_low_stock } : i)));
    } catch (e) { showToast(e.message || "Failed to load item detail.", false); }
    finally { setDetailLoading(false); }
  }, [showToast]);

  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

  const closeDrawer = () => { setDrawerMode(null); setDrawerData({}); };
  const openUse     = () => { setDrawerMode("useStock"); setDrawerData({}); };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const res = await useStock(selectedItem.item_id, {
        quantity_used: Number(drawerData.quantity_used),
        department: drawerData.department.trim(),
        notes: drawerData.notes || "",
      });
      setLocalItems((p) => p.map((i) => (i.item_id === selectedItem.item_id ? { ...i, total_stock: res.total_stock, is_low_stock: res.is_low_stock } : i)));
      await loadDetail(selectedItem.item_id);
      onRefreshSummary();
      showToast(res.message || "Stock issued.");
      setTimeout(closeDrawer, 500);
    } catch (e) {
      showToast(e.message || "Something went wrong.", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <p style={{ textAlign: "center", color: C.gray[400], padding: 40, fontSize: 13 }}>Loading supplies…</p>
  );

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      {/* ── Item picker ── */}
      <div style={{ flex: "0 0 280px", border: `1px solid #EEF2F7`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.gray[100]}` }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Icon d={ICONS.search} size={14} color={C.gray[400]}
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Search items…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...INPUT, paddingLeft: 28, fontSize: 12.5, padding: "7px 10px 7px 28px" }} />
          </div>
          <CategorySelect value={activeCategory} onChange={setActiveCategory}
            style={{ fontSize: 11.5, padding: "5px 7px", minWidth: 0, width: "100%" }} />
        </div>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12, padding: 20 }}>No items found.</p>
          ) : filtered.map((item) => {
            const s = stockStatus(item);
            const active = selectedId === item.item_id;
            return (
              <button key={item.item_id} onClick={() => setSelectedId(item.item_id)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                border: "none", borderBottom: `1px solid ${C.gray[100]}`,
                background: active ? C.primaryLight : "#fff", cursor: "pointer",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? C.primary : C.gray[900] }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: C.gray[500] }}>{item.total_stock}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected item panel ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedItem ? (
          <div style={{
            border: `1px dashed ${C.gray[300]}`, borderRadius: 12, padding: 60,
            textAlign: "center", color: C.gray[400], fontSize: 13,
          }}>
            Select an item on the left to issue stock to a department.
          </div>
        ) : (
          <div style={{ border: `1px solid #EEF2F7`, borderRadius: 12, background: "#fff", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.gray[900] }}>{selectedItem.name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.gray[500] }}>
                  Current stock: <strong style={{ color: C.gray[900] }}>{selectedItem.total_stock}</strong>
                  {"  ·  "}<StatusBadge item={selectedItem} />
                </p>
              </div>
              <button onClick={openUse} disabled={!selectedItem.total_stock} style={{
                ...ghostBtn, background: C.warning, color: "#fff", borderColor: C.warning,
                opacity: selectedItem.total_stock ? 1 : 0.5,
                cursor: selectedItem.total_stock ? "pointer" : "not-allowed",
              }}>
                <Icon d={ICONS.minus} size={12} color="#fff" /> Issue Stock
              </button>
            </div>

            {detailLoading || !detail || detail.item_id !== selectedItem.item_id ? (
              <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12.5, padding: 20 }}>Loading usage…</p>
            ) : !detail.recent_usage || detail.recent_usage.length === 0 ? (
              <p style={{ textAlign: "center", color: C.gray[400], fontSize: 12.5, padding: 20 }}>
                No usage recorded yet — click "Issue Stock" to log a department pickup.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", fontSize: 11, color: C.gray[500], textTransform: "uppercase" }}>
                      {["Date","Department","Qty Issued","Balance After","Issued By","Notes"].map((h) => (
                        <th key={h} style={{ padding: "4px 10px", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recent_usage.map((u) => (
                      <tr key={u.log_id} style={{ borderTop: `1px solid ${C.gray[100]}`, fontSize: 12.5 }}>
                        <td style={{ padding: "7px 10px", color: C.gray[500], whiteSpace: "nowrap" }}>{fmtDT(u.used_at)}</td>
                        <td style={{ padding: "7px 10px", color: C.gray[700], fontWeight: 600 }}>{u.department || "—"}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 700, color: C.warning }}>−{u.quantity_used}</td>
                        <td style={{ padding: "7px 10px", color: C.gray[600] }}>{u.balance_after ?? "—"}</td>
                        <td style={{ padding: "7px 10px", color: C.gray[600] }}>{u.used_by_name || "—"}</td>
                        <td style={{ padding: "7px 10px", color: C.gray[500] }}>{u.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Drawer
        mode={drawerMode} item={selectedItem} batch={null} data={drawerData}
        setData={setDrawerData} saving={saving}
        onClose={closeDrawer} onSubmit={handleSubmit}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// USAGE LOGS TAB — a filterable report of every issue-to-department
// entry across all items (not tied to a single selected item).
// ═════════════════════════════════════════════════════════════
function UsageLogsTab({ items, showToast }) {
  const [logs,       setLogs]       = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [itemId,     setItemId]     = useState("");
  const [department, setDepartment] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { results, total_count } = await getUsageLogs({
        item_id: itemId || undefined,
        department: department || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 200,
      });
      setLogs(results);
      setTotalCount(total_count);
    } catch (e) {
      showToast(e.message || "Failed to load usage logs.", false);
    } finally {
      setLoading(false);
    }
  }, [itemId, department, dateFrom, dateTo, showToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}
          style={{ ...INPUT, width: 220, cursor: "pointer" }}>
          <option value="">All items</option>
          {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.name}</option>)}
        </select>
        <input placeholder="Department…" value={department} list="dept-filter-list"
          onChange={(e) => setDepartment(e.target.value)} style={{ ...INPUT, width: 180 }} />
        <datalist id="dept-filter-list">
          {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
        </datalist>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...INPUT, width: 150 }} />
        <span style={{ color: C.gray[400], fontSize: 12 }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...INPUT, width: 150 }} />
        <button onClick={load} style={ghostBtn}>
          <Icon d={ICONS.refresh} size={12} color={C.gray[600]} /> Refresh
        </button>
      </div>

      <div style={{ border: `1px solid #EEF2F7`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.gray[50], textAlign: "left" }}>
              <th style={TH}>Date</th>
              <th style={TH}>Item</th>
              <th style={TH}>Department</th>
              <th style={{ ...TH, textAlign: "right" }}>Qty Issued</th>
              <th style={{ ...TH, textAlign: "right" }}>Balance After</th>
              <th style={TH}>Issued By</th>
              <th style={TH}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.gray[400], fontSize: 13 }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.gray[400], fontSize: 13 }}>No usage logs found.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.log_id} style={{ borderTop: `1px solid ${C.gray[100]}` }}>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{fmtDT(l.used_at)}</td>
                <td style={{ ...TD, fontWeight: 600, color: C.gray[900] }}>{l.supply_item_name}</td>
                <td style={TD}>{l.department || "—"}</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: C.warning }}>−{l.quantity_used}</td>
                <td style={{ ...TD, textAlign: "right" }}>{l.balance_after ?? "—"}</td>
                <td style={TD}>{l.used_by_name || "—"}</td>
                <td style={{ ...TD, color: C.gray[500] }}>{l.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 12, color: C.gray[400], textAlign: "right" }}>
        {logs.length} of {totalCount} log{totalCount !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ALERTS TAB — open (and, optionally, resolved) low-stock alerts.
// ═════════════════════════════════════════════════════════════
function AlertsTab({ showToast, onRefreshSummary }) {
  const [alerts,       setAlerts]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId,  setResolvingId]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAlerts({ resolved: showResolved });
      setAlerts(data);
    } catch (e) {
      showToast(e.message || "Failed to load alerts.", false);
    } finally {
      setLoading(false);
    }
  }, [showResolved, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (alertId) => {
    setResolvingId(alertId);
    try {
      await resolveAlert(alertId);
      showToast("Alert resolved.");
      await load();
      onRefreshSummary();
    } catch (e) {
      showToast(e.message || "Failed to resolve alert.", false);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.gray[500], cursor: "pointer" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved instead of open alerts
        </label>
        <button onClick={load} style={ghostBtn}>
          <Icon d={ICONS.refresh} size={12} color={C.gray[600]} /> Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: C.gray[400], padding: 40, fontSize: 13 }}>Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <div style={{
          border: `1px dashed ${C.gray[300]}`, borderRadius: 12, padding: 50,
          textAlign: "center", color: C.gray[400], fontSize: 13,
        }}>
          {showResolved ? "No resolved alerts yet." : "No open low-stock alerts. 🎉"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((a) => (
            <div key={a.alert_id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              border: `1px solid ${a.is_resolved ? C.gray[100] : "#FED7AA"}`,
              background: a.is_resolved ? "#fff" : C.warningLight,
              borderRadius: 10, padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon d={ICONS.alert} size={16} color={a.is_resolved ? C.gray[400] : C.warning} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.gray[900] }}>
                    {a.supply_item_name}
                    {a.is_resolved && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, padding: "1px 6px",
                        background: C.successLight, color: C.success, borderRadius: 4, fontWeight: 700,
                      }}>RESOLVED</span>
                    )}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: C.gray[500] }}>
                    Stock at <strong>{a.current_stock}</strong>, below threshold of <strong>{a.threshold}</strong>
                    {"  ·  "}{fmtDT(a.created_at)}
                  </p>
                </div>
              </div>
              {!a.is_resolved && (
                <button
                  onClick={() => handleResolve(a.alert_id)}
                  disabled={resolvingId === a.alert_id}
                  style={{
                    ...ghostBtn, background: C.success, color: "#fff", borderColor: C.success,
                    opacity: resolvingId === a.alert_id ? 0.6 : 1,
                  }}
                >
                  {resolvingId === a.alert_id ? "Resolving…" : "Mark Resolved"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PAGE — ties the Items and Stock tabs together behind a header,
// summary stat cards, and a shared "Add Item" action.
// ═════════════════════════════════════════════════════════════
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      flex: "1 1 160px", background: bg || "#fff", border: `1px solid #EEF2F7`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.gray[500], textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: color || C.gray[900] }}>
        {value}
      </p>
    </div>
  );
}

export default function SuppliesPage() {
  const [activeTab, setActiveTab] = useState("items"); // "items" | "stock" | "usage" | "usageLogs" | "alerts"
  const [items,     setItems]     = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState({ msg: "", ok: true, warn: false });

  const addItemRef = useRef(null);

  const showToast = useCallback((msg, ok = true, warn = false) => {
    setToast({ msg, ok, warn });
    setTimeout(() => setToast({ msg: "", ok: true, warn: false }), 3000);
  }, []);

  const loadItems = useCallback(async () => {
    const data = await getSupplyItems();
    setItems(Array.isArray(data) ? data : []);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getSuppliesDashboard();
      setSummary(data);
    } catch (e) {
      // Non-fatal — stat cards just won't render.
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(), loadSummary()]);
  }, [loadItems, loadSummary]);

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ padding: "20px 24px" }}>
      <Toast msg={toast.msg} ok={toast.ok} warn={toast.warn} />

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon d={ICONS.box} size={24} color={C.primary} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.gray[900], margin: 0 }}>
              Supplies &amp; Consumables
            </h1>
            <p style={{ fontSize: 13, color: C.gray[500], margin: "4px 0 0" }}>
              Track hospital consumables — syringes, gloves, IV sets, PPE and more.
            </p>
          </div>
        </div>

        {activeTab === "items" && (
          <button
            onClick={() => addItemRef.current && addItemRef.current()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: C.primary, color: "#fff", border: "none",
              borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Icon d={ICONS.plus} size={14} color="#fff" /> Add Item
          </button>
        )}
      </div>

      {/* SUMMARY STAT CARDS */}
      {summary && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Active Items" value={summary.total_items ?? 0} />
          <StatCard
            label="Low Stock"
            value={summary.low_stock_count ?? 0}
            color={summary.low_stock_count ? C.warning : C.gray[900]}
            bg={summary.low_stock_count ? C.warningLight : "#fff"}
          />
          <StatCard
            label="Open Alerts"
            value={summary.alerts_open ?? 0}
            color={summary.alerts_open ? C.danger : C.gray[900]}
            bg={summary.alerts_open ? C.dangerLight : "#fff"}
          />
          <StatCard label="Stock Value" value={money(summary.total_stock_value)} color={C.success} />
        </div>
      )}

      {/* TABS */}
      <div style={{ display: "flex", gap: 6, borderBottom: `1.5px solid ${C.gray[100]}`, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { key: "items",      label: "Items",      icon: ICONS.box },
          { key: "value",      label: "Total Value", icon: ICONS.calendar },
          { key: "stock",      label: "Stock",      icon: ICONS.receipt },
          { key: "usage",      label: "Usage",      icon: ICONS.minus },
          { key: "usageLogs",  label: "Usage Logs", icon: ICONS.calendar },
          { key: "alerts",     label: "Alerts",     icon: ICONS.alert, badge: summary?.alerts_open },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", border: "none", background: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: activeTab === t.key ? C.primary : C.gray[500],
              borderBottom: activeTab === t.key ? `2px solid ${C.primary}` : "2px solid transparent",
              marginBottom: -1.5,
            }}
          >
            <Icon d={t.icon} size={14} color={activeTab === t.key ? C.primary : C.gray[400]} />
            {t.label}
            {!!t.badge && (
              <span style={{
                marginLeft: 2, fontSize: 10.5, fontWeight: 700, color: "#fff",
                background: C.danger, borderRadius: 999, padding: "1px 6px",
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ACTIVE TAB */}
      {activeTab === "items" && (
        <ItemsTab
          items={items} loading={loading} showToast={showToast}
          onRefreshSummary={loadSummary} addItemRef={addItemRef}
        />
      )}
      {activeTab === "value" && (
        <ValueTab items={items} loading={loading} />
      )}
      {activeTab === "stock" && (
        <StockTab
          items={items} loading={loading} showToast={showToast}
          onRefreshSummary={loadSummary}
        />
      )}
      {activeTab === "usage" && (
        <UsageTab
          items={items} loading={loading} showToast={showToast}
          onRefreshSummary={loadSummary}
        />
      )}
      {activeTab === "usageLogs" && (
        <UsageLogsTab items={items} showToast={showToast} />
      )}
      {activeTab === "alerts" && (
        <AlertsTab showToast={showToast} onRefreshSummary={loadSummary} />
      )}
    </div>
  );
}