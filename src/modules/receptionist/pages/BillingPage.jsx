// src/modules/receptionist/pages/BillingPage.jsx
// ── Changes vs previous version ───────────────────────────────────
//  • Step 2 now has two tabs: "Active Doctor" and "Common / Guest Doctor"
//  • Common Doctor tab lets reception type any doctor name + manual fee
//  • Sidebar progress shows chosen doctor regardless of mode
//  • handleCreate sends doctor:null + doctor_name for common-doctor path
//  • Step 3 fee field is editable only for common-doctor mode
//  • UPI pay-bill dialog added to Bill List (handles upi_reference)
//
// ✅ BUG FIX (Bug 3):
//  The revisit-check API previously returned { eligible, reason } but the
//  frontend was reading res.is_revisit_eligible and res.message — both
//  always undefined, silently breaking the free-revisit flow.
//  The backend (views.py) was fixed to emit the correct keys.
//  No frontend change is needed for that fix; this file is re-issued so
//  all three fixed files are delivered together.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getBills, payBill, createBill, getPatients, getDoctors, checkFollowUp, toArray, reassignBillDoctor, cancelBill, getPrebookings, cancelPrebooking, getHomeVisitDefaults, getBillingDepartments } from "../api/receptionApi";
import ConvertDialog from "../components/ConvertDialog";
import ConfirmDialog from "../../../components/shared/ConfirmDialog";

const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";

// ─── Micro helpers ───────────────────────────────────────────────
const Ico = ({ d, size = 16, color = "currentColor", extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

const Toast = ({ t, onDismiss }) => {
  if (!t) return null;
  return (
    <div style={{
      position: "fixed", top: "20px", right: "20px", zIndex: 3000,
      padding: "12px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
      background: t.ok ? "#F0FDF4" : "#FEF2F2",
      color: t.ok ? "#15803D" : "#DC2626",
      border: `1px solid ${t.ok ? "#BBF7D0" : "#FECACA"}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
    }} onClick={onDismiss}>
      <Ico d={t.ok ? "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3" : "M18 6 6 18 M6 6l12 12"} size={14} color={t.ok ? G : "#DC2626"} />
      {t.msg}
    </div>
  );
};

const PayBadge = ({ status, type, cancelled }) => {
  const paid = status === "PAID";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
        background: cancelled ? "#F1F5F9" : (paid ? LIGHT_G : "#FEF3C7"),
        color: cancelled ? "#64748B" : (paid ? "#15803D" : "#D97706"),
      }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cancelled ? "#94A3B8" : (paid ? G : "#F59E0B") }} />
        {cancelled ? "Cancelled" : (paid ? "Paid" : "Pending")}
      </span>
      <span style={{
        fontSize: "10.5px", fontWeight: 600, padding: "1px 7px", borderRadius: "6px",
        background: type === "HOME_VISIT" ? "#FDF4FF" : type === "NEW" ? "#EFF6FF" : "#F5F3FF",
        color: type === "HOME_VISIT" ? "#A21CAF" : type === "NEW" ? "#2563EB" : "#7C3AED",
        display: "inline-block", width: "fit-content",
      }}>
        {type === "HOME_VISIT" ? "🏠 Home Visit" : type === "REVISIT" ? "Revisit" : "New"}
      </span>
    </div>
  );
};

// ─── Confirm Payment Dialog ────────────────────────────────────────
// Lets reception classify the payment as Cash or UPI at the moment a bill
// is marked paid (rather than silently reusing whatever method — often just
// the CASH default — was set back when the bill was created).
function ConfirmPaymentDialog({ bill, onConfirm, onCancel, paying }) {
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");

  useEffect(() => {
    if (bill) {
      setMethod(bill.payment_method === "UPI" ? "UPI" : "CASH");
      setRef(bill.upi_reference ?? "");
    }
  }, [bill]);

  if (!bill) return null;
  const total = parseFloat(bill.total_amount ?? bill.consultation_fee ?? 0);
  const regFee = parseFloat(bill.registration_fee ?? 0);
  const canConfirm = method === "CASH" || ref.trim();

  const tabBtn = (val, label, icon) => (
    <button onClick={() => setMethod(val)} style={{
      flex: 1, padding: "10px 8px", borderRadius: "9px", border: "2px solid",
      borderColor: method === val ? G : "#E8EDF4",
      background: method === val ? "#F0FDF4" : "#F8FAFC",
      color: method === val ? "#15803D" : "#64748B",
      fontSize: "13px", fontWeight: 600, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    }}>
      <Ico d={icon} size={14} color={method === val ? G : "#94A3B8"} /> {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", padding: "28px 28px 24px", maxWidth: "420px", width: "calc(100% - 32px)", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1 }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>Confirm Payment</h3>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
          <strong>{bill.patient_name}</strong> — ₹{total.toLocaleString("en-IN")}
          {regFee > 0 && <> (incl. ₹{regFee.toLocaleString("en-IN")} one-time MRD fee)</>}
        </p>

        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", display: "block" }}>
          Payment Method
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {tabBtn("CASH", "Cash", "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6")}
          {tabBtn("UPI", "UPI", "M5 12h14 M12 5l7 7-7 7")}
        </div>

        {method === "UPI" && (
          <input
            autoFocus
            style={{ width: "100%", padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", outline: "none", boxSizing: "border-box", marginBottom: "18px" }}
            placeholder="e.g. TXN1234567890"
            value={ref}
            onChange={e => setRef(e.target.value)}
            onFocus={e => e.target.style.borderColor = G}
            onBlur={e => e.target.style.borderColor = "#E8EDF4"}
          />
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: method === "CASH" ? "4px" : 0 }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(method, ref.trim())} disabled={!canConfirm || paying}
            style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: !canConfirm ? "#86EFAC" : G, color: "#fff", fontSize: "13px", fontWeight: 600, cursor: !canConfirm ? "not-allowed" : "pointer", boxShadow: "0 2px 8px #16a34a33" }}>
            {paying ? "Processing…" : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reassign Doctor Dialog ──────────────────────────────────────
// For when the current doctor becomes unavailable mid-consultation —
// hands the same patient, with everything already entered, to another
// doctor. No new bill/consultation is created.
function ReassignDoctorDialog({ bill, doctors, onConfirm, onCancel, saving }) {
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  if (!bill) return null;

  const currentKey = bill.doctor_type === "guest"
    ? `guest-${bill.guest_doctor_id_ro}`
    : `registered-${bill.doctor_profile_id}`;

  const options = doctors.filter(d => `${d.doctor_type}-${d.id}` !== currentKey);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", padding: "28px 28px 24px", maxWidth: "440px", width: "calc(100% - 32px)", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1 }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>Reassign Doctor</h3>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px", lineHeight: 1.5 }}>
          Move <strong>{bill.patient_name}</strong>'s ongoing consultation from <strong>{bill.doctor_name}</strong> to another doctor.
          Vitals, notes and anything already entered are kept — the new doctor just continues from here.
        </p>

        <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", display: "block" }}>New doctor</label>
        <select
          value={choice}
          onChange={e => setChoice(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", marginBottom: "14px", background: "#fff" }}
        >
          <option value="">Select a doctor…</option>
          {options.map(d => (
            <option key={`${d.doctor_type}-${d.id}`} value={`${d.doctor_type}-${d.id}`}>
              {d.full_name}{d.specialty_name ? ` — ${d.specialty_name}` : ""}{d.doctor_type === "guest" ? " (Guest)" : ""}
            </option>
          ))}
        </select>
        {options.length === 0 && (
          <p style={{ fontSize: "11.5px", color: "#D97706", marginTop: "-8px", marginBottom: "14px" }}>No other active doctors available right now.</p>
        )}

        <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", display: "block" }}>
          Reason <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Dr. became unavailable mid-consultation"
          style={{ width: "100%", padding: "10px 12px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", marginBottom: "18px", resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => {
              if (!choice) return;
              const idx = choice.indexOf("-");
              const doctorType = choice.slice(0, idx);
              const idStr = choice.slice(idx + 1);
              onConfirm(
                doctorType === "guest" ? { guest_doctor_id: Number(idStr) } : { doctor_id: Number(idStr) },
                reason
              );
            }}
            disabled={!choice || saving}
            style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: !choice ? "#86EFAC" : G, color: "#fff", fontSize: "13px", fontWeight: 600, cursor: !choice ? "not-allowed" : "pointer", boxShadow: "0 2px 8px #16a34a33" }}
          >
            {saving ? "Reassigning…" : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel Appointment Dialog ────────────────────────────────────
// Only ever shown for appointments the doctor hasn't started work on yet
// (consultation_status === "STARTED"). Once a doctor has acted on the
// case, the backend rejects the cancel request outright.
function CancelAppointmentDialog({ bill, onConfirm, onCancel, cancelling }) {
  const [reason, setReason] = useState("");
  const [refundChoice, setRefundChoice] = useState(null); // null | "refund" | "no_refund"

  useEffect(() => {
    setReason("");
    setRefundChoice(null);
  }, [bill?.bill_id]);

  if (!bill) return null;

  // The one-time MRD registration fee only needs a refund decision if it was
  // actually charged AND already collected on this bill. If it's unpaid,
  // there's nothing to refund — cancelling just drops the pending charge.
  const hasMrdFee = parseFloat(bill.registration_fee ?? 0) > 0;
  const mrdFeeCollected = hasMrdFee && bill.payment_status === "PAID";
  const canConfirm = !mrdFeeCollected || refundChoice !== null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", padding: "28px 28px 24px", maxWidth: "420px", width: "calc(100% - 32px)", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1 }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>Cancel Appointment</h3>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px", lineHeight: 1.5 }}>
          Cancel <strong>{bill.patient_name}</strong>'s appointment with <strong>{bill.doctor_name}</strong>?
          This can only be done because the doctor hasn't started the consultation yet.
          {!mrdFeeCollected && bill.payment_status === "PAID" && (
            <> This bill was already marked <strong>paid</strong> — handle any refund separately.</>
          )}
        </p>

        {mrdFeeCollected && (
          <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12.5px", color: "#92400E", margin: "0 0 10px", lineHeight: 1.5 }}>
              This bill includes a <strong>one-time MRD registration fee</strong> of ₹{parseFloat(bill.registration_fee).toLocaleString("en-IN")}, already collected.
              Choose what happens to it:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#78350F", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="mrdRefundChoice"
                  checked={refundChoice === "refund"}
                  onChange={() => setRefundChoice("refund")}
                  style={{ marginTop: "2px" }}
                />
                <span><strong>Refund it</strong> — patient gets the MRD fee back; they'll be charged it again on their next visit.</span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#78350F", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="mrdRefundChoice"
                  checked={refundChoice === "no_refund"}
                  onChange={() => setRefundChoice("no_refund")}
                  style={{ marginTop: "2px" }}
                />
                <span><strong>No refund</strong> — patient keeps their MRD registration; they won't be charged it again.</span>
              </label>
            </div>
          </div>
        )}

        <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", display: "block" }}>
          Reason <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Patient did not show up"
          style={{ width: "100%", padding: "10px 12px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", marginBottom: "18px", resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "9px 20px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Keep appointment</button>
          <button
            onClick={() => onConfirm(reason.trim(), refundChoice === "refund")}
            disabled={cancelling || !canConfirm}
            style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: "#DC2626", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: (cancelling || !canConfirm) ? "not-allowed" : "pointer", boxShadow: "0 2px 8px #dc262633", opacity: canConfirm ? 1 : 0.6 }}
          >
            {cancelling ? "Cancelling…" : "Yes, Cancel Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Bill Dialog ─────────────────────────────────────────────
function EditBillDialog({ bill, onSave, onCancel, saving }) {
  const isPaid = bill?.payment_status === "PAID";

  const [form, setForm] = useState({
    doctor_name:        bill?.doctor_name        ?? "",
    consultation_fee:   bill?.consultation_fee   ?? "",
    consultation_type:  bill?.consultation_type  ?? "NEW",
    travel_charge:      bill?.travel_charge      ?? "0",
    payment_method:     bill?.payment_method     ?? "CASH",
    upi_reference:      bill?.upi_reference      ?? "",
    discount_amount:    bill?.discount_amount    ?? "0",
    notes:              bill?.notes              ?? "",
  });
  const [err, setErr] = useState("");
  const [loadingHomeVisitDefaults, setLoadingHomeVisitDefaults] = useState(false);

  if (!bill) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isHomeVisit = form.consultation_type === "HOME_VISIT";

  // Live subtotal/total preview — subtotal = consultation_fee + registration_fee + travel_charge (Home Visit only)
  const regFeeForCalc = parseFloat(bill.registration_fee ?? 0);
  const travelForCalc = isHomeVisit ? (parseFloat(form.travel_charge || 0) || 0) : 0;
  const subtotalForCalc = parseFloat(form.consultation_fee || 0) + regFeeForCalc + travelForCalc;
  const discountForCalc = parseFloat(form.discount_amount || 0);
  const totalForCalc = Math.max(subtotalForCalc - (isNaN(discountForCalc) ? 0 : discountForCalc), 0);

  const handleSave = () => {
    setErr("");
    if (!isPaid && !form.doctor_name.trim()) { setErr("Doctor name is required."); return; }
    if (!isPaid && (form.consultation_fee === "" || isNaN(parseFloat(form.consultation_fee)))) { setErr("Consultation fee is required."); return; }
    if (!isPaid && isHomeVisit && parseFloat(form.consultation_fee) <= 0) { setErr("Home Visit Fee must be greater than 0."); return; }
    if (!isPaid && isHomeVisit && form.travel_charge !== "" && (isNaN(parseFloat(form.travel_charge)) || parseFloat(form.travel_charge) < 0)) { setErr("Travel charge cannot be negative."); return; }
    if (!isPaid && form.payment_method === "UPI" && !form.upi_reference.trim()) { setErr("UPI reference is required."); return; }
    if (!isPaid && (isNaN(discountForCalc) || discountForCalc < 0)) { setErr("Discount amount cannot be negative."); return; }
    if (!isPaid && discountForCalc > subtotalForCalc) { setErr("Discount amount cannot exceed the bill subtotal."); return; }

    const payload = isPaid
      ? { notes: form.notes }
      : {
          doctor_name:       form.doctor_name.trim(),
          consultation_fee:  parseFloat(form.consultation_fee),
          consultation_type: form.consultation_type,
          travel_charge:     isHomeVisit ? (parseFloat(form.travel_charge) || 0) : 0,
          payment_method:    form.payment_method,
          discount_amount:   isNaN(discountForCalc) ? 0 : discountForCalc,
          notes:             form.notes,
          ...(form.payment_method === "UPI" && { upi_reference: form.upi_reference.trim() }),
        };

    onSave(payload);
  };

  const inp = {
    padding: "10px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4",
    fontSize: "14px", color: "#1E293B", outline: "none", width: "100%",
    boxSizing: "border-box", background: "#fff", transition: "border-color 0.15s",
  };
  const lbl = { fontSize: "11.5px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" };
  const Field = ({ label, children }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>{
      label && <label style={lbl}>{label}</label>
    }{children}</div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onCancel} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "18px", padding: "28px", maxWidth: "480px", width: "calc(100% - 32px)", margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Edit Bill</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "3px" }}>
              {bill.bill_number} · {bill.patient_name}
              {isPaid && <span style={{ marginLeft: "8px", color: "#D97706", fontWeight: 600 }}>Paid — only notes editable</span>}
            </p>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "4px" }}>
            <Ico d="M18 6 6 18 M6 6l12 12" size={18} />
          </button>
        </div>

        {err && (
          <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "9px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: "13px", fontWeight: 500 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Doctor name — always shown, disabled for paid */}
          <Field label="Doctor Name">
            <input
              style={{ ...inp, background: isPaid ? "#F8FAFC" : "#fff", color: isPaid ? "#94A3B8" : "#1E293B" }}
              value={form.doctor_name}
              disabled={isPaid}
              onChange={e => set("doctor_name", e.target.value)}
              onBlur={e => {
                const t = form.doctor_name.trim();
                if (t && !t.toLowerCase().startsWith("dr")) set("doctor_name", `Dr. ${t}`);
              }}
              onFocus={e => { if (!isPaid) e.target.style.borderColor = G; }}
              placeholder="Dr. Name"
            />
          </Field>

          {/* Fee + Type */}
          {!isPaid && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <Field label={isHomeVisit ? "Home Visit Fee (₹)" : "Consultation Fee (₹)"}>
                <input
                  type="number" min="0"
                  style={{ ...inp, fontSize: "17px", fontWeight: 700, color: G }}
                  value={form.consultation_fee}
                  onChange={e => set("consultation_fee", e.target.value)}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                />
                {parseFloat(bill.registration_fee ?? 0) > 0 && (
                  <p style={{ fontSize: "10.5px", color: "#94A3B8", margin: "2px 0 0" }}>
                    + ₹{parseFloat(bill.registration_fee).toLocaleString("en-IN")} MRD registration fee is added automatically — total: ₹{(parseFloat(form.consultation_fee || 0) + parseFloat(bill.registration_fee)).toLocaleString("en-IN")}
                  </p>
                )}
              </Field>
              <Field label="Consultation Type">
                <select
                  style={{ ...inp, cursor: "pointer" }}
                  value={form.consultation_type}
                  onChange={async e => {
                    const t = e.target.value;
                    set("consultation_type", t);
                    if (t === "REVISIT") {
                      set("consultation_fee", "0");
                    } else if (t === "HOME_VISIT") {
                      setLoadingHomeVisitDefaults(true);
                      try {
                        const defaults = await getHomeVisitDefaults();
                        setForm(f => ({
                          ...f,
                          consultation_type: t,
                          consultation_fee: String(defaults.default_home_visit_fee ?? ""),
                          travel_charge:    String(defaults.default_home_visit_travel_charge ?? "0"),
                        }));
                      } catch { /* leave existing values — reception can still enter manually */ }
                      finally { setLoadingHomeVisitDefaults(false); }
                    }
                  }}>
                  <option value="NEW">New</option>
                  <option value="REVISIT">Revisit (₹0)</option>
                  <option value="HOME_VISIT">Home Visit</option>
                </select>
              </Field>
            </div>
          )}

          {/* Travel Charge — Home Visit only */}
          {!isPaid && isHomeVisit && (
            <Field label="Travel Charge (₹)">
              <input
                type="number" min="0"
                style={inp}
                value={form.travel_charge}
                disabled={loadingHomeVisitDefaults}
                onChange={e => set("travel_charge", e.target.value)}
                onFocus={e => e.target.style.borderColor = G}
                onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                placeholder="0"
              />
              <p style={{ fontSize: "10.5px", color: "#94A3B8", margin: "2px 0 0" }}>Optional — defaults to ₹0 if left blank</p>
            </Field>
          )}

          {/* Discount + live summary */}
          {!isPaid && (
            <Field label="Discount (₹)">
              <input
                type="number" min="0"
                style={inp}
                value={form.discount_amount}
                onChange={e => set("discount_amount", e.target.value)}
                onFocus={e => e.target.style.borderColor = G}
                onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                placeholder="0"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "4px", padding: "10px 12px", borderRadius: "9px", background: "#F8FAFC", fontSize: "12px", color: "#475569" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>₹{subtotalForCalc.toLocaleString("en-IN")}</span></div>
                {isHomeVisit && travelForCalc > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>(incl. Travel Charge)</span><span>₹{travelForCalc.toLocaleString("en-IN")}</span></div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span>− ₹{(isNaN(discountForCalc) ? 0 : discountForCalc).toLocaleString("en-IN")}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0F172A", paddingTop: "4px", borderTop: "1px dashed #E2E8F0" }}><span>Total Payable</span><span>₹{totalForCalc.toLocaleString("en-IN")}</span></div>
              </div>
            </Field>
          )}

          {/* Payment method + UPI ref */}
          {!isPaid && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Field label="Payment Method">
                <select
                  style={{ ...inp, cursor: "pointer" }}
                  value={form.payment_method}
                  onChange={e => set("payment_method", e.target.value)}>
                  <option value="CASH">💵  Cash</option>
                  <option value="UPI">📱  UPI</option>
                </select>
              </Field>
              {form.payment_method === "UPI" && (
                <Field label="UPI Reference">
                  <input
                    style={inp}
                    placeholder="e.g. TXN1234567890"
                    value={form.upi_reference}
                    onChange={e => set("upi_reference", e.target.value)}
                    onFocus={e => e.target.style.borderColor = G}
                    onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                  />
                </Field>
              )}
            </div>
          )}

          {/* Notes — always editable */}
          <Field label="Notes">
            <textarea rows={2}
              style={{ ...inp, resize: "none", lineHeight: 1.5, fontSize: "13px" }}
              placeholder="Any remarks…"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              onFocus={e => e.target.style.borderColor = G}
              onBlur={e => e.target.style.borderColor = "#E8EDF4"}
            />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
          <button onClick={onCancel} style={{ padding: "10px 22px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "10px 22px", borderRadius: "9px", border: "none", background: saving ? "#86EFAC" : G, color: "#fff", fontSize: "13px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 2px 8px #16a34a33", display: "flex", alignItems: "center", gap: "7px" }}>
            <Ico d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8" size={14} color="#fff" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}


const DoctorCard = ({ d, selected, onClick }) => (
  <div onClick={onClick} style={{
    padding: "14px 16px", borderRadius: "12px", border: "2px solid",
    borderColor: selected ? G : "#E8EDF4",
    background: selected ? "#F0FDF4" : "#fff",
    cursor: "pointer", transition: "all 0.15s",
    display: "flex", alignItems: "center", gap: "12px",
    boxShadow: selected ? "0 4px 12px rgba(22,163,74,0.12)" : "0 1px 2px rgba(0,0,0,0.03)",
  }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "#CBD5E1"; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "#E8EDF4"; }}
  >
    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: selected ? G : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: selected ? "#fff" : "#64748B", flexShrink: 0 }}>
      {(d.full_name?.[0] ?? "D").toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.full_name}</div>
      <div style={{ fontSize: "11.5px", color: "#64748B" }}>{d.specialty_name ?? "General"}</div>
    </div>
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: G }}>₹{Math.floor(d.consultation_fee ?? 0)}</div>
      {selected && <Ico d="M20 6 9 17l-5-5" size={14} color={G} />}
    </div>
  </div>
);

// ─── Bill Creator ────────────────────────────────────────────────
function BillCreator({ onClose, onCreated, patients, doctors, preselectedPatient }) {
  // step: 1=Patient  2=Doctor  3=Details
  // If a patient is preselected (booked from Patients page), start at step 2
  const [step, setStep] = useState(preselectedPatient ? 2 : 1);

  // Doctor mode: "active" = pick from list  |  "common" = type name manually
  const [doctorMode, setDoctorMode] = useState("active");
  const [commonName, setCommonName] = useState("");
  const [commonNameErr, setCommonNameErr] = useState("");
  const [guestDoctorName, setGuestDoctorName] = useState("");
  const [guestDoctorNameErr, setGuestDoctorNameErr] = useState("");

  const [form, setForm] = useState({
    patient:             preselectedPatient ?? null,
    doctor:              null,
    billed_department:   null,
    fee:                 "",
    travel_charge:       "0",
    method:              "CASH",
    upi_reference:       "",
    discount_amount:     "",
    notes:               "",
    type:                "NEW",
    is_revisit_eligible: false,
    revisit_message:    "",
  });

  const [patSearch, setPatSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  // Manager-curated billing-department dropdown (Step 3) — plain <select>
  // rather than a searchable combobox since this list is expected to stay
  // small (tens, not hundreds); see getBillingDepartments() for why it's
  // fetched with an explicit page_size instead of relying on the default.
  const [deptOptions, setDeptOptions] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [toast,  setToast]        = useState(null);
  const [loadingHomeVisitDefaults, setLoadingHomeVisitDefaults] = useState(false);

  // One-time MRD registration fee amount (HospitalSettings.mrd_registration_fee),
  // fetched once so the Bill Summary can show the actual ₹ figure — and fold it
  // into Total Payable — instead of a vague "added on generate" placeholder.
  // Same branch-scoped endpoint already used to prefill Home Visit defaults;
  // null while loading / if the fetch fails, in which case the summary falls
  // back to the advisory note only.
  const [mrdFee, setMrdFee] = useState(null);
  useEffect(() => {
    getHomeVisitDefaults()
      .then(defaults => setMrdFee(parseFloat(defaults.mrd_registration_fee ?? 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getBillingDepartments().then(setDeptOptions).catch(() => {});
  }, []);

  // ── Auto-run follow-up check when patient is preselected ──────
  useEffect(() => {
    if (!preselectedPatient) return;
    checkFollowUp(preselectedPatient.patient_id)
      .then(res => {
        // ✅ BUG 3 NOTE: Backend now returns is_revisit_eligible and message
        // (previously returned eligible and reason — keys didn't match and
        // the revisit flow was always silently broken).
        // NOTE: only surface eligibility/message here — don't auto-flip
        // `type` to REVISIT. The consultation type stays whatever it was
        // (defaults to NEW), and Free Revisit only becomes the selected
        // type if reception explicitly picks it from the Type dropdown,
        // same as the Convert-to-Bill dialog.
        setForm(f => ({
          ...f,
          is_revisit_eligible: res.is_revisit_eligible,
          revisit_message:     res.message,
        }));
      })
      .catch(() => {});
  }, [preselectedPatient]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Derived label shown in sidebar step 2
  const doctorLabel = doctorMode === "active"
    ? (form.doctor?.full_name ?? null)
    : form.doctor?.doctor_type === "guest"
      ? (guestDoctorName.trim() || form.doctor?.full_name || null)
      : (commonName.trim() || null);

  // ── filtered lists ───────────────────────────────────────────
  const filtPat = patients.filter(p => {
    const q = patSearch.toLowerCase();
    return !q || (p.full_name ?? "").toLowerCase().includes(q) || (p.mrd_number ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });

  const filtDoc = doctors.filter(d => {
    if (d.doctor_type === "guest") return false; // guests go in the other tab
    const q = docSearch.toLowerCase();
    return !q || (d.full_name ?? "").toLowerCase().includes(q) || (d.specialty_name ?? "").toLowerCase().includes(q);
  });

  const filtGuestDoc = doctors.filter(d => {
    if (d.doctor_type !== "guest") return false;
    const q = docSearch.toLowerCase();
    return !q || (d.full_name ?? "").toLowerCase().includes(q) || (d.specialty_name ?? "").toLowerCase().includes(q);
  });

  // ── Patient select ────────────────────────────────────────────
  const handleSelectPatient = async (p) => {
    setForm(f => ({ ...f, patient: p, type: "NEW", fee: "", is_revisit_eligible: false, revisit_message: "" }));
    setPatSearch("");
    setStep(2);
    // background revisit check
    try {
      const res = await checkFollowUp(p.patient_id);
      // ✅ BUG 3 NOTE: reading is_revisit_eligible and message (fixed backend keys)
      // NOTE: only surface eligibility/message — don't auto-flip `type` to
      // REVISIT. Stays NEW by default; Free Revisit is only used if
      // reception explicitly selects it from the Type dropdown.
      setForm(f => ({
        ...f,
        is_revisit_eligible: res.is_revisit_eligible,
        revisit_message:     res.message,
      }));
    } catch { /* silently ignore */ }
  };

  // Convenience pre-fill only — matches the doctor's free-text `department`
  // against the manager-curated BillingDepartment list by name. The backend
  // does its own authoritative match/override if billed_department is left
  // null, so no need to handle a "no match" case here beyond falling back
  // to null (→ "Auto" in the dropdown).
  const matchBillingDepartment = (d) =>
    deptOptions.find(
      o => o.name.toLowerCase() === (d.department ?? "").trim().toLowerCase()
    ) ?? null;

  // ── Active doctor select ──────────────────────────────────────
  const handleSelectActiveDoctor = (d) => {
    setForm(f => ({
      ...f,
      doctor: d,
      billed_department: matchBillingDepartment(d),
      fee:    f.type === "REVISIT" ? "0" : String(d.consultation_fee ?? "0"),
    }));
    setDocSearch("");
    setStep(3);
  };

  const handleSelectGuestDoctor = (d) => {
    setForm(f => ({
      ...f,
      doctor: d,
      billed_department: matchBillingDepartment(d),
      fee:    f.type === "REVISIT" ? "0" : String(d.consultation_fee ?? "0"),
    }));
    // Pre-fill name from the profile, ensuring "Dr." prefix
    const raw = (d.full_name ?? "").trim();
    setGuestDoctorName(raw && !raw.toLowerCase().startsWith("dr") ? `Dr. ${raw}` : raw);
    setGuestDoctorNameErr("");
    setDocSearch("");
    // Stay on step 2 — reception must confirm / edit the printed name before continuing
  };

  // ── Common doctor confirm ─────────────────────────────────────
  const handleConfirmCommonDoctor = () => {
    if (!commonName.trim()) { setCommonNameErr("Please enter the doctor's name."); return; }
    setCommonNameErr("");
    // fee stays blank; user fills it in Step 3
    setForm(f => ({ ...f, doctor: null, fee: f.type === "REVISIT" ? "0" : "" }));
    setStep(3);
  };

  const handleCreate = async () => {
    setToast(null);

    if (!form.patient) {
      setToast({ msg: "No patient selected.", err: true });
      return;
    }

    if (doctorMode === "common" && !commonName.trim() && !form.doctor) {
      setToast({ msg: "Please enter the guest doctor's name.", err: true });
      return;
    }

    if (doctorMode === "common" && form.doctor?.doctor_type === "guest" && !guestDoctorName.trim()) {
      setToast({ msg: "Please enter the doctor's name for the bill.", err: true });
      return;
    }

    if (doctorMode === "active" && !form.doctor) {
      setToast({ msg: "No doctor selected.", err: true });
      return;
    }

    if (form.fee === "" || form.fee === null) {
      setToast({ msg: "Consultation fee is required.", err: true });
      return;
    }

    if (form.type !== "REVISIT" && parseFloat(form.fee) < 0) {
      setToast({ msg: "Fee cannot be negative.", err: true });
      return;
    }

    if (form.type === "HOME_VISIT" && (isNaN(parseFloat(form.fee)) || parseFloat(form.fee) <= 0)) {
      setToast({ msg: "Home Visit Fee must be greater than 0.", err: true });
      return;
    }

    if (form.type === "HOME_VISIT" && form.travel_charge !== "" && (isNaN(parseFloat(form.travel_charge)) || parseFloat(form.travel_charge) < 0)) {
      setToast({ msg: "Travel charge cannot be negative.", err: true });
      return;
    }

    if (form.method === "UPI" && !form.upi_reference.trim()) {
      setToast({ msg: "UPI reference number is required.", err: true });
      return;
    }

    const discountVal = parseFloat(form.discount_amount || 0);
    if (form.discount_amount !== "" && (isNaN(discountVal) || discountVal < 0)) {
      setToast({ msg: "Discount amount cannot be negative.", err: true });
      return;
    }
    const feeForCheck = (parseFloat(form.fee) || 0) + (form.type === "HOME_VISIT" ? (parseFloat(form.travel_charge) || 0) : 0);
    if (!isNaN(discountVal) && discountVal > feeForCheck) {
      setToast({ msg: "Discount amount cannot exceed the bill subtotal.", err: true });
      return;
    }

    // Warn if using manual doctor entry (no profile in system)
    if (doctorMode === "common" && !form.doctor?.id) {
      const proceed = window.confirm(
        `⚠️  Doctor Not in System\n\n` +
        `The doctor "${commonName}" is not registered in the system.\n\n` +
        `The appointment WILL BE CREATED, but:\n` +
        `• The doctor may NOT see it in their queue\n` +
        `• No automated notification will be sent\n` +
        `• Consider adding this doctor as an Active or Guest profile first\n\n` +
        `Continue anyway?`
      );

      if (!proceed) {
        setToast({
          msg: "Appointment creation cancelled. Please add the doctor to the system first.",
          err: false
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        patient:          form.patient.patient_id,
        consultation_fee: parseFloat(form.fee) || 0,
        payment_method:   form.method,
        consultation_type: form.type,
        travel_charge:    form.type === "HOME_VISIT" ? (parseFloat(form.travel_charge) || 0) : 0,
        discount_amount:  isNaN(discountVal) ? 0 : discountVal,
        ...(form.method === "UPI" && { upi_reference: form.upi_reference }),
        ...(form.notes.trim()    && { notes: form.notes }),
        // Only sent when reception explicitly overrides — leaving it out lets
        // the backend's own doctor-department auto-match apply as the default.
        ...(form.billed_department?.department_id && { billed_department: form.billed_department.department_id }),
      };

      if (doctorMode === "active") {
        // Scenario A — registered DoctorProfile; backend returns "id" = profile_id
        payload.doctor = form.doctor.id;
        // doctor_name is auto-populated by the serializer from the profile
      } else if (form.doctor?.doctor_type === "guest") {
        // Scenario B — Guest doctor profile selected from the list
        payload.guest_doctor = form.doctor.id;
        payload.doctor_name  = guestDoctorName.trim();
      } else {
        // Scenario C — free-text name (no profile)
        payload.doctor_name = commonName.trim();
      }

      const created = await createBill(payload);

      let successMsg = "✅ Appointment created successfully";

      if (doctorMode === "common" && !form.doctor?.id) {
        successMsg += " (⚠️  doctor may need to be added to system)";
      } else if (doctorMode === "active" || (doctorMode === "common" && form.doctor?.id)) {
        successMsg += " and doctor notified";
      }

      // Surface the combined total (consultation fee + one-time MRD
      // registration fee, if any) that the backend actually computed —
      // rather than just the consultation fee entered in the form.
      const createdRegFee = parseFloat(created?.registration_fee ?? 0);
      const createdTotal  = created?.total_amount != null ? parseFloat(created.total_amount) : null;
      if (createdTotal != null && createdRegFee > 0) {
        successMsg += ` · Bill total ₹${createdTotal.toLocaleString("en-IN")} (incl. ₹${createdRegFee.toLocaleString("en-IN")} MRD registration fee)`;
      }

      setToast({ ok: true, msg: successMsg });
      onCreated();
      onClose();

    } catch (e) {
      const d = e?.response?.data;
      let msg = "Failed to create bill. Please try again.";
      if (d) msg = typeof d === "string" ? d : Object.values(d).flat().join(", ");
      setToast({ msg: msg.slice(0, 200), err: true });
    } finally {
      setSaving(false);
    }
  };

  // ── Common styles ─────────────────────────────────────────────
  const inputStyle = {
    padding: "10px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4",
    fontSize: "14px", color: "#1E293B", outline: "none", width: "100%",
    boxSizing: "border-box", background: "#fff", transition: "border-color 0.15s",
  };
  const labelStyle = { fontSize: "11.5px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" };

  // ── Tab button for doctor-mode toggle ─────────────────────────
  const ModeTab = ({ mode, label, icon }) => {
    const active = doctorMode === mode;
    return (
      <button onClick={() => { setDoctorMode(mode); setCommonNameErr(""); }}
        style={{
          flex: 1, padding: "11px 10px", borderRadius: "10px", border: "2px solid",
          borderColor: active ? G : "#E8EDF4",
          background: active ? "#F0FDF4" : "#F8FAFC",
          color: active ? "#15803D" : "#64748B",
          fontSize: "13px", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          transition: "all 0.15s",
        }}>
        <Ico d={icon} size={15} color={active ? G : "#94A3B8"} />
        {label}
      </button>
    );
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "10px 0" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
        <button onClick={onClose} style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1.5px solid #E8EDF4", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ico d="M19 12H5 M12 19l-7-7 7-7" size={18} color="#475569" />
        </button>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>New Consultation Bill</h2>
      </div>

      <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
        {/* ── Sidebar progress ── */}
        <div style={{ width: "210px", flexShrink: 0, position: "sticky", top: "24px" }}>
          {[
            { n: 1, l: "Select Patient",  detail: form.patient ? `${form.patient.full_name} · ${form.patient.mrd_number}` : null },
            { n: 2, l: "Assign Doctor",   detail: doctorLabel ? (doctorMode === "common" ? `${doctorLabel} (Guest)` : doctorLabel) : null },
            { n: 3, l: "Bill Details",    detail: form.fee !== "" ? `₹${form.fee} · ${form.type === "REVISIT" ? "Revisit" : "New"}` : null },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: "14px", marginBottom: "24px", opacity: step === s.n ? 1 : step > s.n ? 0.75 : 0.4 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{
                  width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
                  background: step > s.n ? G : step === s.n ? G : "#E2E8F0",
                  color: step >= s.n ? "#fff" : "#94A3B8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                }}>
                  {step > s.n ? <Ico d="M20 6 9 17l-5-5" size={13} color="#fff" /> : s.n}
                </div>
                {s.n < 3 && <div style={{ width: "2px", height: "20px", background: step > s.n ? G : "#E2E8F0", borderRadius: "1px" }} />}
              </div>
              <div style={{ paddingTop: "3px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{s.l}</div>
                {s.detail && <div style={{ fontSize: "11.5px", color: G, marginTop: "2px", fontWeight: 500 }}>{s.detail}</div>}
              </div>
            </div>
          ))}

          {/* Common doctor indicator (sidebar only) */}
          {step >= 2 && doctorMode === "common" && (
            <div style={{ padding: "10px 12px", borderRadius: "10px", background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: "12px", color: "#92400E", fontWeight: 500, display: "flex", gap: "7px", alignItems: "flex-start" }}>
              <Ico d="M12 9v4 M12 17h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={14} color="#D97706" />
              <span>Common Doctor mode — fee must be entered manually.</span>
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, maxWidth: "700px" }}>
          {toast && (
            <div style={{ marginBottom: "20px", padding: "12px 16px", borderRadius: "10px", background: toast.err ? "#FEF2F2" : "#F0FDF4", color: toast.err ? "#DC2626" : G, border: `1px solid ${toast.err ? "#FECACA" : "#BBF7D0"}`, fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <Ico d={toast.err ? "M18 6 6 18 M6 6l12 12" : "M20 6 9 17l-5-5"} size={14} color={toast.err ? "#DC2626" : G} style={{ flexShrink: 0, marginTop: "1px" }} />
              {toast.msg}
            </div>
          )}

          {/* ════════ STEP 1 — Patient ════════ */}
          {step === 1 && (
            <div>
              <div style={{ position: "relative", marginBottom: "18px" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                  <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={16} />
                </span>
                <input autoFocus
                  style={{ ...inputStyle, paddingLeft: "40px", fontSize: "15px", padding: "13px 14px 13px 40px" }}
                  placeholder="Search by name, MRD number or phone…"
                  value={patSearch}
                  onChange={e => setPatSearch(e.target.value)}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                />
              </div>
              {filtPat.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: "12px", border: "1.5px dashed #E2E8F0" }}>
                  <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={32} color="#CBD5E1" />
                  <p style={{ marginTop: "10px", fontWeight: 500 }}>No patients found.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {filtPat.map(p => (
                    <div key={p.patient_id} onClick={() => handleSelectPatient(p)}
                      style={{
                        padding: "13px 15px", borderRadius: "12px", border: "2px solid",
                        borderColor: form.patient?.patient_id === p.patient_id ? G : "#E8EDF4",
                        background: form.patient?.patient_id === p.patient_id ? "#F0FDF4" : "#fff",
                        cursor: "pointer", transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: "11px",
                      }}
                      onMouseEnter={e => { if (form.patient?.patient_id !== p.patient_id) e.currentTarget.style.borderColor = "#CBD5E1"; }}
                      onMouseLeave={e => { if (form.patient?.patient_id !== p.patient_id) e.currentTarget.style.borderColor = "#E8EDF4"; }}
                    >
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: G, flexShrink: 0 }}>
                        {(p.full_name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.full_name}</div>
                        <div style={{ fontSize: "11.5px", color: "#94A3B8" }}>{p.mrd_number} · {p.phone}</div>
                      </div>
                      {form.patient?.patient_id === p.patient_id && <Ico d="M20 6 9 17l-5-5" size={14} color={G} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ STEP 2 — Doctor ════════ */}
          {step === 2 && (
            <div>
              {/* ── Mode toggle ── */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ ...labelStyle, marginBottom: "10px" }}>Doctor Type</p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <ModeTab mode="active" label="Active Doctor" icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                  <ModeTab mode="common" label="Common / Guest Doctor" icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
                </div>
              </div>

              {/* ── Active Doctor panel ── */}
              {doctorMode === "active" && (
                <div>
                  <div style={{ position: "relative", marginBottom: "14px" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                      <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={15} />
                    </span>
                    <input
                      style={{ ...inputStyle, paddingLeft: "38px" }}
                      placeholder="Search by name or specialty…"
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      onFocus={e => e.target.style.borderColor = G}
                      onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                    />
                  </div>

                  {filtDoc.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: "12px", border: "1.5px dashed #E2E8F0" }}>
                      <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={32} color="#CBD5E1" />
                      <p style={{ marginTop: "10px", fontWeight: 500 }}>No active doctors found.</p>
                      <p style={{ fontSize: "12px", marginTop: "4px" }}>Switch to <strong>Common / Guest Doctor</strong> above to enter a name manually.</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {filtDoc.map(d => (
                        <DoctorCard key={d.id} d={d}
                          selected={form.doctor?.id === d.id}
                          onClick={() => handleSelectActiveDoctor(d)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Common / Guest Doctor panel ── */}
              {doctorMode === "common" && (
                <div>
                  <div style={{ position: "relative", marginBottom: "14px" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                      <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={15} />
                    </span>
                    <input
                      style={{ ...inputStyle, paddingLeft: "38px" }}
                      placeholder="Search guest doctors…"
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      onFocus={e => e.target.style.borderColor = G}
                      onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                    />
                  </div>

                  {filtGuestDoc.length > 0 ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                        {filtGuestDoc.map(d => (
                          <DoctorCard key={d.id} d={d}
                            selected={form.doctor?.id === d.id}
                            onClick={() => handleSelectGuestDoctor(d)} />
                        ))}
                      </div>

                      {/* Name confirm — shown once a guest card is selected */}
                      {form.doctor?.doctor_type === "guest" && (
                        <div style={{ borderTop: "1.5px solid #E8EDF4", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ ...labelStyle }}>Doctor Name for Bill <span style={{ color: "#EF4444" }}>*</span></label>
                            <div style={{ position: "relative" }}>
                              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                                <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={15} />
                              </span>
                              <input
                                style={{ ...inputStyle, paddingLeft: "38px", borderColor: guestDoctorNameErr ? "#EF4444" : "#E8EDF4" }}
                                placeholder="Dr. Rajesh Sharma"
                                value={guestDoctorName}
                                onChange={e => { setGuestDoctorName(e.target.value); setGuestDoctorNameErr(""); }}
                                onFocus={e => e.target.style.borderColor = G}
                                onBlur={e => {
                                  const trimmed = guestDoctorName.trim();
                                  if (trimmed && !trimmed.toLowerCase().startsWith("dr")) {
                                    setGuestDoctorName(`Dr. ${trimmed}`);
                                  }
                                  e.target.style.borderColor = guestDoctorNameErr ? "#EF4444" : "#E8EDF4";
                                }}
                              />
                            </div>
                            {guestDoctorNameErr && <p style={{ fontSize: "12px", color: "#EF4444", margin: 0 }}>{guestDoctorNameErr}</p>}
                          </div>
                          <button
                            onClick={() => {
                              const trimmed = guestDoctorName.trim();
                              if (!trimmed) { setGuestDoctorNameErr("Doctor name is required."); return; }
                              const final = trimmed.toLowerCase().startsWith("dr") ? trimmed : `Dr. ${trimmed}`;
                              setGuestDoctorName(final);
                              setGuestDoctorNameErr("");
                              setStep(3);
                            }}
                            style={{
                              padding: "11px", borderRadius: "10px", border: "none",
                              background: G, color: "#fff", fontSize: "14px", fontWeight: 600,
                              cursor: "pointer", boxShadow: "0 2px 8px #16a34a33",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            }}>
                            <Ico d="M5 12h14 M12 5l7 7-7 7" size={16} color="#fff" />
                            Continue
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* No guest profiles — fall back to free-text entry */
                    <div style={{ background: "#F8FAFC", border: "1.5px solid #E8EDF4", borderRadius: "14px", padding: "20px 22px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                        <label style={{ ...labelStyle }}>Doctor Full Name <span style={{ color: "#EF4444" }}>*</span></label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                            <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" size={15} />
                          </span>
                          <input
                            autoFocus
                            style={{ ...inputStyle, paddingLeft: "38px", borderColor: commonNameErr ? "#EF4444" : "#E8EDF4", background: "#FAFCFF" }}
                            placeholder="Rajesh Sharma"
                            value={commonName}
                            onChange={e => { setCommonName(e.target.value); setCommonNameErr(""); }}
                            onFocus={e => e.target.style.borderColor = G}
                            onBlur={e => {
                              const trimmed = commonName.trim();
                              if (trimmed && !trimmed.toLowerCase().startsWith("dr")) {
                                setCommonName(`Dr. ${trimmed}`);
                              }
                              e.target.style.borderColor = commonNameErr ? "#EF4444" : "#E8EDF4";
                            }}
                          />
                        </div>
                        {commonNameErr && <p style={{ fontSize: "12px", color: "#EF4444", margin: 0 }}>{commonNameErr}</p>}
                      </div>
                      <button onClick={handleConfirmCommonDoctor} style={{
                        width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                        background: G, color: "#fff", fontSize: "14px", fontWeight: 600,
                        cursor: "pointer", boxShadow: "0 2px 8px #16a34a33",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      }}>
                        <Ico d="M5 12h14 M12 5l7 7-7 7" size={16} color="#fff" />
                        Continue with Guest Doctor
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setStep(1)} style={{ marginTop: "18px", background: "none", border: "none", color: "#64748B", fontSize: "13px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                <Ico d="M19 12H5 M12 19l-7-7 7-7" size={13} color="#64748B" />
                Back to Patient
              </button>
            </div>
          )}

          {/* ════════ STEP 3 — Bill Details ════════ */}
          {step === 3 && (
            <div style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid #E8EDF4", padding: "24px", maxWidth: "520px" }}>
              {/* Revisit eligible notice */}
              {form.is_revisit_eligible && (
                <div style={{ marginBottom: "18px", padding: "12px 14px", borderRadius: "10px", background: "#F0FDF4", color: G, border: "1px solid #BBF7D0", fontSize: "13px", fontWeight: 500, display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <Ico d="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3" size={15} color={G} />
                  {form.revisit_message || "Patient is eligible for a FREE revisit consultation."}
                </div>
              )}

              {/* Not eligible, but backend told us why (e.g. last visit was
                  cancelled) — surface it so reception isn't left guessing
                  why a recent-looking visit isn't offering a free revisit. */}
              {!form.is_revisit_eligible && form.revisit_message && (
                <div style={{ marginBottom: "18px", padding: "12px 14px", borderRadius: "10px", background: "#F8FAFC", color: "#64748B", border: "1px solid #E8EDF4", fontSize: "12.5px", fontWeight: 500, display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <Ico d="M13 16h-1v-4h-1 M12 8h.01 M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" size={15} color="#94A3B8" />
                  {form.revisit_message}
                </div>
              )}

              {/* Consultation type — always selectable; Revisit only offered when eligible */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                <label style={labelStyle}>Consultation Type</label>
                <select
                  style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", background: "#fff", cursor: "pointer" }}
                  value={form.type}
                  onChange={async e => {
                    const t = e.target.value;
                    if (t === "HOME_VISIT") {
                      setLoadingHomeVisitDefaults(true);
                      try {
                        const defaults = await getHomeVisitDefaults();
                        setForm(f => ({
                          ...f, type: t,
                          fee: String(defaults.default_home_visit_fee ?? ""),
                          travel_charge: String(defaults.default_home_visit_travel_charge ?? "0"),
                        }));
                      } catch {
                        setForm(f => ({ ...f, type: t, fee: "", travel_charge: "0" }));
                      } finally { setLoadingHomeVisitDefaults(false); }
                      return;
                    }
                    setForm(f => ({
                      ...f, type: t,
                      fee: t === "REVISIT" ? "0"
                        : doctorMode === "active" ? String(f.doctor?.consultation_fee ?? "")
                        : "",        // common doctor → manual entry
                      travel_charge: "0",
                    }));
                  }}>
                  {form.is_revisit_eligible && (
                    <option value="REVISIT">Revisit Consultation (₹0 — Free)</option>
                  )}
                  <option value="NEW">
                    New Consultation
                    {doctorMode === "active" && form.doctor ? ` (₹${parseFloat(form.doctor.consultation_fee ?? 0)})` : ""}
                  </option>
                  <option value="HOME_VISIT">Home Visit</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>
                {/* Consultation Fee */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={labelStyle}>{form.type === "HOME_VISIT" ? "Home Visit Fee (₹)" : "Consultation Fee (₹)"} <span style={{ color: "#EF4444" }}>*</span></label>
                  <input
                    type="number" min="0"
                    // READ-ONLY only for active-doctor NEW (fee matches profile) | EDITABLE for common-doctor, follow-up override, or Home Visit
                    readOnly={doctorMode === "active" && form.type === "NEW"}
                    disabled={form.type === "HOME_VISIT" && loadingHomeVisitDefaults}
                    style={{
                      padding: "11px 14px", borderRadius: "9px",
                      border: "1.5px solid #E8EDF4", fontSize: "18px", fontWeight: 700,
                      background: (doctorMode === "active" && form.type === "NEW") ? "#F8FAFC" : "#fff",
                      color: G, outline: "none", width: "100%", boxSizing: "border-box",
                    }}
                    value={form.fee}
                    onChange={e => {
                      // Only allow changes when editable
                      if (doctorMode === "common" || form.type === "REVISIT" || form.type === "HOME_VISIT") set("fee", e.target.value);
                    }}
                    onFocus={e => { if (doctorMode === "common" || form.type === "REVISIT" || form.type === "HOME_VISIT") e.target.style.borderColor = G; }}
                    onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                  />
                  <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>
                    {form.type === "REVISIT"
                      ? "Free revisit — fee locked at ₹0"
                      : form.type === "HOME_VISIT"
                        ? "Home Visit Fee — mandatory, must be greater than ₹0"
                        : doctorMode === "active"
                          ? `Fixed rate for ${form.doctor?.full_name ?? "selected doctor"}`
                          : "Enter the fee agreed with the guest doctor"}
                  </p>
                </div>

                {/* Payment Method */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={labelStyle}>Payment Method</label>
                  <select
                    style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", background: "#fff", cursor: "pointer", outline: "none" }}
                    value={form.method}
                    onChange={e => set("method", e.target.value)}>
                    <option value="CASH">💵  Cash</option>
                    <option value="UPI">📱  UPI</option>
                  </select>
                </div>
              </div>

              {/* Billed Department */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                <label style={labelStyle}>Billed Department</label>
                <select
                  style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", background: "#fff", cursor: "pointer", outline: "none" }}
                  value={form.billed_department?.department_id ?? ""}
                  onChange={e => {
                    const dept = deptOptions.find(o => String(o.department_id) === e.target.value) ?? null;
                    set("billed_department", dept);
                  }}>
                  <option value="">Auto (doctor's own department)</option>
                  {deptOptions.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>
                  Defaults to {form.doctor?.department || "the selected doctor's own department"} — change this if the patient is actually being billed under a different department (e.g. seen in Emergency).
                </p>
              </div>

              {/* UPI Reference */}
              {form.method === "UPI" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                  <label style={labelStyle}>UPI Reference Number <span style={{ color: "#EF4444" }}>*</span></label>
                  <input
                    style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box" }}
                    placeholder="e.g. TXN987654321"
                    value={form.upi_reference}
                    onChange={e => set("upi_reference", e.target.value)}
                    onFocus={e => e.target.style.borderColor = G}
                    onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                  />
                  <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>Verify transaction ID before generating bill.</p>
                </div>
              )}

              {/* Travel Charge — Home Visit only */}
              {form.type === "HOME_VISIT" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                  <label style={labelStyle}>Travel Charge (₹)</label>
                  <input
                    type="number" min="0"
                    disabled={loadingHomeVisitDefaults}
                    style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box" }}
                    placeholder="0"
                    value={form.travel_charge}
                    onChange={e => set("travel_charge", e.target.value)}
                    onFocus={e => e.target.style.borderColor = G}
                    onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                  />
                  <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>Optional — defaults to ₹0 if left blank</p>
                </div>
              )}

              {/* Discount */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                <label style={labelStyle}>Discount (₹)</label>
                <input
                  type="number" min="0"
                  style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "14px", color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box" }}
                  placeholder="0"
                  value={form.discount_amount}
                  onChange={e => set("discount_amount", e.target.value)}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                />
              </div>

              {/* Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
                <label style={labelStyle}>Internal Notes</label>
                <textarea rows={2}
                  style={{ padding: "11px 14px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#1E293B", resize: "none", outline: "none", width: "100%", boxSizing: "border-box", lineHeight: 1.5 }}
                  placeholder="Any special instructions or remarks…"
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  onFocus={e => e.target.style.borderColor = G}
                  onBlur={e => e.target.style.borderColor = "#E8EDF4"}
                />
              </div>

              {/* Bill Summary */}
              {/* NOTE: The one-time MRD registration fee (HospitalSettings.mrd_registration_fee)
                  is fetched once on mount into `mrdFee` via the same branch-scoped
                  home-visit-defaults endpoint reception already uses to prefill Home
                  Visit fees — that endpoint deliberately also exposes mrd_registration_fee
                  read-only for exactly this preview. So both the advisory note and the
                  Bill Summary below can show the real ₹ amount and fold it straight into
                  Total Payable, rather than a vague "added on generate" placeholder. The
                  backend still independently (re)computes and locks in the authoritative
                  registration_fee at creation time — this is a preview, not the source
                  of truth — and that final figure is what's surfaced afterwards in the
                  success toast, bill list, UPI dialog, and revenue cards. */}
              {(() => {
                const mrdFeeApplies = form.type === "NEW" && form.patient && !form.patient.registration_fee_paid;
                const mrdFeeAmount = mrdFeeApplies ? (mrdFee ?? 0) : 0;
                const totalPayable = Math.max(
                  (parseFloat(form.fee) || 0)
                  + (form.type === "HOME_VISIT" ? (parseFloat(form.travel_charge) || 0) : 0)
                  + mrdFeeAmount
                  - (parseFloat(form.discount_amount) || 0),
                  0
                );
                return (
              <>
              {mrdFeeApplies && (
                <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "10px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", fontSize: "12.5px", fontWeight: 500, display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <Ico d="M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0" size={14} color="#2563EB" />
                  A one-time MRD registration fee{mrdFee != null ? ` of ₹${mrdFee.toLocaleString("en-IN")}` : ""} will be added automatically to this bill, since this patient hasn't been charged it before.
                </div>
              )}
              <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px", border: "1px solid #F1F5F9" }}>
                <p style={{ ...labelStyle, marginBottom: "10px" }}>Bill Summary</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {[
                    { l: "Patient",  v: `${form.patient?.full_name} (${form.patient?.mrd_number})` },
                    { l: "Doctor",   v: doctorMode === "active"
                        ? `${form.doctor?.full_name} · ${form.doctor?.specialty_name ?? ""}`
                        : form.doctor?.doctor_type === "guest"
                          ? `${guestDoctorName.trim()} · Guest`
                          : `${commonName.trim()} (Guest)` },
                    { l: "Type",     v: form.type === "REVISIT" ? "Revisit Consultation" : form.type === "HOME_VISIT" ? "Home Visit" : "New Consultation" },
                    { l: `${form.type === "HOME_VISIT" ? "Home Visit Fee" : "Consultation Fee"} (${form.billed_department?.name ?? form.doctor?.department ?? "Auto"})`, v: `₹${form.fee || "0"}` },
                    ...(form.type === "HOME_VISIT" && parseFloat(form.travel_charge || 0) > 0
                      ? [{ l: "Travel Charge", v: `₹${parseFloat(form.travel_charge).toLocaleString("en-IN")}` }]
                      : []),
                    ...(mrdFeeApplies
                      ? [mrdFee != null
                          ? { l: "MRD Registration Fee", v: `₹${mrdFee.toLocaleString("en-IN")}` }
                          : { l: "MRD Registration Fee", v: "added on generate", note: true }]
                      : []),
                    ...(parseFloat(form.discount_amount || 0) > 0
                      ? [{ l: "Discount", v: `− ₹${parseFloat(form.discount_amount).toLocaleString("en-IN")}` }]
                      : []),
                    { l: "Total Payable", v: `₹${totalPayable.toLocaleString("en-IN")}`, bold: true },
                    { l: "Payment",  v: form.method === "UPI" ? `UPI${form.upi_reference ? ` · ${form.upi_reference}` : ""}` : "Cash" },
                  ].map(row => (
                    <div key={row.l} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ color: "#64748B" }}>{row.l}</span>
                      <span style={{ color: row.note ? "#94A3B8" : (row.bold ? G : "#1E293B"), fontStyle: row.note ? "italic" : "normal", fontWeight: row.bold ? 700 : 500, textAlign: "right", maxWidth: "60%" }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              </>
                );
              })()}

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: "14px" }}>
                  ← Back
                </button>
                <button onClick={handleCreate} disabled={saving} style={{
                  flex: 2, padding: "12px", borderRadius: "10px", border: "none",
                  background: saving ? "#86EFAC" : G, color: "#fff", fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer", fontSize: "14px",
                  boxShadow: "0 4px 12px rgba(22,163,74,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}>
                  {saving
                    ? <><Ico d="M12 6v6l4 2" size={16} color="#fff" /> Processing…</>
                    : <><Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" extra="M14 2v6h6" size={16} color="#fff" /> Generate Bill</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main BillingPage ────────────────────────────────────────────
export default function BillingPage({ quickBookPatient, onQuickBookClose }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bills,    setBills]    = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors,  setDoctors]  = useState([]);
  // Prebookings that were paid for up front (e.g. over the phone) but
  // haven't been converted into a real ConsultationBill yet — see the
  // revenue note near totalRevenue/paidAmount below for why these need to
  // be folded in separately.
  const [prebookings, setPrebookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState(() => searchParams.get("filter") || "all"); // all | pending | paid
  // If launched with a pre-selected patient (from PatientsPage), open creator immediately
  const [creating, setCreating] = useState(!!quickBookPatient);
  const [quickPatient, setQuickPatient] = useState(quickBookPatient ?? null);
  const [toast,    setToast]    = useState(null);
  const [convertTargetPrebooking, setConvertTargetPrebooking] = useState(null);
  const [cancelPrebookingTarget, setCancelPrebookingTarget] = useState(null);
  const [cancellingPrebooking, setCancellingPrebooking] = useState(false);

  // Keep filter in sync if the user arrives again via a different notification link
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) setFilter(f);
  }, [searchParams]);

  // UPI pay dialog
  const [payDialog, setPayDialog] = useState(null); // bill object
  const [paying,    setPaying]    = useState(false);

  // Reassign-doctor dialog
  const [reassignTarget, setReassignTarget] = useState(null); // bill object
  const [reassigning,    setReassigning]    = useState(false);

  // Cancel-appointment dialog
  const [cancelTarget, setCancelTarget] = useState(null); // bill object
  const [cancelling,   setCancelling]   = useState(false);

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      getBills({ page_size: 200 }),
      getPatients({ page_size: 500 }),
      getDoctors(),
      getPrebookings(),
    ]).then(([bR, pR, dR, pbR]) => {
      if (bR.status === "fulfilled") setBills(toArray(bR.value));
      if (pR.status === "fulfilled") setPatients(toArray(pR.value));
      if (dR.status === "fulfilled") {
        setDoctors([
          ...(dR.value.registered_doctors ?? []),
          ...(dR.value.guest_doctors ?? []),
        ]);
      }
      if (pbR.status === "fulfilled") {
        setPrebookings(toArray(pbR.value));
      } else {
        // Surface this instead of silently leaving prebookings at [] —
        // that silent failure is exactly what makes the revenue cards look
        // like they're "not adding up" with no clue why.
        console.error("Failed to load prebookings for revenue calc:", pbR.reason);
        showToast(pbR.reason?.response?.data?.detail || "Couldn't load prebookings — revenue may not include prepaid bookings.", false);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Reassign doctor (mid-consultation handover) ────────────────
  const handleReassign = async (payload, reason) => {
    if (!reassignTarget) return;
    setReassigning(true);
    try {
      const res = await reassignBillDoctor(reassignTarget.bill_id, { ...payload, reason });
      const updated = res?.data ?? res;
      setBills(prev => prev.map(b => b.bill_id === reassignTarget.bill_id ? { ...b, ...updated } : b));
      showToast(res?.message || "Doctor reassigned.", true);
      setReassignTarget(null);
    } catch (e) {
      const d = e?.response?.data;
      const msg = d ? (typeof d === "string" ? d : (d.detail || Object.values(d).flat().join(", "))) : "Failed to reassign doctor.";
      showToast(msg, false);
    } finally {
      setReassigning(false);
    }
  };

  // ── Cancel appointment (only while consultation is still untouched) ──
  const handleCancelAppointment = async (reason, refundRegistrationFee) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const payload = {};
      if (reason) payload.reason = reason;
      if (refundRegistrationFee) payload.refund_registration_fee = true;
      const res = await cancelBill(cancelTarget.bill_id, payload);
      const updated = res?.data ?? res;
      setBills(prev => prev.map(b => b.bill_id === cancelTarget.bill_id ? { ...b, ...updated } : b));
      showToast(res?.message || "Appointment cancelled.", true);
      setCancelTarget(null);
    } catch (e) {
      const d = e?.response?.data;
      const msg = d ? (typeof d === "string" ? d : (d.detail || Object.values(d).flat().join(", "))) : "Failed to cancel appointment.";
      showToast(msg, false);
    } finally {
      setCancelling(false);
    }
  };

  // ── Pay bill (Opens Confirm Payment Dialog) ───────────────────
  const handleMarkPaid = (bill) => {
    setPayDialog(bill);
  };

  // ── Confirm payment (Cash or UPI) ────────────────────────────
  const handlePaymentConfirm = async (method, upiRef) => {
    if (!payDialog) return;
    setPaying(true);
    try {
      const payload = { payment_method: method };
      if (method === "UPI") {
        payload.upi_reference = upiRef;
      }
      await payBill(payDialog.bill_id, payload);
      setBills(prev => prev.map(b => b.bill_id === payDialog.bill_id ? { ...b, payment_status: "PAID", payment_method: method, upi_reference: method === "UPI" ? upiRef : "" } : b));
      showToast("Payment confirmed!", true);
      setPayDialog(null);
    } catch (e) {
      const d = e?.response?.data;
      const msg = d ? (typeof d === "string" ? d : Object.values(d).flat().join(", ")) : "Payment failed.";
      showToast(msg, false);
    } finally { setPaying(false); }
  };

  if (creating) {
    return <BillCreator
      onClose={() => { setCreating(false); setQuickPatient(null); onQuickBookClose?.(); }}
      onCreated={() => { load(); setQuickPatient(null); onQuickBookClose?.(); }}
      patients={patients}
      doctors={doctors}
      preselectedPatient={quickPatient}
    />;
  }

  // ── Derived stats ─────────────────────────────────────────────
  // NOTE: total_amount (= consultation_fee + registration_fee, computed by the
  // backend) is used here instead of consultation_fee alone, so the one-time
  // MRD registration fee for new patients is actually reflected in revenue.
  // Cancelled appointments never collected money and were never really
  // "pending" in any actionable sense — leave them out of the financial
  // summary cards so cancellations don't skew revenue/pending numbers.
  const activeBills   = bills.filter(b => b.consultation_status !== "CANCELLED");
  // ✅ BUG FIX: reception can collect payment for a prebooking up front
  // (over the phone, "Pay now" at booking time) — that's real money in
  // hand, recorded on the ConsultationPreBooking row's own payment_status.
  // But no ConsultationBill exists for it until the patient actually shows
  // up and reception hits "Convert to Bill", which can be days later (or
  // never, e.g. a no-show). Since these revenue cards are built purely
  // from `bills`, that already-collected cash was invisible here the whole
  // time it sat as a paid-but-unconverted prebooking. Once a booking is
  // converted its amount is already reflected via the resulting bill, so
  // only count bookings that are PAID and NOT YET converted/cancelled here
  // — otherwise the same money would be counted twice.
  const prepaidPrebookings = prebookings.filter(
    b => b.payment_status === "PAID" && !["CONVERTED", "CANCELLED", "NO_SHOW"].includes(b.status)
  );
  const prebookingCollected = prepaidPrebookings.reduce((s, b) => s + parseFloat(b.consultation_fee ?? 0), 0);
  const totalRevenue  = activeBills.reduce((s, b) => s + parseFloat(b.total_amount ?? b.consultation_fee ?? 0), 0) + prebookingCollected;
  const paidAmount    = activeBills.filter(b => b.payment_status === "PAID").reduce((s, b) => s + parseFloat(b.total_amount ?? b.consultation_fee ?? 0), 0) + prebookingCollected;

  const pendingPrebookings = prebookings.filter(
    pb => pb.payment_status === "PENDING" && ["BOOKED", "CONFIRMED"].includes(pb.status)
  ).map(pb => ({
    isPrebooking: true,
    prebooking_id: pb.prebooking_id,
    bill_id: `pb-${pb.prebooking_id}`,
    bill_number: `PB-${pb.prebooking_id}`,
    op_number: pb.booking_mode === "CALL" ? "Call-in" : "Walk-in",
    consultation_date: pb.requested_date,
    requested_time: pb.requested_time,
    patient_name: pb.patient_name,
    doctor_name: pb.doctor_display_name ? `Dr. ${pb.doctor_display_name}` : "—",
    consultation_fee: pb.consultation_fee,
    total_amount: pb.consultation_fee,
    payment_status: "PENDING",
    consultation_type: pb.consultation_type,
    consultation_status: pb.status,
    rawPrebooking: pb
  }));

  const pendingCount  = activeBills.filter(b => b.payment_status === "PENDING").length + pendingPrebookings.length;

  const combinedItems = [...bills, ...pendingPrebookings];

  const filtered = combinedItems.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (b.patient_name ?? "").toLowerCase().includes(q)
      || (b.bill_number ?? "").toLowerCase().includes(q)
      || (b.doctor_name ?? "").toLowerCase().includes(q)
      || (b.patient_mrd ?? "").toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ? true :
      filter === "pending"   ? (b.payment_status === "PENDING" && b.consultation_status !== "CANCELLED") :
      filter === "paid"      ? (b.payment_status === "PAID" && b.consultation_status !== "CANCELLED") :
      filter === "cancelled" ? b.consultation_status === "CANCELLED" :
      true;
    return matchSearch && matchFilter;
  });

  const cancelledCount = bills.filter(b => b.consultation_status === "CANCELLED").length;

  const srchInp = { padding: "8px 12px 8px 36px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#475569", background: "#F8FAFC", outline: "none", boxSizing: "border-box", width: "100%" };
  const filterBtn = (val, label) => (
    <button onClick={() => setFilter(val)} style={{
      padding: "7px 14px", borderRadius: "8px", border: "1.5px solid",
      borderColor: filter === val ? G : "#E8EDF4",
      background: filter === val ? LIGHT_G : "#F8FAFC",
      color: filter === val ? "#15803D" : "#64748B",
      fontSize: "12px", fontWeight: 600, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div>
      <Toast t={toast} onDismiss={() => setToast(null)} />
      <ConfirmPaymentDialog bill={payDialog} onConfirm={handlePaymentConfirm} onCancel={() => setPayDialog(null)} paying={paying} />
      <ReassignDoctorDialog bill={reassignTarget} doctors={doctors} onConfirm={handleReassign} onCancel={() => setReassignTarget(null)} saving={reassigning} />
      <CancelAppointmentDialog bill={cancelTarget} onConfirm={handleCancelAppointment} onCancel={() => setCancelTarget(null)} cancelling={cancelling} />
      {cancelPrebookingTarget && (
        <ConfirmDialog
          title="Cancel prebooking?"
          message={`Cancel the prebooking for ${cancelPrebookingTarget.patient_name}?`}
          confirmLabel="Yes, cancel it"
          cancelLabel="No, keep it"
          danger
          loading={cancellingPrebooking}
          onConfirm={async () => {
            setCancellingPrebooking(true);
            try {
              await cancelPrebooking(cancelPrebookingTarget.prebooking_id);
              showToast("Prebooking cancelled.", true);
              setCancelPrebookingTarget(null);
              load();
            } catch (e) {
              showToast(e.response?.data?.detail || e.message || "Failed to cancel.", false);
              setCancelPrebookingTarget(null);
            } finally {
              setCancellingPrebooking(false);
            }
          }}
          onClose={() => !cancellingPrebooking && setCancelPrebookingTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: LIGHT_G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" size={20} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>Billing</h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>{bills.length} total bills · {pendingCount} pending payment</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "14px", marginBottom: "24px" }}>
        {[
          { l: "Total Revenue", v: `₹${totalRevenue.toLocaleString("en-IN")}`, c: "#3B82F6", bg: "#EFF6FF" },
          { l: "Collected",     v: `₹${paidAmount.toLocaleString("en-IN")}`,   c: G,         bg: LIGHT_G,
            note: prepaidPrebookings.length > 0 ? `incl. ₹${prebookingCollected.toLocaleString("en-IN")} from ${prepaidPrebookings.length} prepaid prebooking${prepaidPrebookings.length !== 1 ? "s" : ""}` : null },
          { l: "Pending Bills", v: pendingCount,                                c: "#F59E0B", bg: "#FEF3C7" },
        ].map(c => (
          <div key={c.l} style={{ background: "#fff", borderRadius: "14px", padding: "18px 20px", border: "1px solid #E8EDF4", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>{c.l}</p>
            <p style={{ fontSize: "26px", fontWeight: 700, color: c.c }}>{loading ? "…" : c.v}</p>
            {c.note && !loading && <p style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "4px" }}>{c.note}</p>}
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "340px" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
              <Ico d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" size={14} />
            </span>
            <input style={srchInp} placeholder="Patient, bill no, doctor…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {filterBtn("all", "All")}
            {filterBtn("pending", `Pending (${pendingCount})`)}
            {filterBtn("paid", "Paid")}
            {cancelledCount > 0 && filterBtn("cancelled", `Cancelled (${cancelledCount})`)}
          </div>
          <button onClick={() => { setQuickPatient(null); setCreating(true); }} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
            borderRadius: "9px", border: "none", background: G, color: "#fff",
            fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px #16a34a33", marginLeft: "auto",
          }}>
            <Ico d="M12 5v14 M5 12h14" size={14} color="#fff" /> New Bill
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr 1fr 1fr 110px", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
          {["Patient & Doctor", "Bill No. / OP No.", "Department", "Date", "Amount", "Status", "Action"].map((h, i) => (
            <div key={i} style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: "54px", borderRadius: "8px", background: "#F1F5F9", animation: "shimmer 1.5s infinite", animationDelay: `${i*0.08}s` }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
            {search ? "No bills match your search." : "No bills found."}
          </div>
        ) : filtered.map((b, i) => {
          const isPaid = b.payment_status === "PAID";
          const isCancelled = b.consultation_status === "CANCELLED";
          // Reception can only cancel while the doctor hasn't touched the
          // consultation yet — the backend enforces this too, this is just
          // so the button doesn't even show once it'd be rejected.
          const canCancel = b.consultation_status === "STARTED";
          return (
            <div key={b.bill_id ?? i}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr 1fr 1fr 1fr 110px", padding: "13px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center", transition: "background 0.1s", opacity: isCancelled ? 0.6 : 1 }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Patient & Doctor */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `${G}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: G, flexShrink: 0 }}>
                  {(b.patient_name?.[0] ?? "P").toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B" }}>{b.patient_name}</div>
                  <div style={{ fontSize: "11.5px", color: "#94A3B8", display: "flex", alignItems: "center", gap: "4px" }}>
                    {b.doctor_name ?? "—"}
                  </div>
                  {b.consultation_status && !["COMPLETED", "CANCELLED"].includes(b.consultation_status) && !b.isPrebooking && (
                    <button onClick={() => setReassignTarget(b)}
                      style={{ marginTop: "2px", padding: 0, border: "none", background: "none", color: "#2563EB", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
                      <Ico d="M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3" size={10} color="#2563EB" />
                      Reassign
                    </button>
                  )}
                </div>
              </div>

              {/* Bill / OP numbers */}
              <div>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#475569" }}>{b.bill_number}</div>
                {b.isPrebooking ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>{b.op_number}</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "4px", background: "#EFF6FF", color: "#2563EB" }}>PREBOOKING</span>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>{b.op_number}</div>
                )}
              </div>

              {/* Department */}
              <span style={{ fontSize: "12.5px", color: "#475569" }}>
                {b.billed_department_name ?? "—"}
              </span>

              {/* Date */}
              <span style={{ fontSize: "13px", color: "#475569" }}>
                {b.consultation_date ?? "—"}
                {b.isPrebooking && b.requested_time && ` · ${b.requested_time.slice(0, 5)}`}
              </span>

              {/* Amount */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1E293B" }}>
                  ₹{parseFloat(b.total_amount ?? b.consultation_fee ?? 0).toLocaleString("en-IN")}
                </span>
                {parseFloat(b.registration_fee ?? 0) > 0 && (
                  <span style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                    incl. ₹{parseFloat(b.registration_fee).toLocaleString("en-IN")} MRD fee
                  </span>
                )}
                {parseFloat(b.discount_amount ?? 0) > 0 && (
                  <span style={{ fontSize: "10.5px", color: "#DC2626" }}>
                    − ₹{parseFloat(b.discount_amount).toLocaleString("en-IN")} discount
                  </span>
                )}
              </div>

              {/* Status + Type badges */}
              <PayBadge status={b.payment_status} type={b.consultation_type} cancelled={isCancelled} />

              {isCancelled ? (
                <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <Ico d="M18 6 6 18 M6 6l12 12" size={12} color="#94A3B8" /> Cancelled
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                  {b.isPrebooking ? (
                    <>
                      <button onClick={() => setConvertTargetPrebooking(b.rawPrebooking)}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: G, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px #16a34a28" }}>
                        Convert to Bill
                      </button>
                      <button onClick={() => setCancelPrebookingTarget(b)}
                        style={{ padding: 0, border: "none", background: "none", color: "#DC2626", fontSize: "11px", fontWeight: 600, cursor: "pointer", marginTop: "4px" }}>
                        Cancel prebooking
                      </button>
                    </>
                  ) : !isPaid ? (
                    <button onClick={() => handleMarkPaid(b)}
                      style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: G, color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px #16a34a28" }}>
                      Mark Paid
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#94A3B8", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <Ico d="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3" size={12} color={G} /> Done
                      </span>
                      <button onClick={() => navigate(`/reception/billing/print/${b.bill_id}`)}
                        style={{
                          padding: "4px 8px", borderRadius: "6px", border: "1px solid #E2E8F0",
                          background: "#fff", color: "#64748B", fontSize: "11px", fontWeight: 600,
                          cursor: "pointer", display: "flex", alignItems: "center", gap: "4px"
                        }}>
                        <Ico d="M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z" size={11} /> Print
                      </button>
                    </div>
                  )}
                  {!b.isPrebooking && canCancel && (
                    <button onClick={() => setCancelTarget(b)}
                      style={{ padding: 0, border: "none", background: "none", color: "#DC2626", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                      Cancel appointment
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {convertTargetPrebooking && (
        <ConvertDialog
          booking={convertTargetPrebooking}
          doctors={doctors}
          onClose={() => setConvertTargetPrebooking(null)}
          onConverted={() => {
            showToast("Prebooking converted to bill.", true);
            load();
          }}
        />
      )}
 
      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}