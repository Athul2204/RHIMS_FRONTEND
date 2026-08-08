// src/modules/pharmacist/pages/PrescriptionDetailPage.jsx
// FIXED: Added comprehensive patient name extraction with fallback chain
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBillDetail } from "../api/pharmacistApi";
import { flattenFormError } from "../../../utils/formErrors";

const G = "#8B5CF6";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  arrow:  "M19 12H5 M12 5l-7 7 7 7",
  rx:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  pill:   "M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3",
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  bill:   "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  check:  "M20 6 9 17l-5-5",
  print:  "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
};

const BILL_STATUS = {
  OPEN:      { label: "Open",      bg: "#EFF6FF", color: "#1D4ED8" },
  PAID:      { label: "Paid",      bg: "#F0FDF4", color: "#15803D" },
  COMPLETED: { label: "Completed", bg: "#F5F3FF", color: "#6D28D9" },
  CANCELLED: { label: "Cancelled", bg: "#FEF2F2", color: "#B91C1C" },
};

// ─────────────────────────────────────────────────────────────────
// SAFE PATIENT NAME EXTRACTION - Complete fallback chain
// ─────────────────────────────────────────────────────────────────
const getPatientName = (bill) => {
  if (!bill) return "Patient";
  
  // ✅ PRIMARY: Use patient_info if available (has correct logic from backend)
  if (bill.patient_info?.name?.trim()) return bill.patient_info.name.trim();
  
  // Fallback 1: Try direct patient_name field
  if (bill.patient_name?.trim()) return bill.patient_name.trim();
  
  // Fallback 2: Try walk-in name field
  if (bill.walkin_name?.trim()) return bill.walkin_name.trim();
  
  // Fallback 3: Try nested patient object (first_name + last_name)
  if (bill.patient?.first_name || bill.patient?.last_name) {
    const fullName = `${bill.patient.first_name || ""} ${bill.patient.last_name || ""}`.trim();
    if (fullName) return fullName;
  }
  
  // Ultimate fallback based on bill type
  return bill.is_walkin ? "Walk-in Patient" : "Patient";
};

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F8FAFC" }}>
      <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1E293B", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value || "—"}</span>
    </div>
  );
}

export default function PrescriptionDetailPage() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!billId) { setError("No bill ID provided."); setLoading(false); return; }
    getBillDetail(billId)
      .then(setBill)
      .catch(e => setError(flattenFormError(e)))
      .finally(() => setLoading(false));
  }, [billId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 700, padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "#B91C1C", fontSize: 14, fontWeight: 600 }}>{error || "Bill not found."}</p>
        <button onClick={() => navigate("/pharmacy/bills")}
          style={{ marginTop: 16, padding: "8px 18px", borderRadius: 8, border: "none", background: G, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          ← Back to Bills
        </button>
      </div>
    );
  }

  const st = BILL_STATUS[bill.bill_status] || { label: bill.bill_status, bg: "#F1F5F9", color: "#64748B" };
  const medItems = bill.medicine_items || [];

  // Merge duplicate procedure rows (same procedure, or same manual
  // description + rate) into one line with a combined quantity.
  const rawProcItems = bill.procedure_items || [];
  const procItemMap = new Map();
  rawProcItems.forEach(p => {
    const key = p.procedure ? `p-${p.procedure}` : `m-${(p.procedure_name || "").trim().toLowerCase()}-${p.unit_charge}`;
    const existing = procItemMap.get(key);
    if (existing) {
      existing.quantity += p.quantity;
      existing.item_total = parseFloat(existing.item_total || 0) + parseFloat(p.item_total || 0);
    } else {
      procItemMap.set(key, { ...p });
    }
  });
  const procItems = Array.from(procItemMap.values());

  const totalMed = medItems.reduce((s, i) => s + parseFloat(i.item_total || 0), 0);
  const totalProc = procItems.reduce((s, i) => s + parseFloat(i.item_total || 0), 0);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/pharmacy/bills")}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#64748B" }}>
            <Ico d={ICONS.arrow} size={14} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Bill #{bill.bill_number}
            </h1>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: "3px 0 0" }}>
              Prescription Detail — {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
          <button onClick={() => window.print()}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#64748B" }}>
            <Ico d={ICONS.print} size={14} /> Print
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Patient info */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico d={ICONS.user} size={14} color={G} />
            </div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>Patient Information</h2>
          </div>
          {/* FIXED: Use getPatientName helper with complete fallback chain */}
          <InfoRow label="Name" value={getPatientName(bill)} />
          <InfoRow label="Age" value={bill.patient_info?.age != null ? `${bill.patient_info.age} yrs` : null} />
          <InfoRow label="Gender" value={bill.patient_info?.gender} />
          {bill.prescription && <InfoRow label="Prescription ID" value={`RX-${bill.prescription}`} />}
          {bill.consultation_bill && <InfoRow label="Consultation Bill" value={`#${bill.consultation_bill}`} />}
          <InfoRow label="Bill Type" value={bill.bill_type} />
          {bill.notes && <InfoRow label="Notes" value={bill.notes} />}
        </div>

        {/* Payment info */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#10B98115", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico d={ICONS.bill} size={14} color="#10B981" />
            </div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>Payment Summary</h2>
          </div>
          <InfoRow label="Payment Status" value={bill.payment_status} />
          <InfoRow label="Payment Method" value={bill.payment_method} />
          {bill.upi_reference && <InfoRow label="UPI Ref" value={bill.upi_reference} />}
          <InfoRow label="Subtotal" value={`₹${parseFloat(bill.subtotal || 0).toFixed(2)}`} />
          <InfoRow label="GST" value={`₹${parseFloat(bill.gst_amount || 0).toFixed(2)}`} />
          {parseFloat(bill.margin_adjustment || 0) !== 0 && (
            <InfoRow label="Adjustment" value={`₹${parseFloat(bill.margin_adjustment || 0).toFixed(2)}`} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 4, borderTop: "2px solid #EEF2F7" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: G }}>₹{parseFloat(bill.total_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Medicine items */}
      {medItems.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", marginBottom: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <Ico d={ICONS.pill} size={15} color={G} />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>Medicines ({medItems.length})</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Medicine", "Batch", "Qty", "Rate", "Total"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Medicine" || h === "Batch" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {medItems.map((item, i) => (
                  <tr key={item.item_id} style={{ borderBottom: i < medItems.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0F172A" }}>{item.medicine_name}</td>
                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12 }}>{item.batch_number || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>{item.quantity}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>₹{parseFloat(item.unit_mrp || 0).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>₹{parseFloat(item.item_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 16px", background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 20 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Subtotal:</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>₹{totalMed.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Procedure items */}
      {procItems.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", marginBottom: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <Ico d={ICONS.pill} size={15} color="#10B981" />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>Procedures ({procItems.length})</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Procedure", "Qty", "Rate", "Total"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Procedure" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {procItems.map((p, i) => (
                  <tr key={p.item_id} style={{ borderBottom: i < procItems.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0F172A" }}>{p.procedure_name}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>{p.quantity}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>₹{parseFloat(p.unit_charge || 0).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>₹{parseFloat(p.item_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 16px", background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 20 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Subtotal:</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>₹{totalProc.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}