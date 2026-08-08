// src/modules/receptionist/pages/PrintPharmacyBillPage.jsx
import { useEffect, useState, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPharmacyBillDetailForReception } from "../api/receptionApi";

const G = "#16A34A";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  print: "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
  back:  "M19 12H5 M12 19l-7-7 7-7",
  check: "M20 6 9 17l-5-5",
};

// Builds a "1 dose · Twice Daily · After Meals · 5 days" style summary
// from the prescription context the backend attaches to each bill
// medicine item. Returns null for items with no linked prescription
// (e.g. walk-in sales).
function formatDosage(item) {
  if (item.dose_quantity == null && !item.frequency_display && !item.duration_days) return null;
  const parts = [];
  if (item.dose_quantity != null) parts.push(`${parseFloat(item.dose_quantity)} dose`);
  if (item.frequency_display) parts.push(item.frequency_display);
  if (item.meal_timing_display && item.meal_timing) parts.push(item.meal_timing_display);
  if (item.duration_days) parts.push(`${item.duration_days} day${item.duration_days > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

export default function PrintPharmacyBillPage() {
  const { billId } = useParams();
  const navigate    = useNavigate();
  const printRef     = useRef();
  const [bill, setBill]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getPharmacyBillDetailForReception(billId)
      .then(setBill)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [billId]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}>
      <div style={{ width:28, height:28, borderRadius:"50%", border:`3px solid ${G}20`, borderTop:`3px solid ${G}`, animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !bill) return (
    <div style={{ padding:40, textAlign:"center", color:"#EF4444", fontFamily:"'Inter',sans-serif" }}>
      <p style={{ fontSize:15, fontWeight:600 }}>Failed to load pharmacy bill.</p>
      <p style={{ fontSize:13, color:"#94A3B8" }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ marginTop:16, padding:"8px 18px", borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:13 }}>
        Go back
      </button>
    </div>
  );

  const items      = bill.medicine_items   || [];
  const general    = bill.general_items    || [];

  // Merge duplicate procedure rows (same procedure, or same manual
  // description + rate) into one line with a combined quantity, so a
  // procedure added more than once shows as a single row instead of
  // repeating with quantity 1 each time.
  const rawProcedures = bill.procedure_items || [];
  const procedureMap = new Map();
  rawProcedures.forEach(p => {
    const key = p.procedure ? `p-${p.procedure}` : `m-${(p.procedure_name || "").trim().toLowerCase()}-${p.unit_charge}`;
    const existing = procedureMap.get(key);
    if (existing) {
      existing.quantity += p.quantity;
      existing.item_total = parseFloat(existing.item_total || 0) + parseFloat(p.item_total || 0);
    } else {
      procedureMap.set(key, { ...p });
    }
  });
  const procedures = Array.from(procedureMap.values());
  const paidAt     = bill.updated_at ? new Date(bill.updated_at).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", maxWidth:"148mm", margin:"0 auto", padding:"16px 16px 40px" }}>

      {/* ── Screen-only toolbar ── */}
      <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <button onClick={() => navigate(-1)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, color:"#64748B" }}>
          <Ico d={ICONS.back} size={14} /> Back
        </button>
        <button onClick={handlePrint} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:8, border:"none", background:G, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, boxShadow:"0 2px 8px #16a34a33" }}>
          <Ico d={ICONS.print} size={14} color="#fff" /> Print A5 Receipt
        </button>
      </div>

      {/* ── Printable bill ── */}
      <div ref={printRef} id="bill-print" style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12, padding:"24px", boxShadow:"0 4px 20px rgba(0,0,0,0.05)", boxSizing:"border-box" }}>

        {/* Header */}
        <div style={{ textAlign:"center", borderBottom:"2px solid #E5E7EB", paddingBottom:18, marginBottom:20 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:"#0F172A", margin:"0 0 2px" }}>RHIMS Hospital</h1>
          <p style={{ fontSize:12, color:"#64748B", margin:0 }}>Pharmacy Receipt</p>
        </div>

        {/* Bill meta */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 12px", marginBottom:20, fontSize:13 }}>
          {[
            ["Bill No.",      bill.bill_number],
            ["Patient",       (bill.patient_info?.name || bill.patient_name || "—") + (bill.patient_info?.type === 'walk-in' ? " (Walk-in)" : "")],
            ["Payment",       bill.payment_method + (bill.upi_reference ? ` · ${bill.upi_reference}` : "")],
            ["Paid at",       paidAt],
          ].map(([label, value]) => (
            <div key={label} style={{ display:"flex", gap:6 }}>
              <span style={{ color:"#94A3B8", minWidth:90, flexShrink:0 }}>{label}</span>
              <span style={{ fontWeight:500, color:"#0F172A" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, padding:"8px 14px", background:"#F0FDF4", borderRadius:8, border:"1px solid #BBF7D0" }}>
          <Ico d={ICONS.check} size={14} color="#15803D" />
          <span style={{ fontSize:12, fontWeight:700, color:"#166534" }}>Paid — medicines dispensed</span>
        </div>

        {/* Medicine items */}
        {items.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", margin:"0 0 8px" }}>Medicines</p>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Medicine","Qty","Rate","Total"].map(h => (
                    <th key={h} style={{ padding:"7px 10px", textAlign: h === "Medicine" ? "left" : "right", fontSize:11, fontWeight:700, color:"#64748B", borderBottom:"1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const dosage = formatDosage(item);
                  const isLast = i === items.length - 1;
                  return (
                    <Fragment key={item.item_id}>
                      <tr style={{ borderBottom: (isLast && !dosage && !item.instructions) ? "none" : "1px solid #F8FAFC" }}>
                        <td style={{ padding:"8px 10px 2px", fontWeight:500, color:"#0F172A" }}>
                          {item.medicine_name}
                          {item.is_dispensed && <span style={{ marginLeft:6, fontSize:10, color:"#15803D", fontWeight:700 }}>✓ dispensed</span>}
                        </td>
                        <td style={{ padding:"8px 10px 2px", textAlign:"right", color:"#475569" }}>{item.quantity}</td>
                        <td style={{ padding:"8px 10px 2px", textAlign:"right", color:"#475569" }}>₹{parseFloat(item.unit_mrp||0).toFixed(2)}</td>
                        <td style={{ padding:"8px 10px 2px", textAlign:"right", fontWeight:600, color:"#0F172A" }}>₹{parseFloat(item.item_total||0).toFixed(2)}</td>
                      </tr>
                      {(dosage || item.instructions) && (
                        <tr style={{ borderBottom: isLast ? "none" : "1px solid #F8FAFC" }}>
                          <td colSpan={4} style={{ padding:"0 10px 8px" }}>
                            {dosage && (
                              <p style={{ margin:0, fontSize:11, fontWeight:600, color:"#15803D" }}>{dosage}</p>
                            )}
                            {item.instructions && (
                              <p style={{ margin:"1px 0 0", fontSize:11, fontStyle:"italic", color:"#94A3B8" }}>{item.instructions}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Procedure items */}
        {procedures.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", margin:"0 0 8px" }}>Procedures</p>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Procedure","Qty","Rate","Total"].map(h => (
                    <th key={h} style={{ padding:"7px 10px", textAlign: h === "Procedure" ? "left" : "right", fontSize:11, fontWeight:700, color:"#64748B", borderBottom:"1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {procedures.map((p, i) => (
                  <tr key={p.item_id} style={{ borderBottom: i < procedures.length-1 ? "1px solid #F8FAFC" : "none" }}>
                    <td style={{ padding:"8px 10px", fontWeight:500, color:"#0F172A" }}>{p.procedure_name}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#475569" }}>{p.quantity}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#475569" }}>₹{parseFloat(p.unit_charge||0).toFixed(2)}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:"#0F172A" }}>₹{parseFloat(p.item_total||0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* General items */}
        {general.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", margin:"0 0 8px" }}>Other Items</p>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Item","Qty","Rate","Total"].map(h => (
                    <th key={h} style={{ padding:"7px 10px", textAlign: h === "Item" ? "left" : "right", fontSize:11, fontWeight:700, color:"#64748B", borderBottom:"1px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {general.map((g, i) => (
                  <tr key={g.item_id} style={{ borderBottom: i < general.length-1 ? "1px solid #F8FAFC" : "none" }}>
                    <td style={{ padding:"8px 10px", fontWeight:500, color:"#0F172A" }}>{g.item_name || g.description}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#475569" }}>{g.quantity}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#475569" }}>₹{parseFloat(g.unit_mrp||0).toFixed(2)}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:"#0F172A" }}>₹{parseFloat(g.item_total||0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div style={{ borderTop:"2px solid #E5E7EB", paddingTop:14, marginTop:4 }}>
          {[
            ["Subtotal",        `₹${parseFloat(bill.subtotal||0).toFixed(2)}`,    false],
            ["GST",             `₹${parseFloat(bill.gst_amount||0).toFixed(2)}`,  false],
            ...(parseFloat(bill.margin_adjustment||0) !== 0 ? [["Adjustment", `₹${parseFloat(bill.margin_adjustment||0).toFixed(2)}`, false]] : []),
            ...(parseFloat(bill.discount_amount||0) > 0 ? [["Discount", `− ₹${parseFloat(bill.discount_amount).toFixed(2)}`, false]] : []),
            ["Total",           `₹${parseFloat(bill.total_amount||0).toFixed(2)}`, true],
          ].map(([label, value, bold]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: bold ? "#0F172A" : "#475569", marginBottom: bold ? 0 : 6, paddingTop: bold ? 10 : 0, borderTop: bold ? "1px solid #E5E7EB" : "none" }}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop:24, paddingTop:16, borderTop:"1px dashed #E5E7EB", textAlign:"center" }}>
          <p style={{ fontSize:11, color:"#94A3B8", margin:0 }}>Thank you for choosing RHIMS Hospital</p>
          <p style={{ fontSize:11, color:"#CBD5E1", margin:"4px 0 0" }}>This is a computer-generated receipt. No signature required.</p>
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