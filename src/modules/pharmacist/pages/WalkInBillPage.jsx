// src/modules/pharmacist/pages/WalkInBillPage.jsx - SEARCH-BASED DESIGN
// ✅ FEATURES: 
//    - Search-based medicine selection (NO DROPDOWNS)
//    - Admin procedures fetching + Instant procedure creation
//    - Multiple medicines & procedures
// ✅ NO MODALS: Full-page integrated design
// ✅ DESIGN: Clean, search-first approach
//
// STEP ORDER: items → details → billing → payment → success
//   "items"   — stage medicines/procedures locally (no backend calls, no bill yet)
//   "details" — patient info form; on submit: createBill() + flush staged items → "billing"
//   "billing" — read-only review of items + Complete Bill action
//   "payment" — collect payment (unchanged)
//   "success" — confirmation (unchanged)

import { useState, useCallback, useEffect, useRef } from "react";
import { createBill, addMedicine, addProcedure, addGeneralItem, completeBill, transitionBillToOpen, markBillPaid, setBillDiscount } from "../api/pharmacistApi";
import API from "../../../api";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import { flattenFormError } from "../../../utils/formErrors";

const G = "#8B5CF6";
const COLORS = {
  primary: "#8B5CF6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  }
};

const INP = { 
  padding: "10px 12px", 
  borderRadius: 8, 
  border: "1.5px solid #E5E7EB", 
  fontSize: 13, 
  color: "#1E293B", 
  outline: "none", 
  background: "#fff", 
  width: "100%", 
  boxSizing: "border-box" 
};

const LBL = { 
  fontSize: 11, 
  fontWeight: 600, 
  color: "#64748B", 
  textTransform: "uppercase", 
  letterSpacing: "0.5px", 
  display: "block", 
  marginBottom: 6 
};

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  x: "M18 6 6 18 M6 6l12 12",
  plus: "M12 5v14 M5 12h14",
  check: "M20 6 9 17l-5-5",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  pill: "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  package: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10",
  box: "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4Z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
};

// ─── Utility Functions ───
const getPatientName = (patient) => {
  if (!patient) return "Walk-in";
  if (typeof patient === "string") return patient;
  return (
    patient.full_name ||
    patient.patient_name ||
    patient.name ||
    patient.patient?.full_name ||
    `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
    "Walk-in"
  );
};

const getPatientMRD = (patient) => {
  if (!patient) return "N/A";
  return patient.mrd_number || patient.mrd || "N/A";
};

const getPatientPhone = (patient) => {
  if (!patient) return "N/A";
  return (
    patient.phone ||
    patient.mobile ||
    patient.contact_number ||
    patient.phone_number ||
    patient.patient?.phone ||
    "N/A"
  );
};

function Toast({ msg, ok }) {
  if (!msg) return null;
  return (
    <div style={{ 
      position: "fixed", 
      top: 20, 
      right: 20, 
      zIndex: 9999, 
      padding: "11px 18px", 
      borderRadius: 10, 
      fontSize: 13, 
      fontWeight: 600, 
      background: ok ? "#F0FDF4" : "#FEF2F2", 
      color: ok ? "#166534" : "#B91C1C", 
      border: `1px solid ${ok ? "#BBF7D0" : "#FECACA"}`, 
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)" 
    }}>
      {msg}
    </div>
  );
}

// ── Patient Search Component ────────────────────────
function PatientSearch({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (q) => {
    setSearch(q);
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await API.get("/pharmacist/patients/search/", { params: { q: q } });
      const list = Array.isArray(data?.data) ? data.data : (data?.data?.results ?? []);
      setResults(list);
    } catch (e) {
      console.error("Patient search error:", e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, maxWidth: 500, width: "90%", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Search Patient</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Ico d={ICONS.x} size={20} color="#94A3B8" />
          </button>
        </div>

        <input 
          autoFocus
          placeholder="Enter MRD, Patient ID, or Name…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ ...INP, marginBottom: 12 }}
        />

        {searching && <div style={{ padding: 20, textAlign: "center", color: "#94A3B8" }}>Searching…</div>}
        {!searching && search && results.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94A3B8" }}>No patients found</div>}

        {results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((p) => (
              <button
                key={p.patient_id}
                onClick={() => onSelect(p)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#8B5CF6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#0F172A", fontSize: 13 }}>{getPatientName(p)}</p>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748B", flexWrap: "wrap" }}>
                    <span>📋 MRD: <strong>{getPatientMRD(p)}</strong></span>
                    <span>🆔 ID: <strong>{p.patient_id || 'N/A'}</strong></span>
                    {getPatientPhone(p) !== "N/A" && <span>📞 {getPatientPhone(p)}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 20, color: "#8B5CF6", marginLeft: 8 }}>→</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Walk-In Bill Page ──────────────────────────────────
export default function WalkInBillPage({ onClose }) {
  // Step machine: "items" → "details" → "billing" → "payment" → "success"
  const [step, setStep] = useState("items");
  const [billId, setBillId] = useState(null);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [walkInData, setWalkInData] = useState({ name: "", age: "", gender: "Male", phone: "" });
  const [medicines, setMedicines] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [generalItems, setGeneralItems] = useState([]);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  
  // Medicine search state
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineResults, setMedicineResults] = useState([]);
  const [medicineSearching, setMedicineSearching] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [selectedMedicineData, setSelectedMedicineData] = useState(null);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [medicineQty, setMedicineQty] = useState("1");
  const medicineDropdownRef = useRef(null);
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  
  // Procedure state
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newProcedureAmount, setNewProcedureAmount] = useState("");
  const [creatingProcedure, setCreatingProcedure] = useState(false);

  // Procedure search state (searchable dropdown, mirrors medicine search)
  const [procedureSearch, setProcedureSearch] = useState("");
  const [procedureResults, setProcedureResults] = useState([]);
  const [procedureSearching, setProcedureSearching] = useState(false);
  const [showProcedureDropdown, setShowProcedureDropdown] = useState(false);
  const procedureDropdownRef = useRef(null);

  // General item search state (mirrors medicine search)
  const [generalItemSearch, setGeneralItemSearch] = useState("");
  const [generalItemResults, setGeneralItemResults] = useState([]);
  const [generalItemSearching, setGeneralItemSearching] = useState(false);
  const [selectedGeneralItemId, setSelectedGeneralItemId] = useState("");
  const [selectedGeneralItemData, setSelectedGeneralItemData] = useState(null);
  const [availableGiBatches, setAvailableGiBatches] = useState([]);
  const [selectedGiBatchId, setSelectedGiBatchId] = useState("");
  const [generalItemQty, setGeneralItemQty] = useState("1");
  const generalItemDropdownRef = useRef(null);
  const [showGeneralItemDropdown, setShowGeneralItemDropdown] = useState(false);

  // Payment collection state (COMPLETED → PAID step)
  const [payMethod, setPayMethod] = useState("CASH");
  const [upiRef, setUpiRef] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountSaving, setDiscountSaving] = useState(false);

  // Ref guard — prevents a second POST if the user double-clicks "Continue"
  // or React StrictMode double-invokes the handler.
  const _creatingRef = useRef(false);

  // Tracks whether the staged-items flush has been completed for the current
  // billId. Once true, going Back from Billing → Details → submitting Details
  // again skips createBill + flush (to avoid double-adding items that are
  // already on the bill server-side).
  const flushCompleted = useRef(false);

  const showToast = (msg, ok = true) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Handle patient selection in search
  const handleSelectPatient = (p) => {
    setRegisteredPatient(p);
    setShowPatientSearch(false);
  };

  // ─── ITEMS STEP HANDLERS ───
  // All three add-item handlers work on local React state only.
  // No bill exists yet, so no backend calls are made here.

  const handleMedicineSearch = useCallback(async (q) => {
    setMedicineSearch(q);
    if (!q || q.length < 2) {
      setMedicineResults([]);
      setShowMedicineDropdown(false);
      return;
    }

    setMedicineSearching(true);
    try {
      const data = await API.get("/pharmacist/medicines/", {
        params: {
          search: q,
          include_batches: "true",
          show_inactive: "false",
          in_stock: "true"
        }
      });
      const list = Array.isArray(data?.data) ? data.data : (data?.data?.results ?? []);
      setMedicineResults(list);
      setShowMedicineDropdown(true);
    } catch (e) {
      console.error("Medicine search error:", e);
      setMedicineResults([]);
    } finally {
      setMedicineSearching(false);
    }
  }, []);

  const handleSelectMedicine = async (medicine) => {
    setSelectedMedicineId(medicine.medicine_id);
    setSelectedMedicineData(medicine);
    setMedicineSearch(`${medicine.name} ${medicine.strength ? `(${medicine.strength})` : ""}`);
    setShowMedicineDropdown(false);
    setSelectedBatchId("");
    setMedicineQty("1");

    const activeBatches = (medicine.batches || []).filter(b => b.status === "ACTIVE");
    setAvailableBatches(activeBatches);
  };

  const handleSelectBatch = (batch) => {
    setSelectedBatchId(batch.batch_id);
  };

  // Add medicine to LOCAL STATE only — bill does not exist yet on the Items step.
  const handleAddMedicine = () => {
    if (!selectedMedicineId || !selectedBatchId || medicineQty <= 0) {
      showToast("Please complete medicine selection", false);
      return;
    }

    const selectedBatch = availableBatches.find(b => b.batch_id === parseInt(selectedBatchId));
    const maxAvailable = (selectedBatch?.quantity || 0) - (selectedBatch?.allocated_quantity || 0);

    if (parseInt(medicineQty) > maxAvailable) {
      showToast(`Only ${maxAvailable} units available`, false);
      return;
    }

    setMedicines(prev => [...prev, {
      batch_id: parseInt(selectedBatchId),
      quantity: parseInt(medicineQty),
      medicine_name: selectedMedicineData?.name || "Unknown",
      medicine_id: parseInt(selectedMedicineId),
      batch_number: selectedBatch?.batch_number || "",
      mrp: parseFloat(selectedBatch?.mrp) || 0,
      strength: selectedMedicineData?.strength
    }]);

    showToast(`✓ ${selectedMedicineData?.name} added`, true);

    // Reset medicine search form
    setMedicineSearch("");
    setSelectedMedicineId("");
    setSelectedMedicineData(null);
    setSelectedBatchId("");
    setMedicineQty("1");
    setAvailableBatches([]);
    setMedicineResults([]);
  };

  // Remove medicine — pure local state, no backend call needed
  const handleRemoveMedicine = (index) => {
    const removed = medicines[index];
    setMedicines(medicines.filter((_, i) => i !== index));
    showToast(`✓ ${removed.medicine_name} removed`, true);
  };

  const handleProcedureSearch = useCallback(async (q) => {
    setProcedureSearch(q);
    if (!q || q.length < 2) {
      setProcedureResults([]);
      setShowProcedureDropdown(false);
      return;
    }

    setProcedureSearching(true);
    try {
      const data = await API.get("/administration/procedures/", {
        params: { search: q }
      });
      const list = Array.isArray(data?.data) ? data.data : (data?.data?.results ?? []);
      setProcedureResults(list);
      setShowProcedureDropdown(true);
    } catch (e) {
      console.error("Procedure search error:", e);
      setProcedureResults([]);
    } finally {
      setProcedureSearching(false);
    }
  }, []);

  // Add existing procedure from admin catalog — LOCAL STATE only on Items step.
  const handleAddProcedure = (procedure) => {
    setProcedures(prev => [...prev, {
      procedure_id: procedure.procedure_id,
      amount: parseFloat(procedure.charge) || 0,
      description: procedure.name,
      isFromAdmin: true
    }]);

    showToast(`✓ ${procedure.name} added`, true);
    setProcedureSearch("");
    setProcedureResults([]);
    setShowProcedureDropdown(false);
  };

  // Manually add a one-off procedure — LOCAL STATE only on Items step.
  const handleAddManualProcedure = () => {
    if (!newProcedureName.trim() || !newProcedureAmount || parseFloat(newProcedureAmount) <= 0) {
      showToast("Please fill procedure name and amount", false);
      return;
    }

    setCreatingProcedure(true);
    try {
      setProcedures(prev => [...prev, {
        amount: parseFloat(newProcedureAmount),
        description: newProcedureName.trim(),
        isInstant: true
      }]);

      showToast(`✓ ${newProcedureName} added`, true);
      setNewProcedureName("");
      setNewProcedureAmount("");
    } finally {
      setCreatingProcedure(false);
    }
  };

  // Remove procedure — pure local state, no backend call needed
  const handleRemoveProcedure = (index) => {
    const removed = procedures[index];
    setProcedures(procedures.filter((_, i) => i !== index));
    showToast(`✓ ${removed.description} removed`, true);
  };

  const handleGeneralItemSearch = useCallback(async (q) => {
    setGeneralItemSearch(q);
    if (!q || q.length < 2) {
      setGeneralItemResults([]);
      setShowGeneralItemDropdown(false);
      return;
    }

    setGeneralItemSearching(true);
    try {
      const data = await API.get("/pharmacist/general-items/search/", {
        params: { q, limit: 12 }
      });
      const list = data?.data?.results ?? [];
      setGeneralItemResults(list);
      setShowGeneralItemDropdown(true);
    } catch (e) {
      console.error("General item search error:", e);
      setGeneralItemResults([]);
    } finally {
      setGeneralItemSearching(false);
    }
  }, []);

  const handleSelectGeneralItem = (item) => {
    setSelectedGeneralItemId(item.item_id);
    setSelectedGeneralItemData(item);
    setGeneralItemSearch(`${item.name}${item.brand ? ` (${item.brand})` : ""}`);
    setShowGeneralItemDropdown(false);
    setSelectedGiBatchId("");
    setGeneralItemQty("1");

    const activeBatches = (item.batches || []).filter(b => b.status === "ACTIVE");
    setAvailableGiBatches(activeBatches);
  };

  const handleSelectGiBatch = (batch) => {
    setSelectedGiBatchId(batch.batch_id);
  };

  // Add general item to LOCAL STATE only — bill does not exist yet on the Items step.
  const handleAddGeneralItem = () => {
    if (!selectedGeneralItemId || !selectedGiBatchId || generalItemQty <= 0) {
      showToast("Please complete item selection", false);
      return;
    }

    const selectedBatch = availableGiBatches.find(b => b.batch_id === parseInt(selectedGiBatchId));
    const maxAvailable = (selectedBatch?.quantity || 0) - (selectedBatch?.allocated_quantity || 0);

    if (parseInt(generalItemQty) > maxAvailable) {
      showToast(`Only ${maxAvailable} units available`, false);
      return;
    }

    setGeneralItems(prev => [...prev, {
      batch_id: parseInt(selectedGiBatchId),
      quantity: parseInt(generalItemQty),
      item_name: selectedGeneralItemData?.name || "Unknown",
      item_id: parseInt(selectedGeneralItemId),
      batch_number: selectedBatch?.batch_number || "",
      mrp: parseFloat(selectedBatch?.mrp) || 0,
      brand: selectedGeneralItemData?.brand,
    }]);

    showToast(`✓ ${selectedGeneralItemData?.name} added`, true);

    // Reset general item search form
    setGeneralItemSearch("");
    setSelectedGeneralItemId("");
    setSelectedGeneralItemData(null);
    setSelectedGiBatchId("");
    setGeneralItemQty("1");
    setAvailableGiBatches([]);
    setGeneralItemResults([]);
  };

  // Remove general item — pure local state, no backend call needed
  const handleRemoveGeneralItem = (index) => {
    const removed = generalItems[index];
    setGeneralItems(generalItems.filter((_, i) => i !== index));
    showToast(`✓ ${removed.item_name} removed`, true);
  };

  // ─── DETAILS STEP HANDLER ───
  // Creates the bill, then flushes all staged medicines + procedures to the
  // backend in sequence. On full success advances to "billing".
  //
  // Re-entry guard: if the bill was already created AND the flush already ran
  // this session (flushCompleted.current === true), skip straight to "billing"
  // without re-calling createBill or re-flushing (which would double-add items
  // that are already on the bill server-side).
  const handleCreateBill = async () => {
    if (!registeredPatient && !walkInData.name) {
      showToast("Please select a patient or enter walk-in name", false);
      return;
    }

    if (!registeredPatient && walkInData.phone?.trim() && !isValidPhone(walkInData.phone)) {
      showToast(PHONE_ERROR_MESSAGE, false);
      return;
    }

    // If bill already created and items already flushed, go straight to billing
    if (billId && flushCompleted.current) {
      setStep("billing");
      return;
    }

    // Block concurrent / double-click calls
    if (_creatingRef.current) return;
    _creatingRef.current = true;

    setBusy(true);
    try {
      let newBillId = billId; // may already be set if recovering from a mid-flush error

      if (!newBillId) {
        const data = {
          patient_type: registeredPatient ? "registered" : "walkin",
        };

        if (registeredPatient) {
          data.patient_id = registeredPatient.patient_id;
        } else {
          data.walkin_name = walkInData.name?.trim();
          if (walkInData.phone?.trim()) data.walkin_phone = walkInData.phone.trim();
          if (walkInData.age) data.walkin_age = parseInt(walkInData.age);
          if (walkInData.gender) data.walkin_gender = walkInData.gender;
        }

        try {
          const result = await createBill(data);
          newBillId = result?.bill?.bill_id ?? result?.bill_id;
          if (!newBillId) {
            showToast("Bill created but no bill ID was returned.", false);
            _creatingRef.current = false;
            return;
          }
          if (result?.resumed_draft) {
            const billNo = result?.bill?.bill_number ?? "";
            showToast(`Continuing draft bill #${billNo} with updated details`, true);
          }
        } catch (e) {
          // 409 = backend found an existing active DRAFT for this patient today.
          // Resume it and continue to the flush step.
          if (e.status === 409 && e.existing_bill_id) {
            showToast(
              `Resuming existing bill #${e.existing_bill_number} (${e.existing_bill_status})`,
              true
            );
            newBillId = e.existing_bill_id;
          } else {
            throw e;
          }
        }

        setBillId(newBillId);
      }

      // Flush staged medicines and procedures to the backend sequentially.
      // Sequential (for...of with await) rather than Promise.all so that a
      // stock failure on item N doesn't leave the bill in an inconsistent state
      // from concurrent partial writes.
      const flushErrors = [];

      for (const med of medicines) {
        try {
          await addMedicine(newBillId, {
            batch_id: med.batch_id,
            quantity: med.quantity,
          });
        } catch (e) {
          console.error(`Flush error — medicine ${med.medicine_name}:`, e);
          flushErrors.push(`${med.medicine_name}: ${String(e.message ?? e)}`);
        }
      }

      for (const proc of procedures) {
        try {
          await addProcedure(newBillId, {
            ...(proc.procedure_id ? { procedure_id: proc.procedure_id } : {}),
            amount: proc.amount,
            description: proc.description,
          });
        } catch (e) {
          console.error(`Flush error — procedure ${proc.description}:`, e);
          flushErrors.push(`${proc.description}: ${String(e.message ?? e)}`);
        }
      }

      for (const gi of generalItems) {
        try {
          await addGeneralItem(newBillId, {
            batch_id: gi.batch_id,
            quantity: gi.quantity,
          });
        } catch (e) {
          console.error(`Flush error — general item ${gi.item_name}:`, e);
          flushErrors.push(`${gi.item_name}: ${String(e.message ?? e)}`);
        }
      }

      // Mark flush as done so a Back→Details→Continue cycle doesn't double-add.
      flushCompleted.current = true;

      if (flushErrors.length > 0) {
        // Advance to billing anyway so the pharmacist can review what did make
        // it onto the bill; warn about what failed.
        showToast(`⚠ Some items could not be added: ${flushErrors.join("; ")}`, false);
      }

      setStep("billing");

    } catch (e) {
      console.error("Bill creation error:", e);
      showToast("Failed to create bill: " + String(e.message ?? e), false);
      // Release the lock on error so the user can correct input and retry
      _creatingRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  // ─── BILLING STEP HANDLER ───
  // Bill transitions: DRAFT → OPEN → COMPLETED, then payment step separately.
  const handleCompleteBill = async () => {
    if (medicines.length === 0 && procedures.length === 0 && generalItems.length === 0) {
      showToast("Please add at least one medicine, procedure, or general item", false);
      return;
    }

    setBusy(true);
    try {
      // Bills are created in DRAFT status; the complete endpoint requires OPEN.
      try {
        await transitionBillToOpen(billId);
      } catch (transErr) {
        // If it's already OPEN (e.g. re-clicked after a partial failure), ignore.
        if (!String(transErr).toLowerCase().includes("already")) {
          throw transErr;
        }
      }
      await completeBill(billId);
      showToast("✓ Bill completed — now collect payment", true);
      setStep("payment");
    } catch(e) {
      console.error("Complete bill error:", e);
      showToast("Failed to complete bill: " + flattenFormError(e), false);
    } finally {
      setBusy(false);
    }
  };

  // ─── PAYMENT STEP HANDLER ───
  // Collect payment: COMPLETED → PAID. Dispenses medicines and deducts stock.
  const handleConfirmPayment = async () => {
    if (payMethod === "UPI" && !upiRef.trim()) {
      showToast("UPI Reference is required when paying by UPI", false);
      return;
    }

    setBusy(true);
    try {
      await markBillPaid(billId, {
        payment_method: payMethod,
        upi_reference: payMethod === "UPI" ? upiRef : "",
      });
      showToast("✓ Payment received! Medicines dispensed.", true);
      setTimeout(() => setStep("success"), 500);
    } catch(e) {
      console.error("Mark paid error:", e);
      showToast("Failed to record payment: " + flattenFormError(e), false);
    } finally {
      setBusy(false);
    }
  };

  // Calculate totals (always derived from local state)
  const medTotal  = medicines.reduce((sum, m) => sum + (parseFloat(m.mrp) || 0) * (m.quantity || 0), 0);
  const procTotal = procedures.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const giTotal   = generalItems.reduce((sum, g) => sum + (parseFloat(g.mrp) || 0) * (g.quantity || 0), 0);
  const billTotal = medTotal + procTotal + giTotal;
  // Total payable after the flat discount (if any) has been applied to the bill.
  const displayTotal = Math.max(billTotal - (discountAmount || 0), 0);

  const handleApplyDiscount = async () => {
    const val = parseFloat(discountInput || 0);
    if (isNaN(val) || val < 0) {
      setToast("Discount amount cannot be negative");
      return;
    }
    if (val > billTotal) {
      setToast(`Discount cannot exceed the subtotal (₹${billTotal.toFixed(2)})`);
      return;
    }
    setDiscountSaving(true);
    try {
      await setBillDiscount(billId, val);
      setDiscountAmount(val);
      setToast("Discount applied");
    } catch (e) {
      setToast(String(e?.message || e));
    } finally {
      setDiscountSaving(false);
    }
  };

  // Close medicine/procedure dropdowns on outside click.
  // The refs live in the component body regardless of which step is rendered;
  // the handlers are no-ops when the step doesn't show those inputs.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (medicineDropdownRef.current && !medicineDropdownRef.current.contains(e.target)) {
        setShowMedicineDropdown(false);
      }
      if (procedureDropdownRef.current && !procedureDropdownRef.current.contains(e.target)) {
        setShowProcedureDropdown(false);
      }
      if (generalItemDropdownRef.current && !generalItemDropdownRef.current.contains(e.target)) {
        setShowGeneralItemDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── ITEMS STEP (first) ───────────────────────────────────────────────────
  // Medicines and procedures are staged in local React state only.
  // No bill ID exists yet; addMedicine / addProcedure are NOT called here.
  if (step === "items") {
    const maxQtyForSelected = selectedBatchId 
      ? (availableBatches.find(b => b.batch_id === parseInt(selectedBatchId))?.quantity || 0) - 
        (availableBatches.find(b => b.batch_id === parseInt(selectedBatchId))?.allocated_quantity || 0)
      : 0;

    return (
      <div style={{ padding: 0, fontFamily: "'Inter',sans-serif", maxWidth: "100%" }}>
        {/* HEADER */}
        <div style={{ padding: 20, background: "#F8FAFC", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 5 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Add Medicines, Procedures & Items</h2>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Step 1 of 4 — select items before entering patient details</p>
          </div>
          <button onClick={() => onClose()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <Ico d={ICONS.x} size={20} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* MEDICINE SEARCH SECTION */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray[900], marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Ico d={ICONS.pill} size={18} color={COLORS.primary} />
              Search & Add Medicines
            </h3>

            {/* Search Input */}
            <div style={{ marginBottom: 16, position: "relative" }} ref={medicineDropdownRef}>
              <label style={LBL}>Medicine Search</label>
              <div style={{ position: "relative" }}>
                <Ico d={ICONS.search} size={13} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search by name, generic name, or category…"
                  value={medicineSearch}
                  onChange={(e) => handleMedicineSearch(e.target.value)}
                  onFocus={() => medicineSearch.length >= 2 && setShowMedicineDropdown(true)}
                  style={{ ...INP, paddingLeft: 32 }}
                />
              </div>

              {/* Search Results Dropdown */}
              {showMedicineDropdown && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  maxHeight: 300,
                  overflowY: "auto",
                }}>
                  {medicineSearching && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Searching…</div>}
                  {!medicineSearching && medicineResults.length === 0 && medicineSearch && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No medicines found</div>}
                  {medicineResults.map((med) => (
                    <button
                      key={med.medicine_id}
                      onClick={() => handleSelectMedicine(med)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        background: "#fff",
                        borderBottom: "1px solid #F3F4F6",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 13,
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                    >
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>
                        {med.name} {med.strength ? `(${med.strength})` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                        {med.category || "General"} • {med.generic_name || ""}
                      </div>
                      {med.description && (
                        <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {med.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Batch & Quantity Selection */}
            {selectedMedicineData && availableBatches.length > 0 && (
              <>
                <label style={LBL}>Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleSelectBatch(availableBatches.find(b => b.batch_id === parseInt(e.target.value)))}
                  style={{ ...INP, marginBottom: 12 }}
                >
                  <option value="">-- Select Batch --</option>
                  {availableBatches.map((batch) => {
                    const available = (batch.quantity || 0) - (batch.allocated_quantity || 0);
                    return (
                      <option key={batch.batch_id} value={batch.batch_id}>
                        {batch.batch_number} • Available: {available}/{batch.quantity} • MRP: ₹{batch.mrp}
                      </option>
                    );
                  })}
                </select>

                {selectedBatchId && (
                  <>
                    <label style={LBL}>Quantity (Max: {maxQtyForSelected})</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
                      <input
                        type="number"
                        min="1"
                        max={maxQtyForSelected}
                        value={medicineQty}
                        onChange={(e) => setMedicineQty(e.target.value)}
                        style={INP}
                      />
                      <button
                        onClick={handleAddMedicine}
                        disabled={!selectedMedicineId || !selectedBatchId || parseInt(medicineQty) <= 0 || parseInt(medicineQty) > maxQtyForSelected}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: (selectedMedicineId && selectedBatchId && parseInt(medicineQty) > 0 && parseInt(medicineQty) <= maxQtyForSelected) ? G : "#E5E7EB",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: (selectedMedicineId && selectedBatchId && parseInt(medicineQty) > 0 && parseInt(medicineQty) <= maxQtyForSelected) ? "pointer" : "not-allowed",
                          fontSize: 13,
                          whiteSpace: "nowrap"
                        }}
                      >
                        <Ico d={ICONS.plus} size={16} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        Add
                      </button>
                    </div>
                  </>
                )}

                {availableBatches.length === 0 && (
                  <div style={{ padding: 10, background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12, marginBottom: 12 }}>
                    No active batches available for this medicine
                  </div>
                )}
              </>
            )}
          </div>

          {/* ADDED MEDICINES */}
          {medicines.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: "#F8FAFC", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
                Medicines Added ({medicines.length})
              </p>
              {medicines.map((med, i) => (
                <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E5E7EB" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
                      {med.medicine_name} {med.strength ? `(${med.strength})` : ""}
                    </p>
                    <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>
                      Batch: {med.batch_number} • Qty: {med.quantity} • ₹{(med.mrp * med.quantity).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveMedicine(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 8 }}
                  >
                    <Ico d={ICONS.trash} size={16} />
                  </button>
                </div>
              ))}
              <div style={{ padding: 10, background: "#EFF6FF", borderRadius: 8, marginTop: 12, borderLeft: `4px solid ${G}` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: G, margin: 0 }}>Subtotal: ₹{medTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* PROCEDURES SECTION */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray[900], marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Ico d={ICONS.package} size={18} color={COLORS.success} />
              Procedures & Services
            </h3>

            {/* Search & Add Procedure (from admin catalog) */}
            <div style={{ marginBottom: 16, position: "relative" }} ref={procedureDropdownRef}>
              <label style={LBL}>Procedure Search</label>
              <div style={{ position: "relative" }}>
                <Ico d={ICONS.search} size={13} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search by procedure name…"
                  value={procedureSearch}
                  onChange={(e) => handleProcedureSearch(e.target.value)}
                  onFocus={() => procedureSearch.length >= 2 && setShowProcedureDropdown(true)}
                  style={{ ...INP, paddingLeft: 32 }}
                />
              </div>

              {showProcedureDropdown && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  maxHeight: 260,
                  overflowY: "auto",
                }}>
                  {procedureSearching && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Searching…</div>}
                  {!procedureSearching && procedureResults.length === 0 && procedureSearch && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No procedures found</div>}
                  {procedureResults.map((proc) => (
                    <button
                      key={proc.procedure_id}
                      onClick={() => handleAddProcedure(proc)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        background: "#fff",
                        borderBottom: "1px solid #F3F4F6",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                    >
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{proc.name}</span>
                      <span style={{ fontSize: 11, color: "#64748B" }}>₹{proc.charge || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manually add a one-off procedure line to this bill only */}
            <div style={{ marginBottom: 16, padding: 14, background: "#FEF3C7", borderRadius: 8, border: "1px solid #FCD34D" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", marginBottom: 10 }}>Add Procedure Manually</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Procedure name (e.g., Dressing, Injection)…"
                  value={newProcedureName}
                  onChange={(e) => setNewProcedureName(e.target.value)}
                  style={INP}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Amount (₹)"
                    min="0"
                    step="0.01"
                    value={newProcedureAmount}
                    onChange={(e) => setNewProcedureAmount(e.target.value)}
                    style={INP}
                  />
                  <button
                    onClick={handleAddManualProcedure}
                    disabled={creatingProcedure || !newProcedureName.trim() || !newProcedureAmount}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: (newProcedureName.trim() && newProcedureAmount) ? "#F59E0B" : "#E5E7EB",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: (newProcedureName.trim() && newProcedureAmount) ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                      fontSize: 13
                    }}
                  >
                    {creatingProcedure ? "…" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ADDED PROCEDURES */}
          {procedures.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: "#F0F9FF", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
                Procedures Added ({procedures.length})
              </p>
              {procedures.map((proc, i) => (
                <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E5E7EB" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>{proc.description}</p>
                    <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>₹{parseFloat(proc.amount).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveProcedure(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 8 }}
                  >
                    <Ico d={ICONS.trash} size={16} />
                  </button>
                </div>
              ))}
              <div style={{ padding: 10, background: "#CFFAFE", borderRadius: 8, marginTop: 12, borderLeft: `4px solid #06B6D4` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0891B2", margin: 0 }}>Subtotal: ₹{procTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* GENERAL ITEMS SECTION */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray[900], marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Ico d={ICONS.box} size={18} color="#0EA5E9" />
              General Items
            </h3>

            {/* Search Input */}
            <div style={{ marginBottom: 16, position: "relative" }} ref={generalItemDropdownRef}>
              <label style={LBL}>General Item Search</label>
              <div style={{ position: "relative" }}>
                <Ico d={ICONS.search} size={13} color="#94A3B8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search by name, brand, category, or description…"
                  value={generalItemSearch}
                  onChange={(e) => handleGeneralItemSearch(e.target.value)}
                  onFocus={() => generalItemSearch.length >= 2 && setShowGeneralItemDropdown(true)}
                  style={{ ...INP, paddingLeft: 32 }}
                />
              </div>

              {/* Search Results Dropdown */}
              {showGeneralItemDropdown && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  maxHeight: 300,
                  overflowY: "auto",
                }}>
                  {generalItemSearching && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Searching…</div>}
                  {!generalItemSearching && generalItemResults.length === 0 && generalItemSearch && <div style={{ padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No items found</div>}
                  {generalItemResults.map((item) => (
                    <button
                      key={item.item_id}
                      onClick={() => handleSelectGeneralItem(item)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        background: "#fff",
                        borderBottom: "1px solid #F3F4F6",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 13,
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                    >
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>
                        {item.name}{item.brand ? ` — ${item.brand}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: item.stock_status === "OUT_OF_STOCK" ? "#B91C1C" : "#64748B", marginTop: 2 }}>
                        {item.category_display || "General"} • Stock: {item.stock_quantity}{item.stock_status === "OUT_OF_STOCK" ? " (out of stock)" : ""}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Batch & Quantity Selection */}
            {selectedGeneralItemData && availableGiBatches.length > 0 && (
              <>
                <label style={LBL}>Batch</label>
                <select
                  value={selectedGiBatchId}
                  onChange={(e) => handleSelectGiBatch(availableGiBatches.find(b => b.batch_id === parseInt(e.target.value)))}
                  style={{ ...INP, marginBottom: 12 }}
                >
                  <option value="">-- Select Batch --</option>
                  {availableGiBatches.map((batch) => {
                    const available = (batch.quantity || 0) - (batch.allocated_quantity || 0);
                    return (
                      <option key={batch.batch_id} value={batch.batch_id}>
                        {batch.batch_number} • Available: {available}/{batch.quantity} • MRP: ₹{batch.mrp}
                      </option>
                    );
                  })}
                </select>

                {selectedGiBatchId && (() => {
                  const maxQtyForGi = (availableGiBatches.find(b => b.batch_id === parseInt(selectedGiBatchId))?.quantity || 0) -
                    (availableGiBatches.find(b => b.batch_id === parseInt(selectedGiBatchId))?.allocated_quantity || 0);
                  return (
                    <>
                      <label style={LBL}>Quantity (Max: {maxQtyForGi})</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
                        <input
                          type="number"
                          min="1"
                          max={maxQtyForGi}
                          value={generalItemQty}
                          onChange={(e) => setGeneralItemQty(e.target.value)}
                          style={INP}
                        />
                        <button
                          onClick={handleAddGeneralItem}
                          disabled={!selectedGeneralItemId || !selectedGiBatchId || parseInt(generalItemQty) <= 0 || parseInt(generalItemQty) > maxQtyForGi}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "none",
                            background: (selectedGeneralItemId && selectedGiBatchId && parseInt(generalItemQty) > 0 && parseInt(generalItemQty) <= maxQtyForGi) ? "#0EA5E9" : "#E5E7EB",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: (selectedGeneralItemId && selectedGiBatchId && parseInt(generalItemQty) > 0 && parseInt(generalItemQty) <= maxQtyForGi) ? "pointer" : "not-allowed",
                            fontSize: 13,
                            whiteSpace: "nowrap"
                          }}
                        >
                          <Ico d={ICONS.plus} size={16} style={{ marginRight: 4, verticalAlign: "middle" }} />
                          Add
                        </button>
                      </div>
                    </>
                  );
                })()}

                {availableGiBatches.length === 0 && (
                  <div style={{ padding: 10, background: "#FEF2F2", borderRadius: 8, border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12, marginBottom: 12 }}>
                    No active batches available for this item
                  </div>
                )}
              </>
            )}
          </div>

          {/* ADDED GENERAL ITEMS */}
          {generalItems.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: "#F0F9FF", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
                General Items Added ({generalItems.length})
              </p>
              {generalItems.map((gi, i) => (
                <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E5E7EB" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
                      {gi.item_name}{gi.brand ? ` — ${gi.brand}` : ""}
                    </p>
                    <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>
                      Batch: {gi.batch_number} • Qty: {gi.quantity} • ₹{(gi.mrp * gi.quantity).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveGeneralItem(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 8 }}
                  >
                    <Ico d={ICONS.trash} size={16} />
                  </button>
                </div>
              ))}
              <div style={{ padding: 10, background: "#E0F2FE", borderRadius: 8, marginTop: 12, borderLeft: "4px solid #0EA5E9" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0EA5E9", margin: 0 }}>Subtotal: ₹{giTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Cart total preview when items present */}
          {(medicines.length > 0 || procedures.length > 0 || generalItems.length > 0) && (
            <div style={{ padding: 12, background: "#F0FDF4", borderRadius: 8, marginBottom: 16, border: "1px solid #BBF7D0" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#15803D", margin: 0 }}>
                Cart Total: ₹{billTotal.toFixed(2)} ({medicines.length} medicine{medicines.length !== 1 ? "s" : ""}, {procedures.length} procedure{procedures.length !== 1 ? "s" : ""}, {generalItems.length} item{generalItems.length !== 1 ? "s" : ""})
              </p>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          position: "sticky",
          bottom: 0,
          margin: "0 -0px",
          padding: "16px 20px",
          background: "#fff",
          borderTop: "1px solid #E5E7EB",
          zIndex: 5,
        }}>
          <button
            onClick={() => onClose()}
            style={{ padding: "12px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#64748B", fontWeight: 700, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => setStep("details")}
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "none",
              background: G,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Continue →
          </button>
        </div>

        <Toast msg={toast} ok={!toast.includes("Failed") && !toast.includes("⚠")} />
      </div>
    );
  }

  // ─── DETAILS STEP (second) ───────────────────────────────────────────────
  // Patient info form. On submit: createBill() + flush staged items → "billing".
  // Back button returns to Items without clearing staged medicines/procedures.
  if (step === "details") {
    return (
      <div style={{ padding: 20, fontFamily: "'Inter',sans-serif", maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Patient Details</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <Ico d={ICONS.x} size={20} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 20px" }}>Step 2 of 4 — {medicines.length + procedures.length} item{medicines.length + procedures.length !== 1 ? "s" : ""} staged</p>

        <div style={{ marginBottom: 20 }}>
          <label style={LBL}>Patient Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setRegisteredPatient(null);
                setWalkInData({ name: "", age: "", gender: "Male", phone: "" });
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: `2px solid ${!registeredPatient ? G : "#E5E7EB"}`,
                background: !registeredPatient ? `${G}10` : "#fff",
                color: !registeredPatient ? G : "#64748B",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Walk-In
            </button>
            <button
              onClick={() => setShowPatientSearch(true)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: `2px solid ${registeredPatient ? G : "#E5E7EB"}`,
                background: registeredPatient ? `${G}10` : "#fff",
                color: registeredPatient ? G : "#64748B",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Registered Patient
            </button>
          </div>
        </div>

        {registeredPatient && (
          <div style={{ marginBottom: 20, padding: 12, background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBFD0" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#15803D", margin: "0 0 8px" }}>✓ Patient Selected</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: 0 }}>
              {getPatientName(registeredPatient)}
            </p>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748B", marginTop: 4 }}>
              <span>📋 {getPatientMRD(registeredPatient)}</span>
              {getPatientPhone(registeredPatient) !== "N/A" && <span>📞 {getPatientPhone(registeredPatient)}</span>}
            </div>
          </div>
        )}

        {!registeredPatient && (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={LBL}>Patient Name *</label>
              <input
                autoFocus
                type="text"
                placeholder="Full name"
                value={walkInData.name}
                onChange={(e) => setWalkInData({ ...walkInData, name: e.target.value })}
                style={INP}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={LBL}>Age</label>
                <input
                  type="number"
                  placeholder="Age"
                  value={walkInData.age}
                  onChange={(e) => setWalkInData({ ...walkInData, age: e.target.value })}
                  style={INP}
                />
              </div>
              <div>
                <label style={LBL}>Gender</label>
                <select
                  value={walkInData.gender}
                  onChange={(e) => setWalkInData({ ...walkInData, gender: e.target.value })}
                  style={INP}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <label style={LBL}>Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Starts with 6-9, 10 digits (optional)"
              value={walkInData.phone}
              onChange={(e) => setWalkInData({ ...walkInData, phone: sanitizePhoneInput(e.target.value) })}
              style={{ ...INP, marginBottom: 20 }}
            />
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={() => setStep("items")}
            disabled={busy}
            style={{ padding: "10px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#64748B", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            ← Back
          </button>
          <button
            onClick={handleCreateBill}
            disabled={busy || (!registeredPatient && !walkInData.name)}
            style={{ padding: "10px", borderRadius: 8, border: "none", background: busy ? "#D1D5DB" : G, color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Creating…" : "Continue →"}
          </button>
        </div>

        {showPatientSearch && (
          <PatientSearch
            onSelect={handleSelectPatient}
            onClose={() => setShowPatientSearch(false)}
          />
        )}

        <Toast msg={toast} ok={!toast.includes("Failed") && !toast.includes("⚠")} />
      </div>
    );
  }

  // ─── PAYMENT STEP ────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <div style={{ padding: 20, fontFamily: "'Inter',sans-serif", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Collect Payment</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <Ico d={ICONS.x} size={20} />
          </button>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E5E7EB", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Bill #{billId}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: G }}>₹{displayTotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <p style={{ fontSize: 11, color: "#DC2626", margin: "4px 0 0" }}>
              Includes − ₹{discountAmount.toFixed(2)} discount (subtotal ₹{billTotal.toFixed(2)})
            </p>
          )}
          <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>
            Medicines will be dispensed and stock deducted once payment is confirmed.
          </p>
        </div>

        <label style={LBL}>Payment Method</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {["CASH", "CARD", "UPI"].map((m) => (
            <button
              key={m}
              onClick={() => setPayMethod(m)}
              style={{
                padding: "10px",
                borderRadius: 8,
                border: payMethod === m ? `1.5px solid ${G}` : "1.5px solid #E5E7EB",
                background: payMethod === m ? `${G}15` : "#fff",
                color: payMethod === m ? G : "#64748B",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {payMethod === "UPI" && (
          <div style={{ marginBottom: 16 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={() => setStep("billing")}
            disabled={busy}
            style={{ padding: "10px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#64748B", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            ← Back
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={busy}
            style={{ padding: "10px", borderRadius: 8, border: "none", background: busy ? "#D1D5DB" : G, color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Processing…" : "✓ Confirm Payment"}
          </button>
        </div>

        <Toast msg={toast} ok={!toast.includes("Failed") && !toast.includes("⚠")} />
      </div>
    );
  }

  // ─── SUCCESS STEP ────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div style={{ padding: 20, fontFamily: "'Inter',sans-serif", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Ico d={ICONS.check} size={24} color="#15803D" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Payment Received & Dispensed!</h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 8px" }}>Bill #: {billId}</p>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>Total: ₹{displayTotal.toFixed(2)}</p>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: G, color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Close & Refresh
        </button>
      </div>
    );
  }

  // ─── BILLING STEP (third) ─────────────────────────────────────────────────
  // Read-only review: shows items flushed to the bill + Bill Summary totals.
  // Complete Bill transitions DRAFT → OPEN → COMPLETED → "payment".
  // Back returns to Details without resetting billId or medicines/procedures
  // (the flush-guard on handleCreateBill ensures items are not double-added).
  return (
    <div style={{ padding: 0, fontFamily: "'Inter',sans-serif", maxWidth: "100%" }}>
      {/* HEADER */}
      <div style={{ padding: 20, background: "#F8FAFC", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 5 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Review Bill</h2>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0" }}>Step 3 of 4 — Bill #{billId}</p>
        </div>
        <button onClick={() => onClose()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
          <Ico d={ICONS.x} size={20} />
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {/* ADDED MEDICINES (read-only) */}
        {medicines.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: "#F8FAFC", borderRadius: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
              Medicines ({medicines.length})
            </p>
            {medicines.map((med, i) => (
              <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, border: "1px solid #E5E7EB" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
                  {med.medicine_name} {med.strength ? `(${med.strength})` : ""}
                </p>
                <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>
                  Batch: {med.batch_number} • Qty: {med.quantity} • ₹{(med.mrp * med.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            <div style={{ padding: 10, background: "#EFF6FF", borderRadius: 8, marginTop: 12, borderLeft: `4px solid ${G}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: G, margin: 0 }}>Subtotal: ₹{medTotal.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* ADDED PROCEDURES (read-only) */}
        {procedures.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: "#F0F9FF", borderRadius: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
              Procedures ({procedures.length})
            </p>
            {procedures.map((proc, i) => (
              <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, border: "1px solid #E5E7EB" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>{proc.description}</p>
                <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>₹{parseFloat(proc.amount).toFixed(2)}</p>
              </div>
            ))}
            <div style={{ padding: 10, background: "#CFFAFE", borderRadius: 8, marginTop: 12, borderLeft: `4px solid #06B6D4` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0891B2", margin: 0 }}>Subtotal: ₹{procTotal.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* ADDED GENERAL ITEMS (read-only) */}
        {generalItems.length > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: "#F0F9FF", borderRadius: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px" }}>
              General Items ({generalItems.length})
            </p>
            {generalItems.map((gi, i) => (
              <div key={i} style={{ padding: 12, background: "#fff", borderRadius: 8, marginBottom: 8, border: "1px solid #E5E7EB" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
                  {gi.item_name}{gi.brand ? ` — ${gi.brand}` : ""}
                </p>
                <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>
                  Batch: {gi.batch_number} • Qty: {gi.quantity} • ₹{(gi.mrp * gi.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            <div style={{ padding: 10, background: "#E0F2FE", borderRadius: 8, marginTop: 12, borderLeft: "4px solid #0EA5E9" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0EA5E9", margin: 0 }}>Subtotal: ₹{giTotal.toFixed(2)}</p>
            </div>
          </div>
        )}

        {medicines.length === 0 && procedures.length === 0 && generalItems.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            No items on this bill.
          </div>
        )}

        {/* BILL SUMMARY */}
        <div style={{ padding: 14, background: "#F0FDF4", borderRadius: 10, marginBottom: 20, border: "2px solid #BBF7D0" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#15803D", margin: "0 0 12px", textTransform: "uppercase" }}>Bill Summary</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12, marginBottom: 10 }}>
            <div>
              <span style={{ color: "#64748B" }}>Medicines:</span>
              <div style={{ fontWeight: 600, color: "#0F172A", marginTop: 2 }}>₹{medTotal.toFixed(2)}</div>
            </div>
            <div>
              <span style={{ color: "#64748B" }}>Procedures:</span>
              <div style={{ fontWeight: 600, color: "#0F172A", marginTop: 2 }}>₹{procTotal.toFixed(2)}</div>
            </div>
            <div>
              <span style={{ color: "#64748B" }}>General Items:</span>
              <div style={{ fontWeight: 600, color: "#0F172A", marginTop: 2 }}>₹{giTotal.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #BBF7D0", paddingTop: 10, fontSize: 18, fontWeight: 800, color: "#15803D" }}>
            {discountAmount > 0 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", marginBottom: 4 }}>
                Discount: − ₹{discountAmount.toFixed(2)}
              </div>
            )}
            Total: ₹{displayTotal.toFixed(2)}
          </div>

          {/* Flat discount — applied via the bill's discount endpoint */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px dashed #BBF7D0" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#15803D", textTransform: "uppercase", flexShrink: 0 }}>Discount (₹)</label>
            <input
              type="number" min="0"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1.5px solid #BBF7D0", fontSize: 13, outline: "none" }}
              placeholder="0"
            />
            <button
              onClick={handleApplyDiscount}
              disabled={discountSaving}
              style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: discountSaving ? "#D1D5DB" : "#10B981", color: "#fff", fontWeight: 700, fontSize: 12, cursor: discountSaving ? "not-allowed" : "pointer" }}>
              {discountSaving ? "…" : "Apply"}
            </button>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        position: "sticky",
        bottom: 0,
        margin: "0 -0px",
        padding: "16px 20px",
        background: "#fff",
        borderTop: "1px solid #E5E7EB",
        zIndex: 5,
      }}>
        {/* Back to Details: does NOT reset billId, medicines, or procedures.
            The flush-guard in handleCreateBill prevents double-adding on
            re-submission of the Details form. */}
        <button
          onClick={() => setStep("details")}
          disabled={busy}
          style={{ padding: "12px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#64748B", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
        >
          ← Back
        </button>
        <button
          onClick={handleCompleteBill}
          disabled={busy || (medicines.length === 0 && procedures.length === 0 && generalItems.length === 0)}
          style={{
            padding: "12px",
            borderRadius: 8,
            border: "none",
            background: busy || (medicines.length === 0 && procedures.length === 0 && generalItems.length === 0) ? "#D1D5DB" : "#10B981",
            color: "#fff",
            fontWeight: 700,
            cursor: busy || (medicines.length === 0 && procedures.length === 0 && generalItems.length === 0) ? "not-allowed" : "pointer"
          }}
        >
          {busy ? "Completing…" : "✓ Complete Bill"}
        </button>
      </div>

      <Toast msg={toast} ok={!toast.includes("Failed") && !toast.includes("⚠")} />
    </div>
  );
}