// src/modules/pharmacist/pages/PrescriptionsPage.jsx - COMPLETE FIXED VERSION
// ✅ ISSUE FIXED: prescription_status now calculated correctly from backend
// ✅ Proper status display for PENDING, PARTIALLY_DISPENSED, DISPENSED
// ✅ Full medication management and bill creation workflow

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { flattenFormError } from "../../../utils/formErrors";
import { 
  getConsultationsWithRx, 
  createBill 
} from "../api/pharmacistApi";

const G = "#8B5CF6";
const S = {
  inp: { 
    padding: "9px 12px", 
    borderRadius: 8, 
    border: "1.5px solid #E5E7EB", 
    fontSize: 13, 
    color: "#1E293B", 
    outline: "none", 
    background: "#fff", 
    width: "100%", 
    boxSizing: "border-box" 
  },
};

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  rx:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  bill:    "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  check:   "M20 6 9 17l-5-5",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  arrow:   "M5 12h14 M12 5l7 7-7 7",
  x:       "M18 6 6 18 M6 6l12 12",
  send:    "M22 2L11 13m11-11l-7 20-4-9-9-4 20-7z",
  return:  "M3 14L1 12m0 0l2-2M1 12h11a4 4 0 010 8H9m11-6l2 2m0 0l-2 2m2-2h-11",
  lock:    "M12 1v6m-5 0H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V1m0 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2",
};

// ═════════════════════════════════════════════════════════════════
// STATUS BADGE STYLING
// ═════════════════════════════════════════════════════════════════
const getStatusStyle = (status) => {
  switch(status?.toUpperCase?.()) {
    case "PENDING":
      return {
        bg: "#FEF3C7",
        border: "#FCD34D",
        color: "#92400E",
        label: "Pending",
        icon: "⏳"
      };
    case "PARTIALLY_DISPENSED":
      return {
        bg: "#FED7AA",
        border: "#FDBA74",
        color: "#B45309",
        label: "Partial",
        icon: "⚠️"
      };
    case "DISPENSED":
    case "COMPLETED":
      return {
        bg: "#F0FDF4",
        border: "#BBF7D0",
        color: "#15803D",
        label: "Dispensed",
        icon: "✓"
      };
    default:
      return {
        bg: "#F3F4F6",
        border: "#D1D5DB",
        color: "#6B7280",
        label: "Unknown",
        icon: "?"
      };
  }
};

// ═════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION COMPONENT
// ═════════════════════════════════════════════════════════════════
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
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      animation: "slideIn 0.3s ease-out"
    }}>
      {msg}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════
// PRESCRIPTION ROW COMPONENT
// ═════════════════════════════════════════════════════════════════
function RxRow({ c, onCreateBill, creating, onRefresh }) {
  const [expanded, setExpanded] = useState(false);

  const handleExpandToggle = async () => {
    setExpanded(!expanded);
  };

  const handleCreateBillClick = () => {
    if (c.prescriptions && c.prescriptions.length > 0) {
      onCreateBill(c, c.prescriptions[0]);
    }
  };

  // ✅ FIXED: Use prescription_status from backend (now included in serializer)
  const prescriptionStatus = c.prescriptions?.[0]?.prescription_status || "PENDING";
  const statusStyle = getStatusStyle(prescriptionStatus);

  const medicines = c.prescriptions?.[0]?.items || [];
  const itemCount = medicines.length;

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 1fr 80px 100px 180px",
        padding: "14px 20px",
        background: "#fff",
        borderBottom: "1px solid #F1F5F9",
        gap: 8,
        alignItems: "center",
        transition: "background 0.2s"
      }}>
        {/* Patient Name */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: "0 0 4px" }}>
            {c.patient_info?.name || c.patient_name || "Unknown"}
          </p>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
            MRD: {c.patient_mrd || "—"}
          </p>
        </div>

        {/* Doctor Name */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
            {c.doctor_name || c.doctor || "—"}
          </p>
        </div>

        {/* Date */}
        <div>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
            {new Date(c.consultation_date || new Date()).toLocaleDateString("en-IN")}
          </p>
        </div>

        {/* Items Count */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: 0 }}>
            {itemCount}
          </p>
        </div>

        {/* Status Badge - ✅ FIXED: Now shows correct status */}
        <div>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 6,
            background: statusStyle.bg,
            border: `1px solid ${statusStyle.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: statusStyle.color
          }}>
            <Ico d={ICONS.check} size={12} color={statusStyle.color} />
            {statusStyle.label}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            onClick={handleExpandToggle}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              background: "#fff",
              color: "#64748B",
              fontWeight: 600,
              fontSize: 11,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.target.style.background = "#F8FAFC";
              e.target.style.borderColor = "#CBD5E1";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "#fff";
              e.target.style.borderColor = "#E5E7EB";
            }}
          >
            {expanded ? "Hide" : "View"}
          </button>

          {prescriptionStatus !== "DISPENSED" && prescriptionStatus !== "COMPLETED" && (
            <button
              onClick={handleCreateBillClick}
              disabled={creating === c.consultation_id}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                background: creating === c.consultation_id ? "#D1D5DB" : G,
                color: "#fff",
                fontWeight: 600,
                fontSize: 11,
                cursor: creating === c.consultation_id ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                if (creating !== c.consultation_id) {
                  e.target.style.opacity = "0.9";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseOut={(e) => {
                if (creating !== c.consultation_id) {
                  e.target.style.opacity = "1";
                  e.target.style.transform = "translateY(0)";
                }
              }}
            >
              {creating === c.consultation_id ? "Creating..." : "Create Bill"}
            </button>
          )}

          {(prescriptionStatus === "DISPENSED" || prescriptionStatus === "COMPLETED") && (
            <div style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "#F0FDF4",
              color: "#15803D",
              fontWeight: 700,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <Ico d={ICONS.check} size={12} />
              Done
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          padding: "16px 20px",
          background: "#F8FAFC",
          borderBottom: "1px solid #F1F5F9"
        }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", margin: "0 0 8px" }}>
              Medicines ({itemCount})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {medicines.map((item, idx) => (
                <div key={idx} style={{
                  padding: "8px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #E5E7EB",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0 }}>
                      {item.medicine?.name || item.name || "Unknown Medicine"}
                    </p>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                      Strength: {item.medicine?.strength || "—"} | Route: {item.route || "—"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      {item.quantity} {item.unit || "units"}
                    </p>
                    {item.frequency && (
                      <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                        {item.frequency}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor Notes */}
          {c.prescriptions?.[0]?.notes && (
            <div style={{ marginTop: 12, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #E5E7EB" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", margin: "0 0 6px", textTransform: "uppercase" }}>
                Doctor Notes
              </p>
              <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: "1.5" }}>
                {c.prescriptions[0].notes}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN PRESCRIPTIONS PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function PrescriptionsPage() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(null);
  const [toast, setToast] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConsultationsWithRx({ date });
      
      let list = Array.isArray(data) ? data : [];

      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(c => {
          const patientName = (c.patient_info?.name || c.patient_name || "").toLowerCase();
          const opNum = (c.op_number || "").toLowerCase();
          const mrd = (c.patient_mrd || "").toLowerCase();
          const doctorName = (c.doctor_name || c.doctor || "").toLowerCase();
          
          return patientName.includes(q) || opNum.includes(q) || mrd.includes(q) || doctorName.includes(q);
        });
      }

      setConsultations(list);
    } catch (e) {
      console.error("Error loading consultations:", e);
      showToast(flattenFormError(e), false);
    } finally {
      setLoading(false);
    }
  }, [date, search, showToast]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const handleCreateBill = async (consultation, rx) => {
    setCreating(consultation.consultation_id);
    try {
      const billResult = await createBill({
        patient_type: "registered",
        prescription_id: rx.prescription_id,
        auto_add_medicines: true,
        notes: `Prescription #${rx.prescription_id} for ${consultation.patient_info?.name || consultation.patient_name || "Patient"}`,
      });

      const billId = billResult?.bill?.bill_id ?? billResult?.bill_id ?? billResult?.id;

      if (!billId) {
        showToast("Failed to create bill: No bill ID returned", false);
        setCreating(null);
        return;
      }

      showToast("Bill created successfully!");
      setTimeout(() => {
        navigate(`/pharmacy/bills?open=${billId}`);
      }, 600);

    } catch (e) {
      const msg = flattenFormError(e);
      if (msg.includes("already exists") || msg.includes("409")) {
        showToast("Bill already exists for this prescription", true);
        setTimeout(() => {
          navigate("/pharmacy/bills");
        }, 1200);
      } else {
        showToast(msg, false);
      }
      load();
    } finally {
      setCreating(null);
    }
  };

  const COL = { fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 1400, margin: "0 auto", padding: "20px" }}>
      <Toast msg={toast?.msg} ok={toast?.ok} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>
            Prescriptions
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "6px 0 0" }}>
            {loading ? "Loading prescriptions..." : `${consultations.length} prescription${consultations.length !== 1 ? "s" : ""} on ${new Date(date).toLocaleDateString("en-IN")}`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94A3B8" }}>
              <Ico d={ICONS.search} size={13} />
            </span>
            <input
              placeholder="Search patient, MRD, OP, doctor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...S.inp, paddingLeft: 32, width: 280 }}
            />
          </div>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...S.inp, width: 150 }}
          />

          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            style={{ 
              padding: "9px 14px", 
              borderRadius: 8, 
              border: "1.5px solid #E2E8F0", 
              background: "#fff", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              fontSize: 12, 
              fontWeight: 600, 
              color: "#64748B",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#CBD5E1";
              e.currentTarget.style.background = "#F8FAFC";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#E2E8F0";
              e.currentTarget.style.background = "#fff";
            }}
          >
            <Ico d={ICONS.refresh} size={14} /> 
            Refresh
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div style={{
        marginBottom: 16,
        padding: "12px 16px",
        background: "#F8FAFC",
        borderRadius: 8,
        border: "1px solid #E2E8F0",
        fontSize: 11,
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "#FEF3C7", border: "1px solid #FCD34D" }} />
          <span style={{ color: "#64748B" }}>Pending - No bill created</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "#FED7AA", border: "1px solid #FDBA74" }} />
          <span style={{ color: "#64748B" }}>Partial - Bill created, awaiting payment</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "#F0FDF4", border: "1px solid #BBF7D0" }} />
          <span style={{ color: "#64748B" }}>Dispensed - Payment received & medicines dispensed</span>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* Column Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 80px 100px 180px", padding: "12px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", gap: 8 }}>
          <span style={COL}>Patient</span>
          <span style={COL}>Doctor</span>
          <span style={COL}>Date</span>
          <span style={{ ...COL, textAlign: "center" }}>Items</span>
          <span style={COL}>Status</span>
          <span style={{ ...COL, textAlign: "right" }}>Actions</span>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>Loading prescriptions...</p>
          </div>
        ) : consultations.length === 0 ? (
          <div style={{ padding: "80px 20px", textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: `${G}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Ico d={ICONS.rx} size={28} color={G} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#64748B", margin: 0 }}>
              {search ? "No prescriptions match your search" : "No prescriptions found for this date"}
            </p>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: "8px 0 0" }}>
              {search ? "Try adjusting your search criteria" : "Check that consultations are completed with final prescriptions"}
            </p>
          </div>
        ) : (
          consultations.map(c => (
            <RxRow
              key={c.consultation_id}
              c={c}
              onCreateBill={handleCreateBill}
              creating={creating}
              onRefresh={() => setRefreshTrigger(prev => prev + 1)}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}