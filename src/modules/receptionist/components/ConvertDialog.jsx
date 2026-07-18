import { useEffect, useState } from "react";
import { convertPrebooking, checkFollowUp } from "../api/receptionApi";

const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const inp = {
  padding: "9px 12px",
  borderRadius: "9px",
  border: "1.5px solid #E8EDF4",
  fontSize: "13px",
  color: "#1E293B",
  outline: "none",
  width: "100%",
  boxSizing: "border-box"
};

const label = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "5px",
  display: "block"
};

export default function ConvertDialog({ booking, doctors = [], onClose, onConverted }) {
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [upiRef, setUpiRef] = useState("");
  const [collectNow, setCollectNow] = useState(true);
  const [converting, setConverting] = useState(false);
  const [err, setErr] = useState("");

  const [consultType, setConsultType] = useState(booking.consultation_type || "NEW");
  const [fee, setFee] = useState(String(booking.consultation_fee ?? "0"));
  const [revisitEligible, setRevisitEligible] = useState(false);
  const [revisitMessage, setRevisitMessage] = useState("");
  const [revisitChecking, setRevisitChecking] = useState(false);

  const alreadyPaid = booking.payment_status === "PAID";

  useEffect(() => {
    if (booking.patient && !alreadyPaid) {
      setRevisitChecking(true);
      checkFollowUp(booking.patient)
        .then(res => {
          setRevisitEligible(!!res.is_revisit_eligible);
          setRevisitMessage(res.message || "");
          if (res.is_revisit_eligible) {
            setConsultType("REVISIT");
            setFee("0");
          } else {
            setConsultType("NEW");
            setFee(String(booking.consultation_fee ?? "0"));
          }
        })
        .catch(() => {})
        .finally(() => setRevisitChecking(false));
    } else {
      setConsultType(booking.consultation_type || "NEW");
      setFee(String(booking.consultation_fee ?? "0"));
    }
  }, [booking, alreadyPaid]);

  const handleConsultTypeChange = (type) => {
    setConsultType(type);
    if (type === "REVISIT") {
      setFee("0");
    } else {
      // Look up live rate for registered doctor, otherwise fallback to booking rate
      const doc = doctors.find(d => d.id === booking.doctor && d.doctor_type !== "guest");
      if (doc) {
        setFee(String(doc.consultation_fee ?? "0"));
      } else {
        setFee(String(booking.consultation_fee ?? "0"));
      }
    }
  };

  const handleConvert = async () => {
    setErr("");
    if (!alreadyPaid && collectNow && paymentMethod === "UPI" && !upiRef.trim()) {
      setErr("UPI reference is required.");
      return;
    }
    if (!alreadyPaid && consultType === "NEW" && (fee === "" || isNaN(parseFloat(fee)) || parseFloat(fee) < 0)) {
      setErr("Please enter a valid consultation fee.");
      return;
    }

    setConverting(true);
    try {
      const payload = alreadyPaid
        ? {}
        : {
            payment_method: paymentMethod,
            collect_payment: collectNow,
            ...(collectNow && paymentMethod === "UPI" && { upi_reference: upiRef.trim() }),
            consultation_type: consultType,
            consultation_fee: consultType === "REVISIT" ? 0 : parseFloat(fee)
          };
      await convertPrebooking(booking.prebooking_id, payload);
      onConverted?.();
      onClose();
    } catch (e) {
      const data = e.response?.data;
      setErr(data ? Object.values(data).flat().join(" ") : (e.message || "Failed to convert."));
    } finally {
      setConverting(false);
    }
  };

  // Lock fee to read-only for revisits, or for NEW consultations with registered doctors (fixed live rate validation)
  const isFeeReadOnly = alreadyPaid || consultType === "REVISIT" || (consultType === "NEW" && !!booking.doctor);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "440px", width: "100%" }}>
        <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>Convert to Bill</h2>
        <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px" }}>
          {booking.patient_name} · Dr. {booking.doctor_display_name ?? "—"}
        </p>

        {revisitChecking ? (
          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Checking revisit eligibility…</p>
        ) : (
          !alreadyPaid && booking.patient && (
            <div style={{ marginBottom: "16px" }}>
              <label style={label}>Consultation Type</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button type="button" onClick={() => handleConsultTypeChange("NEW")}
                  style={{
                    flex: 1, padding: "9px", borderRadius: "9px",
                    border: consultType === "NEW" ? `1.5px solid ${G}` : "1.5px solid #E8EDF4",
                    background: consultType === "NEW" ? LIGHT_G : "#fff",
                    color: consultType === "NEW" ? G : "#64748B",
                    fontSize: "12.5px", fontWeight: 600, cursor: "pointer"
                  }}>
                  New Consultation
                </button>
                <button type="button" onClick={() => revisitEligible && handleConsultTypeChange("REVISIT")}
                  disabled={!revisitEligible}
                  title={revisitEligible ? "" : (revisitMessage || "No active revisit window")}
                  style={{
                    flex: 1, padding: "9px", borderRadius: "9px",
                    border: consultType === "REVISIT" ? `1.5px solid ${G}` : "1.5px solid #E8EDF4",
                    background: consultType === "REVISIT" ? LIGHT_G : "#fff",
                    color: !revisitEligible ? "#CBD5E1" : consultType === "REVISIT" ? G : "#64748B",
                    fontSize: "12.5px", fontWeight: 600, cursor: revisitEligible ? "pointer" : "not-allowed"
                  }}>
                  Free Revisit
                </button>
              </div>
              <p style={{ fontSize: "11px", color: revisitEligible ? "#15803D" : "#94A3B8", margin: "4px 0 0" }}>
                {revisitEligible
                  ? (revisitMessage || "Patient is eligible for a FREE revisit consultation.")
                  : (revisitMessage || "Not eligible for a free revisit — defaults to New Consultation.")}
              </p>
            </div>
          )
        )}

        {/* Fee preview/edit */}
        <div style={{ marginBottom: "16px" }}>
          <label style={label}>Consultation Fee (₹)</label>
          <input
            type="number"
            min="0"
            style={{ ...inp, ...(isFeeReadOnly ? { background: "#F8FAFC", color: "#94A3B8", cursor: "not-allowed" } : {}) }}
            value={fee}
            onChange={e => !isFeeReadOnly && setFee(e.target.value)}
            readOnly={isFeeReadOnly}
            placeholder={consultType === "REVISIT" ? "Free revisit — locked at ₹0" : "Enter fee"}
          />
          {!alreadyPaid && consultType === "NEW" && !!booking.doctor && (
            <p style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "4px" }}>
              Fixed rate for registered doctor profile.
            </p>
          )}
        </div>

        {alreadyPaid ? (
          <div style={{ background: LIGHT_G, color: "#15803D", borderRadius: "9px", padding: "10px 12px", fontSize: "13px", marginBottom: "16px" }}>
            Already paid — the bill will be created as paid, no charge at the counter.
          </div>
        ) : (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#0F172A", cursor: "pointer", marginBottom: "10px" }}>
              <input type="checkbox" checked={collectNow} onChange={e => setCollectNow(e.target.checked)} />
              Collect payment now
            </label>
            {collectNow ? (
              <>
                <label style={label}>Payment method</label>
                <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
                {paymentMethod === "UPI" && (
                  <input style={{ ...inp, marginTop: "8px" }} placeholder="UPI reference number" value={upiRef} onChange={e => setUpiRef(e.target.value)} />
                )}
              </>
            ) : (
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>
                The bill will be created as Pending and can be marked paid later from the Billing page.
              </p>
            )}
          </div>
        )}

        {err && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px", fontSize: "13px" }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleConvert} disabled={converting || revisitChecking}
            style={{ flex: 1, padding: "11px", borderRadius: "9px", border: "none", background: converting ? "#D1D5DB" : G, color: "#fff", fontSize: "13px", fontWeight: 700, cursor: (converting || revisitChecking) ? "not-allowed" : "pointer" }}>
            {converting ? "Converting…" : "Convert"}
          </button>
        </div>
      </div>
    </div>
  );
}