// src/modules/receptionist/pages/PrintConsultationBillPage.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBillDetail } from "../api/receptionApi";
import { flattenFormError } from "../../../utils/formErrors";

const G = "#16A34A";
const LIGHT_G = "#DCFCE7";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  print: "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  back: "M19 12H5 M12 19l-7-7 7-7",
  check: "M20 6 9 17l-5-5",
};

export default function PrintConsultationBillPage() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBillDetail(billId)
      .then(setBill)
      .catch(e => setError(flattenFormError(e)))
      .finally(() => setLoading(false));
  }, [billId]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !bill) return (
    <div style={{ padding: 40, textAlign: "center", color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>
      <p style={{ fontSize: 15, fontWeight: 600 }}>Failed to load consultation bill.</p>
      <p style={{ fontSize: 13, color: "#94A3B8" }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: "8px 18px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13 }}>
        Go back
      </button>
    </div>
  );

  const formattedDate = bill.consultation_date
    ? new Date(bill.consultation_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const totalFee = parseFloat(bill.total_amount ?? bill.consultation_fee ?? 0);
  const regFee = parseFloat(bill.registration_fee ?? 0);
  const baseFee = parseFloat(bill.consultation_fee ?? 0);
  const discountAmt = parseFloat(bill.discount_amount ?? 0);
  const subtotalFee = baseFee + regFee;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: "148mm", margin: "0 auto", padding: "16px 16px 40px" }}>
      {/* ── Screen-only toolbar ── */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748B" }}>
          <Ico d={ICONS.back} size={14} /> Back
        </button>
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "none", background: G, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 2px 8px #16a34a33" }}>
          <Ico d={ICONS.print} size={14} color="#fff" /> Print A5 Receipt
        </button>
      </div>

      {/* ── Printable A5 Bill ── */}
      <div ref={printRef} id="bill-print" style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: "24px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        boxSizing: "border-box",
        minHeight: "210mm",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}>
        <div>
          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #F1F5F9", paddingBottom: 12, marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 2px" }}>RHIMS Hospital</h1>
            <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>OP Consultation Receipt</p>
          </div>

          {/* Metadata */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 16, fontSize: 12.5 }}>
            {[
              ["Bill No.", bill.bill_number],
              ["OP Number", bill.op_number],
              ["Date", formattedDate],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>{label}:</span>
                <span style={{ fontWeight: 600, color: "#1E293B" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #F1F5F9", margin: "14px 0" }} />

          {/* Patient Details */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Patient Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 12.5 }}>
              {[
                ["MRD Number", bill.patient_mrd || "—"],
                ["Name", bill.patient_name || "—"],
                ["Age / Gender", [bill.patient_age != null ? `${bill.patient_age} Yrs` : null, bill.patient_gender].filter(Boolean).join(" / ") || "—"],
                ["Phone", bill.patient_phone || "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #F1F5F9", margin: "14px 0" }} />

          {/* Consulting Details */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Consultation Details</p>
            <div style={{ fontSize: 12.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>Doctor:</span>
                <span style={{ fontWeight: 600, color: "#1E293B" }}>{bill.doctor_name || "—"}</span>
              </div>
            </div>
          </div>

          {/* Fees Breakdown Table */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Fees Breakdown</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}>Description</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontSize: 10.5, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>
                    Consultation Fee {bill.consultation_type === "REVISIT" && <span style={{ fontSize: 10.5, color: "#2563EB", fontWeight: 600 }}>(Revisit)</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>₹{baseFee.toFixed(2)}</td>
                </tr>
                {regFee > 0 && (
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>MRD Registration Fee (One-time)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>₹{regFee.toFixed(2)}</td>
                  </tr>
                )}
                {discountAmt > 0 && (
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 10px", color: "#DC2626" }}>Discount</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#DC2626" }}>− ₹{discountAmt.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <div style={{ width: "220px" }}>
              {discountAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#64748B", marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotalFee.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#0F172A", paddingTop: 8, borderTop: `2px solid #0F172A` }}>
                <span>Total Amount:</span>
                <span>₹{totalFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px dashed #E2E8F0", textAlign: "center" }}>
          <p style={{ fontSize: 10.5, color: "#94A3B8", margin: 0 }}>Thank you for choosing RHIMS Hospital</p>
          <p style={{ fontSize: 9.5, color: "#CBD5E1", margin: "2px 0 0" }}>This is a computer-generated receipt. No signature required.</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { 
            margin: 0;
            padding: 0;
            background: #fff;
          }
          @page {
            size: A5 portrait;
            margin: 8mm;
          }
          #bill-print {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  );
}