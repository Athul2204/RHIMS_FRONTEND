// src/modules/labTechnician/pages/PrintLabBillPage.jsx
import { useEffect, useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getLabBillDetail, getLabRequestDetail } from "../api/labApi";
import { groupLabRequestItems } from "../../../utils/labItemGrouping";

const AMBER = "#F59E0B";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  print: "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  back:  "M19 12H5 M12 19l-7-7 7-7",
  check: "M20 6 9 17l-5-5",
};

export default function PrintLabBillPage() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [labRequest, setLabRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const billData = await getLabBillDetail(billId);
        if (cancelled) return;
        setBill(billData);
        const requestId = billData?.lab_request;
        if (requestId) {
          const requestData = await getLabRequestDetail(requestId);
          if (!cancelled) setLabRequest(requestData);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [billId]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${AMBER}20`, borderTop: `3px solid ${AMBER}`, animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !bill) return (
    <div style={{ padding: 40, textAlign: "center", color: "#EF4444", fontFamily: "'Inter',sans-serif" }}>
      <p style={{ fontSize: 15, fontWeight: 600 }}>Failed to load bill.</p>
      <p style={{ fontSize: 13, color: "#94A3B8" }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ marginTop: 16, padding: "8px 18px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13 }}>
        Go back
      </button>
    </div>
  );

  const items = labRequest?.items || [];
  const date = bill.created_at ? new Date(bill.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const paidAt = bill.updated_at ? new Date(bill.updated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const isWalkin = labRequest?.is_walkin ?? false;
  const patientName = bill.patient_name || labRequest?.patient_name || "—";
  const patientMrd = bill.patient_mrd || labRequest?.patient_mrd;
  const patientPhone = labRequest?.patient_phone;

  const subtotal = parseFloat(bill.subtotal || 0);
  const discount = parseFloat(bill.discount || 0);
  const total = parseFloat(bill.total_amount || 0);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: "148mm", margin: "0 auto", padding: "16px 16px 40px" }}>

      {/* Screen-only toolbar */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748B" }}>
          <Ico d={ICONS.back} size={14} /> Back
        </button>
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          <Ico d={ICONS.print} size={14} color="#fff" /> Print A5 Receipt
        </button>
      </div>

      {/* Printable bill */}
      <div id="bill-print" style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", boxSizing: "border-box" }}>

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #E5E7EB", paddingBottom: 18, marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 2px" }}>RHIMS Hospital</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Lab Receipt</p>
        </div>

        {/* Bill meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 20, fontSize: 13 }}>
          {[
            ["Bill No.",     bill.bill_number],
            ["Date",         date],
            ["Patient",      patientName + (isWalkin ? " (Walk-in)" : "")],
            ["MRD / Phone",  patientMrd || patientPhone || "—"],
            ["Payment",      bill.payment_method && bill.payment_method !== "NONE" ? bill.payment_method : "—"],
            ["Paid at",      bill.payment_status === "PAID" ? paidAt : "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>{label}</span>
              <span style={{ fontWeight: 500, color: "#0F172A" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "8px 14px", background: bill.payment_status === "PAID" ? "#F0FDF4" : "#FFF7ED", borderRadius: 8, border: `1px solid ${bill.payment_status === "PAID" ? "#BBF7D0" : "#FED7AA"}` }}>
          <Ico d={ICONS.check} size={14} color={bill.payment_status === "PAID" ? "#15803D" : "#C2410C"} />
          <span style={{ fontSize: 12, fontWeight: 700, color: bill.payment_status === "PAID" ? "#166534" : "#C2410C" }}>
            {bill.payment_status === "PAID" ? "Paid" : bill.payment_status}
          </span>
        </div>

        {/* Test items */}
        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Tests</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Test", "Code", "Rate"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: h === "Rate" ? "right" : "left", fontSize: 11, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupLabRequestItems(items).map((row, i, arr) => row.type === "group" ? (
                  <Fragment key={`g-${row.groupId}`}>
                    <tr style={{ borderBottom: i < arr.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0F172A" }}>
                        {row.groupName} <span style={{ fontWeight: 500, fontSize: 10, color: "#94A3B8" }}>(Panel)</span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748B", fontSize: 12 }}>—</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569", fontWeight: 600 }}>
                        {row.groupPrice != null ? `₹${row.groupPrice.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                    {row.items.map((sub) => (
                      <tr key={sub.item_id} style={{ borderBottom: "none" }}>
                        <td style={{ padding: "1px 10px 1px 22px", color: "#64748B", fontSize: 12 }}>{sub.test_name}</td>
                        <td style={{ padding: "1px 10px", color: "#94A3B8", fontSize: 11 }}>{sub.test_code}</td>
                        <td style={{ padding: "1px 10px" }} />
                      </tr>
                    ))}
                  </Fragment>
                ) : (
                  <tr key={row.item.item_id} style={{ borderBottom: i < arr.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500, color: "#0F172A" }}>{row.item.test_name}</td>
                    <td style={{ padding: "8px 10px", color: "#64748B", fontSize: 12 }}>{row.item.test_code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>
                      {row.item.test_price != null ? `₹${parseFloat(row.item.test_price).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div style={{ borderTop: "2px solid #E5E7EB", paddingTop: 14, marginTop: 4 }}>
          {[
            ["Subtotal", `₹${subtotal.toFixed(2)}`, false],
            ...(discount > 0 ? [["Discount", `− ₹${discount.toFixed(2)}`, false]] : []),
            ["Total", `₹${total.toFixed(2)}`, true],
          ].map(([label, value, bold]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: bold ? "#0F172A" : "#475569", marginBottom: bold ? 0 : 6, paddingTop: bold ? 10 : 0, borderTop: bold ? "1px solid #E5E7EB" : "none" }}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed #E5E7EB", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>Thank you for choosing RHIMS Hospital</p>
          <p style={{ fontSize: 11, color: "#CBD5E1", margin: "4px 0 0" }}>This is a computer-generated receipt. No signature required.</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
          @page { size: A5 portrait; margin: 8mm; }
          #bill-print {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  );
}
