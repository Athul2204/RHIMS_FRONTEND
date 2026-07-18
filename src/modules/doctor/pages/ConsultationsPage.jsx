// src/modules/doctor/pages/ConsultationsPage.jsx
// Full-page consultation workspace with integrated AddItemModal
// Includes advanced medicine modal for adding prescription items

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getConsultationDetail,
  updateConsultationDetail,
  completeConsultation,
  getConsultationTimeline,
  getLabTests,
  getTestGroups,
  createLabRequest,
  createPrescription,
  createPrescriptionItem,
  deletePrescription,
  deletePrescriptionItem,
  getLabResultsByRequest,
  getPatientConsultationHistory,
} from "../api/doctorApi";
import API from "../../../api";
import MedicineAutocomplete from "../components/MedicineAutocomplete";
import { groupLabRequestItems, subTestIdsCoveredByGroups } from "../../../utils/labItemGrouping";

// ─── Design tokens ────────────────────────────────────────────────────────────
const G        = "#16A34A";
const G_LIGHT  = "#F0FDF4";
const G_MID    = "#22C55E";
const SLATE    = "#0F172A";
const MUTED    = "#64748B";
const BORDER   = "#E8EDF4";
const SURFACE  = "#F8FAFC";

// ─── Helper functions & constants ─────────────────────────────────────────────
const DOSES_PER_DAY = { OD: 1, BD: 2, TDS: 3, QID: 4, SOS: 0, STAT: 1, HS: 1 };
const MIN_SEARCH_CHARS = 2;
const DEBOUNCE_MS = 300;

const getRecentIds = () => {
  const recent = localStorage.getItem("recentMedicines");
  return recent ? recent.split(",").map(Number) : [];
};

const saveRecentId = (id) => {
  const recent = getRecentIds();
  const updated = [id, ...recent.filter(x => x !== id)].slice(0, 5);
  localStorage.setItem("recentMedicines", updated.join(","));
};

const calcQuantity = (doseQty, freq, durationDays) => {
  if (!doseQty || !freq || !durationDays) return null;
  const doseNum = Number(doseQty);
  const daysNum = Number(durationDays);
  const dosesPerDay = DOSES_PER_DAY[freq] ?? 0;
  if (dosesPerDay === 0 || !doseNum || !daysNum) return null;
  return doseNum * dosesPerDay * daysNum;
};

// ─── Tiny icon helper ─────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  back:      "M19 12H5 M12 5l-7 7 7 7",
  check:     "M20 6 9 17l-5-5",
  edit:      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  flask:     "M10 2v8L3.5 20.5A2 2 0 0 0 5.34 23h13.32a2 2 0 0 0 1.84-2.5L14 10V2 M8.5 2h7",
  rx:        "M9 3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-4H9z M14 3v4h4 M12 11v6 M9 14h6",
  clock:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  plus:      "M12 5v14 M5 12h14",
  trash:     "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  user:      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  notes:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  vitals:    "M22 12h-4l-3 9L9 3l-3 9H2",
  timeline:  "M12 22V12 M12 8V2 M4.93 4.93l4.24 4.24 M14.83 14.83l4.24 4.24 M2 12h4 M18 12h4 M4.93 19.07l4.24-4.24 M14.83 9.17l4.24-4.24",
  save:      "M19 21H5a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8",
  x:         "M18 6 6 18 M6 6l12 12",
  lab:       "M9 3v11.5a3.5 3.5 0 0 0 7 0V3 M6 3h12",
  history:   "M3 3v5h5 M3.05 13a9 9 0 1 0 2.13-9.36L3 8 M12 7v5l4 2",
  chevDown:  "M6 9l6 6 6-6",
};

const STATUS_CFG = {
  STARTED:           { bg:"#EFF6FF", color:"#1D4ED8", dot:"#3B82F6", label:"Started" },
  LAB_REQUESTED:     { bg:"#FEF3C7", color:"#D97706", dot:"#F59E0B", label:"Lab Requested" },
  WAITING_FOR_LAB:   { bg:"#FEF3C7", color:"#D97706", dot:"#F59E0B", label:"Waiting for Lab" },
  LAB_COMPLETED:     { bg:"#F0FDF4", color:"#15803D", dot:G,         label:"Lab Completed" },
  FOLLOWUP_REQUIRED: { bg:"#FDF4FF", color:"#7E22CE", dot:"#A855F7", label:"Follow-up" },
  COMPLETED:         { bg:"#DCFCE7", color:"#15803D", dot:G,         label:"Completed" },
  CANCELLED:         { bg:"#F1F5F9", color:"#64748B", dot:"#94A3B8", label:"Cancelled (by reception)" },
};

const VITALS_KEYS = ["bp","pulse","temp","spo2","weight","blood_sugar"];
const VITALS_META = {
  bp:          { label:"Blood Pressure", unit:"mmHg", icon:"♥" },
  pulse:       { label:"Pulse",          unit:"bpm",  icon:"〜" },
  temp:        { label:"Temperature",    unit:"°F",   icon:"🌡" },
  spo2:        { label:"SpO₂",           unit:"%",    icon:"○" },
  weight:      { label:"Weight",         unit:"kg",   icon:"⊕" },
  blood_sugar: { label:"Blood Sugar",    unit:"mg/dL",icon:"◈" },
};

const FREQ_OPTS    = ["OD","BD","TDS","QID","SOS","STAT","HS"];
const ROUTE_OPTS   = ["ORAL","IV","IM","SC","TOPICAL","NASAL","RECTAL","OTHER"];
const FREQ_LABELS  = { OD:"Once Daily",BD:"Twice Daily",TDS:"3× Daily",QID:"4× Daily",SOS:"PRN",STAT:"Stat",HS:"Bedtime" };
const ROUTE_LABELS = { ORAL:"Oral",IV:"IV",IM:"IM",SC:"SC",TOPICAL:"Topical",NASAL:"Nasal",RECTAL:"Rectal",OTHER:"Other" };
// NOTE: backend MealTimingChoices are "", "BEFORE_MEALS", "WITH_MEALS", "AFTER_MEALS" (field is
// blank=True but NOT null=True, so a JS `null` value is rejected — always send "" for "not specified").
const MEAL_TIMING_OPTS = ["", "BEFORE_MEALS", "WITH_MEALS", "AFTER_MEALS"];
const MEAL_TIMING_LABELS = { "": "Not Specified", BEFORE_MEALS: "Before Meals", WITH_MEALS: "With Meals", AFTER_MEALS: "After Meals" };

// ─── ToggleGroup Component ────────────────────────────────────────────────────
function ToggleGroup({ options, labels, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.12s",
            border: value === opt ? `2px solid ${G}` : "1.5px solid #E2E8F0",
            background: value === opt ? G_LIGHT : "#fff",
            color: value === opt ? G : MUTED,
          }}
        >
          {labels[opt] || opt}
        </button>
      ))}
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] ?? { bg:"#F1F5F9", color:"#475569", dot:"#94A3B8", label:status };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:20, fontSize:11, fontWeight:700, background:s.bg, color:s.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot }} />{s.label}
    </span>
  );
}

function Toast({ msg, type, onDismiss }) {
  if (!msg) return null;
  const c = { success:{bg:"#F0FDF4",border:"#BBF7D0",color:"#15803D"}, error:{bg:"#FEF2F2",border:"#FECACA",color:"#DC2626"}, info:{bg:"#EFF6FF",border:"#BFDBFE",color:"#1D4ED8"} }[type] || { bg:"#EFF6FF",border:"#BFDBFE",color:"#1D4ED8" };
  return (
    <div onClick={onDismiss} style={{ position:"fixed", top:20, right:24, zIndex:9999,
      padding:"12px 18px", borderRadius:10, background:c.bg, border:`1px solid ${c.border}`,
      color:c.color, fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.12)",
      maxWidth:340, cursor:"pointer", animation:"slideIn 0.2s ease" }}>
      {msg}
    </div>
  );
}

// ─── Input styles ─────────────────────────────────────────────────────────────
const INP = {
  padding:"9px 12px", borderRadius:8, border:`1.5px solid ${BORDER}`,
  fontSize:13, color:SLATE, outline:"none", width:"100%",
  boxSizing:"border-box", background:"#fff", transition:"border-color 0.15s",
  fontFamily:"inherit",
};
const LBL = {
  fontSize:10.5, fontWeight:700, color:MUTED,
  textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:5, display:"block",
};

// ─── Add Medicine Modal (AddItemModal) ─────────────────────────────────────────
function ConsultationAddItemModal({ onClose, onAdded, prescriptionExists = false }) {
  const [selectedMed, setSelectedMed] = useState(null);
  const [form, setForm] = useState({
    medicine_id: null,
    medicine_name: "",
    dose_quantity: "1",
    frequency: "OD",
    meal_timing: "",
    route: "ORAL",
    is_route_overridden: false,
    duration_days: "7",
    quantity: "",
    is_manual_quantity: false,
    prn_reason: "",
    prn_reason_other: "",
    max_daily_dose: "",
    instructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recentIds = getRecentIds();

  useEffect(() => {
    if (form.is_manual_quantity) return;
    if (form.frequency === "SOS") {
      setForm(f => ({ ...f, quantity: f.quantity }));
      return;
    }
    if (form.frequency === "STAT") {
      // Stat = a single one-time immediate dose, not multiplied by duration.
      const dose = Number(form.dose_quantity);
      setForm(f => ({ ...f, quantity: dose > 0 ? String(Math.ceil(dose)) : "" }));
      return;
    }
    const calc = calcQuantity(form.dose_quantity, form.frequency, form.duration_days);
    if (calc !== null) {
      setForm(f => ({ ...f, quantity: String(calc) }));
    } else {
      setForm(f => ({ ...f, quantity: "" }));
    }
  }, [form.dose_quantity, form.frequency, form.duration_days, form.is_manual_quantity]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleMedicineSelect = (med) => {
    if (!med) {
      setSelectedMed(null);
      setForm(f => ({
        ...f,
        medicine_id: null,
        medicine_name: "",
        route: "ORAL",
        is_route_overridden: false,
      }));
      return;
    }
    setSelectedMed(med);
    saveRecentId(med.id);
    setForm(f => ({
      ...f,
      medicine_id: med.id,
      medicine_name: med.name,
      // Auto-fill from the medicine's own default route (set by the pharmacist
      // when the medicine was added to inventory). Not a manual override yet —
      // the doctor is free to change it below, which is what flips the flag.
      route: med.route || "ORAL",
      is_route_overridden: false,
    }));
  };

  const handleRecalculate = () => {
    setForm(f => ({ ...f, is_manual_quantity: false }));
  };

  // Route changes made directly by the doctor (as opposed to the auto-fill
  // that happens on medicine selection) are explicit overrides — flag them
  // so the backend keeps this value instead of re-deriving it from the
  // medicine's default_route on save.
  const handleRouteChange = (v) => {
    setForm(f => ({ ...f, route: v, is_route_overridden: true }));
  };

  const handleManualQtyChange = (val) => {
    setForm(f => ({ ...f, quantity: val, is_manual_quantity: val !== "" }));
  };

  const handleSave = async () => {
    if (!form.medicine_id) {
      setError("Medicine is required");
      return;
    }
    if (!form.dose_quantity) {
      setError("Dose quantity is required");
      return;
    }
    if (!form.frequency) {
      setError("Frequency is required");
      return;
    }
    if (!form.duration_days && form.frequency !== "STAT") {
      setError("Duration is required");
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        medicine_id: form.medicine_id,
        medicine_name: form.medicine_name,
        medicine: form.medicine_id,
        dosage: form.dose_quantity,
        frequency: form.frequency,
        meal_timing: form.meal_timing || "",
        route: form.route,
        is_route_overridden: form.is_route_overridden,
        duration_days: form.frequency === "STAT" ? (form.duration_days || null) : form.duration_days,
        quantity: Number(form.quantity) || 1,
        prn_reason: form.prn_reason || null,
        prn_reason_other: form.prn_reason_other || null,
        max_daily_dose: form.max_daily_dose || null,
        instructions: form.instructions || null,
        medicineObj: selectedMed,
      };
      onAdded(itemData);
      onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onClose} />
      <div style={{
        position: "relative",
        background: "#fff",
        borderRadius: 16,
        width: "100%",
        maxWidth: 520,
        margin: "0 16px",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        zIndex: 1,
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10, background: G_LIGHT,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Ico d={ICONS.plus} size={18} color={G} />
            </span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, lineHeight: 1.3 }}>
                {prescriptionExists ? "Add Medicine to Prescription" : "Add First Medicine"}
              </h3>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Select from pharmacy inventory</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, marginTop: 2 }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={16} />
          </button>
        </div>

        {error && (
          <div style={{ margin: "12px 24px 0", padding: "9px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", fontSize: 12.5, border: "1px solid #FECACA" }}>
            {error}
          </div>
        )}

        <div style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Medicine Name <span style={{ color: "#EF4444" }}>*</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>— live search from pharmacy stock</span>
            </label>
            <MedicineAutocomplete
              value={selectedMed}
              onChange={handleMedicineSelect}
              recentIds={recentIds}
              error={error && !form.medicine_id ? "Select a medicine" : ""}
              placeholder="Type to search pharmacy stock…"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
              Dose per Administration <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>e.g. 1 tablet, 5 ml</span>
            </label>
            <input
              type="number"
              style={INP}
              placeholder="e.g. 1"
              min="0.01"
              step="0.01"
              value={form.dose_quantity}
              onChange={e => set("dose_quantity", e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Frequency <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <ToggleGroup
              options={FREQ_OPTS}
              labels={FREQ_LABELS}
              value={form.frequency}
              onChange={(v) => {
                set("frequency", v);
                if (v !== "SOS") set("prn_reason", "");
              }}
            />
          </div>

          {form.frequency === "SOS" && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#C2410C", marginBottom: 10 }}>As Needed (PRN) — Additional Fields</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Reason for PRN</label>
                <input
                  value={form.prn_reason}
                  onChange={e => set("prn_reason", e.target.value)}
                  placeholder="e.g. Pain, Fever, Cough"
                  style={INP}
                />
              </div>
              {form.prn_reason && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Max daily dose</label>
                  <input
                    value={form.max_daily_dose}
                    onChange={e => set("max_daily_dose", e.target.value)}
                    placeholder="e.g. 4 tablets/day"
                    style={INP}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Meal Timing</label>
            <ToggleGroup
              options={MEAL_TIMING_OPTS}
              labels={MEAL_TIMING_LABELS}
              value={form.meal_timing}
              onChange={v => set("meal_timing", v)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Duration (days)</label>
              <input
                type="number"
                style={INP}
                placeholder="e.g. 7"
                min="1"
                max="30"
                value={form.duration_days}
                onChange={e => set("duration_days", e.target.value)}
              />
            </div>
            <div>
              <label style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#374151",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 5,
              }}>
                Quantity
                {form.is_manual_quantity ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>Manual</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: G_LIGHT, color: "#15803D" }}>Auto</span>
                )}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  style={{ ...INP, paddingRight: form.is_manual_quantity ? 70 : 12 }}
                  min="1"
                  value={form.quantity}
                  onChange={e => handleManualQtyChange(e.target.value)}
                  placeholder={form.frequency === "SOS" ? "Enter qty" : "Auto-calculated"}
                />
                {form.is_manual_quantity && (
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: G,
                      background: G_LIGHT,
                      border: "none",
                      borderRadius: 5,
                      padding: "2px 7px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Recalc
                  </button>
                )}
              </div>
              {!form.is_manual_quantity && form.quantity && (
                <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 4 }}>
                  = {form.dose_quantity || 0} × {DOSES_PER_DAY[form.frequency] ?? 0}×/day × {form.duration_days || 0}d = <strong style={{ color: "#15803D" }}>{form.quantity}</strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Route</label>
            <ToggleGroup
              options={ROUTE_OPTS}
              labels={ROUTE_LABELS}
              value={form.route}
              onChange={handleRouteChange}
            />
            {form.medicine_id && (
              <p style={{ fontSize: 10.5, color: "#94A3B8", margin: "5px 0 0" }}>
                {form.is_route_overridden
                  ? "Manually changed from the medicine's default route."
                  : "Auto-filled from the medicine's default route — tap to change."}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Special Instructions</label>
            <textarea
              rows={2}
              style={{ ...INP, resize: "none" }}
              placeholder="e.g. Take with a full glass of water…"
              value={form.instructions}
              onChange={e => set("instructions", e.target.value)}
            />
          </div>
        </div>

        <div style={{
          padding: "14px 24px 20px",
          borderTop: "1px solid #F1F5F9",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          flexShrink: 0,
          background: "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              borderRadius: 9,
              border: "1.5px solid #E8EDF4",
              background: "#fff",
              color: "#475569",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.medicine_id}
            style={{
              padding: "9px 20px",
              borderRadius: 9,
              border: "none",
              background: form.medicine_id ? G : "#CCCCCC",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving || !form.medicine_id ? "not-allowed" : "pointer",
              opacity: saving ? 0.75 : 1,
              boxShadow: "0 2px 8px #16a34a33",
            }}
          >
            {saving ? "Adding…" : "Add Medicine"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NewPrescriptionModal ────────────────────────────────────────────────────
function NewPrescriptionModal({ consultationId, onClose, onCreated }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const rx = await createPrescription(consultationId, { consultation: consultationId, prescription_type: "FINAL", notes: notes.trim() || undefined });
      const rxId = rx?.data?.prescription_id || rx?.prescription_id;
      if (onCreated) onCreated(rxId);
      onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : "Failed to create prescription.");
    } finally {
      setSaving(false);
    }
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
          <textarea rows={3} style={{ ...INP, resize: "none" }} placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 9, border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, boxShadow: "0 2px 8px #16a34a33" }}>{saving ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ id, detail, onClose, onDone }) {
  const [form, setForm] = useState({
    final_diagnosis: detail?.final_diagnosis || "",
    treatment_notes: detail?.treatment_notes || "",
    followup_instructions: detail?.followup_instructions || "",
    followup_date: detail?.followup_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.final_diagnosis.trim()) { setErr("Final diagnosis is required."); return; }
    if (!form.treatment_notes.trim()) { setErr("Treatment notes are required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, followup_date: form.followup_date || null };
      await updateConsultationDetail(id, payload);
      await completeConsultation(id);
      onDone();
    } catch (e) {
      setErr(String(e) || "Failed to complete consultation.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, display:"flex",
      alignItems:"center", justifyContent:"center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.55)",
        backdropFilter:"blur(4px)" }} onClick={onClose} />
      <div style={{ position:"relative", background:"#fff", borderRadius:18,
        width:"min(520px,96vw)", boxShadow:"0 24px 64px rgba(0,0,0,0.22)", zIndex:1,
        overflow:"hidden" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${BORDER}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:G_LIGHT }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:G,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ico d={ICONS.check} size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize:15, fontWeight:700, color:SLATE, margin:0 }}>Complete Consultation</h2>
              <p style={{ fontSize:11, color:MUTED, margin:"2px 0 0" }}>Fill in final details before closing</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:MUTED }}>
            <Ico d={ICONS.x} size={16} />
          </button>
        </div>
        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          {err && <div style={{ padding:"10px 14px", borderRadius:8, background:"#FEF2F2",
            border:"1px solid #FECACA", color:"#DC2626", fontSize:12, fontWeight:600 }}>{err}</div>}
          {[
            { k:"final_diagnosis",      l:"Final Diagnosis *",       rows:2, ph:"Enter final diagnosis…" },
            { k:"treatment_notes",      l:"Treatment Notes *",        rows:2, ph:"Treatment plan and notes…" },
            { k:"followup_instructions",l:"Follow-up Instructions",   rows:2, ph:"Optional follow-up instructions…" },
          ].map(f => (
            <div key={f.k}>
              <label style={LBL}>{f.l}</label>
              <textarea rows={f.rows} value={form[f.k]}
                onChange={e => set(f.k, e.target.value)}
                placeholder={f.ph}
                style={{ ...INP, resize:"vertical" }} />
            </div>
          ))}
          <div>
            <label style={LBL}>Follow-up Date</label>
            <input type="date" value={form.followup_date}
              onChange={e => set("followup_date", e.target.value)} style={INP} />
          </div>
        </div>
        <div style={{ padding:"16px 24px", borderTop:`1px solid ${BORDER}`,
          display:"flex", justifyContent:"flex-end", gap:10, background:SURFACE }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:8,
            border:`1px solid ${BORDER}`, background:"#fff", color:MUTED,
            fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding:"9px 20px",
            borderRadius:8, border:"none", background:G, color:"#fff",
            fontSize:13, fontWeight:600, cursor:saving?"not-allowed":"pointer",
            opacity:saving?0.7:1, display:"flex", alignItems:"center", gap:6 }}>
            <Ico d={ICONS.check} size={14} color="#fff" />
            {saving ? "Completing…" : "Complete Consultation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ConsultationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail,       setDetail]       = useState(null);
  const [timeline,     setTimeline]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState("clinical");
  const [toast,        setToast]        = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const [editFields, setEditFields] = useState({
    chief_complaint:"", symptoms:"", clinical_notes:"",
    provisional_diagnosis:"", final_diagnosis:"",
    treatment_notes:"", followup_instructions:"", followup_date:"",
  });
  const [editVitals, setEditVitals] = useState({
    bp:"", pulse:"", temp:"", spo2:"", weight:"", blood_sugar:"",
  });

  // Labs
  const [labRequests,   setLabRequests]   = useState([]);
  const [availTests,    setAvailTests]    = useState([]);
  const [availGroups,   setAvailGroups]   = useState([]);
  // Visible (not just console) diagnostic state for the panel/test picker,
  // so "no panels" vs "still loading" vs "the request failed" are never
  // silently indistinguishable in the UI again.
  const [labPickerStatus, setLabPickerStatus] = useState("idle"); // idle | loading | error | loaded
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]); // TestGroup objects
  const coveredTestIds = useMemo(() => subTestIdsCoveredByGroups(selectedGroups), [selectedGroups]);
  const [labSearchQuery, setLabSearchQuery] = useState(""); // filters both panels and individual tests below
  const labSearchNorm = labSearchQuery.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!labSearchNorm) return availGroups;
    return availGroups.filter(g => {
      if ((g.name||"").toLowerCase().includes(labSearchNorm)) return true;
      if ((g.code||"").toLowerCase().includes(labSearchNorm)) return true;
      // Also match if the query hits one of the panel's sub-tests, so
      // searching "bilirubin" surfaces the LFT panel that contains it.
      return (g.sub_tests||[]).some(st =>
        (st.name||"").toLowerCase().includes(labSearchNorm) ||
        (st.code||"").toLowerCase().includes(labSearchNorm)
      );
    });
  }, [availGroups, labSearchNorm]);
  const filteredTests = useMemo(() => {
    if (!labSearchNorm) return availTests;
    return availTests.filter(t =>
      (t.name||"").toLowerCase().includes(labSearchNorm) ||
      (t.code||"").toLowerCase().includes(labSearchNorm)
    );
  }, [availTests, labSearchNorm]);
  const [expandedGroupId, setExpandedGroupId] = useState(null); // group_id whose sub-tests preview is open
  const [labNotes,      setLabNotes]      = useState("");
  const [creatingLab,   setCreatingLab]   = useState(false);
  const [showLabForm,   setShowLabForm]   = useState(false);
  const [labResults,    setLabResults]    = useState({});
  const [labReports,    setLabReports]    = useState({});
  const [expandedReport, setExpandedReport] = useState(null);

  // Prescriptions
  const [prescriptions, setPrescriptions] = useState([]);
  const [showRxForm,    setShowRxForm]    = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [rxNotes,       setRxNotes]       = useState("");
  const [rxItems,       setRxItems]       = useState([]);
  const [creatingRx, setCreatingRx] = useState(false);
  const [addMedRxId,   setAddMedRxId]   = useState(null); // prescription_id currently receiving a new medicine
  const [addingMedItem, setAddingMedItem] = useState(false);
  const [deletingItemKey, setDeletingItemKey] = useState(null); // `${rxId}-${itemId}` currently deleting

  // Previous history (other consultations for this same patient/MRD)
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading]  = useState(false);
  const [historyLoaded,  setHistoryLoaded]   = useState(false);
  const [historyError,   setHistoryError]    = useState("");
  const [expandedHistory, setExpandedHistory] = useState(null);

  const showToast = (msg, type="info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, tRes] = await Promise.allSettled([
        getConsultationDetail(id),
        getConsultationTimeline(id),
      ]);
      if (dRes.status === "fulfilled" && dRes.value) {
        const d = dRes.value;
        setDetail(d);
        const v = d.vital_signs || {};
        setEditVitals({ bp:v.bp||"", pulse:v.pulse||"", temp:v.temp||"",
          spo2:v.spo2||"", weight:v.weight||"", blood_sugar:v.blood_sugar||"" });
        setEditFields({
          chief_complaint:       d.chief_complaint       || "",
          symptoms:              d.symptoms              || "",
          clinical_notes:        d.clinical_notes        || "",
          provisional_diagnosis: d.provisional_diagnosis || "",
          final_diagnosis:       d.final_diagnosis       || "",
          treatment_notes:       d.treatment_notes       || "",
          followup_instructions: d.followup_instructions || "",
          followup_date:         d.followup_date         || "",
        });
        setPrescriptions(d.prescriptions || []);
        const labs = d.lab_requests || [];
        setLabRequests(labs);
        const results = {};
        const reports = {};
        await Promise.all(labs.map(async lr => {
          const rid = lr.request_id || lr.id;
          try {
            const r = await getLabResultsByRequest(rid);
            results[rid] = r?.items ?? (Array.isArray(r) ? r : (r?.results ?? []));
          } catch(err) {
            console.warn(`Failed to fetch results for lab request #${rid}:`, err);
            results[rid] = [];
          }
          if (["COMPLETED","VERIFIED","DELIVERED"].includes(lr.status)) {
            try {
              const rep = await API.get(`/lab/requests/${rid}/report/`);
              reports[rid] = rep.data;
            } catch { /* report may not exist yet */ }
          }
        }));
        setLabResults(results);
        setLabReports(reports);
      }
      if (tRes.status === "fulfilled") {
        const t = tRes.value;
        setTimeline(Array.isArray(t) ? t : (t?.results ?? []));
      }
    } catch(e) {
      showToast("Failed to load consultation", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Fetch the picker's available tests/panels. Previously this only ran once
  // on mount (empty dep array), so a panel created by the lab team *after*
  // the doctor had this page open wouldn't appear until a full page reload —
  // and any fetch failure was silently swallowed, so there was no way to
  // tell "no panels yet" apart from "the request failed" in the UI.
  // Now it also re-fetches whenever the doctor opens the New Lab Request
  // form, and surfaces failures via the toast instead of dropping them.
  const fetchLabPickerData = useCallback(async () => {
    setLabPickerStatus("loading");
    let hadError = false;
    try {
      const res = await getLabTests();
      setAvailTests(Array.isArray(res) ? res : (res?.results ?? []));
    } catch (e) {
      hadError = true;
      showToast(String(e?.message || e) || "Failed to load lab tests", "error");
    }
    try {
      const res = await getTestGroups();
      const groups = Array.isArray(res) ? res : (res?.results ?? []);
      setAvailGroups(groups);
    } catch (e) {
      hadError = true;
      showToast(String(e?.message || e) || "Failed to load lab panels", "error");
    }
    setLabPickerStatus(hadError ? "error" : "loaded");
  }, []);

  useEffect(() => { fetchLabPickerData(); }, [fetchLabPickerData]);

  // Re-fetch fresh data every time the New Lab Request form is opened, so
  // panels/tests created or activated since the page was loaded show up
  // without requiring a full reload.
  useEffect(() => {
    if (showLabForm) fetchLabPickerData();
  }, [showLabForm, fetchLabPickerData]);

  // Reset history cache whenever we navigate to a different consultation
  useEffect(() => {
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryError("");
    setExpandedHistory(null);
  }, [id]);

  const loadHistory = useCallback(async () => {
    const patientId = detail?.patient?.patient_id ?? detail?.patient_id ?? detail?.patient?.id;
    if (!patientId) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const past = await getPatientConsultationHistory(patientId, { exclude: id });
      setHistory(past || []);
      setHistoryLoaded(true);
    } catch (e) {
      setHistoryError(String(e) || "Failed to load previous history");
    } finally {
      setHistoryLoading(false);
    }
  }, [detail, id]);

  // Lazy-load history the first time the tab is opened
  useEffect(() => {
    if (tab === "history" && !historyLoaded && !historyLoading && detail) {
      loadHistory();
    }
  }, [tab, historyLoaded, historyLoading, detail, loadHistory]);

  // Actions
  const handleSaveClinical = async () => {
    setSaving(true);
    try {
      const vitalsClean = {};
      VITALS_KEYS.forEach(k => { if (editVitals[k]) vitalsClean[k] = editVitals[k]; });
      const fieldsClean = Object.fromEntries(
        Object.entries(editFields).map(([k, v]) => [k, v === "" ? null : v])
      );
      await updateConsultationDetail(id, { ...fieldsClean, vital_signs: vitalsClean });
      showToast("Clinical details saved", "success");
      setIsEditing(false);
      await load();
    } catch(e) {
      showToast(String(e) || "Failed to save", "error");
    } finally { setSaving(false); }
  };

  const handleCreateLab = async () => {
    if (selectedTests.length === 0 && selectedGroups.length === 0) {
      showToast("Select at least one test or panel", "error"); return;
    }
    setCreatingLab(true);
    try {
      await createLabRequest({ consultation: id, notes: labNotes,
        test_ids: selectedTests.map(t => t.test_id || t.id),
        group_ids: selectedGroups.map(g => g.group_id) });
      showToast("Lab request sent", "success");
      setSelectedTests([]); setSelectedGroups([]); setLabNotes(""); setShowLabForm(false); setLabSearchQuery("");
      await load();
    } catch(e) {
      showToast(String(e) || "Failed to create lab request", "error");
    } finally { setCreatingLab(false); }
  };

  const handleCreateRx = async () => {
    if (rxItems.length === 0) {
      showToast("Add at least one medicine", "error");
      return;
    }
    
    setCreatingRx(true);
    try {
      const rx = await createPrescription(id, {
        consultation: id,
        prescription_type: "FINAL",
        notes: rxNotes,
      });
      const rxId = rx?.data?.prescription_id || rx?.prescription_id;
      
      for (const item of rxItems) {
        await createPrescriptionItem(rxId, {
          prescription: rxId,
          medicine_name: item.medicine_name,
          medicine: item.medicine_id,
          medicine_id: item.medicine_id,
          dose_quantity: item.dosage || null,
          frequency: item.frequency,
          meal_timing: item.meal_timing || "",
          route: item.route,
          is_route_overridden: item.is_route_overridden || false,
          duration_days: item.duration_days ? Number(item.duration_days) : null,
          quantity: Number(item.quantity) || 1,
          prn_reason: item.prn_reason || null,
          prn_reason_other: item.prn_reason_other || null,
          max_daily_dose: item.max_daily_dose || null,
          instructions: item.instructions || null,
        });
      }
      
      showToast("Prescription created!", "success");
      setShowRxForm(false);
      setRxItems([]);
      setRxNotes("");
      await load();
    } catch (e) {
      showToast(String(e) || "Failed to create prescription", "error");
    } finally {
      setCreatingRx(false);
    }
  };

  const handleDeleteRx = async (pid) => {
    if (!window.confirm("Delete this prescription?")) return;
    try {
      await deletePrescription(pid);
      showToast("Prescription deleted", "success");
      await load();
    } catch(e) { showToast("Failed to delete", "error"); }
  };

  const addRxItem = (itemData) => {
    setRxItems(p => [...p, itemData]);
    setShowAddItemModal(false);
  };

  const removeRxItem = (i) => setRxItems(p => p.filter((_, idx) => idx !== i));

  // Add a medicine directly to an already-created prescription (e.g. one issued with 0 items)
  const handleAddItemToExistingRx = async (itemData) => {
    if (!addMedRxId) return;
    setAddingMedItem(true);
    try {
      await createPrescriptionItem(addMedRxId, {
        prescription: addMedRxId,
        medicine_name: itemData.medicine_name,
        medicine: itemData.medicine_id,
        medicine_id: itemData.medicine_id,
        dose_quantity: itemData.dosage || null,
        frequency: itemData.frequency,
        meal_timing: itemData.meal_timing || "",
        route: itemData.route,
        is_route_overridden: itemData.is_route_overridden || false,
        duration_days: itemData.duration_days ? Number(itemData.duration_days) : null,
        quantity: Number(itemData.quantity) || 1,
        prn_reason: itemData.prn_reason || null,
        prn_reason_other: itemData.prn_reason_other || null,
        max_daily_dose: itemData.max_daily_dose || null,
        instructions: itemData.instructions || null,
      });
      showToast("Medicine added", "success");
      setAddMedRxId(null);
      await load();
    } catch (e) {
      showToast(String(e) || "Failed to add medicine", "error");
    } finally {
      setAddingMedItem(false);
    }
  };

  const handleDeleteRxItem = async (rxId, itemId) => {
    if (!window.confirm("Remove this medicine from the prescription?")) return;
    const key = `${rxId}-${itemId}`;
    setDeletingItemKey(key);
    try {
      await deletePrescriptionItem(rxId, itemId);
      showToast("Medicine removed", "success");
      await load();
    } catch (e) {
      showToast(String(e) || "Failed to remove medicine", "error");
    } finally {
      setDeletingItemKey(null);
    }
  };

  const isCompleted = detail?.status === "COMPLETED";

  const TABS = [
    { key:"clinical",      label:"Clinical Notes", icon:"notes" },
    { key:"labs",          label:`Lab Requests (${labRequests.length})`, icon:"flask" },
    { key:"prescriptions", label:`Prescriptions (${prescriptions.length})`, icon:"rx" },
    { key:"history",       label:"Previous History", icon:"history" },
    { key:"timeline",      label:"Timeline", icon:"clock" },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ fontFamily:"'DM Sans', 'Segoe UI', sans-serif", minHeight:"100vh",
        background:SURFACE, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:40, height:40, borderRadius:"50%",
            border:`3px solid ${G}20`, borderTopColor:G,
            animation:"spin 0.7s linear infinite", margin:"0 auto 16px" }} />
          <p style={{ fontSize:13, color:MUTED }}>Loading consultation…</p>
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ fontFamily:"'DM Sans', 'Segoe UI', sans-serif", padding:48, textAlign:"center" }}>
        <p style={{ fontSize:16, color:"#EF4444", fontWeight:600 }}>Consultation not found.</p>
        <button onClick={() => navigate(-1)} style={{ marginTop:16, padding:"9px 20px",
          borderRadius:8, border:`1px solid ${BORDER}`, background:"#fff",
          color:MUTED, fontSize:13, cursor:"pointer" }}>← Go back</button>
      </div>
    );
  }

  // Main render
  return (
    <div style={{ fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
      display:"flex", flexDirection:"column", height:"100%",
      margin:"-24px -20px 0", background:"#F1F5F9" }}>

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
      {showRxForm && id && (
        <NewPrescriptionModal consultationId={id}
          onClose={() => setShowRxForm(false)}
          onCreated={(rxId) => {
            setShowRxForm(false);
            load();
            showToast("Prescription header created.", true);
          }} />
      )}

      {/* Top header bar — a non-scrolling flex item (not position:sticky), so it
          is genuinely fixed in place: only the panel below it scrolls. */}
      <div style={{ flexShrink:0, background:"#fff", borderBottom:`1px solid ${BORDER}`,
        padding:"0 24px", display:"flex", alignItems:"center", gap:16,
        boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>

        <button onClick={() => navigate(-1)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"14px 4px",
            background:"none", border:"none", cursor:"pointer", color:MUTED,
            fontSize:13, fontWeight:600, transition:"color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = SLATE}
          onMouseLeave={e => e.currentTarget.style.color = MUTED}>
          <Ico d={ICONS.back} size={16} /> Back
        </button>

        <div style={{ width:1, height:24, background:BORDER }} />

        {/* Patient info */}
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:`${G}15`,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Ico d={ICONS.user} size={18} color={G} />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:15, fontWeight:700, color:SLATE }}>
                {detail.patient_name || "Unknown Patient"}
              </span>
              <StatusBadge status={detail.status} />
            </div>
            <p style={{ fontSize:11, color:MUTED, margin:0 }}>
              MRD: {detail.patient_mrd || "—"} · OP: {detail.op_number || "—"}
              {" · "}Consultation #{detail.consultation_id}
              {" · "}{detail.consultation_date}
            </p>
          </div>
        </div>

        {/* Actions */}
        {!isCompleted && (
          <div style={{ display:"flex", gap:8 }}>
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)}
                  style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${BORDER}`,
                    background:"#fff", color:MUTED, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={handleSaveClinical} disabled={saving}
                  style={{ padding:"8px 16px", borderRadius:8, border:"none", background:G,
                    color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", opacity:saving?0.7:1,
                    display:"flex", alignItems:"center", gap:6 }}>
                  <Ico d={ICONS.save} size={14} color="#fff" />
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(true)}
                  style={{ padding:"8px 16px", borderRadius:8, border:`1.5px solid ${G}40`,
                    background:`${G}08`, color:G, fontSize:13, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:6 }}>
                  <Ico d={ICONS.edit} size={14} color={G} /> Edit Notes
                </button>
                <button onClick={() => setShowComplete(true)}
                  style={{ padding:"8px 18px", borderRadius:8, border:"none", background:G,
                    color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:6 }}>
                  <Ico d={ICONS.check} size={14} color="#fff" /> Mark Complete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content area — everything here scrolls independently
          underneath the fixed header above. */}
      <div style={{ flex:1, overflowY:"auto" }} className="rhims-scrollbar">

        {/* Complete Modal */}
        {showComplete && (
          <CompleteModal
            id={id}
            detail={detail}
            onClose={() => setShowComplete(false)}
            onDone={() => {
              setShowComplete(false);
              navigate("/doctor/consultations");
            }}
          />
        )}

        {/* Body */}
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"12px 24px 40px" }}>

        {/* Vitals row */}
        <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`,
          padding:"16px 20px", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Ico d={ICONS.vitals} size={14} color={G} />
              <span style={{ fontSize:12, fontWeight:700, color:SLATE, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                Vital Signs
              </span>
            </div>
          </div>
          {isEditing ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))", gap:10 }}>
              {VITALS_KEYS.map(k => (
                <div key={k}>
                  <label style={{ ...LBL, marginBottom:4 }}>
                    {VITALS_META[k].label} <span style={{ color:"#CBD5E1", fontWeight:400 }}>({VITALS_META[k].unit})</span>
                  </label>
                  <input value={editVitals[k]}
                    onChange={e => setEditVitals(p => ({ ...p, [k]:e.target.value }))}
                    placeholder={VITALS_META[k].unit}
                    style={{ ...INP, padding:"7px 10px", fontSize:13 }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))", gap:10 }}>
              {VITALS_KEYS.map(k => {
                const val = detail.vital_signs?.[k];
                return (
                  <div key={k} style={{ borderRadius:10, padding:"11px 14px",
                    background: val ? G_LIGHT : SURFACE,
                    border:`1px solid ${val ? "#BBF7D0" : BORDER}` }}>
                    <p style={{ fontSize:10, fontWeight:700, color:val?G:MUTED, margin:"0 0 4px",
                      textTransform:"uppercase", letterSpacing:"0.5px" }}>{VITALS_META[k].label}</p>
                    <p style={{ fontSize:18, fontWeight:700, color:val?SLATE:"#CBD5E1", margin:0 }}>
                      {val || "—"}
                      {val && <span style={{ fontSize:11, color:MUTED, fontWeight:400 }}> {VITALS_META[k].unit}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabs + content */}
        <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`,
          boxShadow:"0 1px 4px rgba(0,0,0,0.04)", overflow:"hidden" }}>

          {/* Tab bar */}
          <div style={{ display:"flex", borderBottom:`1px solid ${BORDER}`, background:SURFACE,
            overflowX:"auto", flexShrink:0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding:"13px 20px", border:"none", background:"none", cursor:"pointer",
                display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap",
                fontSize:13, fontWeight:tab===t.key?700:500,
                color:tab===t.key?G:MUTED,
                borderBottom:tab===t.key?`3px solid ${G}`:"3px solid transparent",
                transition:"all 0.15s",
              }}>
                <Ico d={ICONS[t.icon]} size={14} color={tab===t.key?G:MUTED} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding:24 }}>

            {/* CLINICAL NOTES TAB */}
            {tab === "clinical" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {[
                  { key:"chief_complaint",       label:"Chief Complaint",         span:1 },
                  { key:"symptoms",              label:"History",                 span:1 },
                  { key:"provisional_diagnosis", label:"Provisional Diagnosis",   span:1 },
                  { key:"final_diagnosis",       label:"Final Diagnosis",         span:1 },
                  { key:"clinical_notes",        label:"Clinical Notes",          span:2 },
                  { key:"treatment_notes",       label:"Treatment Notes",         span:2 },
                  { key:"followup_instructions", label:"Follow-up Instructions",  span:1 },
                  { key:"followup_date",         label:"Follow-up Date",          span:1, date:true },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn:`span ${f.span}` }}>
                    <label style={LBL}>{f.label}</label>
                    {isEditing ? (
                      f.date ? (
                        <input type="date" value={editFields[f.key]}
                          onChange={e => setEditFields(p => ({ ...p, [f.key]:e.target.value }))}
                          style={INP} />
                      ) : (
                        <textarea value={editFields[f.key]} rows={f.span===2?3:2}
                          onChange={e => setEditFields(p => ({ ...p, [f.key]:e.target.value }))}
                          style={{ ...INP, resize:"vertical" }} />
                      )
                    ) : (
                      <div style={{ padding:"10px 12px", borderRadius:8, background:SURFACE,
                        border:`1px solid ${BORDER}`, fontSize:13, minHeight:38,
                        color: detail[f.key] ? SLATE : "#CBD5E1", lineHeight:1.5 }}>
                        {detail[f.key] || <em style={{ fontSize:12 }}>Not recorded</em>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* LAB REQUESTS TAB */}
            {tab === "labs" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                  <h3 style={{ fontSize:15, fontWeight:700, color:SLATE, margin:0 }}>Lab Requests</h3>
                  <button onClick={() => setShowLabForm(p => !p)}
                    style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px",
                      borderRadius:8, border:"none", background:G, color:"#fff",
                      fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    <Ico d={ICONS.plus} size={13} color="#fff" /> New Lab Request
                  </button>
                </div>

                {showLabForm && (
                  <div style={{ background:G_LIGHT, borderRadius:12, padding:20,
                    marginBottom:20, border:`1px solid #BBF7D0` }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      marginBottom:14 }}>
                      <h4 style={{ fontSize:13, fontWeight:700, color:SLATE, margin:0 }}>Request Lab Tests</h4>
                      <button onClick={fetchLabPickerData}
                        disabled={labPickerStatus === "loading"}
                        style={{ fontSize:11, fontWeight:600, color:G, background:"none",
                          border:`1px solid ${G}40`, borderRadius:6, padding:"3px 10px",
                          cursor: labPickerStatus === "loading" ? "not-allowed" : "pointer" }}>
                        {labPickerStatus === "loading" ? "Refreshing…" : "↻ Refresh list"}
                      </button>
                    </div>

                    <div style={{ position:"relative", marginBottom:14 }}>
                      <input
                        type="text"
                        value={labSearchQuery}
                        onChange={e => setLabSearchQuery(e.target.value)}
                        placeholder="Search panels or tests by name or code…"
                        style={{ ...INP, paddingRight: labSearchQuery ? 32 : 12 }}
                      />
                      {labSearchQuery && (
                        <button
                          onClick={() => setLabSearchQuery("")}
                          aria-label="Clear search"
                          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                            background:"none", border:"none", cursor:"pointer", fontSize:14,
                            color:MUTED, lineHeight:1, padding:4 }}>
                          ×
                        </button>
                      )}
                    </div>

                    {labPickerStatus === "loaded" && availGroups.length === 0 && (
                      <p style={{ fontSize:11.5, color:MUTED, margin:"0 0 14px",
                        background:"#F1F5F9", borderRadius:8, padding:"6px 10px" }}>
                        No panels came back from the server for this account. If you
                        expect one to be here, click "↻ Refresh list" above — if it's
                        still empty, ask the lab team to confirm the panel is marked
                        Active.
                      </p>
                    )}

                    {labPickerStatus === "loaded" && availGroups.length > 0 && labSearchNorm &&
                      filteredGroups.length === 0 && filteredTests.length === 0 && (
                      <p style={{ fontSize:11.5, color:MUTED, margin:"0 0 14px",
                        background:"#F1F5F9", borderRadius:8, padding:"6px 10px" }}>
                        No panels or tests match "{labSearchQuery}".
                      </p>
                    )}

                    {filteredGroups.length > 0 && (
                      <>
                        <label style={LBL}>Panels (billed once for the whole group)</label>
                        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                          {filteredGroups.map(g => {
                            const gid = g.group_id;
                            const selG = selectedGroups.find(s => s.group_id === gid);
                            const isExpanded = expandedGroupId === gid;
                            return (
                              <div key={gid} style={{
                                border: selG ? `2px solid ${G}` : "1.5px solid #E2E8F0",
                                background: selG ? `${G}0D` : "#fff",
                                borderRadius:10, padding:"8px 12px",
                              }}>
                                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                                  <button
                                    onClick={() => setSelectedGroups(p => {
                                      if (selG) return p.filter(s => s.group_id !== gid);
                                      // Selecting a group covers its sub-tests — drop any of
                                      // those that were individually selected to avoid the
                                      // backend rejecting a duplicate (lab_request, test) row.
                                      const subIds = new Set((g.sub_tests||[]).map(t => t.test_id));
                                      setSelectedTests(pt => pt.filter(t => !subIds.has(t.test_id || t.id)));
                                      return [...p, g];
                                    })}
                                    style={{
                                      flex:1, textAlign:"left", background:"none", border:"none",
                                      cursor:"pointer", padding:0, fontSize:13, fontWeight:700,
                                      color: selG ? G : SLATE,
                                    }}
                                  >
                                    {g.name} {g.code && <span style={{ fontWeight:500, color:MUTED }}>({g.code})</span>}
                                    {" — "}₹{parseFloat(g.price||0).toFixed(2)}
                                  </button>
                                  <button
                                    onClick={() => setExpandedGroupId(isExpanded ? null : gid)}
                                    style={{ background:"none", border:"none", cursor:"pointer",
                                      fontSize:11, color:MUTED, fontWeight:600, whiteSpace:"nowrap" }}
                                  >
                                    {isExpanded ? "Hide tests" : `${(g.sub_tests||[]).length} tests ▾`}
                                  </button>
                                </div>
                                {isExpanded && (
                                  <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${BORDER}` }}>
                                    {(g.sub_tests||[]).map(st => (
                                      <div key={st.test_id} style={{ fontSize:12, color:MUTED, padding:"2px 0" }}>
                                        • {st.name}{st.code && ` (${st.code})`}
                                        {st.normal_range && <span> — Ref: {st.normal_range}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <label style={LBL}>Select Individual Tests</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                      {filteredTests.length === 0 ? (
                        <p style={{ fontSize:13, color:MUTED }}>
                          {availTests.length === 0 ? "No tests available" : `No tests match "${labSearchQuery}"`}
                        </p>
                      ) : filteredTests.map(t => {
                        const tid = t.test_id || t.id;
                        const sel = selectedTests.find(s => (s.test_id||s.id) === tid);
                        // If this test belongs to a panel that's currently selected,
                        // it's already covered — block picking it individually to
                        // avoid confusing double billing on the picker itself.
                        const coveredByGroup = coveredTestIds.has(tid);
                        return (
                          <button
                            key={tid}
                            disabled={coveredByGroup}
                            title={coveredByGroup ? `Included in the "${t.group_name}" panel selected above` : undefined}
                            onClick={() => !coveredByGroup && setSelectedTests(p =>
                              sel ? p.filter(s => (s.test_id||s.id)!==tid) : [...p, t]
                            )} style={{
                            padding:"5px 13px", borderRadius:20, fontSize:12, fontWeight:600,
                            cursor: coveredByGroup ? "not-allowed" : "pointer",
                            border: sel?`2px solid ${G}`:"1.5px solid #E2E8F0",
                            background: coveredByGroup ? "#F1F5F9" : (sel?`${G}18`:"#fff"),
                            color: coveredByGroup ? "#CBD5E1" : (sel?G:MUTED),
                          }}>
                            {t.name}{t.code && ` (${t.code})`}
                            {t.group_name && <span style={{ opacity:0.7 }}> · {t.group_name}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <label style={LBL}>Notes for Lab Technician</label>
                    <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)} rows={2}
                      placeholder="Any special instructions…"
                      style={{ ...INP, resize:"vertical", marginBottom:14 }} />
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={handleCreateLab} disabled={creatingLab}
                        style={{ padding:"8px 18px", borderRadius:8, border:"none", background:G,
                          color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", opacity:creatingLab?0.7:1 }}>
                        {creatingLab ? "Sending…" : "Send Lab Request"}
                      </button>
                      <button onClick={() => { setShowLabForm(false); setLabSearchQuery(""); }}
                        style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${BORDER}`,
                          background:"#fff", color:MUTED, fontSize:12, cursor:"pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {labRequests.length === 0 ? (
                  <div style={{ textAlign:"center", padding:56, color:"#CBD5E1" }}>
                    <Ico d={ICONS.flask} size={36} color="#CBD5E1" />
                    <p style={{ marginTop:12, fontSize:13, color:MUTED }}>No lab requests for this consultation</p>
                  </div>
                ) : labRequests.map(lr => {
                  const rid = lr.request_id || lr.id;
                  const results = labResults[rid] || [];
                  const report  = labReports[rid] ?? null;
                  const isDone  = ["COMPLETED","VERIFIED","DELIVERED"].includes(lr.status);
                  const isExpanded = expandedReport === rid;
                  return (
                    <div key={rid} style={{ background:SURFACE, borderRadius:12,
                      border:`1px solid ${BORDER}`, padding:18, marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                        <div>
                          <p style={{ fontSize:13, fontWeight:700, color:SLATE, margin:0 }}>Lab Request #{rid}</p>
                          <p style={{ fontSize:11, color:MUTED, margin:"2px 0 0" }}>
                            {lr.created_at ? new Date(lr.created_at).toLocaleString("en-IN") : ""}
                          </p>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <StatusBadge status={lr.status} />
                          {isDone && (
                            <button
                              onClick={() => setExpandedReport(isExpanded ? null : rid)}
                              style={{ padding:"4px 10px", borderRadius:7, border:`1.5px solid ${G}40`,
                                background:isExpanded?`${G}10`:"#fff", color:G, fontSize:11,
                                fontWeight:700, cursor:"pointer" }}>
                              {isExpanded ? "Hide Report" : "Full Report"}
                            </button>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const rows = groupLabRequestItems(lr.items||[]);
                        const groupRows = rows.filter(r => r.type === "group");
                        const standaloneRows = rows.filter(r => r.type === "standalone");
                        return (
                          <>
                            {groupRows.length > 0 && (
                              <div>
                                <p style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase",
                                  letterSpacing:0.4, margin:"10px 0 4px" }}>Panel Tests</p>
                                {groupRows.map((row, i) => (
                                  <div key={`g-${row.groupId}`} style={{ padding:"6px 0", borderTop:i>0?`1px solid ${BORDER}`:"none" }}>
                                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                                      <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                                        <span style={{ width:6, height:6, borderRadius:"50%", background:G, flexShrink:0 }} />
                                        <span style={{ fontSize:12.5, fontWeight:700, color:"#334155" }}>{row.groupName}</span>
                                        <span style={{ fontSize:10.5, fontWeight:600, color:MUTED, background:"#F1F5F9",
                                          padding:"1px 7px", borderRadius:20 }}>Panel</span>
                                      </span>
                                      {row.groupPrice != null && (
                                        <span style={{ fontSize:12, fontWeight:700, color:G }}>₹{row.groupPrice.toFixed(2)}</span>
                                      )}
                                    </div>
                                    <div style={{ marginLeft:14, marginTop:3 }}>
                                      {row.items.map((item, j) => (
                                        <div key={j} style={{ fontSize:11.5, color:MUTED, padding:"1px 0" }}>
                                          • {item.test_name || `Test #${item.test}`}
                                          {item.test_code && ` (${item.test_code})`}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {standaloneRows.length > 0 && (
                              <div>
                                <p style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase",
                                  letterSpacing:0.4, margin:"10px 0 4px" }}>Individual Tests</p>
                                {standaloneRows.map((row, i) => (
                                  <div key={`s-${row.item.item_id ?? i}`} style={{ display:"flex", alignItems:"center", gap:8,
                                    padding:"5px 0", borderTop:i>0?`1px solid ${BORDER}`:"none" }}>
                                    <span style={{ width:6, height:6, borderRadius:"50%", background:G, flexShrink:0 }} />
                                    <span style={{ fontSize:12.5, color:"#334155" }}>{row.item.test_name || `Test #${row.item.test}`}</span>
                                    {row.item.test_code && <span style={{ fontSize:11, color:MUTED }}>({row.item.test_code})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {lr.notes && <p style={{ fontSize:12, color:MUTED, marginTop:10, fontStyle:"italic" }}>Note: {lr.notes}</p>}
                      {results.length > 0 && (
                        <div style={{ marginTop:14, background:G_LIGHT, borderRadius:10, padding:14 }}>
                          <p style={{ fontSize:12, fontWeight:700, color:G, margin:"0 0 10px" }}>Results</p>
                          {results.map((r, i) => {
                            const res = r.result;
                            if (!res) return null;
                            return (
                              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto",
                                gap:8, fontSize:12, color:SLATE, padding:"5px 0",
                                borderTop:i>0?`1px solid #BBF7D0`:"none" }}>
                                <span style={{ fontWeight:600 }}>{r.test_name || r.test_item_name || "—"}</span>
                                <span>{res.result_value || "—"}</span>
                                {(res.normal_range || r.test_normal_range) && (
                                  <span style={{ color:MUTED }}>Ref: {res.normal_range || r.test_normal_range}</span>
                                )}
                                {res.is_abnormal && <span style={{ color:"#EF4444", fontWeight:700 }}>⚠ Abnormal</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isExpanded && (
                        <div style={{ marginTop:14, borderTop:`1px solid ${BORDER}`, paddingTop:14 }}>
                          <p style={{ fontSize:12, fontWeight:700, color:"#475569", marginBottom:10,
                            textTransform:"uppercase", letterSpacing:"0.4px" }}>Lab Report</p>
                          {!report ? (
                            <p style={{ fontSize:12, color:"#94A3B8", fontStyle:"italic" }}>
                              Report not yet available.
                            </p>
                          ) : (
                            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:8 }}>
                                {[
                                  ["Report ID",    `#${report.report_id}`],
                                  ["Verified By",  report.verified_by_username ?? "Pending"],
                                  ["Verified At",  report.verified_at ? new Date(report.verified_at).toLocaleString("en-IN") : "Pending"],
                                  ["Delivered At", report.delivered_at ? new Date(report.delivered_at).toLocaleString("en-IN") : "Pending"],
                                ].map(([l, v]) => (
                                  <div key={l} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 12px" }}>
                                    <p style={{ fontSize:10, color:"#94A3B8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:3 }}>{l}</p>
                                    <p style={{ fontSize:12, fontWeight:600, color:SLATE, margin:0 }}>{v}</p>
                                  </div>
                                ))}
                              </div>
                              {report.report_notes ? (
                                <div style={{ background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:10, padding:"12px 14px" }}>
                                  <p style={{ fontSize:11, fontWeight:700, color:"#D97706", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.4px" }}>Report Notes</p>
                                  <p style={{ fontSize:13, color:"#475569", whiteSpace:"pre-wrap", margin:0, lineHeight:1.6 }}>{report.report_notes}</p>
                                </div>
                              ) : (
                                <p style={{ fontSize:12, color:"#94A3B8", fontStyle:"italic" }}>No report notes added by lab technician.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* PRESCRIPTIONS TAB */}
            {tab === "prescriptions" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                  <h3 style={{ fontSize:15, fontWeight:700, color:SLATE, margin:0 }}>Prescriptions</h3>
                  {!showRxForm && (
                    <button onClick={() => setShowRxForm(true)}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px",
                        borderRadius:8, border:"none", background:G, color:"#fff",
                        fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      <Ico d={ICONS.plus} size={13} color="#fff" /> New Prescription
                    </button>
                  )}
                </div>

                {showRxForm && (
                  <div style={{ background:SURFACE, borderRadius:14, padding:22,
                    marginBottom:20, border:`1px solid ${BORDER}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                      <h4 style={{ fontSize:14, fontWeight:700, color:SLATE, margin:0 }}>Create Prescription</h4>
                      <button
                        onClick={() => {
                          setShowRxForm(false);
                          setRxItems([]);
                          setRxNotes("");
                        }}
                        style={{ background:"none", border:"none", cursor:"pointer", color:MUTED }}>
                        <Ico d={ICONS.x} size={16} />
                      </button>
                    </div>

                    <div style={{ marginBottom:18 }}>
                      <label style={LBL}>Notes for Pharmacist</label>
                      <textarea
                        rows={2}
                        value={rxNotes}
                        onChange={e => setRxNotes(e.target.value)}
                        placeholder="Additional instructions…"
                        style={{ ...INP, resize: "none" }}
                      />
                    </div>

                    <div style={{ marginBottom:18 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <label style={{ ...LBL, margin:0 }}>Medicines ({rxItems.length})</label>
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          style={{
                            fontSize:12,
                            fontWeight:600,
                            color:G,
                            background:`${G}10`,
                            border:"none",
                            borderRadius:6,
                            padding:"5px 12px",
                            cursor:"pointer",
                          }}>
                          + Add Medicine
                        </button>
                      </div>

                      {rxItems.length === 0 && (
                        <div style={{ padding:16, background:"#F8FAFC", borderRadius:10, border:`1px solid ${BORDER}`, textAlign:"center" }}>
                          <p style={{ margin:0, fontSize:12, color:MUTED }}>No medicines added yet. Click "Add Medicine" to begin.</p>
                        </div>
                      )}

                      {rxItems.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            background:"#fff",
                            borderRadius:12,
                            padding:14,
                            border:`1px solid ${BORDER}`,
                            marginBottom:10,
                          }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                            <div style={{ flex:1 }}>
                              <p style={{ margin:"0 0 4px 0", fontSize:13, fontWeight:600, color:SLATE }}>
                                {item.medicine_name}
                              </p>
                              <p style={{ margin:0, fontSize:11, color:MUTED }}>
                                {item.dosage && `${item.dosage} • `}
                                {FREQ_LABELS[item.frequency] || item.frequency}
                                {item.meal_timing ? ` • ${MEAL_TIMING_LABELS[item.meal_timing] || item.meal_timing}` : ""}
                              </p>
                              <p style={{ margin:"4px 0 0 0", fontSize:11, color:"#64748B" }}>
                                {item.duration_days && `${item.duration_days} days`}
                                {item.quantity && ` • Qty: ${item.quantity}`}
                              </p>
                            </div>
                            {rxItems.length > 1 && (
                              <button
                                onClick={() => removeRxItem(idx)}
                                style={{
                                  background:"#FEF2F2",
                                  color:"#DC2626",
                                  border:"1px solid #FECACA",
                                  borderRadius:6,
                                  padding:"4px 8px",
                                  cursor:"pointer",
                                  fontSize:11,
                                  fontWeight:600,
                                  marginLeft:12,
                                  whiteSpace:"nowrap",
                                }}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display:"flex", gap:10, marginTop:16 }}>
                      <button
                        onClick={handleCreateRx}
                        disabled={creatingRx || rxItems.length === 0}
                        style={{
                          padding:"9px 20px",
                          borderRadius:8,
                          border:"none",
                          background:rxItems.length > 0 ? G : "#CCCCCC",
                          color:"#fff",
                          fontSize:13,
                          fontWeight:600,
                          cursor:rxItems.length > 0 && !creatingRx ? "pointer" : "not-allowed",
                          opacity:creatingRx ? 0.7 : 1,
                        }}>
                        {creatingRx ? "Saving…" : "Save Prescription"}
                      </button>
                      <button
                        onClick={() => {
                          setShowRxForm(false);
                          setRxItems([]);
                          setRxNotes("");
                        }}
                        style={{
                          padding:"9px 20px",
                          borderRadius:8,
                          border:`1px solid ${BORDER}`,
                          background:"#fff",
                          color:MUTED,
                          fontSize:13,
                          fontWeight:600,
                          cursor:"pointer",
                        }}>
                        Cancel
                      </button>
                    </div>

                    {showAddItemModal && (
                      <ConsultationAddItemModal
                        onClose={() => setShowAddItemModal(false)}
                        onAdded={addRxItem}
                        prescriptionExists={rxItems.length > 0}
                      />
                    )}
                  </div>
                )}

                {prescriptions.length === 0 && !showRxForm ? (
                  <div style={{ textAlign:"center", padding:56 }}>
                    <Ico d={ICONS.rx} size={36} color="#CBD5E1" />
                    <p style={{ marginTop:12, fontSize:13, color:MUTED }}>No prescriptions issued yet</p>
                  </div>
                ) : prescriptions.map(rx => (
                  <div key={rx.prescription_id} style={{ background:SURFACE, borderRadius:12,
                    border:`1px solid ${BORDER}`, padding:18, marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:SLATE }}>
                            Prescription #{rx.prescription_id}
                          </span>
                          <span style={{ padding:"2px 9px", borderRadius:12, fontSize:11, fontWeight:700,
                            background:G_LIGHT, color:G }}>
                            FINAL
                          </span>
                        </div>
                        <p style={{ fontSize:11, color:MUTED, margin:"3px 0 0" }}>
                          By {rx.prescribed_by_username||"—"} · {new Date(rx.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      {!isCompleted && (
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => setAddMedRxId(rx.prescription_id)}
                            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
                              borderRadius:8, border:"none", background:G, color:"#fff",
                              fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                            <Ico d={ICONS.plus} size={12} color="#fff" /> Add Medicine
                          </button>
                          <button onClick={() => handleDeleteRx(rx.prescription_id)}
                            style={{ width:32, height:32, borderRadius:8, border:"1px solid #FEE2E2",
                              background:"#FEF2F2", color:"#EF4444", cursor:"pointer",
                              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <Ico d={ICONS.trash} size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {rx.notes && <p style={{ fontSize:12, color:MUTED, fontStyle:"italic", marginBottom:12 }}>Note: {rx.notes}</p>}
                    <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${BORDER}` }}>
                      <div style={{ display:"grid", gridTemplateColumns:isCompleted ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 32px",
                        padding:"7px 12px", background:"#EEF2F7", fontSize:10, fontWeight:700,
                        color:MUTED, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                        <span>Medicine</span><span>Dose</span><span>Freq</span><span>Days</span><span>Qty</span>
                        {!isCompleted && <span></span>}
                      </div>
                      {(rx.items||[]).map((item, j) => (
                        <div key={j} style={{ display:"grid", gridTemplateColumns:isCompleted ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 32px",
                          padding:"9px 12px", borderTop:`1px solid ${BORDER}`, fontSize:12.5, color:"#334155", alignItems:"center" }}>
                          <div>
                            <p style={{ margin:0, fontWeight:600 }}>{item.medicine_name}</p>
                            {item.instructions && <p style={{ margin:"2px 0 0", fontSize:11, color:MUTED }}>{item.instructions}</p>}
                          </div>
                          <span>{item.dosage||"—"}</span>
                          <span>
                            {FREQ_LABELS[item.frequency] ?? item.frequency}
                            {item.meal_timing && (
                              <> · {MEAL_TIMING_LABELS[item.meal_timing] ?? item.meal_timing}</>
                            )}
                          </span>
                          <span>{item.duration_days||"—"}</span>
                          <span>{item.quantity}</span>
                          {!isCompleted && (
                            <button
                              onClick={() => handleDeleteRxItem(rx.prescription_id, item.item_id || item.id)}
                              disabled={deletingItemKey === `${rx.prescription_id}-${item.item_id || item.id}`}
                              title="Remove medicine"
                              style={{ width:24, height:24, borderRadius:6, border:"none",
                                background:"transparent", color:"#EF4444", cursor:"pointer",
                                display:"flex", alignItems:"center", justifyContent:"center",
                                opacity: deletingItemKey === `${rx.prescription_id}-${item.item_id || item.id}` ? 0.5 : 1 }}>
                              <Ico d={ICONS.trash} size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!(rx.items||[]).length && (
                        <p style={{ padding:"10px 12px", fontSize:12, color:MUTED }}>No medicines added</p>
                      )}
                    </div>

                    {addMedRxId === rx.prescription_id && (
                      <ConsultationAddItemModal
                        onClose={() => !addingMedItem && setAddMedRxId(null)}
                        onAdded={handleAddItemToExistingRx}
                        prescriptionExists={true}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* PREVIOUS HISTORY TAB */}
            {tab === "history" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                  <div>
                    <h3 style={{ fontSize:15, fontWeight:700, color:SLATE, margin:"0 0 4px" }}>Previous Consultations</h3>
                    <p style={{ fontSize:12, color:MUTED, margin:0 }}>
                      Past visits for {detail.patient_name || "this patient"}
                      {detail.patient_mrd ? ` · MRD: ${detail.patient_mrd}` : ""}
                    </p>
                  </div>
                  <button onClick={loadHistory} disabled={historyLoading}
                    style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${BORDER}`,
                      background:"#fff", color:MUTED, fontSize:12.5, fontWeight:600,
                      cursor:historyLoading?"not-allowed":"pointer", opacity:historyLoading?0.6:1,
                      display:"flex", alignItems:"center", gap:6 }}>
                    <Ico d={ICONS.history} size={13} color={MUTED} />
                    {historyLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                {historyError && (
                  <div style={{ marginBottom:16, padding:"12px 14px", borderRadius:8,
                    background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626",
                    fontSize:12.5, fontWeight:500 }}>
                    {historyError}
                  </div>
                )}

                {historyLoading && history.length === 0 ? (
                  <div style={{ textAlign:"center", padding:56 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%",
                      border:`3px solid ${G}20`, borderTopColor:G,
                      animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
                    <p style={{ fontSize:13, color:MUTED }}>Loading previous history…</p>
                  </div>
                ) : history.length === 0 ? (
                  <div style={{ textAlign:"center", padding:56 }}>
                    <Ico d={ICONS.history} size={32} color="#CBD5E1" />
                    <p style={{ marginTop:12, fontSize:13, color:MUTED }}>No previous consultations found for this patient</p>
                  </div>
                ) : (
                  history.map(h => {
                    const isOpen = expandedHistory === h.consultation_id;
                    const v = h.vital_signs || {};
                    const hasVitals = VITALS_KEYS.some(k => v[k]);
                    return (
                      <div key={h.consultation_id} style={{ background:SURFACE, borderRadius:12,
                        border:`1px solid ${BORDER}`, marginBottom:12, overflow:"hidden" }}>

                        {/* Card header */}
                        <button onClick={() => setExpandedHistory(isOpen ? null : h.consultation_id)}
                          style={{ width:"100%", display:"flex", justifyContent:"space-between",
                            alignItems:"center", padding:"14px 18px", background:"none",
                            border:"none", cursor:"pointer", textAlign:"left" }}>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:13.5, fontWeight:700, color:SLATE }}>
                                Consultation #{h.consultation_id}
                              </span>
                              <StatusBadge status={h.status} />
                            </div>
                            <p style={{ fontSize:11.5, color:MUTED, margin:"4px 0 0" }}>
                              {h.consultation_date}
                              {h.doctor_fullname ? ` · Dr. ${h.doctor_fullname}` : ""}
                              {h.chief_complaint ? ` · ${h.chief_complaint}` : ""}
                            </p>
                          </div>
                          <span style={{ color:MUTED, flexShrink:0, marginLeft:12,
                            transform: isOpen ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                            <Ico d={ICONS.chevDown} size={16} />
                          </span>
                        </button>

                        {isOpen && (
                          <div style={{ padding:"0 18px 18px" }}>

                            {/* Vitals */}
                            <div style={{ marginBottom:16 }}>
                              <p style={{ ...LBL, marginBottom:8 }}>Vital Signs</p>
                              {hasVitals ? (
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px,1fr))", gap:8 }}>
                                  {VITALS_KEYS.filter(k => v[k]).map(k => (
                                    <div key={k} style={{ background:"#fff", borderRadius:8,
                                      padding:"8px 10px", border:`1px solid ${BORDER}` }}>
                                      <p style={{ fontSize:9.5, fontWeight:700, color:MUTED, margin:"0 0 3px",
                                        textTransform:"uppercase", letterSpacing:"0.4px" }}>{VITALS_META[k].label}</p>
                                      <p style={{ fontSize:14, fontWeight:700, color:SLATE, margin:0 }}>
                                        {v[k]} <span style={{ fontSize:10, color:MUTED, fontWeight:400 }}>{VITALS_META[k].unit}</span>
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize:12, color:"#CBD5E1", margin:0 }}>No vitals recorded</p>
                              )}
                            </div>

                            {/* Notes */}
                            <div style={{ marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                              {[
                                { label:"Chief Complaint",       value:h.chief_complaint },
                                { label:"History",                value:h.symptoms },
                                { label:"Provisional Diagnosis",  value:h.provisional_diagnosis },
                                { label:"Final Diagnosis",        value:h.final_diagnosis },
                                { label:"Clinical Notes",         value:h.clinical_notes, span:2 },
                                { label:"Treatment Notes",        value:h.treatment_notes, span:2 },
                              ].map(f => (
                                <div key={f.label} style={{ gridColumn: f.span===2 ? "1 / -1" : "auto",
                                  background:"#fff", borderRadius:8, padding:"9px 12px", border:`1px solid ${BORDER}` }}>
                                  <p style={{ fontSize:9.5, fontWeight:700, color:MUTED, margin:"0 0 3px",
                                    textTransform:"uppercase", letterSpacing:"0.4px" }}>{f.label}</p>
                                  <p style={{ fontSize:12.5, color:f.value?SLATE:"#CBD5E1", margin:0 }}>
                                    {f.value || "Not recorded"}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Lab requests */}
                            <div style={{ marginBottom:16 }}>
                              <p style={{ ...LBL, marginBottom:8 }}>Lab Requests ({(h.lab_requests||[]).length})</p>
                              {(h.lab_requests||[]).length === 0 ? (
                                <p style={{ fontSize:12, color:"#CBD5E1", margin:0 }}>No lab tests requested</p>
                              ) : h.lab_requests.map(lr => (
                                <div key={lr.request_id} style={{ background:"#fff", borderRadius:8,
                                  border:`1px solid ${BORDER}`, padding:"10px 12px", marginBottom:8 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                                    <span style={{ fontSize:12, fontWeight:700, color:SLATE }}>Request #{lr.request_id}</span>
                                    <StatusBadge status={lr.status} />
                                  </div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                    {(lr.items||[]).map(item => (
                                      <span key={item.item_id} style={{ padding:"3px 9px", borderRadius:6,
                                        background:SURFACE, border:`1px solid ${BORDER}`, fontSize:11, color:"#334155" }}>
                                        {item.test_name}
                                      </span>
                                    ))}
                                    {!(lr.items||[]).length && (
                                      <span style={{ fontSize:11.5, color:MUTED }}>No tests listed</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Prescriptions */}
                            <div>
                              <p style={{ ...LBL, marginBottom:8 }}>Prescriptions ({(h.prescriptions||[]).length})</p>
                              {(h.prescriptions||[]).length === 0 ? (
                                <p style={{ fontSize:12, color:"#CBD5E1", margin:0 }}>No medicines prescribed</p>
                              ) : h.prescriptions.map(rx => (
                                <div key={rx.prescription_id} style={{ borderRadius:10, overflow:"hidden",
                                  border:`1px solid ${BORDER}`, marginBottom:8 }}>
                                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                                    padding:"6px 12px", background:"#EEF2F7", fontSize:9.5, fontWeight:700,
                                    color:MUTED, textTransform:"uppercase", letterSpacing:"0.4px" }}>
                                    <span>Medicine</span><span>Dose</span><span>Freq</span><span>Days</span><span>Qty</span>
                                  </div>
                                  {(rx.items||[]).map((item, j) => (
                                    <div key={j} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",
                                      padding:"8px 12px", borderTop:`1px solid ${BORDER}`, fontSize:12, color:"#334155", background:"#fff" }}>
                                      <span style={{ fontWeight:600 }}>{item.medicine_name}</span>
                                      <span>{item.dosage||item.dose_quantity||"—"}</span>
                                      <span>{FREQ_LABELS[item.frequency] ?? item.frequency}</span>
                                      <span>{item.duration_days||item.duration||"—"}</span>
                                      <span>{item.quantity}</span>
                                    </div>
                                  ))}
                                  {!(rx.items||[]).length && (
                                    <p style={{ padding:"8px 12px", fontSize:11.5, color:MUTED, background:"#fff" }}>No medicines added</p>
                                  )}
                                </div>
                              ))}
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TIMELINE TAB */}
            {tab === "timeline" && (
              <div>
                <h3 style={{ fontSize:15, fontWeight:700, color:SLATE, margin:"0 0 20px" }}>Consultation Timeline</h3>
                {timeline.length === 0 ? (
                  <div style={{ textAlign:"center", padding:56 }}>
                    <Ico d={ICONS.clock} size={32} color="#CBD5E1" />
                    <p style={{ marginTop:12, fontSize:13, color:MUTED }}>No timeline events recorded</p>
                  </div>
                ) : (
                  <div style={{ position:"relative", paddingLeft:28 }}>
                    <div style={{ position:"absolute", left:9, top:0, bottom:0,
                      width:2, background:`${G}20`, borderRadius:2 }} />
                    {timeline.map((entry, i) => (
                      <div key={entry.entry_id||i} style={{ position:"relative", marginBottom:18 }}>
                        <div style={{ position:"absolute", left:-23, top:6, width:12, height:12,
                          borderRadius:"50%", background:G, border:"3px solid #fff",
                          boxShadow:`0 0 0 2px ${G}40` }} />
                        <div style={{ background:"#fff", borderRadius:10, padding:"12px 16px",
                          border:`1px solid ${BORDER}`, marginLeft:4 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <span style={{ fontSize:12.5, fontWeight:700, color:SLATE }}>
                              {entry.event?.replace(/_/g," ")}
                            </span>
                            <span style={{ fontSize:11, color:MUTED, flexShrink:0, marginLeft:12 }}>
                              {new Date(entry.timestamp).toLocaleString("en-IN")}
                            </span>
                          </div>
                          {entry.description && (
                            <p style={{ fontSize:12, color:MUTED, margin:"5px 0 0" }}>{entry.description}</p>
                          )}
                          {entry.actor_username && (
                            <p style={{ fontSize:11, color:"#94A3B8", margin:"3px 0 0" }}>By: {entry.actor_username}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  );
}