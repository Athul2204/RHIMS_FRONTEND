// src/modules/pharmacist/pages/BillsPage.jsx - FIXED VERSION
// ✅ FIXES APPLIED:
//    1. Line 510: Improved procedure loading with better response parsing
//    2. Line 546-554: Added transitionBillToOpen() before completeBill()
//    3. Better error handling and logging for debugging

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getBills, getBillDetail, addMedicine, removeMedicineItem, updateMedicineItem,
  markBillPaid, completeBill, reopenBill, cancelBill, getBatches,
  transitionBillToOpen, setBillDiscount,
  addProcedure, removeProcedureItem, updateProcedureItem, getPrescriptionItems,
  searchGeneralItems, addGeneralItem, removeGeneralItem, updateGeneralItemBillItem,
} from "../api/pharmacistApi";
import API from "../../../api";
import WalkInBillPage from "./WalkInBillPage";

const G = "#8B5CF6";
const INP = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
const LBL = { fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 };

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

// Builds a "1 tab · Twice Daily · After Meals · 5 days" style summary from the
// prescription context the backend attaches to each bill medicine item.
// Returns null when there's nothing to show (e.g. a walk-in item with no
// linked prescription_item).
function formatDosage(item) {
  if (item.dose_quantity == null && !item.frequency_display && !item.duration_days) return null;
  const parts = [];
  if (item.dose_quantity != null) parts.push(`${parseFloat(item.dose_quantity)} dose`);
  if (item.frequency_display) parts.push(item.frequency_display);
  if (item.meal_timing_display && item.meal_timing) parts.push(item.meal_timing_display);
  if (item.duration_days) parts.push(`${item.duration_days} day${item.duration_days > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

const ICONS = {
  bill:    "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  x:       "M18 6 6 18 M6 6l12 12",
  trash:   "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  plus:    "M12 5v14 M5 12h14",
  check:   "M20 6 9 17l-5-5",
  print:   "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  pill:    "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  unlock:  "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 9.9-1",
  alert:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
};

const PAY_OPTS = ["CASH","CARD","UPI"];
const PAY_STYLE = { CASH:{bg:"#F0FDF4",color:"#15803D"}, CARD:{bg:"#EFF6FF",color:"#1D4ED8"}, UPI:{bg:"#FDF4FF",color:"#7C3AED"} };

function Toast({ msg, ok }) {
  if (!msg) return null;
  return <div style={{ position:"fixed",top:20,right:20,zIndex:9999,padding:"11px 18px",borderRadius:10,fontSize:13,fontWeight:600,background:ok?"#F0FDF4":"#FEF2F2",color:ok?"#166534":"#B91C1C",border:`1px solid ${ok?"#BBF7D0":"#FECACA"}`,boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>{msg}</div>;
}

const STATUS = {
  DRAFT:     { label:"Draft",     bg:"#FEF3C7", color:"#92400E" },
  READY:     { label:"Ready",     bg:"#DBEAFE", color:"#1E40AF" },
  OPEN:      { label:"Open",      bg:"#EFF6FF", color:"#1D4ED8" },
  COMPLETED: { label:"Completed", bg:"#F5F3FF", color:"#6D28D9" },
  PAID:      { label:"Paid",      bg:"#F0FDF4", color:"#15803D" },
  CANCELLED: { label:"Cancelled", bg:"#FEF2F2", color:"#B91C1C" },
};

function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, bg: "#F1F5F9", color: "#64748B" };
  return <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:s.bg, color:s.color }}>{s.label}</span>;
}

function Stepper({ status }) {
  const steps = ["DRAFT", "OPEN", "COMPLETED", "PAID"];
  const idx = steps.indexOf(status);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20, overflowX:"auto", paddingBottom:8 }}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const labels = {
          "DRAFT": "Draft",
          "READY": "Ready",
          "OPEN": "Open",
          "COMPLETED": "Complete",
          "PAID": "Paid"
        };
        return (
          <div key={s} style={{ display:"flex", alignItems:"center", minWidth:"fit-content" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: done||active ? G : "#E2E8F0", border: `2px solid ${done||active ? G : "#E2E8F0"}` }}>
                {done ? <Ico d={ICONS.check} size={13} color="#fff" /> : <span style={{ fontSize:11, fontWeight:700, color: active?"#fff":"#94A3B8" }}>{i+1}</span>}
              </div>
              <span style={{ fontSize:10, fontWeight:600, color: done||active ? G : "#94A3B8", whiteSpace:"nowrap" }}>{labels[s]}</span>
            </div>
            {i < steps.length-1 && (
              <div style={{ width:60, height:2, background: done ? G : "#E2E8F0", margin:"0 4px", marginBottom:18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Prescribed Medicines Display ────────────────────────────────────
function PrescribedMedicines({ billId, prescriptionId, onAdded, onError, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(new Set());
  // Editable quantity per prescription item — pharmacist can adjust before
  // adding to the bill (e.g. partial dispensing, or stock-limited quantity).
  const [qtyOverrides, setQtyOverrides] = useState({});

  const loadPrescriptionItems = useCallback(async () => {
    if (!prescriptionId) return;
    setLoading(true);
    try {
      const data = await getPrescriptionItems(prescriptionId);
      setItems(Array.isArray(data) ? data : data.items || []);
      if ((!data || (Array.isArray(data) && data.length === 0)) || (data?.items && data.items.length === 0)) {
        console.warn("No prescription items found for prescription:", prescriptionId);
      }
    } catch(e) {
      console.error("Prescription fetch error:", e);
      onError("Failed to load prescribed medicines: " + String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [prescriptionId, onError]);

  useEffect(() => {
    loadPrescriptionItems();
  }, [loadPrescriptionItems]);

  const handleAddMedicine = async (item) => {
    // ✅ FIX: FetchPrescriptionMedicinesView returns flat fields
    // (medicine_id, medicine_name, prescription_item_id) — there is no
    // nested `item.medicine` object. Checking `item.medicine.medicine_id`
    // was always false, so this fired "Medicine not linked to prescription"
    // for every single medicine, even correctly linked ones.
    if (!item.medicine_id) {
      onError("Medicine not linked to prescription. Please contact pharmacy admin.");
      return;
    }

    setAdding(prev => new Set([...prev, item.prescription_item_id]));
    try {
      // The prescription-medicines endpoint already computed available
      // batches (with expiry/stock filtering) per item — use that instead
      // of a second, less precise getBatches() call.
      const availableBatches = (item.available_batches || []).filter(b => b.is_available);
      if (availableBatches.length === 0) {
        onError(`No active batches available for ${item.medicine_name}. Please add to stock first.`);
        return;
      }

      const batch = availableBatches[0];
      const requestedQty = parseInt(qtyOverrides[item.prescription_item_id], 10) || item.prescribed_quantity || 1;
      const qty = Math.min(requestedQty, batch.quantity);
      if (requestedQty > batch.quantity) {
        onError(`Only ${batch.quantity} in stock for ${item.medicine_name}; added ${qty} instead.`);
      }

      await addMedicine(billId, {
        batch_id: batch.batch_id,
        quantity: qty,
        prescription_item_id: item.prescription_item_id,
      });
      onAdded();
    } catch(e) {
      onError("Failed to add medicine: " + String(e));
    } finally {
      setAdding(prev => { const s = new Set(prev); s.delete(item.prescription_item_id); return s; });
    }
  };

  if (!prescriptionId) return null;

  return (
    <div style={{ marginBottom:20, padding:"14px 16px", borderRadius:10, background:"#FFF5E6", border:`1px solid #FFD966` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <p style={{ fontSize:12, fontWeight:700, color:"#92400E", margin:0, textTransform:"uppercase", letterSpacing:"0.5px" }}>
          📋 Prescribed Medicines
        </p>
        <button
          onClick={onClose}
          style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:"#94A3B8" }}>
          <Ico d={ICONS.x} size={16} />
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize:12, color:"#64748B", margin:0 }}>Loading medicines…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize:12, color:"#64748B", margin:0 }}>No prescribed medicines found.</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {items.map(item => (
            <div key={item.prescription_item_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:11, fontWeight:600, color:"#0F172A", margin:0 }}>{item.medicine_name}</p>
                <p style={{ fontSize:10, color:"#64748B", margin:"2px 0 0" }}>Prescribed: {item.prescribed_quantity}</p>
              </div>
              <input
                type="number"
                min="1"
                value={qtyOverrides[item.prescription_item_id] ?? item.prescribed_quantity ?? 1}
                onChange={(e) => setQtyOverrides(prev => ({ ...prev, [item.prescription_item_id]: e.target.value }))}
                title="Edit quantity before adding to bill"
                style={{ width:52, padding:"5px 6px", borderRadius:6, border:"1.5px solid #E5E7EB", fontSize:11, textAlign:"center" }}
              />
              <button
                onClick={() => handleAddMedicine(item)}
                disabled={adding.has(item.prescription_item_id)}
                style={{ padding:"6px 12px", borderRadius:6, border:"none", background:adding.has(item.prescription_item_id)?"#D1D5DB":G, color:"#fff", fontWeight:600, fontSize:11, cursor:adding.has(item.prescription_item_id)?"not-allowed":"pointer" }}>
                {adding.has(item.prescription_item_id) ? "…" : "Add"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Medicine Form ───────────────────────────────────────────────
function AddMedicineForm({ billId, batches, onAdded, onError }) {
  const [search, setSearch] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const selectedBatch = batches.find(b => b.batch_id === selectedBatchId);
  const availableForSelected = selectedBatch
    ? Math.max(0, (selectedBatch.quantity || 0) - (selectedBatch.allocated_quantity || 0))
    : 0;

  // Search matches on brand name, batch number, AND the medicine's knowledge
  // fields — generic name, category, and description — so a pharmacist can
  // find "Paracetamol" by typing the generic name, a category like
  // "Antibiotic", or a word from the description, not just the brand.
  const filteredBatches = batches.filter(b => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = (b.medicine_name || b.medicine || "").toLowerCase();
    const batchNum = (b.batch_number || "").toLowerCase();
    const genericName = (b.medicine_generic_name || "").toLowerCase();
    const category = (b.medicine_category || "").toLowerCase();
    const description = (b.medicine_description || "").toLowerCase();
    return (
      name.includes(q) ||
      batchNum.includes(q) ||
      genericName.includes(q) ||
      category.includes(q) ||
      description.includes(q)
    );
  });

  const handleSelect = (batch) => {
    const available = Math.max(0, (batch.quantity || 0) - (batch.allocated_quantity || 0));
    if (available <= 0) return;   // out of stock — cannot select
    setSelectedBatchId(batch.batch_id);
    setSearch(`${batch.medicine_name || batch.medicine} (${batch.batch_number})`);
    setShowDropdown(false);
    setQty(1);
  };

  const handleAdd = async () => {
    if (!selectedBatchId || qty < 1 || qty > availableForSelected) return;
    setSaving(true);
    try {
      await addMedicine(billId, { batch_id: Number(selectedBatchId), quantity: Number(qty) });
      setSelectedBatchId("");
      setSearch("");
      setQty(1);
      onAdded();
    } catch(e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ marginTop:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 80px auto", gap:8, position:"relative" }}>
        <div style={{ position:"relative" }} ref={dropdownRef}>
          <div style={{ position:"relative" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8"
              style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input
              type="text"
              placeholder="Search by name, generic name, category, or batch…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              style={{ ...INP, paddingLeft:32 }}
            />
          </div>

          {showDropdown && (
            <div style={{
              position:"absolute",
              top:"100%",
              left:0,
              right:0,
              marginTop:4,
              background:"#fff",
              border:"1px solid #E5E7EB",
              borderRadius:8,
              boxShadow:"0 4px 12px rgba(0,0,0,0.1)",
              zIndex:10,
              maxHeight:300,
              overflowY:"auto",
            }}>
              {filteredBatches.length === 0 ? (
                <div style={{ padding:"12px 14px", fontSize:12, color:"#94A3B8", textAlign:"center" }}>
                  {batches.length === 0 ? "No medicines available" : "No matches found"}
                </div>
              ) : (
                filteredBatches.map(batch => {
                  const available = Math.max(0, (batch.quantity || 0) - (batch.allocated_quantity || 0));
                  const outOfStock = available <= 0;
                  return (
                    <div
                      key={batch.batch_id}
                      onClick={() => handleSelect(batch)}
                      style={{
                        padding:"10px 14px",
                        borderBottom:"1px solid #F1F5F9",
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        background:selectedBatchId === batch.batch_id ? "#F5F3FF" : "#fff",
                        opacity: outOfStock ? 0.55 : 1,
                        transition:"background 0.2s",
                      }}
                      onMouseOver={(e) => !outOfStock && !selectedBatchId && (e.target.style.background = "#F8FAFC")}
                      onMouseOut={(e) => !outOfStock && !selectedBatchId && (e.target.style.background = "#fff")}
                    >
                      <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>
                        {batch.medicine_name || batch.medicine}
                      </div>
                      {(batch.medicine_category || batch.medicine_generic_name) && (
                        <div style={{ fontSize:10.5, color:"#8B5CF6", marginTop:2 }}>
                          {batch.medicine_category || "General"}{batch.medicine_generic_name ? ` • ${batch.medicine_generic_name}` : ""}
                        </div>
                      )}
                      <div style={{ fontSize:11, color: outOfStock ? "#B91C1C" : "#64748B", marginTop:2 }}>
                        Batch {batch.batch_number} • Stock: {available}{outOfStock ? " (out of stock)" : ""} • ₹{batch.mrp}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <input
          type="number"
          min={1}
          max={availableForSelected || 999}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ ...INP, textAlign:"center" }}
        />
        <button
          onClick={handleAdd}
          disabled={!selectedBatchId || saving || qty < 1 || qty > availableForSelected}
          style={{
            padding:"9px 18px",
            borderRadius:8,
            border:"none",
            background:(!selectedBatchId || saving || qty < 1 || qty > availableForSelected) ? "#E9D5FF" : G,
            color:"#fff",
            fontWeight:700,
            fontSize:13,
            cursor:(!selectedBatchId || saving || qty < 1 || qty > availableForSelected) ? "not-allowed" : "pointer",
          }}>
          {saving ? "…" : "Add"}
        </button>
      </div>
      {selectedBatchId && availableForSelected <= 0 && (
        <p style={{ fontSize:11.5, color:"#B91C1C", margin:"6px 0 0", fontWeight:600 }}>
          This batch is out of stock.
        </p>
      )}
    </div>
  );
}

// ── Add Procedure Form ──────────────────────────────────────────────
function AddProcedureForm({ billId, procedures, onAdded, onError }) {
  const [search, setSearch] = useState("");
  const [selectedProcedureId, setSelectedProcedureId] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const filteredProcedures = procedures.filter(p => {
    const q = search.toLowerCase();
    const name = (p.name || "").toLowerCase();
    return !q || name.includes(q);
  });

  const handleSelect = (procedure) => {
    setSelectedProcedureId(procedure.procedure_id || procedure.id);
    setSearch(procedure.name);
    setShowDropdown(false);
  };

  const handleAdd = async () => {
    if (!selectedProcedureId || qty < 1) return;
    setSaving(true);
    try {
      await addProcedure(billId, { procedure_id: Number(selectedProcedureId), quantity: Number(qty) });
      setSelectedProcedureId("");
      setSearch("");
      setQty(1);
      onAdded();
    } catch(e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ marginTop:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 80px auto", gap:8, position:"relative" }}>
        <div style={{ position:"relative" }} ref={dropdownRef}>
          <div style={{ position:"relative" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8"
              style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input
              type="text"
              placeholder="Search procedure…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              style={{ ...INP, paddingLeft:32 }}
            />
          </div>

          {showDropdown && (
            <div style={{
              position:"absolute",
              top:"100%",
              left:0,
              right:0,
              marginTop:4,
              background:"#fff",
              border:"1px solid #E5E7EB",
              borderRadius:8,
              boxShadow:"0 4px 12px rgba(0,0,0,0.1)",
              zIndex:10,
              maxHeight:300,
              overflowY:"auto",
            }}>
              {filteredProcedures.length === 0 ? (
                <div style={{ padding:"12px 14px", fontSize:12, color:"#94A3B8", textAlign:"center" }}>
                  {procedures.length === 0 ? "No procedures available" : "No matches found"}
                </div>
              ) : (
                filteredProcedures.map(procedure => (
                  <div
                    key={procedure.procedure_id || procedure.id}
                    onClick={() => handleSelect(procedure)}
                    style={{
                      padding:"10px 14px",
                      borderBottom:"1px solid #F1F5F9",
                      cursor:"pointer",
                      background:selectedProcedureId === (procedure.procedure_id || procedure.id) ? "#F5F3FF" : "#fff",
                      transition:"background 0.2s",
                    }}
                    onMouseOver={(e) => !selectedProcedureId && (e.target.style.background = "#F8FAFC")}
                    onMouseOut={(e) => !selectedProcedureId && (e.target.style.background = "#fff")}
                  >
                    <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>
                      {procedure.name}
                    </div>
                    <div style={{ fontSize:11, color:"#64748B", marginTop:2 }}>
                      Charge: ₹{procedure.charge || 0}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ ...INP, textAlign:"center" }}
        />
        <button
          onClick={handleAdd}
          disabled={!selectedProcedureId || saving}
          style={{
            padding:"9px 18px",
            borderRadius:8,
            border:"none",
            background:!selectedProcedureId || saving ? "#E9D5FF" : G,
            color:"#fff",
            fontWeight:700,
            fontSize:13,
            cursor:(!selectedProcedureId || saving) ? "not-allowed" : "pointer",
          }}>
          {saving ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

// ── Add General Item (FMCG) Form ────────────────────────────────────
// Unlike medicines/procedures (preloaded lists), general items are looked
// up live via GET /general-items/search/ (debounced) since the catalog can
// be large. Selecting an item reveals its ACTIVE batches so the pharmacist
// can add a specific batch by id (POST /bills/<id>/add-general-item/).
function AddGeneralItemForm({ billId, onAdded, onError }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!search.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await searchGeneralItems(search.trim(), 12);
        setResults(Array.isArray(resp) ? resp : (resp?.results ?? []));
      } catch (e) {
        onError(String(e));
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = (item) => {
    if (item.stock_status === "OUT_OF_STOCK") return;   // out of stock — cannot select
    setSelectedItem(item);
    setSearch(item.name);
    setShowDropdown(false);
    const firstBatch = (item.batches || [])[0];
    setSelectedBatchId(firstBatch ? String(firstBatch.batch_id) : "");
  };

  const availableBatches = selectedItem?.batches || [];
  const selectedBatch = availableBatches.find(b => String(b.batch_id) === String(selectedBatchId));
  const availableForSelected = selectedBatch
    ? Math.max(0, (selectedBatch.quantity || 0) - (selectedBatch.allocated_quantity || 0))
    : 0;

  const handleAdd = async () => {
    if (!selectedBatchId || qty < 1 || qty > availableForSelected) return;
    setSaving(true);
    try {
      await addGeneralItem(billId, { batch_id: Number(selectedBatchId), quantity: Number(qty) });
      setSelectedItem(null);
      setSelectedBatchId("");
      setSearch("");
      setQty(1);
      onAdded();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <div style={{ position: "relative" }}>
          <Ico d={ICONS.search} size={13} color="#94A3B8"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search by name, brand, category, or description…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedItem(null); setSelectedBatchId(""); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            style={{ ...INP, paddingLeft: 32 }}
          />
        </div>

        {showDropdown && search.trim() && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: 300, overflowY: "auto",
          }}>
            {searching ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>No matches found</div>
            ) : (
              results.map(item => {
                const outOfStock = item.stock_status === "OUT_OF_STOCK";
                return (
                  <div key={item.item_id} onClick={() => handleSelectItem(item)}
                    style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", cursor: outOfStock ? "not-allowed" : "pointer", opacity: outOfStock ? 0.55 : 1 }}
                    onMouseOver={(e) => !outOfStock && (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseOut={(e) => !outOfStock && (e.currentTarget.style.background = "#fff")}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                      {item.name}{item.brand ? ` — ${item.brand}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: outOfStock ? "#B91C1C" : "#64748B", marginTop: 2 }}>
                      {item.category_display} · Stock: {item.stock_quantity} {outOfStock ? "(out of stock)" : ""}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedItem && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginTop: 8 }}>
          <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={INP}>
            {availableBatches.length === 0 ? (
              <option value="">No active stock</option>
            ) : availableBatches.map(b => {
              const available = Math.max(0, (b.quantity || 0) - (b.allocated_quantity || 0));
              return (
                <option key={b.batch_id} value={b.batch_id} disabled={available <= 0}>
                  Batch {b.batch_number} — {available} in stock @ ₹{parseFloat(b.mrp || 0).toFixed(2)}{available <= 0 ? " (out of stock)" : ""}
                </option>
              );
            })}
          </select>
          <input type="number" min={1} max={availableForSelected || 999} value={qty} onChange={(e) => setQty(e.target.value)} style={{ ...INP, textAlign: "center" }} />
          <button onClick={handleAdd} disabled={!selectedBatchId || saving || qty < 1 || qty > availableForSelected}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none",
              background: (!selectedBatchId || saving || qty < 1 || qty > availableForSelected) ? "#BAE6FD" : "#0EA5E9",
              color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: (!selectedBatchId || saving) ? "not-allowed" : "pointer",
            }}>
            {saving ? "…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bill Detail Component ───────────────────────────────────────────
function BillDetail({ billId, onClose, onRefreshList }) {
  const navigate = useNavigate();
  const [bill, setBill]          = useState(null);
  const [batches, setBatches]    = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading]    = useState(true);
  const [busy, setBusy]          = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  const [upiRef, setUpiRef]      = useState("");
  const [toast, setToast]        = useState(null);
  const [removing, setRemoving]  = useState(null);
  const [showPrescribed, setShowPrescribed] = useState(true);
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showAddProcedure, setShowAddProcedure] = useState(false);
  const [showAddGeneralItem, setShowAddGeneralItem] = useState(false);
  const [editingGenItem, setEditingGenItem] = useState(null);
  const [editGenQty, setEditGenQty] = useState("");
  const [savingGenEdit, setSavingGenEdit] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [dispensed, setDispensed] = useState(new Set());
  const [editingMedItem, setEditingMedItem] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingProcItem, setEditingProcItem] = useState(null);
  const [editProcQty, setEditProcQty] = useState("");
  const [savingProcEdit, setSavingProcEdit] = useState(false);
  const [newProcName, setNewProcName] = useState("");
  const [newProcAmount, setNewProcAmount] = useState("");
  const [creatingProc, setCreatingProc] = useState(false);
  const [discountInput, setDiscountInput] = useState("0");
  const [discountSaving, setDiscountSaving] = useState(false);

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, batchData, procData] = await Promise.all([
        getBillDetail(billId), 
        getBatches({ available:"true" }),
        // ✅ FIXED: Better response parsing for procedures. page_size=100
        // avoids silently truncating to the default page size of 10 when
        // the admin catalog grows past one page.
        API.get("/administration/procedures/", { params: { page_size: 100 } }).then(r => {
          const data = r.data;
          if (Array.isArray(data)) return data;
          if (data?.results) return data.results;
          if (data?.data) return data.data;
          return [];
        }).catch(e => {
          console.error("Failed to fetch procedures from /administration/procedures/:", e);
          console.warn("Attempting fallback endpoint...");
          return [];
        })
      ]);
      const billData = resp?.bill ?? resp;
      setBill(billData);
      setDiscountInput(String(billData?.discount_amount ?? "0"));
      setBatches(Array.isArray(batchData) ? batchData : batchData?.results ?? []);
      setProcedures(Array.isArray(procData) ? procData : procData?.results ?? []);
      
      setDispensed(new Set());
    } catch(e) { 
      console.error("Error loading bill detail:", e);
      showToast(String(e), false); 
    }
    finally { setLoading(false); }
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveMedicine = async (itemId) => {
    setRemoving(itemId);
    try {
      await removeMedicineItem(billId, itemId);
      showToast("Medicine removed");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setRemoving(null); }
  };

  const handleRemoveProcedure = async (itemId) => {
    setRemoving(itemId);
    try {
      await removeProcedureItem(billId, itemId);
      showToast("Procedure removed");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setRemoving(null); }
  };

  const handleStartEditMedicine = (item) => {
    setEditingMedItem(item.item_id);
    setEditQty(String(item.quantity));
  };

  const handleCancelEditMedicine = () => {
    setEditingMedItem(null);
    setEditQty("");
  };

  const handleSaveEditMedicine = async (itemId) => {
    const qty = parseInt(editQty, 10);
    if (!qty || qty < 1) {
      showToast("Enter a valid quantity", false);
      return;
    }
    setSavingEdit(true);
    try {
      await updateMedicineItem(billId, itemId, { quantity: qty });
      showToast("Medicine quantity updated");
      setEditingMedItem(null);
      setEditQty("");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setSavingEdit(false); }
  };

  // Manually add a one-off procedure line to THIS bill only. Does not
  // create/save anything in the admin procedure catalog — it's just a line
  // item on this bill, so it won't reappear as a pickable option next time
  // (that's expected: it's a manual add, not catalog creation).
  const handleCreateInstantProcedure = async () => {
    if (!newProcName.trim() || !newProcAmount || parseFloat(newProcAmount) <= 0) {
      showToast("Please fill procedure name and amount", false);
      return;
    }
    setCreatingProc(true);
    try {
      await addProcedure(billId, {
        amount: parseFloat(newProcAmount),
        description: newProcName.trim(),
      });
      showToast(`✓ ${newProcName.trim()} added`);
      setNewProcName("");
      setNewProcAmount("");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setCreatingProc(false); }
  };

  const handleStartEditProcedure = (item) => {
    setEditingProcItem(item.item_id);
    setEditProcQty(String(item.quantity));
  };

  const handleCancelEditProcedure = () => {
    setEditingProcItem(null);
    setEditProcQty("");
  };

  const handleSaveEditProcedure = async (itemId) => {
    const qty = parseInt(editProcQty, 10);
    if (!qty || qty < 1) {
      showToast("Enter a valid quantity", false);
      return;
    }
    setSavingProcEdit(true);
    try {
      await updateProcedureItem(billId, itemId, { quantity: qty });
      showToast("Procedure quantity updated");
      setEditingProcItem(null);
      setEditProcQty("");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setSavingProcEdit(false); }
  };

  const handleApplyDiscount = async () => {
    const discountVal = parseFloat(discountInput || 0);
    if (isNaN(discountVal) || discountVal < 0) {
      showToast("Discount amount cannot be negative", false);
      return;
    }
    const subtotalForCheck = parseFloat(bill.subtotal ?? 0);
    if (discountVal > subtotalForCheck) {
      showToast(`Discount cannot exceed the subtotal (₹${subtotalForCheck.toFixed(2)})`, false);
      return;
    }
    setDiscountSaving(true);
    try {
      await setBillDiscount(billId, discountVal);
      showToast("Discount updated");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setDiscountSaving(false); }
  };

  // ── General/FMCG item line handlers (DELETE / PATCH quantity) ──────
  const handleRemoveGeneralItem = async (itemId) => {
    setRemoving(itemId);
    try {
      await removeGeneralItem(billId, itemId);
      showToast("Item removed");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setRemoving(null); }
  };

  const handleStartEditGeneralItem = (item) => {
    setEditingGenItem(item.item_id);
    setEditGenQty(String(item.quantity));
  };

  const handleCancelEditGeneralItem = () => {
    setEditingGenItem(null);
    setEditGenQty("");
  };

  const handleSaveEditGeneralItem = async (itemId) => {
    const qty = parseInt(editGenQty, 10);
    if (!qty || qty < 1) {
      showToast("Enter a valid quantity", false);
      return;
    }
    setSavingGenEdit(true);
    try {
      await updateGeneralItemBillItem(billId, itemId, { quantity: qty });
      showToast("Quantity updated");
      setEditingGenItem(null);
      setEditGenQty("");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setSavingGenEdit(false); }
  };

  // ✅ FIXED: Transition to OPEN before completing
  const handleComplete = async () => {
    setBusy(true);
    try {
      const billData = Array.isArray(bill) ? bill[0] : bill;
      
      // First transition to OPEN if still in DRAFT
      if (billData?.bill_status === 'DRAFT') {
        console.log("Transitioning bill to OPEN status...");
        await transitionBillToOpen(billId);
      }
      
      // Then complete
      console.log("Completing bill...");
      await completeBill(billId);
      showToast("✓ Bill completed!");
      await load();
    } catch(e) { 
      console.error("Failed to complete bill:", e);
      showToast(String(e), false); 
    }
    finally { setBusy(false); }
  };

  const handleTransitionToOpen = async () => {
    setBusy(true);
    try {
      await transitionBillToOpen(billId);
      showToast("Bill opened! Now you can complete it.");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setBusy(false); }
  };

  const handleMarkPaid = async () => {
    if (payMethod === "UPI" && !upiRef.trim()) {
      showToast("UPI Reference is required when paying by UPI", false);
      return;
    }

    setBusy(true);
    try {
      await markBillPaid(billId, { payment_method: payMethod, upi_reference: payMethod === "UPI" ? upiRef : "" });
      showToast("✓ Payment received! Bill marked PAID", true);
      setShowPaymentModal(false);
      await load();
      onRefreshList();
    } catch(e) { showToast(String(e), false); }
    finally { setBusy(false); }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await reopenBill(billId);
      showToast("Bill reopened!");
      await load();
    } catch(e) { showToast(String(e), false); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure? This action cannot be undone.")) return;
    setBusy(true);
    try {
      await cancelBill(billId);
      showToast("Bill cancelled");
      onClose();
      onRefreshList();
    } catch(e) { showToast(String(e), false); }
    finally { setBusy(false); }
  };

  const handleToggleDispense = (itemId) => {
    const newDispensed = new Set(dispensed);
    if (newDispensed.has(itemId)) {
      newDispensed.delete(itemId);
    } else {
      newDispensed.add(itemId);
    }
    setDispensed(newDispensed);
  };

  if (loading) return <div style={{ textAlign:"center", padding:40 }}>Loading…</div>;
  if (!bill) return <div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>Bill not found</div>;

  const canAddRemoveItems = bill.can_add_items;

  const medicineTotalAmount = (bill.medicine_items || []).reduce((sum, item) => {
    return sum + (parseFloat(item.item_total) || 0);
  }, 0);

  const procedureTotalAmount = (bill.procedure_items || []).reduce((sum, item) => {
    return sum + (parseFloat(item.item_total) || 0);
  }, 0);

  const generalItemsTotalAmount = (bill.general_items || []).reduce((sum, item) => {
    return sum + (parseFloat(item.item_total) || 0);
  }, 0);

  return (
    <div>
      <Toast msg={toast?.msg} ok={toast?.ok} />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:"#0F172A", margin:"0 0 4px" }}>{bill.bill_number}</h1>
          <p style={{ fontSize:12, color:"#64748B", margin:0 }}>{bill.patient_info?.name || bill.patient_name || "Walk-in"} • {new Date(bill.bill_date).toLocaleDateString("en-IN")}</p>
        </div>
        <StatusChip status={bill.bill_status} />
      </div>

      <Stepper status={bill.bill_status} />

      {!canAddRemoveItems && (
        <div style={{ 
          padding: "12px 14px", 
          borderRadius: 8, 
          background: "#FEF3C7", 
          border: "1px solid #FCD34D", 
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <Ico d={ICONS.alert} size={16} color="#92400E" />
          <p style={{ fontSize: 12, color: "#92400E", margin: 0, fontWeight: 500 }}>
            Bill is in <strong>{bill.bill_status}</strong> status. Items cannot be modified.
          </p>
        </div>
      )}

      {(bill.bill_status === "DRAFT" || bill.bill_status === "OPEN" || bill.bill_status === "READY") && bill.prescription && showPrescribed && (
        <PrescribedMedicines
          billId={billId}
          prescriptionId={bill.prescription}
          onAdded={load}
          onError={showToast}
          onClose={() => setShowPrescribed(false)}
        />
      )}

      {/* ── MEDICINE ITEMS ── */}
      <div style={{ marginBottom:20 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:"#0F172A", margin:"0 0 12px" }}>Medicine Items</h3>
        {bill.medicine_items && bill.medicine_items.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {bill.medicine_items.map(item => (
              <div key={item.item_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:8, background:"#F8FAFC", border:"1px solid #E5E7EB", gap:8 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:"#0F172A", margin:0 }}>{item.medicine_name}</p>
                  {editingMedItem === item.item_id ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                      <span style={{ fontSize:11, color:"#64748B" }}>Batch: {item.batch_number} • Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        style={{ width:60, padding:"4px 6px", borderRadius:6, border:"1.5px solid #E5E7EB", fontSize:12 }}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize:11, color:"#64748B", margin:"2px 0 0" }}>Batch: {item.batch_number} • Qty: {item.quantity} • ₹{parseFloat(item.item_total||0).toFixed(2)}</p>
                  )}
                  {formatDosage(item) && (
                    <p style={{ fontSize:11, color:G, fontWeight:600, margin:"3px 0 0" }}>
                      {formatDosage(item)}
                    </p>
                  )}
                  {item.instructions && (
                    <p style={{ fontSize:11, color:"#94A3B8", fontStyle:"italic", margin:"2px 0 0" }}>
                      {item.instructions}
                    </p>
                  )}
                </div>
                {editingMedItem === item.item_id ? (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => handleSaveEditMedicine(item.item_id)}
                      disabled={savingEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#DCFCE7", color:"#166534", fontWeight:600, fontSize:11, cursor: savingEdit ? "not-allowed" : "pointer" }}>
                      {savingEdit ? "…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEditMedicine}
                      disabled={savingEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:11, cursor: savingEdit ? "not-allowed" : "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => {
                        if (!canAddRemoveItems) {
                          showToast(`Cannot edit items on a ${bill.bill_status} bill`, false);
                          return;
                        }
                        handleStartEditMedicine(item);
                      }}
                      disabled={!canAddRemoveItems}
                      style={{
                        padding:"6px 10px",
                        borderRadius:6,
                        border:"none",
                        background: canAddRemoveItems ? "#EDE9FE" : "#F3F4F6",
                        color: canAddRemoveItems ? G : "#9CA3AF",
                        fontWeight:600,
                        fontSize:11,
                        cursor: canAddRemoveItems ? "pointer" : "not-allowed",
                        opacity: canAddRemoveItems ? 1 : 0.6
                      }}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!canAddRemoveItems) {
                          showToast(`Cannot remove items from a ${bill.bill_status} bill`, false);
                          return;
                        }
                        handleRemoveMedicine(item.item_id);
                      }}
                      disabled={removing === item.item_id || !canAddRemoveItems}
                      style={{ 
                        padding:"6px 10px", 
                        borderRadius:6, 
                        border:"none", 
                        background: canAddRemoveItems ? "#FEE2E2" : "#F3F4F6",
                        color: canAddRemoveItems ? "#B91C1C" : "#9CA3AF",
                        fontWeight:600, 
                        fontSize:11, 
                        cursor: (removing === item.item_id || !canAddRemoveItems) ? "not-allowed" : "pointer",
                        opacity: canAddRemoveItems ? 1 : 0.6
                      }}>
                      {removing === item.item_id ? "…" : "Remove"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize:12, color:"#94A3B8", margin:0 }}>No medicines added</p>
        )}
        {canAddRemoveItems && (
          <>
            {!showAddMedicine ? (
              <button
                onClick={() => setShowAddMedicine(true)}
                style={{ width:"100%", padding:"9px", borderRadius:8, border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontWeight:600, fontSize:12, cursor:"pointer", marginTop:8 }}>
                + Add Medicine
              </button>
            ) : (
              <>
                <AddMedicineForm billId={billId} batches={batches} onAdded={load} onError={showToast} />
                <button
                  onClick={() => setShowAddMedicine(false)}
                  style={{ width:"100%", padding:"6px", borderRadius:6, border:"none", background:"#E9D5FF", color:G, fontWeight:600, fontSize:11, cursor:"pointer", marginTop:6 }}>
                  Cancel
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── PROCEDURE ITEMS ── */}
      <div style={{ marginBottom:20 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:"#0F172A", margin:"0 0 12px" }}>Procedures</h3>
        {bill.procedure_items && bill.procedure_items.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {bill.procedure_items.map(item => (
              <div key={item.item_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:8, background:"#F8FAFC", border:"1px solid #E5E7EB", gap:8 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:"#0F172A", margin:0 }}>{item.procedure_name}</p>
                  {editingProcItem === item.item_id ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                      <span style={{ fontSize:11, color:"#64748B" }}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={editProcQty}
                        onChange={(e) => setEditProcQty(e.target.value)}
                        style={{ width:60, padding:"4px 6px", borderRadius:6, border:"1.5px solid #E5E7EB", fontSize:12 }}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize:11, color:"#64748B", margin:"2px 0 0" }}>Qty: {item.quantity} • ₹{parseFloat(item.item_total||0).toFixed(2)}</p>
                  )}
                </div>
                {editingProcItem === item.item_id ? (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => handleSaveEditProcedure(item.item_id)}
                      disabled={savingProcEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#DCFCE7", color:"#166534", fontWeight:600, fontSize:11, cursor: savingProcEdit ? "not-allowed" : "pointer" }}>
                      {savingProcEdit ? "…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEditProcedure}
                      disabled={savingProcEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:11, cursor: savingProcEdit ? "not-allowed" : "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : canAddRemoveItems && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => handleStartEditProcedure(item)}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#EDE9FE", color:G, fontWeight:600, fontSize:11, cursor:"pointer" }}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemoveProcedure(item.item_id)}
                      disabled={removing === item.item_id}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#FEE2E2", color:"#B91C1C", fontWeight:600, fontSize:11, cursor:removing === item.item_id?"not-allowed":"pointer" }}>
                      {removing === item.item_id ? "…" : "Remove"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize:12, color:"#94A3B8", margin:0 }}>No procedures added</p>
        )}
        {canAddRemoveItems && (
          <>
            {!showAddProcedure ? (
              <button
                onClick={() => setShowAddProcedure(true)}
                style={{ width:"100%", padding:"9px", borderRadius:8, border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontWeight:600, fontSize:12, cursor:"pointer", marginTop:8 }}>
                + Add Procedure
              </button>
            ) : (
              <>
                {procedures.length > 0 ? (
                  <AddProcedureForm billId={billId} procedures={procedures} onAdded={load} onError={showToast} />
                ) : (
                  <div style={{ padding: "12px", background: "#FEF3C7", borderRadius: 8, marginTop: 8 }}>
                    <p style={{ fontSize:11, color:"#92400E", margin:0, fontWeight:600 }}>⚠️ No procedures available</p>
                    <p style={{ fontSize:10, color:"#92400E", margin:"4px 0 0" }}>Please contact admin to add procedures to the system.</p>
                  </div>
                )}

                {/* ── Manually add a one-off procedure line to this bill only ── */}
                <div style={{ marginTop:10, padding:"10px 12px", borderRadius:8, background:"#FFFBEB", border:"1px solid #FDE68A" }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#92400E", textTransform:"uppercase", margin:"0 0 8px" }}>Add Procedure Manually</p>
                  <input
                    type="text"
                    placeholder="Procedure name (e.g., Dressing, Injection)…"
                    value={newProcName}
                    onChange={(e) => setNewProcName(e.target.value)}
                    style={{ ...INP, marginBottom:6 }}
                  />
                  <div style={{ display:"flex", gap:6 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount (₹)"
                      value={newProcAmount}
                      onChange={(e) => setNewProcAmount(e.target.value)}
                      style={{ ...INP, flex:1 }}
                    />
                    <button
                      onClick={handleCreateInstantProcedure}
                      disabled={creatingProc || !newProcName.trim() || !newProcAmount}
                      style={{
                        padding:"0 16px",
                        borderRadius:8,
                        border:"none",
                        background: (newProcName.trim() && newProcAmount) ? "#F59E0B" : "#E5E7EB",
                        color:"#fff",
                        fontWeight:700,
                        fontSize:12,
                        cursor: (newProcName.trim() && newProcAmount) ? "pointer" : "not-allowed",
                      }}>
                      {creatingProc ? "…" : "Add"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddProcedure(false)}
                  style={{ width:"100%", padding:"6px", borderRadius:6, border:"none", background:"#E9D5FF", color:G, fontWeight:600, fontSize:11, cursor:"pointer", marginTop:6 }}>
                  Cancel
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── GENERAL ITEMS (non-medicine retail: diapers, soap, tissues, etc.) ── */}
      <div style={{ marginBottom:20 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:"#0F172A", margin:"0 0 12px" }}>General Items</h3>
        {bill.general_items && bill.general_items.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {bill.general_items.map(item => (
              <div key={item.item_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:8, background:"#F8FAFC", border:"1px solid #E5E7EB", gap:8 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:"#0F172A", margin:0 }}>
                    {item.item_name}{item.brand ? ` — ${item.brand}` : ""}
                  </p>
                  {editingGenItem === item.item_id ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                      <span style={{ fontSize:11, color:"#64748B" }}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={editGenQty}
                        onChange={(e) => setEditGenQty(e.target.value)}
                        style={{ width:60, padding:"4px 6px", borderRadius:6, border:"1.5px solid #E5E7EB", fontSize:12 }}
                      />
                    </div>
                  ) : (
                    <p style={{ fontSize:11, color:"#64748B", margin:"2px 0 0" }}>
                      Batch {item.batch_number} • Qty: {item.quantity} • ₹{parseFloat(item.item_total||0).toFixed(2)}
                    </p>
                  )}
                </div>
                {editingGenItem === item.item_id ? (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => handleSaveEditGeneralItem(item.item_id)}
                      disabled={savingGenEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#DCFCE7", color:"#166534", fontWeight:600, fontSize:11, cursor: savingGenEdit ? "not-allowed" : "pointer" }}>
                      {savingGenEdit ? "…" : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEditGeneralItem}
                      disabled={savingGenEdit}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#F1F5F9", color:"#64748B", fontWeight:600, fontSize:11, cursor: savingGenEdit ? "not-allowed" : "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : canAddRemoveItems && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => handleStartEditGeneralItem(item)}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#E0F2FE", color:"#0EA5E9", fontWeight:600, fontSize:11, cursor:"pointer" }}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemoveGeneralItem(item.item_id)}
                      disabled={removing === item.item_id}
                      style={{ padding:"6px 10px", borderRadius:6, border:"none", background:"#FEE2E2", color:"#B91C1C", fontWeight:600, fontSize:11, cursor:removing === item.item_id?"not-allowed":"pointer" }}>
                      {removing === item.item_id ? "…" : "Remove"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize:12, color:"#94A3B8", margin:0 }}>No general items added</p>
        )}
        {canAddRemoveItems && (
          <>
            {!showAddGeneralItem ? (
              <button
                onClick={() => setShowAddGeneralItem(true)}
                style={{ width:"100%", padding:"9px", borderRadius:8, border:"1.5px solid #0EA5E9", background:"#0EA5E910", color:"#0EA5E9", fontWeight:600, fontSize:12, cursor:"pointer", marginTop:8 }}>
                + Add General Item
              </button>
            ) : (
              <>
                <AddGeneralItemForm billId={billId} onAdded={load} onError={(msg) => showToast(msg, false)} />
                <button
                  onClick={() => setShowAddGeneralItem(false)}
                  style={{ width:"100%", padding:"6px", borderRadius:6, border:"none", background:"#E0F2FE", color:"#0EA5E9", fontWeight:600, fontSize:11, cursor:"pointer", marginTop:6 }}>
                  Cancel
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── BILL SUMMARY ── */}
      <div style={{ padding:"14px 16px", borderRadius:10, background:"#F8FAFC", border:"1px solid #E5E7EB", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <p style={{ fontSize:11, color:"#64748B", margin:0, fontWeight:600, textTransform:"uppercase" }}>Medicine Total</p>
            <p style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:"4px 0 0" }}>₹{medicineTotalAmount.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize:11, color:"#64748B", margin:0, fontWeight:600, textTransform:"uppercase" }}>Procedure Total</p>
            <p style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:"4px 0 0" }}>₹{procedureTotalAmount.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize:11, color:"#64748B", margin:0, fontWeight:600, textTransform:"uppercase" }}>General Items Total</p>
            <p style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:"4px 0 0" }}>₹{generalItemsTotalAmount.toFixed(2)}</p>
          </div>
        </div>
        <div style={{ borderTop:"1px solid #E5E7EB", paddingTop:12 }}>
          {parseFloat(bill.discount_amount ?? 0) > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <p style={{ fontSize:12, color:"#64748B", margin:0 }}>Subtotal</p>
              <p style={{ fontSize:13, fontWeight:600, color:"#0F172A", margin:0 }}>₹{parseFloat(bill.subtotal||0).toFixed(2)}</p>
            </div>
          )}
          {parseFloat(bill.discount_amount ?? 0) > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <p style={{ fontSize:12, color:"#DC2626", margin:0 }}>Discount</p>
              <p style={{ fontSize:13, fontWeight:600, color:"#DC2626", margin:0 }}>− ₹{parseFloat(bill.discount_amount).toFixed(2)}</p>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={{ fontSize:12, fontWeight:700, color:"#0F172A", margin:0 }}>Grand Total</p>
            <p style={{ fontSize:18, fontWeight:700, color:G, margin:0 }}>₹{parseFloat(bill.total_amount||0).toFixed(2)}</p>
          </div>

          {/* Discount input — only editable before the bill is PAID/CANCELLED */}
          {!["PAID", "CANCELLED"].includes(bill.bill_status) && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px dashed #E2E8F0" }}>
              <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", flexShrink:0 }}>Discount (₹)</label>
              <input
                type="number" min="0"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                style={{ flex:1, padding:"7px 10px", borderRadius:7, border:"1.5px solid #E2E8F0", fontSize:13, outline:"none" }}
                placeholder="0"
              />
              <button
                onClick={handleApplyDiscount}
                disabled={discountSaving}
                style={{ padding:"7px 14px", borderRadius:7, border:"none", background: discountSaving ? "#D1D5DB" : "#8B5CF6", color:"#fff", fontWeight:700, fontSize:12, cursor: discountSaving ? "not-allowed" : "pointer" }}>
                {discountSaving ? "…" : "Apply"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {bill.bill_status === "DRAFT" && (
          <button
            onClick={handleTransitionToOpen}
            disabled={busy || (bill.medicine_items?.length === 0 && bill.procedure_items?.length === 0 && bill.general_items?.length === 0)}
            style={{ 
              padding:"10px", 
              borderRadius:8, 
              border:"none", 
              background:busy || (bill.medicine_items?.length === 0 && bill.procedure_items?.length === 0 && bill.general_items?.length === 0)?"#D1D5DB":"#8B5CF6", 
              color:"#fff", 
              fontWeight:700, 
              fontSize:13, 
              cursor:busy || (bill.medicine_items?.length === 0 && bill.procedure_items?.length === 0 && bill.general_items?.length === 0)?"not-allowed":"pointer" 
            }}>
            {busy ? "…" : "→ Open Bill"}
          </button>
        )}
        
        {bill.bill_status === "OPEN" && (
          <button
            onClick={handleComplete}
            disabled={busy}
            style={{ 
              padding:"10px", 
              borderRadius:8, 
              border:"none", 
              background:busy?"#D1D5DB":"#8B5CF6", 
              color:"#fff", 
              fontWeight:700, 
              fontSize:13, 
              cursor:busy?"not-allowed":"pointer" 
            }}>
            {busy ? "…" : "✓ Complete Bill"}
          </button>
        )}
        
        {bill.bill_status === "COMPLETED" && (
          <>
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={busy}
              style={{ 
                padding:"10px", 
                borderRadius:8, 
                border:"none", 
                background:busy?"#D1D5DB":"#F59E0B", 
                color:"#fff", 
                fontWeight:700, 
                fontSize:13, 
                cursor:busy?"not-allowed":"pointer" 
              }}>
              {busy ? "…" : "💳 Collect Payment"}
            </button>
            
            <button
              onClick={handleReopen}
              disabled={busy}
              style={{ 
                padding:"10px", 
                borderRadius:8, 
                border:"1.5px solid #E5E7EB", 
                background:"#fff", 
                color:"#64748B", 
                fontWeight:700, 
                fontSize:13, 
                cursor:busy?"not-allowed":"pointer" 
              }}>
              {busy ? "…" : "↺ Reopen"}
            </button>
          </>
        )}

        {bill.bill_status === "PAID" && (
          <button
            onClick={() => navigate(`/pharmacy/bills/print/${billId}`)}
            style={{
              gridColumn: "1 / -1",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              padding:"10px",
              borderRadius:8,
              border:"none",
              background:G,
              color:"#fff",
              fontWeight:700,
              fontSize:13,
              cursor:"pointer",
            }}>
            <Ico d={ICONS.print} size={14} color="#fff" /> Print Bill
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{ width:"100%", padding:"10px", borderRadius:8, border:"1.5px solid #E5E7EB", background:"#fff", color:"#64748B", fontWeight:700, fontSize:13, cursor:"pointer" }}>
        ← Back
      </button>

      {/* ── COLLECT PAYMENT MODAL ── */}
      {/* ✅ FIX: setShowPaymentModal(true) was wired to the "Collect Payment"
          button, but no modal ever rendered for it — payment could never
          actually be collected from this page, so bills got stuck in
          COMPLETED and never moved to PAID (no dispensing/stock deduction). */}
      {showPaymentModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:"#fff", borderRadius:14, maxWidth:420, width:"90%", padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:0 }}>Collect Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} disabled={busy}
                style={{ background:"none", border:"none", cursor:busy?"not-allowed":"pointer", color:"#94A3B8" }}>
                <Ico d={ICONS.x} size={18} />
              </button>
            </div>

            <div style={{ padding:"12px 14px", borderRadius:10, background:"#F8FAFC", border:"1px solid #E5E7EB", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{bill.bill_number}</span>
                <span style={{ fontSize:18, fontWeight:800, color:G }}>₹{parseFloat(bill.total_amount||0).toFixed(2)}</span>
              </div>
              <p style={{ fontSize:11, color:"#94A3B8", margin:"4px 0 0" }}>
                Medicines will be dispensed and stock deducted once payment is confirmed.
              </p>
            </div>

            <label style={LBL}>Payment Method</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
              {PAY_OPTS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  disabled={busy}
                  style={{
                    padding:"10px",
                    borderRadius:8,
                    border: payMethod === m ? `1.5px solid ${G}` : "1.5px solid #E5E7EB",
                    background: payMethod === m ? `${G}15` : "#fff",
                    color: payMethod === m ? G : "#64748B",
                    fontWeight:700,
                    fontSize:12,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}>
                  {m}
                </button>
              ))}
            </div>

            {payMethod === "UPI" && (
              <div style={{ marginBottom:16 }}>
                <label style={LBL}>UPI Reference</label>
                <input
                  type="text"
                  placeholder="UPI transaction / reference ID"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  style={INP}
                />
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={busy}
                style={{ padding:"10px", borderRadius:8, border:"1.5px solid #E5E7EB", background:"#fff", color:"#64748B", fontWeight:700, cursor:busy?"not-allowed":"pointer" }}>
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={busy}
                style={{ padding:"10px", borderRadius:8, border:"none", background:busy?"#D1D5DB":G, color:"#fff", fontWeight:700, cursor:busy?"not-allowed":"pointer" }}>
                {busy ? "…" : "✓ Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Bills Page ──────────────────────────────────────────
export default function BillsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openBillId, setOpenBillId] = useState(params.get("open") || null);
  const [showWalkIn, setShowWalkIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBills({});
      setBills(Array.isArray(data) ? data : data?.results ?? []);
    } catch(e) {
      console.error("Failed to load bills:", e);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOpenBillId(params.get("open")); }, [params]);

  const filtered = bills.filter(b => {
    const q = search.toLowerCase();
    const patientName = (b.patient_info?.name || b.patient_name || b.walkin_name || "").toLowerCase();
    return !q || patientName.includes(q) || (b.bill_number||"").toLowerCase().includes(q);
  });

  if (openBillId) {
    return (
      <div style={{ fontFamily:"'Inter',sans-serif", maxWidth:800, margin:"0 auto" }}>
        <BillDetail
          billId={openBillId}
          onClose={() => setOpenBillId(null)}
          onRefreshList={load}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", maxWidth:900 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#0F172A", margin:0 }}>Bills</h1>
          <p style={{ fontSize:13, color:"#94A3B8", margin:"4px 0 0" }}>
            {loading ? "Loading…" : `${filtered.length} bill${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button 
            onClick={() => setShowWalkIn(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:"none", background:G, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            <Ico d={ICONS.plus} size={13} /> Walk-In Bill
          </button>
          <div style={{ position:"relative" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...INP, paddingLeft:32, width:200 }} />
          </div>
          <button onClick={() => { setLoading(true); load(); }}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:12, fontWeight:600, color:"#64748B" }}>
            <Ico d={ICONS.refresh} size={13} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:"center" }}>
          <div style={{ width:28, height:28, borderRadius:"50%", border:`3px solid ${G}20`, borderTop:`3px solid ${G}`, animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
          <p style={{ fontSize:13, color:"#94A3B8" }}>Loading bills…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:"60px 20px", textAlign:"center", background:"#fff", borderRadius:14, border:"1px solid #EEF2F7" }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:`${G}10`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            <Ico d={ICONS.bill} size={22} color={G} />
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:"#64748B", margin:0 }}>
            {search ? "No bills match your search." : "No bills found."}
          </p>
        </div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {filtered.map(bill => (
            <div key={bill.bill_id} onClick={() => setOpenBillId(bill.bill_id)}
              style={{ padding:"14px 16px", borderRadius:12, background:"#fff", border:"1px solid #EEF2F7", cursor:"pointer", transition:"all 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:"#0F172A", margin:"0 0 4px" }}>{bill.bill_number}</h3>
                  <p style={{ fontSize:12, color:"#64748B", margin:0 }}>
                    {bill.patient_info?.name || bill.patient_name || bill.walkin_name || "Walk-in"} • ₹{parseFloat(bill.total_amount||0).toFixed(2)}
                  </p>
                </div>
                <StatusChip status={bill.bill_status} />
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Walk-In Bill Modal */}
      {showWalkIn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 600, width: "95%", maxHeight: "90vh", overflow: "auto" }}>
            <WalkInBillPage 
              onClose={() => {
                setShowWalkIn(false);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}