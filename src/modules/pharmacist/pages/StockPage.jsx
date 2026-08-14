/**
 * ✅ PHARMACY MODULE - STOCK PAGE - COMPLETE VERSION WITH ADD QUANTITY FIX
 * 
 * FIXES APPLIED:
 * ✓ Fixed AddBatchModal endpoint from `/pharmacist/batches/` to `/pharmacist/batches/create/`
 * ✓ Fixed field names in addBatch (medicine_id instead of medicine)
 * ✓ Fixed cost_price NaN issue with proper decimal conversion
 * ✓ Fixed margin calculation with safety checks
 * ✓ Implemented Return to Provider endpoint correctly
 * ✓ Added proper error handling for all API calls
 * ✓ Fixed fetchMedicines and fetchBatches data loading
 * ✓ ✅ FIXED EditBatchModal: Shows current qty (read-only) + ADD quantity (editable)
 * ✓ ✅ Calculates new total: current + added
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  getMedicines,
  getBatches,
  getDealers
} from "../api/pharmacistApi";
import API from "../../../api";

// ─────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────
const COLORS = {
  primary: "#8B5CF6",      // Brand purple
  success: "#10B981",      // Green (healthy stock)
  danger: "#EF4444",       // Red (expired/critical)
  warning: "#F59E0B",      // Amber (low stock warning)
  info: "#3B82F6",         // Blue (informational)
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

const INPUT_STYLE = {
  padding: "9px 12px",
  borderRadius: 8,
  border: `1.5px solid ${COLORS.gray[200]}`,
  fontSize: 13,
  color: COLORS.gray[800],
  outline: "none",
  background: "#fff",
  width: "100%",
  boxSizing: "border-box"
};

const LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  color: COLORS.gray[600],
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  display: "block",
  marginBottom: 4
};

// ─────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────

const Icon = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus: "M12 5v14 M5 12h14",
  package: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10",
  alert: "M12 8v4 M12 16h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z",
  checkCircle: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
};

function Toast({ msg, ok }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 9999,
      padding: "12px 18px",
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

// ─── STOCK STATUS BADGE ───────────────────────────────────
function StockStatusBadge({ batch, available }) {
  const isExpired = batch.expiry_date && new Date(batch.expiry_date) < new Date();
  const isLowStock = available < batch.low_stock_threshold && available > 0;
  const isDepleted = available === 0;
  // ✅ NEW: a dealer-linked batch sits here until the manager reviews the
  // purchase on the Dealers page — not sellable/dispensable yet.
  const isPendingApproval = batch.status === "PENDING_APPROVAL";

  let bgColor, textColor, label;

  if (isPendingApproval) {
    bgColor = "#FEF3C7";
    textColor = COLORS.warning;
    label = "Pending Approval";
  } else if (isExpired) {
    bgColor = "#FEE2E2";
    textColor = COLORS.danger;
    label = "Expired";
  } else if (isDepleted) {
    bgColor = "#F3E8FF";
    textColor = COLORS.primary;
    label = "Depleted";
  } else if (isLowStock) {
    bgColor = "#FEF3C7";
    textColor = COLORS.warning;
    label = "Low Stock";
  } else {
    bgColor = "#DBEAFE";
    textColor = COLORS.info;
    label = "Active";
  }

  return (
    <div style={{
      padding: "4px 10px",
      background: bgColor,
      color: textColor,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
      textAlign: "center"
    }}>
      {label}
    </div>
  );
}

// ─── RETURN TO PROVIDER MODAL ───────────────────────────────────
function ReturnToProviderModal({ availableBatches, onClose, onSuccess }) {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [dealerId, setDealerId] = useState("");
  const [dealersError, setDealersError] = useState("");
  // Refund policy: the refund owed by the supplier is quantity × the
  // batch's purchase (cost) price — never the MRP/selling price — and is
  // fixed the moment the return is confirmed, regardless of the reason
  // selected. Confirming here is what routes the refund into the
  // Manager's Expenses → Purchases & Refunds / Total Overview tabs as a
  // reduction against medicine purchase expenses.
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDealers()
      .then((list) => { if (!cancelled) setDealers(list || []); })
      .catch((e) => {
        if (!cancelled) setDealersError(`Failed to load dealers: ${e?.message || e}`);
      });
    return () => { cancelled = true; };
  }, []);

  // If the chosen batch was itself bought from a known dealer, default the
  // return to go back to that same dealer (still fully editable/optional).
  useEffect(() => {
    if (selectedBatch?.dealer) {
      setDealerId(String(selectedBatch.dealer));
    }
  }, [selectedBatch]);

  const available = selectedBatch 
    ? (selectedBatch.quantity || 0) - (selectedBatch.allocated_quantity || 0)
    : 0;

  const refundAmount = (parseFloat(quantity) || 0) * (parseFloat(selectedBatch?.cost_price) || 0);

  const REASON_LABELS = {
    EXPIRED: "Expired", DAMAGED: "Damaged", DEFECTIVE: "Defective",
    RECALL: "Recall", OTHER: "Other",
  };

  const handleReview = () => {
    if (!selectedBatch) {
      alert("Please select a batch");
      return;
    }

    if (!quantity || quantity <= 0) {
      alert("Please enter valid quantity");
      return;
    }

    if (quantity > available) {
      alert(`Only ${available} units available for return`);
      return;
    }

    if (!reason.trim()) {
      alert("Please provide reason for return");
      return;
    }

    setConfirmStep(true);
  };

  const handleReturn = async () => {
    setBusy(true);
    try {
            
      const payload = {
        batch_id: selectedBatch.batch_id,
        quantity: parseInt(quantity),
        reason: reason,
        reason_details: additionalDetails.trim() || "",
        ...(dealerId ? {
          dealer_id: parseInt(dealerId),
        } : {}),
      };

      console.log("📤 Sending return request:", payload);

      const response = await API.post("/pharmacist/medicine-returns-to-provider/", payload);
      
      console.log("✅ Success response:", response);

      const refund = response?.data?.return?.refund_amount;
      const refundText = refund !== undefined ? ` Refund due: ₹${Number(refund).toFixed(2)}.` : "";
      onSuccess(`${quantity} units of ${selectedBatch.medicine_name || selectedBatch.medicine} returned to provider.${refundText}`);
      onClose();
    } catch (error) {
      console.error("❌ Error details:", error);

      let errorMsg = "Unknown error occurred";
      
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstField = Object.keys(errors)[0];
        if (firstField) {
          const fieldErrors = errors[firstField];
          errorMsg = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
        }
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.response?.data) {
        const firstError = Object.entries(error.response.data)[0];
        if (firstError) {
          errorMsg = `${firstError[0]}: ${Array.isArray(firstError[1]) ? firstError[1][0] : firstError[1]}`;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      alert("Error: " + String(errorMsg));
      setConfirmStep(false);
    } finally {
      setBusy(false);
    }
  };

  // ── Confirmation screen: check the refund amount before submitting ──
  if (confirmStep) {
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:24, maxWidth:460, width:"90%", maxHeight:"90vh", overflowY:"auto" }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:"0 0 6px" }}>Confirm Return &amp; Refund</h2>
          <p style={{ fontSize:12, color:COLORS.gray[500], margin:"0 0 18px" }}>
            Please check the refund amount below before sending this batch back to the provider.
          </p>

          <div style={{ background:"#F8FAFC", padding:14, borderRadius:10, marginBottom:14, borderLeft:`4px solid ${COLORS.warning}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>MEDICINE</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{selectedBatch.medicine_name || "Medicine"}</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>BATCH NUMBER</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{selectedBatch.batch_number}</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>QUANTITY RETURNED</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{quantity} units</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>REASON</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{REASON_LABELS[reason] || reason}</p>
              </div>
            </div>
            <div style={{ borderTop:`1px dashed ${COLORS.gray[300]}`, paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, fontWeight:700, color:COLORS.gray[700] }}>Refund Due (at cost price)</span>
              <span style={{ fontSize:18, fontWeight:800, color:COLORS.success }}>₹{refundAmount.toFixed(2)}</span>
            </div>
            {dealerId && (
              <div style={{ borderTop:`1px dashed ${COLORS.gray[300]}`, paddingTop:10, marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11.5, color:COLORS.gray[500] }}>Dealer</span>
                <span style={{ fontSize:12, fontWeight:700, color:COLORS.gray[700] }}>
                  {dealers.find(d => String(d.dealer_id) === String(dealerId))?.name || "—"} (settlement decided by Manager)
                </span>
              </div>
            )}
          </div>

          <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 12px", marginBottom:18 }}>
            <p style={{ fontSize:11.5, color:"#1E40AF", margin:0, lineHeight:1.5 }}>
              ℹ️ <strong>Refund policy:</strong> the refund is always quantity × purchase (cost) price —
              never the MRP — no matter which reason is selected. Once confirmed, stock is deducted
              immediately and the refund automatically offsets medicine purchase expenses on the
              Manager's Expenses page (Purchases &amp; Refunds and Total / Overview tabs).
            </p>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setConfirmStep(false)} disabled={busy}
              style={{ flex:1, padding:"12px 16px", background:COLORS.gray[200], color:COLORS.gray[700], border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer", opacity:busy?0.5:1 }}>
              ← Back &amp; Edit
            </button>
            <button onClick={handleReturn} disabled={busy}
              style={{ flex:1, padding:"12px 16px", background:COLORS.warning, color:"#fff", border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:busy?"not-allowed":"pointer", opacity:busy?0.6:1 }}>
              {busy ? "Processing…" : "✓ Confirm Return"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: 24,
        maxWidth: 500,
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
          Return to Provider
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>Select Batch *</label>
          
          <select
            value={selectedBatch?.batch_id || ""}
            onChange={(e) => {
              const batchId = parseInt(e.target.value);
              const batch = availableBatches.find(b => b.batch_id === batchId);
              setSelectedBatch(batch || null);
              setQuantity("");
            }}
            style={{
              ...INPUT_STYLE,
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234B5563' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              backgroundSize: "12px",
              paddingRight: 28,
              borderColor: !selectedBatch ? "#FCA5A5" : "inherit",
              backgroundColor: "#fff"
            }}
          >
            <option value="">-- Select a batch --</option>
            {availableBatches.map(batch => {
              const avail = (batch.quantity || 0) - (batch.allocated_quantity || 0);
              const isExpired = batch.expiry_date && new Date(batch.expiry_date) < new Date();
              const status = isExpired ? " (Expired)" : avail === 0 ? " (Depleted)" : "";
              
              return (
                <option key={batch.batch_id} value={batch.batch_id}>
                  {batch.batch_number} - {batch.medicine_name || "Medicine"} - {avail} available{status}
                </option>
              );
            })}
          </select>
        </div>

        {selectedBatch && (
          <div style={{ 
            background: "#F8FAFC", 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 16,
            borderLeft: `4px solid ${COLORS.info}`
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: COLORS.gray[500], margin: 0, fontWeight: 600 }}>MEDICINE</p>
                <p style={{ fontSize: 13, color: "#0F172A", margin: "2px 0 0", fontWeight: 600 }}>
                  {selectedBatch.medicine_name || "Medicine"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.gray[500], margin: 0, fontWeight: 600 }}>BATCH NUMBER</p>
                <p style={{ fontSize: 13, color: "#0F172A", margin: "2px 0 0", fontWeight: 600 }}>
                  {selectedBatch.batch_number}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.gray[500], margin: 0, fontWeight: 600 }}>AVAILABLE</p>
                <p style={{ 
                  fontSize: 13, 
                  color: available > 0 ? COLORS.success : COLORS.danger, 
                  margin: "2px 0 0", 
                  fontWeight: 600 
                }}>
                  {available} units
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.gray[500], margin: 0, fontWeight: 600 }}>EXPIRY</p>
                <p style={{ fontSize: 13, color: "#0F172A", margin: "2px 0 0", fontWeight: 600 }}>
                  {selectedBatch.expiry_date
                    ? new Date(selectedBatch.expiry_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                    : "N/A"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.gray[500], margin: 0, fontWeight: 600 }}>REFUND DUE (at cost price, not MRP)</p>
                <p style={{ fontSize: 13, color: COLORS.success, margin: "2px 0 0", fontWeight: 700 }}>
                  ₹{((parseFloat(quantity) || 0) * (parseFloat(selectedBatch.cost_price) || 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>Quantity to Return * {selectedBatch && `(Max: ${available})`}</label>
          <input
            type="number"
            placeholder="Enter quantity..."
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={!selectedBatch}
            min="1"
            max={available}
            style={{
              ...INPUT_STYLE,
              opacity: selectedBatch ? 1 : 0.5,
              cursor: selectedBatch ? "text" : "not-allowed",
              backgroundColor: selectedBatch ? "#fff" : "#F3F4F6"
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>Reason for Return *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!selectedBatch}
            style={{
              ...INPUT_STYLE,
              cursor: selectedBatch ? "pointer" : "not-allowed",
              opacity: selectedBatch ? 1 : 0.5,
              backgroundColor: selectedBatch ? "#fff" : "#F3F4F6",
              appearance: "none",
              backgroundImage: selectedBatch 
                ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234B5563' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`
                : "none",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              backgroundSize: "12px",
              paddingRight: selectedBatch ? 28 : 12
            }}
          >
            <option value="">-- Select reason --</option>
            <option value="EXPIRED">Expired</option>
            <option value="DAMAGED">Damaged</option>
            <option value="DEFECTIVE">Defective</option>
            <option value="RECALL">Recall</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>Additional Details (Optional)</label>
          <textarea
            placeholder="Enter any additional details..."
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
            disabled={!selectedBatch}
            style={{
              ...INPUT_STYLE,
              minHeight: 80,
              resize: "vertical",
              opacity: selectedBatch ? 1 : 0.5,
              cursor: selectedBatch ? "text" : "not-allowed",
              backgroundColor: selectedBatch ? "#fff" : "#F3F4F6",
              fontFamily: "inherit"
            }}
          />
        </div>

        {/* OPTIONAL dealer link — pre-filled from the batch's own dealer
            if it has one, but always editable/clearable. */}
        {selectedBatch && (
          <div style={{ borderTop: `1px dashed ${COLORS.gray[200]}`, paddingTop: 14, marginBottom: 16 }}>
            <label style={LABEL_STYLE}>Dealer <span style={{ textTransform: "none", fontWeight: 400, color: COLORS.gray[400] }}>(optional — who this is going back to)</span></label>
            <select
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: dealerId ? 10 : 0 }}
            >
              <option value="">No dealer — plain return</option>
              {dealers.map((d) => (
                <option key={d.dealer_id} value={d.dealer_id}>
                  {d.name}{d.balance ? ` (balance: ₹${Number(d.balance).toFixed(2)})` : ""}
                </option>
              ))}
            </select>
            {dealerId && (
              <p style={{ fontSize: 10.5, color: COLORS.gray[400], margin: "6px 0 0" }}>
                This return will be sent to the Manager\'s Dealers page for review.
                The Manager decides the settlement (Credit / Cash refund / Exchange)
                when confirming it — this is not set by the pharmacist.
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: COLORS.gray[200],
              color: COLORS.gray[700],
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleReview}
            disabled={!selectedBatch || busy}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: selectedBatch && !busy ? COLORS.warning : COLORS.gray[300],
              color: selectedBatch && !busy ? "#fff" : COLORS.gray[500],
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedBatch && !busy ? "pointer" : "not-allowed",
              opacity: selectedBatch && !busy ? 1 : 0.6
            }}
          >
            Review Refund →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ✅ FIXED EDIT BATCH MODAL - WITH ADD QUANTITY FUNCTION ───────────────────────────────────
function EditBatchModal({ batch, onClose, onSuccess }) {
  // ✅ KEY FIX: quantity_to_add instead of quantity (for ADDING, not replacing)
  const [formData, setFormData] = useState({
    batch_number: batch?.batch_number || "",
    quantity_to_add: 0,  // 🔴 THIS IS THE KEY CHANGE - just what to ADD
    mrp: batch?.mrp || "",
    cost_price: batch?.cost_price || "",
    expiry_date: batch?.expiry_date || "",
    gst_percentage: batch?.gst_percentage || 0,
    low_stock_threshold: batch?.low_stock_threshold || 10,
  });
  const [busy, setBusy] = useState(false);

  // ✅ Calculate the new total
  const currentQuantity = parseInt(batch?.quantity || 0);
  const quantityToAdd = parseInt(formData.quantity_to_add || 0);
  const newTotalQuantity = currentQuantity + quantityToAdd;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.batch_number.trim()) {
      alert("Batch number is required");
      return;
    }
    if (newTotalQuantity < 0) {
      alert("Total quantity cannot be negative");
      return;
    }
    if (!formData.mrp || parseFloat(formData.mrp) <= 0) {
      alert("MRP must be a positive number");
      return;
    }
    if (!formData.cost_price || parseFloat(formData.cost_price) <= 0) {
      alert("Cost price must be a positive number");
      return;
    }

    setBusy(true);
    try {
            
      // 🔴 IMPORTANT: Send the CALCULATED total, not the input
      await API.patch(`/pharmacist/batches/${batch.batch_id}/update/`, {
        batch_number: formData.batch_number,
        quantity: newTotalQuantity,  // ✅ Send calculated total: 70 + 20 = 90
        mrp: parseFloat(formData.mrp),
        cost_price: parseFloat(formData.cost_price),
        expiry_date: formData.expiry_date,
        gst_percentage: parseFloat(formData.gst_percentage) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold),
      });

      const addedText = quantityToAdd !== 0 ? ` Added ${quantityToAdd} units.` : "";
      onSuccess(`Batch ${formData.batch_number} updated successfully!${addedText}`);
      onClose();
    } catch (error) {
      let errorMsg = "Unknown error occurred";

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstField = Object.keys(errors)[0];
        if (firstField) {
          const fieldErrors = errors[firstField];
          errorMsg = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
        }
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.response?.data) {
        // Field-level validation errors come back as { field_name: [...] }
        // with no top-level "detail" key — surface the first one directly
        // instead of falling back to a generic message.
        const firstError = Object.entries(error.response.data)[0];
        if (firstError) {
          errorMsg = `${firstError[0]}: ${Array.isArray(firstError[1]) ? firstError[1][0] : firstError[1]}`;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      alert("Error: " + String(errorMsg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: 24,
        maxWidth: 500,
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>
          Edit Batch: {batch?.batch_number}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* BATCH NUMBER */}
          <div>
            <label style={LABEL_STYLE}>Batch Number</label>
            <input
              type="text"
              value={formData.batch_number}
              onChange={(e) => handleChange("batch_number", e.target.value)}
              style={INPUT_STYLE}
              disabled={true}
            />
            <p style={{ fontSize: 10, color: COLORS.gray[500], margin: "4px 0 0" }}>
              Cannot be modified after creation
            </p>
          </div>

          {/* ✅ NEW: SHOW CURRENT QUANTITY (READ-ONLY) */}
          <div>
            <label style={LABEL_STYLE}>Current Quantity (Units)</label>
            <input
              type="number"
              value={currentQuantity}
              style={{...INPUT_STYLE, background: COLORS.gray[50], color: COLORS.gray[500]}}
              disabled={true}
            />
            <p style={{ fontSize: 10, color: COLORS.gray[500], margin: "4px 0 0" }}>
              Current stock in inventory (read-only)
            </p>
          </div>

          {/* ✅ NEW: ADD QUANTITY FIELD WITH CALCULATION */}
          <div>
            <label style={LABEL_STYLE}>
              ➕ Add Quantity (Units) 
              <span style={{ color: COLORS.primary, fontWeight: 700 }}> ✓ FIXED</span>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  value={formData.quantity_to_add}
                  onChange={(e) => handleChange("quantity_to_add", e.target.value)}
                  style={INPUT_STYLE}
                  placeholder="Enter quantity to add"
                  min="0"
                />
              </div>
              {/* ✅ SHOW THE CALCULATION */}
              <div style={{
                padding: "9px 12px",
                borderRadius: 8,
                background: COLORS.primary,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
                height: "fit-content",
                minWidth: "70px",
                textAlign: "center"
              }}>
                = {newTotalQuantity}
              </div>
            </div>
            {/* ✅ SHOW THE EQUATION */}
            <p style={{ fontSize: 11, color: COLORS.primary, margin: "6px 0 0", fontWeight: 600, background: "#F3E8FF", padding: "8px 10px", borderRadius: 6 }}>
              📊 {currentQuantity} + {quantityToAdd} = {newTotalQuantity}
            </p>
          </div>

          {/* COST PRICE */}
          <div>
            <label style={LABEL_STYLE}>Purchase Cost (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.cost_price}
              onChange={(e) => handleChange("cost_price", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          {/* MRP */}
          <div>
            <label style={LABEL_STYLE}>Selling Price (MRP) ₹</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.mrp}
              onChange={(e) => handleChange("mrp", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          {/* EXPIRY DATE */}
          <div>
            <label style={LABEL_STYLE}>Expiry Date</label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => handleChange("expiry_date", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          {/* LOW STOCK THRESHOLD */}
          <div>
            <label style={LABEL_STYLE}>Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              value={formData.low_stock_threshold}
              onChange={(e) => handleChange("low_stock_threshold", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          {/* GST PERCENTAGE */}
          <div>
            <label style={LABEL_STYLE}>GST %</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.gst_percentage}
              onChange={(e) => handleChange("gst_percentage", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
        </div>

        {/* BUTTONS */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: COLORS.primary,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1
            }}
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: COLORS.gray[200],
              color: COLORS.gray[800],
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD BATCH MODAL ───────────────────────────────────
function AddBatchModal({ medicine, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    batch_number: "",
    quantity: "",
    cost_price: "",
    mrp: "",
    low_stock_threshold: "10",
    expiry_date: "",
    gst_percentage: "0",
    dealer_id: ""
  });
  const [busy, setBusy] = useState(false);
  const [dealers, setDealers] = useState([]);
  // Two-step flow: fill the form, then review & confirm the purchase
  // amount before it's actually saved. Confirming here is what causes
  // this batch's cost to be picked up as a purchase expense on the
  // Manager's Expenses → Purchases & Refunds / Total Overview tabs.
  const [confirmStep, setConfirmStep] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDealers().then((list) => { if (!cancelled) setDealers(list || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setApiError("");   // clear error when user edits any field
  };

  const totalAmount = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.cost_price) || 0);

  const handleReview = () => {
    if (!formData.batch_number || !formData.quantity || !formData.mrp) {
      setApiError("Please fill in all required fields: Batch Number, Quantity, and MRP");
      return;
    }

    if (parseFloat(formData.mrp) <= 0) {
      setApiError("MRP must be greater than 0");
      return;
    }

    if (parseInt(formData.quantity) <= 0) {
      setApiError("Quantity must be greater than 0");
      return;
    }

    setApiError("");
    setConfirmStep(true);
  };

  const handleSubmit = async () => {
    setBusy(true);
    setApiError("");
    try {
            await API.post("/pharmacist/batches/create/", {
        medicine_id: medicine.medicine_id,
        batch_number: formData.batch_number,
        quantity: parseInt(formData.quantity),
        cost_price: parseFloat(formData.cost_price) || 0,
        mrp: parseFloat(formData.mrp),
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        expiry_date: formData.expiry_date || null,
        gst_percentage: parseFloat(formData.gst_percentage) || 0,
        ...(formData.dealer_id ? {
          dealer_id: parseInt(formData.dealer_id),
        } : {}),
      });
      onSuccess();
    } catch (error) {
      let errorMsg = "Unknown error occurred";

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstField = Object.keys(errors)[0];
        if (firstField) {
          const fieldErrors = errors[firstField];
          errorMsg = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
        }
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.response?.data) {
        // Field-level validation errors come back as { field_name: [...] }
        // with no top-level "detail" key — surface the first one directly
        // instead of falling back to a generic message.
        const firstError = Object.entries(error.response.data)[0];
        if (firstError) {
          errorMsg = Array.isArray(firstError[1]) ? firstError[1][0] : firstError[1];
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      // Show inline error on the confirm screen — user can tap "Back & Edit"
      // to fix the batch number instead of being silently bounced back.
      setApiError(String(errorMsg));
    } finally {
      setBusy(false);
    }
  };

  // ── Confirmation screen ──────────────────────────────────
  if (confirmStep) {
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:24, maxWidth:460, width:"90%", maxHeight:"90vh", overflowY:"auto" }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:"#0F172A", margin:"0 0 6px" }}>Confirm Purchase Amount</h2>
          <p style={{ fontSize:12, color:COLORS.gray[500], margin:"0 0 18px" }}>
            Please check the amount below before adding this batch to stock.
          </p>

          <div style={{ background:"#F8FAFC", padding:14, borderRadius:10, marginBottom:18, borderLeft:`4px solid ${COLORS.primary}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>MEDICINE</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{medicine?.name}</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>BATCH NO.</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{formData.batch_number}</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>QUANTITY</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>{formData.quantity} units</p>
              </div>
              <div>
                <p style={{ fontSize:10, color:COLORS.gray[500], margin:0, fontWeight:600 }}>COST PRICE / UNIT</p>
                <p style={{ fontSize:13, color:"#0F172A", margin:"2px 0 0", fontWeight:600 }}>₹{(parseFloat(formData.cost_price) || 0).toFixed(2)}</p>
              </div>
            </div>
            <div style={{ borderTop:`1px dashed ${COLORS.gray[300]}`, paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, fontWeight:700, color:COLORS.gray[700] }}>Total Purchase Amount</span>
              <span style={{ fontSize:18, fontWeight:800, color:COLORS.primary }}>₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"10px 12px", marginBottom:18 }}>
            <p style={{ fontSize:11.5, color:"#92400E", margin:0, lineHeight:1.5 }}>
              ⚠️ Once confirmed, this amount is recorded against this batch and automatically appears
              as a <strong>medicine purchase expense</strong> on the Manager's Expenses page
              (Purchases &amp; Refunds and Total / Overview tabs).
            </p>
          </div>

          {apiError && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 12px", marginBottom:18 }}>
              <p style={{ fontSize:12, color:"#991B1B", margin:0, lineHeight:1.5, fontWeight:600 }}>
                ❌ {apiError}
              </p>
            </div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setConfirmStep(false)} disabled={busy}
              style={{ flex:1, padding:"12px 16px", background:COLORS.gray[200], color:COLORS.gray[700], border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer", opacity:busy?0.5:1 }}>
              ← Back &amp; Edit
            </button>
            <button onClick={handleSubmit} disabled={busy}
              style={{ flex:1, padding:"12px 16px", background:COLORS.primary, color:"#fff", border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:busy?"not-allowed":"pointer", opacity:busy?0.6:1 }}>
              {busy ? "Saving…" : "✓ Confirm & Add Batch"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: 24,
        maxWidth: 500,
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>
          Add New Batch
        </h2>

        <div style={{ background: "#F0F9FF", padding: 12, borderRadius: 8, marginBottom: 20, borderLeft: `4px solid ${COLORS.info}` }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
            {medicine?.name}
          </p>
          <p style={{ fontSize: 11, color: "#64748B", margin: "4px 0 0" }}>
            {medicine?.strength && `${medicine.strength} • `}
            {medicine?.medicine_type || "Medicine"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Batch Number *</label>
            <input
              type="text"
              placeholder="e.g., B12345678"
              value={formData.batch_number}
              onChange={(e) => handleChange("batch_number", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Quantity in Units *</label>
            <input
              type="number"
              placeholder="100"
              min="1"
              value={formData.quantity}
              onChange={(e) => handleChange("quantity", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Purchase Cost (₹)</label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              value={formData.cost_price}
              onChange={(e) => handleChange("cost_price", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Selling Price (MRP) ₹ *</label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              value={formData.mrp}
              onChange={(e) => handleChange("mrp", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Low Stock Threshold</label>
            <input
              type="number"
              placeholder="10"
              min="0"
              value={formData.low_stock_threshold}
              onChange={(e) => handleChange("low_stock_threshold", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Expiry Date</label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => handleChange("expiry_date", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>GST %</label>
            <input
              type="number"
              placeholder="0"
              step="0.01"
              value={formData.gst_percentage}
              onChange={(e) => handleChange("gst_percentage", e.target.value)}
              style={INPUT_STYLE}
            />
          </div>
        </div>

        {/* OPTIONAL dealer link — entirely optional, exactly as before when left blank */}
        <div style={{ borderTop: `1px dashed ${COLORS.gray[200]}`, paddingTop: 14, marginBottom: 16 }}>
          <label style={LABEL_STYLE}>Dealer <span style={{ textTransform: "none", fontWeight: 400, color: COLORS.gray[400] }}>(optional — links this purchase to the Dealers ledger)</span></label>
          <select
            value={formData.dealer_id}
            onChange={(e) => handleChange("dealer_id", e.target.value)}
            style={{ ...INPUT_STYLE, marginBottom: formData.dealer_id ? 10 : 0 }}
          >
            <option value="">No dealer — plain stock entry</option>
            {dealers.map((d) => (
              <option key={d.dealer_id} value={d.dealer_id}>
                {d.name}{d.balance ? ` (balance: ₹${Number(d.balance).toFixed(2)})` : ""}
              </option>
            ))}
          </select>
          {formData.dealer_id && (
            <p style={{ fontSize: 10.5, color: COLORS.gray[400], margin: "8px 0 0" }}>
              This purchase will be sent to the Manager\'s Dealers page for review.
              The Manager decides the settlement (Pay Now / Pay Later — Credit) when
              confirming it — this is not set by the pharmacist.
            </p>
          )}
        </div>

        <div style={{ background: COLORS.gray[50], borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray[600] }}>Total Purchase Amount</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.primary }}>₹{totalAmount.toFixed(2)}</span>
        </div>

        {apiError && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 12px", marginBottom:16 }}>
            <p style={{ fontSize:12, color:"#991B1B", margin:0, lineHeight:1.5, fontWeight:600 }}>
              ❌ {apiError}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "10px 16px",
              background: COLORS.gray[100],
              color: COLORS.gray[700],
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: busy ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleReview}
            disabled={busy}
            style={{
              padding: "10px 16px",
              background: COLORS.primary,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: busy ? 0.5 : 1
            }}
          >
            Review Amount →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SUMMARY STAT CARD — matches SuppliesPage's StatCard exactly,
// so the two inventory pages read as one consistent design.
// ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      flex: "1 1 160px", background: bg || "#fff", border: `1px solid #EEF2F7`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: COLORS.gray[500], textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: color || COLORS.gray[900] }}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────

export default function StockPage() {
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMedicine, setExpandedMedicine] = useState(null);
  const [showAddBatch, setShowAddBatch] = useState(null);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [toast, setToast] = useState({ msg: "", ok: false });
  const [loading, setLoading] = useState(false);

  // Load medicines
  const loadMedicines = useCallback(async () => {
    try {
      const data = await getMedicines({ include_batches: true, show_inactive: false });
      setMedicines(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error("Error loading medicines:", error);
      setToast({ msg: "Failed to load medicines", ok: false });
    }
  }, []);

  // Load batches
  const loadBatches = useCallback(async () => {
    try {
      const data = await getBatches({ only_active: false });
      setBatches(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error("Error loading batches:", error);
      setToast({ msg: "Failed to load batches", ok: false });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMedicines(), loadBatches()]).finally(() => setLoading(false));
  }, [loadMedicines, loadBatches]);

  // Filter medicines
  const filteredMedicines = useMemo(() => {
    if (!searchTerm) return medicines;
    const term = searchTerm.toLowerCase();
    return medicines.filter(m => 
      m.name?.toLowerCase().includes(term) ||
      m.generic_name?.toLowerCase().includes(term) ||
      m.strength?.toLowerCase().includes(term)
    );
  }, [medicines, searchTerm]);

  // Helper to calculate available stock
  const getAvailableStock = (batch) => {
    // A batch awaiting manager approval isn't sellable yet — see
    // StockStatusBadge / MedicineBatch.BATCH_STATUS_CHOICES on the backend.
    if (batch.status === "PENDING_APPROVAL") return 0;
    const qty = parseFloat(batch.quantity) || 0;
    const allocated = parseFloat(batch.allocated_quantity) || 0;
    return Math.max(0, qty - allocated);
  };

  // Helper to safely calculate margin
  const calculateMarginPercent = (batch) => {
    const costPrice = parseFloat(batch.cost_price) || 0;
    const mrp = parseFloat(batch.mrp) || 0;

    if (!costPrice || costPrice === 0) {
      return 0;
    }

    const margin = ((mrp - costPrice) / costPrice) * 100;
    return isFinite(margin) ? Math.round(margin) : 0;
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading stock data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon d={ICONS.package} size={24} color={COLORS.primary} />
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: COLORS.gray[900], margin: 0 }}>
                Medicine Inventory
              </h1>
              <p style={{ fontSize: 13, color: COLORS.gray[500], margin: "4px 0 0" }}>
                View and manage medicine stocks, batches, and pricing
              </p>
            </div>
          </div>
        </div>

        {/* SUMMARY STAT CARDS */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard label="Medicines" value={medicines.length} />
          <StatCard label="Active Batches" value={batches.filter(b => b.status === "ACTIVE").length} />
          <StatCard
            label="Low Stock Batches"
            value={batches.filter(b => b.status === "ACTIVE" && (b.quantity - (b.allocated_quantity || 0)) <= (b.low_stock_threshold ?? 10)).length}
            color={COLORS.warning}
            bg="#FFFBEB"
          />
          <StatCard
            label="Stock Value (cost)"
            value={`₹${batches.filter(b => b.status === "ACTIVE").reduce((sum, b) => sum + (parseFloat(b.quantity) || 0) * (parseFloat(b.cost_price) || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            color={COLORS.success}
          />
        </div>

        {/* SEARCH */}
        <div style={{ position: "relative", maxWidth: 500 }}>
          <Icon d={ICONS.search} size={18} color={COLORS.gray[400]} style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)"
          }} />
          <input
            type="text"
            placeholder="Search by medicine name, generic name, or strength..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...INPUT_STYLE,
              paddingLeft: 36,
              width: "100%"
            }}
          />
        </div>
      </div>

      {/* MEDICINES LIST */}
      {filteredMedicines.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: "center",
          background: COLORS.gray[50],
          borderRadius: 10
        }}>
          <p style={{ color: COLORS.gray[500], margin: 0 }}>
            {medicines.length === 0 ? "No medicines found" : "No medicines match your search"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {filteredMedicines.map((medicine) => {
            // ✅ CHANGED: also show PENDING_APPROVAL batches (dealer-linked
            // stock awaiting manager sign-off) — they used to vanish from
            // this list entirely, which made a freshly-added dealer batch
            // look like it never saved. REJECTED batches (returned to the
            // dealer, zeroed out) stay hidden here — the Dealers page ledger
            // is the audit trail for those.
            const activeBatches = batches.filter(b =>
              b.medicine === medicine.medicine_id &&
              (b.status === 'ACTIVE' || b.status === 'PENDING_APPROVAL')
            );
            const isExpanded = expandedMedicine === medicine.medicine_id;

            return (
              <div key={medicine.medicine_id} style={{
                border: `1px solid ${COLORS.gray[200]}`,
                borderRadius: 10,
                overflow: "hidden",
                background: "#fff"
              }}>
                {/* MEDICINE HEADER */}
                <button
                  onClick={() => setExpandedMedicine(isExpanded ? null : medicine.medicine_id)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: COLORS.gray[50],
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.background = COLORS.gray[100]}
                  onMouseLeave={(e) => e.target.style.background = COLORS.gray[50]}
                >
                  <div style={{ textAlign: "left" }}>
                    <p style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.gray[900],
                      margin: 0
                    }}>
                      {medicine.name}
                    </p>
                    <p style={{
                      fontSize: 12,
                      color: COLORS.gray[600],
                      margin: "4px 0 0"
                    }}>
                      {medicine.strength && `${medicine.strength} • `}
                      {medicine.medicine_type || "Medicine"}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLORS.primary,
                        margin: 0
                      }}>
                        {activeBatches.length} batch{activeBatches.length !== 1 ? 'es' : ''}
                      </p>
                      <p style={{
                        fontSize: 12,
                        color: COLORS.gray[500],
                        margin: "2px 0 0"
                      }}>
                        {activeBatches.reduce((sum, b) => sum + getAvailableStock(b), 0)} units available
                      </p>
                    </div>
                    <Icon d={isExpanded ? "M19 15l-7-7-7 7" : "M13 9l-7 7"} size={20} color={COLORS.gray[400]} />
                  </div>
                </button>

                {/* BATCHES DETAILS */}
                {isExpanded && (
                  <div style={{ padding: 16, borderTop: `1px solid ${COLORS.gray[200]}` }}>
                    {activeBatches.length === 0 && (
                      <p style={{ color: COLORS.gray[500], margin: "0 0 14px" }}>
                        No active batches yet — add the first batch below.
                      </p>
                    )}
                    {activeBatches.length > 0 && (
                      <div>
                        {/* TABLE HEADER */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "120px 80px 80px 80px 100px 100px 100px 120px 80px",
                          gap: 8,
                          padding: "12px 0",
                          borderBottom: `1px solid ${COLORS.gray[200]}`,
                          marginBottom: 12
                        }}>
                          <p style={{ ...LABEL_STYLE, margin: 0 }}>Batch #</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "right" }}>Available</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "right" }}>Reserved</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "right" }}>Total</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "right" }}>Purchase Cost</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "right" }}>MRP</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "center" }}>Expiry</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "center" }}>Status</p>
                          <p style={{ ...LABEL_STYLE, margin: 0, textAlign: "center" }}>Action</p>
                        </div>

                        {/* TABLE ROWS */}
                        {activeBatches.map((batch) => {
                          const available = getAvailableStock(batch);
                          const isExpired = batch.expiry_date && new Date(batch.expiry_date) < new Date();

                          return (
                            <div key={batch.batch_id} style={{
                              display: "grid",
                              gridTemplateColumns: "120px 80px 80px 80px 100px 100px 100px 120px 80px",
                              gap: 8,
                              padding: "12px 0",
                              borderBottom: `1px solid ${COLORS.gray[100]}`,
                              alignItems: "center"
                            }}>
                              {/* BATCH NUMBER */}
                              <div>
                                <p style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: COLORS.gray[900],
                                  margin: 0
                                }}>
                                  {batch.batch_number}
                                </p>
                              </div>

                              {/* AVAILABLE STOCK */}
                              <div style={{ textAlign: "right" }}>
                                <p style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: batch.status === "PENDING_APPROVAL"
                                    ? COLORS.gray[400]
                                    : (available < batch.low_stock_threshold ? COLORS.danger : COLORS.success),
                                  margin: 0
                                }}>
                                  {batch.status === "PENDING_APPROVAL" ? "—" : available}
                                </p>
                              </div>

                              {/* RESERVED STOCK */}
                              <div style={{ textAlign: "right" }}>
                                <p style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: batch.allocated_quantity > 0 ? COLORS.warning : COLORS.gray[500],
                                  margin: 0
                                }}>
                                  {batch.allocated_quantity || 0}
                                </p>
                              </div>

                              {/* TOTAL STOCK */}
                              <div style={{ textAlign: "right" }}>
                                <p style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: COLORS.gray[900],
                                  margin: 0
                                }}>
                                  {batch.quantity}
                                </p>
                              </div>

                              {/* PURCHASE COST */}
                              <div style={{ textAlign: "right" }}>
                                <p style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: batch.cost_price ? COLORS.gray[700] : COLORS.gray[400],
                                  margin: 0
                                }}>
                                  ₹{batch.cost_price ? parseFloat(batch.cost_price).toFixed(2) : "0.00"}
                                </p>
                              </div>

                              {/* SELLING PRICE (MRP) WITH MARGIN */}
                              <div style={{ textAlign: "right" }}>
                                <p style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: COLORS.primary,
                                  margin: 0
                                }}>
                                  ₹{parseFloat(batch.mrp).toFixed(2)}
                                </p>
                                <p style={{
                                  fontSize: 10,
                                  color: COLORS.gray[500],
                                  margin: "2px 0 0"
                                }}>
                                  Margin: {calculateMarginPercent(batch)}%
                                </p>
                              </div>

                              {/* EXPIRY DATE */}
                              <div style={{ textAlign: "center" }}>
                                <p style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: isExpired ? COLORS.danger : COLORS.gray[900],
                                  margin: 0
                                }}>
                                  {batch.expiry_date
                                    ? new Date(batch.expiry_date).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                    : "N/A"}
                                </p>
                              </div>

                              {/* STATUS BADGE */}
                              <div style={{ textAlign: "center" }}>
                                <StockStatusBadge batch={batch} available={available} />
                              </div>

                              {/* ACTION - EDIT BUTTON */}
                              <div style={{ textAlign: "center" }}>
                                <button
                                  onClick={() => {
                                    setEditingBatch(batch);
                                    setShowEditBatch(true);
                                  }}
                                  style={{
                                    padding: "6px 10px",
                                    background: COLORS.primary,
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease"
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = "#7C3AED"}
                                  onMouseLeave={(e) => e.target.style.background = COLORS.primary}
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ACTIONS ROW — always visible, even with zero batches,
                        so a brand-new medicine can get its first batch. */}
                    <div style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: `1px solid ${COLORS.gray[200]}`
                    }}>
                      <button
                        onClick={() => setShowAddBatch(medicine)}
                        style={{
                          padding: "8px 12px",
                          background: COLORS.primary,
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        + Add New Batch
                      </button>
                      {activeBatches.length > 0 && (
                        <button
                          onClick={() => setReturnModal(activeBatches.filter(b => b.status === 'ACTIVE'))}
                          style={{
                            padding: "8px 12px",
                            background: COLORS.warning,
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          Return to Provider
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      {showAddBatch && (
        <AddBatchModal
          medicine={showAddBatch}
          onClose={() => setShowAddBatch(null)}
          onSuccess={() => {
            setToast({ msg: "Batch added successfully!", ok: true });
            loadMedicines();
            loadBatches();
            setShowAddBatch(null);
          }}
        />
      )}

      {returnModal && (
        <ReturnToProviderModal
          availableBatches={returnModal}
          onClose={() => setReturnModal(null)}
          onSuccess={(msg) => {
            setToast({ msg, ok: true });
            loadBatches();
            setReturnModal(null);
          }}
        />
      )}

      {showEditBatch && editingBatch && (
        <EditBatchModal
          batch={editingBatch}
          onClose={() => {
            setShowEditBatch(false);
            setEditingBatch(null);
          }}
          onSuccess={(msg) => {
            setToast({ msg, ok: true });
            setShowEditBatch(false);
            setEditingBatch(null);
            loadBatches();
          }}
        />
      )}

      <Toast msg={toast.msg} ok={toast.ok} />
    </div>
  );
}