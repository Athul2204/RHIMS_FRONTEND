// src/modules/pharmacist/pages/MedicinesPage.jsx
// FIXED: Added medicine_type, strength, default_route to MedicineModal and table display

import { useEffect, useState, useCallback, useRef } from "react";
import { getMedicines, getBatches, createMedicine, updateMedicine } from "../api/pharmacistApi";
import { flattenFormError } from "../../../utils/formErrors";

const G = "#8B5CF6";
const INP = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
const LBL = { fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 };

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  pill:    "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  plus:    "M12 5v14 M5 12h14",
  edit:    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  x:       "M18 6 6 18 M6 6l12 12",
  check:   "M20 6 9 17l-5-5",
  batch:   "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  chevron: "M6 9l6 6 6-6",
  route:   "M17 8l4 4m0 0l-4 4m4-4H3",
};

// Must match backend choices
const MEDICINE_TYPE_OPTS = [
  { value: "TABLET",     label: "Tablet"      },
  { value: "CAPSULE",    label: "Capsule"     },
  { value: "SYRUP",      label: "Syrup"       },
  { value: "SUSPENSION", label: "Suspension"  },
  { value: "CREAM",      label: "Cream"       },
  { value: "OINTMENT",   label: "Ointment"    },
  { value: "GEL",        label: "Gel"         },
  { value: "LOTION",     label: "Lotion"      },
  { value: "DROPS",      label: "Drops"       },
  { value: "NASAL_SPRAY",label: "Nasal Spray" },
  { value: "INHALER",    label: "Inhaler"     },
  { value: "SUPPOSITORY",label: "Suppository" },
  { value: "POWDER",     label: "Powder"      },
  { value: "INJECTION",  label: "Injection"   },
  { value: "OTHER",      label: "Other"       },
];

const ROUTE_OPTS = [
  { value: "ORAL",    label: "Oral"           },
  { value: "IV",      label: "Intravenous"    },
  { value: "IM",      label: "Intramuscular"  },
  { value: "SC",      label: "Subcutaneous"   },
  { value: "TOPICAL", label: "Topical"        },
  { value: "NASAL",   label: "Nasal"          },
  { value: "RECTAL",  label: "Rectal"         },
  { value: "OTHER",   label: "Other"          },
];

// Route badge colour
const ROUTE_COLORS = {
  ORAL:    { bg: "#F0FDF4", color: "#15803D" },
  TOPICAL: { bg: "#FFF7ED", color: "#C2410C" },
  NASAL:   { bg: "#EFF6FF", color: "#1D4ED8" },
  RECTAL:  { bg: "#F5F3FF", color: "#6D28D9" },
  IV:      { bg: "#FEF2F2", color: "#B91C1C" },
  IM:      { bg: "#FEF2F2", color: "#B91C1C" },
  SC:      { bg: "#FFFBEB", color: "#B45309" },
  OTHER:   { bg: "#F1F5F9", color: "#64748B" },
};

function Toast({ msg, ok }) {
  if (!msg) return null;
  return <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: ok ? "#F0FDF4" : "#FEF2F2", color: ok ? "#166534" : "#B91C1C", border: `1px solid ${ok ? "#BBF7D0" : "#FECACA"}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>{msg}</div>;
}

export function MedicineModal({ medicine, onSave, onClose }) {
  const isEdit = !!medicine?.medicine_id;
  const [form, setForm] = useState({
    name:          medicine?.name          || "",
    generic_name:  medicine?.generic_name  || "",
    category:      medicine?.category      || "",
    unit:          medicine?.unit          || "",
    strength:      medicine?.strength      || "",
    medicine_type: medicine?.medicine_type || "TABLET",
    default_route: medicine?.default_route || "ORAL",
    description:   medicine?.description   || "",
    is_active:     medicine?.is_active     ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("Medicine name is required."); return; }
    if (!form.default_route) { setErr("Default route is required."); return; }
    setSaving(true); setErr("");
    try {
      if (isEdit) {
        await updateMedicine(medicine.medicine_id, form);
      } else {
        await createMedicine(form);
      }
      onSave();
    } catch (e) { setErr(flattenFormError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "26px 28px", width: 480, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>{isEdit ? "Edit Medicine" : "Add Medicine"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d={ICONS.x} size={16} color="#94A3B8" /></button>
        </div>

        {/* Medicine name */}
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Medicine name <span style={{ color: "#EF4444" }}>*</span></label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="e.g. Paracetamol 500mg" style={INP} />
        </div>

        {/* Generic name */}
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Generic name</label>
          <input value={form.generic_name} onChange={e => set("generic_name", e.target.value)}
            placeholder="e.g. Acetaminophen" style={INP} />
        </div>

        {/* Medicine Type + Strength row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Medicine type</label>
            <select value={form.medicine_type} onChange={e => set("medicine_type", e.target.value)} style={INP}>
              {MEDICINE_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Strength</label>
            <input value={form.strength} onChange={e => set("strength", e.target.value)}
              placeholder="e.g. 500mg, 250mg/5ml" style={INP} />
          </div>
        </div>

        {/* Default Route (required) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...LBL, marginBottom: 8 }}>
            Default Route <span style={{ color: "#EF4444" }}>*</span>
            <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#94A3B8", marginLeft: 6 }}>
              — auto-copied to prescription items when this medicine is selected
            </span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ROUTE_OPTS.map(o => {
              const active = form.default_route === o.value;
              const rc = ROUTE_COLORS[o.value] || ROUTE_COLORS.OTHER;
              return (
                <button key={o.value} type="button" onClick={() => set("default_route", o.value)}
                  style={{
                    padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: active ? `2px solid ${G}` : "1.5px solid #E5E7EB",
                    background: active ? rc.bg : "#F8FAFC",
                    color: active ? rc.color : "#475569",
                    transition: "all 0.12s",
                  }}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {/* Auto-route hint based on medicine type */}
          {form.medicine_type && (() => {
            const autoRoute = {
              TABLET: "ORAL", CAPSULE: "ORAL", SYRUP: "ORAL", SUSPENSION: "ORAL",
              CREAM: "TOPICAL", OINTMENT: "TOPICAL", GEL: "TOPICAL", LOTION: "TOPICAL",
              NASAL_SPRAY: "NASAL", SUPPOSITORY: "RECTAL", INJECTION: "IV",
            }[form.medicine_type];
            if (autoRoute && autoRoute !== form.default_route) {
              return (
                <div style={{ marginTop: 6, fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 5 }}>
                  <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={12} color="#94A3B8" />
                  Suggested route for {MEDICINE_TYPE_OPTS.find(t => t.value === form.medicine_type)?.label}: 
                  <button type="button" onClick={() => set("default_route", autoRoute)}
                    style={{ fontSize: 11, fontWeight: 600, color: G, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    {ROUTE_OPTS.find(r => r.value === autoRoute)?.label}
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Category + Unit row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Category</label>
            <input value={form.category} onChange={e => set("category", e.target.value)}
              placeholder="e.g. Analgesic, Antibiotic…" style={INP} />
          </div>
          <div>
            <label style={LBL}>Unit</label>
            <input value={form.unit} onChange={e => set("unit", e.target.value)}
              placeholder="e.g. Tablet, ml, Vial" style={INP} />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Description</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
            style={{ ...INP, resize: "vertical", height: 60, fontFamily: "inherit" }} placeholder="Optional notes…" />
        </div>

        {/* Active toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set("is_active", e.target.checked)}
            style={{ width: 15, height: 15, cursor: "pointer" }} />
          <label htmlFor="is_active" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>Active (available for billing and prescriptions)</label>
        </div>

        {err && <p style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", padding: "8px 12px", borderRadius: 7, margin: "0 0 14px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: saving ? "#E9D5FF" : G, color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add medicine"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchStatusBadge({ status }) {
  const map = {
    ACTIVE:           { bg: "#F0FDF4", color: "#15803D", label: "Active" },
    PENDING_APPROVAL: { bg: "#FFFBEB", color: "#B45309", label: "Pending Approval" },
    REJECTED:         { bg: "#FEF2F2", color: "#B91C1C", label: "Rejected" },
    EXPIRED:          { bg: "#FEF2F2", color: "#B91C1C", label: "Expired" },
    DEPLETED:         { bg: "#F3E8FF", color: "#7C3AED", label: "Depleted" },
  };
  const s = map[status] || { bg: "#F1F5F9", color: "#475569", label: status };
  return (
    <span style={{ padding: "2px 7px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function BatchesPanel({ medicine, batches }) {
  const active = batches.filter(b => b.medicine_id === medicine.medicine_id || b.medicine === medicine.medicine_id);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden", marginTop: 8 }}>
      {active.length === 0 ? (
        <p style={{ padding: "12px 14px", fontSize: 12, color: "#94A3B8", margin: 0 }}>No active batches.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 60px 70px 80px 80px 80px", padding: "6px 14px", background: "#F1F5F9", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Batch</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>MRP</span><span style={{ textAlign: "right" }}>GST</span><span style={{ textAlign: "center" }}>Expiry</span><span style={{ textAlign: "center" }}>Status</span>
          </div>
          {active.map(b => {
            const expired = b.expiry_date && b.expiry_date < today;
            const nearExpiry = !expired && b.expiry_date && new Date(b.expiry_date) <= new Date(Date.now() + 30 * 86400000);
            return (
              <div key={b.batch_id} style={{ display: "grid", gridTemplateColumns: "1.5fr 60px 70px 80px 80px 80px", padding: "9px 14px", borderTop: "1px solid #F1F5F9", fontSize: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace" }}>{b.batch_number}</span>
                <span style={{ textAlign: "center", color: b.quantity === 0 ? "#EF4444" : "#475569", fontWeight: b.quantity === 0 ? 700 : 400 }}>{b.quantity}</span>
                <span style={{ textAlign: "right", color: "#475569" }}>₹{parseFloat(b.mrp || 0).toFixed(2)}</span>
                <span style={{ textAlign: "right", color: "#94A3B8" }}>{parseFloat(b.gst_percentage || 0).toFixed(0)}%</span>
                <span style={{ textAlign: "center", color: expired ? "#B91C1C" : nearExpiry ? "#C2410C" : "#64748B", fontWeight: expired || nearExpiry ? 700 : 400, fontSize: 11 }}>
                  {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("en-IN") : "—"}
                </span>
                <div style={{ textAlign: "center" }}>
                  <BatchStatusBadge status={b.status} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function MedicineRow({ med, batches, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const activeBatchCount = batches.filter(b => (b.medicine_id === med.medicine_id || b.medicine === med.medicine_id) && b.status === "ACTIVE").length;
  const routeClr = ROUTE_COLORS[med.default_route] || ROUTE_COLORS.OTHER;
  const routeLabel = ROUTE_OPTS.find(r => r.value === med.default_route)?.label ?? med.default_route ?? "—";
  const typeLabel = MEDICINE_TYPE_OPTS.find(t => t.value === med.medicine_type)?.label ?? med.medicine_type ?? "—";

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.8fr 0.9fr 0.9fr 70px 70px 70px 80px", padding: "12px 20px", alignItems: "center", fontSize: 13, cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

        {/* Medicine name */}
        <div>
          <p style={{ fontWeight: 600, color: "#0F172A", margin: 0 }}>{med.name}</p>
          {med.generic_name && <p style={{ fontSize: 11, color: "#94A3B8", margin: "1px 0 0" }}>{med.generic_name}</p>}
        </div>

        {/* Type */}
        <span style={{ fontSize: 12, color: "#475569" }}>{typeLabel}</span>

        {/* Strength */}
        <span style={{ fontSize: 12, color: "#475569" }}>{med.strength || "—"}</span>

        {/* Default Route */}
        <span>
          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: routeClr.bg, color: routeClr.color }}>
            {routeLabel}
          </span>
        </span>

        {/* Category */}
        <span style={{ color: "#475569" }}>{med.category || "—"}</span>

        {/* Stock */}
        <span style={{ textAlign: "center", color: med.total_stock === 0 ? "#B91C1C" : med.total_stock <= 10 ? "#C2410C" : "#15803D", fontWeight: 700 }}>{med.total_stock ?? 0}</span>

        {/* Batches */}
        <span style={{ textAlign: "center", color: "#64748B" }}>{activeBatchCount}</span>

        {/* Status */}
        <div>
          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: med.is_active ? "#F0FDF4" : "#F1F5F9", color: med.is_active ? "#15803D" : "#64748B" }}>{med.is_active ? "Active" : "Inactive"}</span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={e => { e.stopPropagation(); onEdit(med); }}
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ICONS.edit} size={13} color="#64748B" />
          </button>
          <button onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Ico d={ICONS.chevron} size={13} color="#64748B" />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 14px" }}>
          <BatchesPanel medicine={med} batches={batches} />
        </div>
      )}
    </div>
  );
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category,        setCategory]        = useState("");
  const [routeFilter,     setRouteFilter]     = useState("");
  const [inStock,         setInStock]         = useState(false);
  const [modal,           setModal]           = useState(null);
  const [toast,           setToast]           = useState(null);
  const debounceTimer = useRef(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (category)        params.category = category;
      const [meds, batchData] = await Promise.all([
        getMedicines({ ...params, show_inactive: true }),
        // ✅ FIX: also fetch PENDING_APPROVAL batches so the pharmacist
        // can see dealer-linked stock awaiting manager sign-off. REJECTED
        // batches are excluded — they've been zeroed out and returned.
        getBatches({ status: "ACTIVE,PENDING_APPROVAL" }),
      ]);
      let medList = Array.isArray(meds) ? meds : (meds?.results ?? []);
      if (inStock)      medList = medList.filter(m => (m.total_stock ?? 0) > 0);
      if (routeFilter)  medList = medList.filter(m => m.default_route === routeFilter);
      setMedicines(medList);
      setBatches(Array.isArray(batchData) ? batchData : (batchData?.results ?? []));
    } catch (e) { showToast(flattenFormError(e), false); }
    finally { setLoading(false); }
  }, [debouncedSearch, category, inStock, routeFilter]);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(medicines.map(m => m.category).filter(Boolean))].sort();
  const totalStock = medicines.reduce((s, m) => s + (m.total_stock ?? 0), 0);

  const COL = { fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 1200 }}>
      <Toast {...(toast || {})} msg={toast?.msg} />
      {modal && (
        <MedicineModal
          medicine={modal === "add" ? null : modal}
          onSave={() => { setModal(null); showToast(modal === "add" ? "Medicine added." : "Medicine updated."); load(); }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Medicines</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "4px 0 0" }}>
            {loading ? "Loading…" : `${medicines.length} medicines · ${totalStock} units total`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setModal("add")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Ico d={ICONS.plus} size={14} color="#fff" /> Add medicine
          </button>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B" }}>
            <Ico d={ICONS.refresh} size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8" />
          </span>
          <input placeholder="Search medicines…" value={search} onChange={handleSearchChange}
            style={{ ...INP, paddingLeft: 32 }} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...INP, width: 150 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} style={{ ...INP, width: 140 }}>
          <option value="">All routes</option>
          {ROUTE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} style={{ cursor: "pointer" }} />
          In stock only
        </label>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.8fr 0.9fr 0.9fr 70px 70px 70px 80px", padding: "9px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", gap: 8 }}>
          <span style={COL}>Medicine</span>
          <span style={COL}>Type</span>
          <span style={COL}>Strength</span>
          <span style={COL}>Route</span>
          <span style={COL}>Category</span>
          <span style={{ ...COL, textAlign: "center" }}>Stock</span>
          <span style={{ ...COL, textAlign: "center" }}>Batches</span>
          <span style={COL}>Status</span>
          <span style={{ ...COL, textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: "52px", textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: "#94A3B8" }}>Loading medicines…</p>
          </div>
        ) : medicines.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${G}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Ico d={ICONS.pill} size={22} color={G} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#64748B", margin: 0 }}>
              {search || category || routeFilter ? "No medicines match your filters." : "No medicines found. Add your first medicine."}
            </p>
          </div>
        ) : (
          medicines.map(med => <MedicineRow key={med.medicine_id} med={med} batches={batches} onEdit={setModal} />)
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}