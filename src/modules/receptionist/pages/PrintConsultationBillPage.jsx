// src/modules/receptionist/pages/PrintConsultationBillPage.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBillDetail } from "../api/receptionApi";
import { flattenFormError } from "../../../utils/formErrors";
import logo from "../../../assets/RHIMS LOGO.png";

const G = "#16A34A";

// ── Fallbacks only — used if the bill payload doesn't include branch
// details for some reason. The real values are pulled from the branch
// (bill.branch_name / bill.branch_address / bill.branch_phone) below. ──
const FALLBACK_NAME = "RHIMS Hospital";
const FALLBACK_ADDRESS = "";
const FALLBACK_PHONE = "";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  print: "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  back: "M19 12H5 M12 19l-7-7 7-7",
};

// Plain label:value row used in the metadata grid — no borders, just
// aligned columns, matching the reference bill's layout.
function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
      <span style={{ color: "#334155", minWidth: 84, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 11 }}>{value ?? "—"}</span>
    </div>
  );
}

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

  const ageGender = [bill.patient_age != null ? `${bill.patient_age}` : null, bill.patient_gender]
    .filter(Boolean)
    .join(" / ") || "—";

  // Branch details — same "Branch Management" record shown in the admin
  // (name / address / phone), fetched with the bill rather than hardcoded.
  const branchName = bill.branch_name || FALLBACK_NAME;
  const branchAddress = bill.branch_address || FALLBACK_ADDRESS;
  const branchPhone = bill.branch_phone || FALLBACK_PHONE;

  // Line items for the fee table — same data as before, just rendered
  // with S.No like the reference bill's table.
  const lineItems = [
    {
      label: "Consultation Fee",
      tag: [
        bill.consultation_type === "REVISIT" ? "Revisit" : null,
        bill.billed_department_name || null,
      ].filter(Boolean).join(" · "),
      amount: baseFee,
    },
    ...(regFee > 0 ? [{ label: "MRD Registration Fee (One-time)", amount: regFee }] : []),
    ...(discountAmt > 0 ? [{ label: "Discount", amount: -discountAmt, isDiscount: true }] : []),
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: "210mm", margin: "0 auto", padding: "16px 16px 40px" }}>
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
        padding: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        boxSizing: "border-box",
        minHeight: "120mm",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "#0F172A",
      }}>
        <div>
          {/* Header — logo pinned left, clinic details centered, like the
              reference bill's masthead */}
          <div style={{ position: "relative", textAlign: "center", paddingBottom: 4, marginBottom: 6 }}>
            <img
              src={logo}
              alt={branchName}
              style={{ position: "absolute", left: 90, top: 0, height: 70, width: 110 }}
            />
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "#0F172A" }}>{branchName}</h1>
            {branchAddress && (
              <p style={{ fontSize: 10.5, color: "#334155", margin: 0, lineHeight: 1.3 }}>{branchAddress}</p>
            )}
            {branchPhone && (
              <p style={{ fontSize: 10.5, color: "#334155", margin: "1px 0 0" }}>Ph: {branchPhone}</p>
            )}
          </div>

          <div style={{ borderBottom: "2px solid #0F172A", marginBottom: 8 }} />

          <h2 style={{ textAlign: "center", fontSize: 14, fontWeight: 800, margin: "0 0 10px", color: "#0F172A" }}>
            Visit Bill
          </h2>

          {/* Metadata + Patient Details — plain two-column grid, no cell
              borders, matching the reference bill's layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px", marginBottom: 10 }}>
            <div>
              <InfoRow label="MRD No." value={bill.patient_mrd} />
              <InfoRow label="Patient Name" value={bill.patient_name} />
              <InfoRow label="Phone" value={bill.patient_phone} />
              <InfoRow label="OP Number" value={bill.op_number} />
            </div>
            <div>
              <InfoRow label="Date" value={formattedDate} />
              <InfoRow label="Age / Gender" value={ageGender} />
              <InfoRow label="Doctor Name" value={bill.doctor_name} />
              <InfoRow label="Bill No." value={bill.bill_number} />
            </div>
          </div>

          {/* Fees table — boxed borders, S.No column, matching the
              reference bill's SI No / Description / Amount table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, border: "1.3px solid #0F172A" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "5px 8px", textAlign: "left", fontSize: 10.5, fontWeight: 700, borderBottom: "1.3px solid #0F172A", borderRight: "1px solid #0F172A" }}>SI No</th>
                <th style={{ padding: "5px 8px", textAlign: "left", fontSize: 10.5, fontWeight: 700, borderBottom: "1.3px solid #0F172A", borderRight: "1px solid #0F172A" }}>Description</th>
                <th style={{ padding: "5px 8px", textAlign: "right", fontSize: 10.5, fontWeight: 700, borderBottom: "1.3px solid #0F172A" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={item.label}>
                  <td style={{ padding: "5px 8px", borderRight: "1px solid #0F172A", borderBottom: i === lineItems.length - 1 ? "none" : "1px solid #E2E8F0" }}>{i + 1}</td>
                  <td style={{ padding: "5px 8px", borderRight: "1px solid #0F172A", borderBottom: i === lineItems.length - 1 ? "none" : "1px solid #E2E8F0", color: item.isDiscount ? "#DC2626" : "#0F172A" }}>
                    {item.label}{item.tag && <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 600 }}> ({item.tag})</span>}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, borderBottom: i === lineItems.length - 1 ? "none" : "1px solid #E2E8F0", color: item.isDiscount ? "#DC2626" : "#0F172A" }}>
                    {item.isDiscount ? "− " : ""}₹{Math.abs(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <div style={{ width: "220px" }}>
              {discountAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155", marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotalFee.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, paddingTop: 8, borderTop: "2px solid #0F172A" }}>
                <span>Total Amount</span>
                <span>₹{totalFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 10, paddingTop: 6, borderTop: "1px dashed #E2E8F0", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>Thank you for choosing {branchName}</p>
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
            size: A5 landscape;
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