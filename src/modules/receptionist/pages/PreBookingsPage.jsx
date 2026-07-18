// src/modules/receptionist/pages/PreBookingsPage.jsx
// Consultation Prebooking — call-in / walk-in slots reserved ahead of the
// patient's actual visit. On the visit day reception converts a booking
// into a real Consultation Bill via the "Convert to Bill" action.

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import {
  getPrebookings,
  createPrebooking,
  cancelPrebooking,
  payPrebooking,
  getPatients,
  getDoctors,
  checkFollowUp,
  toArray,
} from "../api/receptionApi";
import ConvertDialog from "../components/ConvertDialog";

const G       = "#16A34A";
const LIGHT_G = "#DCFCE7";
const AMBER   = "#D97706";

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  calendar: "M8 2v4 M16 2v4 M3 10h18 M21 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z",
  plus:     "M12 5v14 M5 12h14",
  close:    "M18 6 6 18 M6 6l12 12",
  phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  walk:     "M13 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4z M15 8l-3 3 2 2-1 6 M12 11l-3 2 1 6 M8 13l-3 1",
};

const StatusBadge = ({ status }) => {
  const cfg = {
    BOOKED:    { bg: "#EFF6FF", color: "#2563EB" },
    CONFIRMED: { bg: "#F5F3FF", color: "#7C3AED" },
    CONVERTED: { bg: LIGHT_G,   color: G },
    CANCELLED: { bg: "#F1F5F9", color: "#64748B" },
    NO_SHOW:   { bg: "#FEF2F2", color: "#DC2626" },
  }[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {status?.replace(/_/g, " ")}
    </span>
  );
};

const PayBadge = ({ status }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
    background: status === "PAID" ? LIGHT_G : "#FEF3C7",
    color:      status === "PAID" ? "#15803D" : AMBER,
  }}>
    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: status === "PAID" ? G : "#F59E0B" }} />
    {status === "PAID" ? "Paid" : "Pending"}
  </span>
);

const inp = { padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#1E293B", outline: "none", width: "100%", boxSizing: "border-box" };
const label = { fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "5px", display: "block" };

/* ─── New Prebooking form (modal) ──────────────────────────────────── */
function NewPreBookingDialog({ patients, doctors, onClose, onCreated }) {
  const [bookingMode, setBookingMode] = useState("CALL");
  const [patientMode, setPatientMode] = useState("existing"); // "existing" | "new"
  const [patSearch, setPatSearch]     = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newPatient, setNewPatient] = useState({ name: "", phone: "", gender: "", age: "" });
  const [docKey, setDocKey] = useState(""); // `${doctor_type}-${id}`
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [fee, setFee] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // ── NEW vs free REVISIT ─────────────────────────────────────────────
  // Only meaningful for an existing, already-registered patient — a
  // brand-new patient can never be a revisit. Mirrors the Billing page's
  // own NEW/REVISIT flow so the fee behaves consistently in both places
  // instead of reception having to remember to zero it out by hand.
  const [consultType, setConsultType] = useState("NEW"); // "NEW" | "REVISIT"
  const [revisitEligible, setRevisitEligible] = useState(false);
  const [revisitMessage, setRevisitMessage] = useState("");
  const [revisitChecking, setRevisitChecking] = useState(false);

  const filtPat = patients.filter(p => {
    const q = patSearch.toLowerCase();
    return !q || (p.full_name ?? `${p.first_name} ${p.last_name}`).toLowerCase().includes(q)
      || (p.mrd_number ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  }).slice(0, 8);

  const selectedDoctor = doctors.find(d => `${d.doctor_type}-${d.id}` === docKey) ?? null;

  const handlePickDoctor = (key) => {
    setDocKey(key);
    const d = doctors.find(dd => `${dd.doctor_type}-${dd.id}` === key);
    // A locked-in free revisit stays ₹0 even after picking a doctor —
    // only auto-fill the fee from the doctor's rate for a NEW booking.
    if (d && consultType !== "REVISIT") setFee(String(d.consultation_fee ?? "0"));
  };

  // Whenever an existing patient is (re)selected, check whether they're
  // inside their free-revisit window and default consultType accordingly
  // — same behavior as the Billing page's patient picker.
  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setPatSearch("");
    setConsultType("NEW");
    setRevisitEligible(false);
    setRevisitMessage("");
    setRevisitChecking(true);
    checkFollowUp(p.patient_id)
      .then(res => {
        setRevisitEligible(!!res.is_revisit_eligible);
        setRevisitMessage(res.message || "");
        if (res.is_revisit_eligible) {
          setConsultType("REVISIT");
          setFee("0");
        }
      })
      .catch(() => { setRevisitEligible(false); setRevisitMessage(""); })
      .finally(() => setRevisitChecking(false));
  };

  const handleConsultTypeChange = (type) => {
    setConsultType(type);
    if (type === "REVISIT") {
      setFee("0");
    } else if (selectedDoctor) {
      setFee(String(selectedDoctor.consultation_fee ?? "0"));
    }
  };

  const switchPatientMode = (mode) => {
    setPatientMode(mode);
    // A brand-new, not-yet-registered patient can't have a revisit window.
    setConsultType("NEW");
    setRevisitEligible(false);
    setRevisitMessage("");
    setSelectedPatient(null);
  };

  const handleSave = async () => {
    setErr("");
    if (patientMode === "existing" && !selectedPatient) { setErr("Select a patient, or switch to \"New patient\"."); return; }
    if (patientMode === "new" && !newPatient.name.trim()) { setErr("New patient name is required."); return; }
    if (patientMode === "new" && newPatient.phone.trim() && !isValidPhone(newPatient.phone)) { setErr(PHONE_ERROR_MESSAGE); return; }
    if (!requestedDate || !requestedTime) { setErr("Requested date and time are required."); return; }
    if (payNow && !paymentMethod) { setErr("Payment method is required to pay now."); return; }

    const payload = {
      booking_mode: bookingMode,
      consultation_type: consultType,
      requested_date: requestedDate,
      requested_time: requestedTime,
      pay_now: payNow,
      ...(payNow && { payment_method: paymentMethod }),
      // Revisit is always ₹0 — don't trust the (locked/read-only) fee
      // input, send it explicitly so a stray value can never slip through.
      consultation_fee: consultType === "REVISIT" ? 0 : (fee !== "" ? parseFloat(fee) : undefined),
    };
    if (payload.consultation_fee === undefined) delete payload.consultation_fee;
    if (patientMode === "existing") {
      payload.patient = selectedPatient.patient_id;
    } else {
      payload.new_patient_name = newPatient.name.trim();
      if (newPatient.phone.trim()) payload.new_patient_phone = newPatient.phone.trim();
      if (newPatient.gender) payload.new_patient_gender = newPatient.gender;
      if (newPatient.age) payload.new_patient_age = parseInt(newPatient.age, 10);
    }
    if (selectedDoctor) {
      if (selectedDoctor.doctor_type === "guest") payload.guest_doctor = selectedDoctor.id;
      else payload.doctor = selectedDoctor.id;
    }

    setSaving(true);
    try {
      await createPrebooking(payload);
      onCreated?.();
      onClose();
    } catch (e) {
      const data = e.response?.data;
      setErr(data ? Object.values(data).flat().join(" ") : (e.message || "Failed to create prebooking."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "560px", width: "100%", marginTop: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>New Prebooking</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
            <Ico d={ICONS.close} size={18} />
          </button>
        </div>

        {/* Booking mode toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {["CALL", "WALKIN"].map(m => (
            <button key={m} onClick={() => setBookingMode(m)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "10px", borderRadius: "10px", border: bookingMode === m ? `1.5px solid ${G}` : "1.5px solid #E8EDF4", background: bookingMode === m ? LIGHT_G : "#fff", color: bookingMode === m ? G : "#64748B", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Ico d={m === "CALL" ? ICONS.phone : ICONS.walk} size={14} />
              {m === "CALL" ? "Call-in" : "Walk-in"}
            </button>
          ))}
        </div>

        {/* Patient mode toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {[["existing", "Existing patient"], ["new", "New patient"]].map(([k, l]) => (
            <button key={k} onClick={() => switchPatientMode(k)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #E8EDF4", background: patientMode === k ? "#F8FAFC" : "#fff", color: patientMode === k ? "#0F172A" : "#94A3B8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>

        {patientMode === "existing" ? (
          <div style={{ marginBottom: "10px", position: "relative" }}>
            <label style={label}>Search patient (name, MRD, or phone)</label>
            <input style={inp} value={selectedPatient ? `${selectedPatient.full_name ?? selectedPatient.first_name} — ${selectedPatient.mrd_number}` : patSearch}
              onChange={e => { setPatSearch(e.target.value); setSelectedPatient(null); setConsultType("NEW"); setRevisitEligible(false); setRevisitMessage(""); }}
              placeholder="Start typing..." />
            {!selectedPatient && patSearch && filtPat.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E8EDF4", borderRadius: "10px", marginTop: "4px", maxHeight: "220px", overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}>
                {filtPat.map(p => (
                  <div key={p.patient_id} onClick={() => handleSelectPatient(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F8FAFC" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>{p.full_name ?? `${p.first_name} ${p.last_name}`}</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8" }}>{p.mrd_number} · {p.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Patient name</label>
              <input style={inp} value={newPatient.name} onChange={e => setNewPatient(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label style={label}>Phone (required to convert later)</label>
              <input style={inp} value={newPatient.phone} maxLength={10} inputMode="numeric"
                onChange={e => setNewPatient(f => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))}
                placeholder="Starts with 6-9, 10 digits" />
            </div>
            <div>
              <label style={label}>Gender</label>
              <select style={inp} value={newPatient.gender} onChange={e => setNewPatient(f => ({ ...f, gender: e.target.value }))}>
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={label}>Age</label>
              <input type="number" min="0" style={inp} value={newPatient.age} onChange={e => setNewPatient(f => ({ ...f, age: e.target.value }))} />
            </div>
          </div>
        )}

        {/* Consultation type — only meaningful for an existing patient;
            a brand-new patient always books as NEW. */}
        {patientMode === "existing" && selectedPatient && (
          <div style={{ marginBottom: "16px" }}>
            <label style={label}>Consultation type</label>
            {revisitChecking ? (
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: "2px 0 0" }}>Checking revisit eligibility…</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => handleConsultTypeChange("NEW")}
                    style={{ flex: 1, padding: "9px", borderRadius: "9px", border: consultType === "NEW" ? `1.5px solid ${G}` : "1.5px solid #E8EDF4", background: consultType === "NEW" ? LIGHT_G : "#fff", color: consultType === "NEW" ? G : "#64748B", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}>
                    New Consultation
                  </button>
                  <button type="button" onClick={() => revisitEligible && handleConsultTypeChange("REVISIT")}
                    disabled={!revisitEligible}
                    title={revisitEligible ? "" : (revisitMessage || "No active revisit window — free revisits only apply today, tomorrow, or the day after the patient's last NEW consultation.")}
                    style={{ flex: 1, padding: "9px", borderRadius: "9px", border: consultType === "REVISIT" ? `1.5px solid ${G}` : "1.5px solid #E8EDF4", background: consultType === "REVISIT" ? LIGHT_G : "#fff", color: !revisitEligible ? "#CBD5E1" : consultType === "REVISIT" ? G : "#64748B", fontSize: "12.5px", fontWeight: 600, cursor: revisitEligible ? "pointer" : "not-allowed" }}>
                    Free Revisit
                  </button>
                </div>
                <p style={{ fontSize: "11.5px", color: revisitEligible ? "#15803D" : "#94A3B8", margin: "6px 0 0" }}>
                  {revisitEligible
                    ? (revisitMessage || "Patient is eligible for a FREE revisit consultation.")
                    : (revisitMessage || "Not eligible for a free revisit — this will default to New Consultation after 3 days (today, tomorrow, day after) of their last visit.")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Doctor select */}
        <div style={{ marginBottom: "16px" }}>
          <label style={label}>Doctor</label>
          <select style={inp} value={docKey} onChange={e => handlePickDoctor(e.target.value)}>
            <option value="">Select a doctor</option>
            {doctors.map(d => (
              <option key={`${d.doctor_type}-${d.id}`} value={`${d.doctor_type}-${d.id}`}>
                {d.full_name}{d.specialization ? ` — ${d.specialization}` : ""}{d.doctor_type === "guest" ? " (Guest)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Date / time */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div>
            <label style={label}>Requested date</label>
            <input type="date" style={inp} value={requestedDate} onChange={e => setRequestedDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Requested time</label>
            <input type="time" style={inp} value={requestedTime} onChange={e => setRequestedTime(e.target.value)} />
          </div>
        </div>

        {/* Fee */}
        <div style={{ marginBottom: "16px" }}>
          <label style={label}>Consultation fee (₹)</label>
          <input type="number" min="0" style={{ ...inp, ...(consultType === "REVISIT" ? { background: "#F8FAFC", color: "#94A3B8", cursor: "not-allowed" } : {}) }}
            value={fee} onChange={e => setFee(e.target.value)}
            readOnly={consultType === "REVISIT"}
            placeholder={consultType === "REVISIT" ? "Free revisit — locked at ₹0" : "Auto-filled from doctor"} />
        </div>

        {/* Pay now toggle */}
        <div style={{ marginBottom: "18px", padding: "12px 14px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
            <input type="checkbox" checked={payNow} onChange={e => setPayNow(e.target.checked)} />
            Pay now
          </label>
          {payNow ? (
            <div style={{ marginTop: "10px" }}>
              <label style={label}>Payment method</label>
              <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "6px 0 0" }}>Pay at visit — payment will be collected on the day, or via the Pay action below.</p>
          )}
        </div>

        {err && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px", fontSize: "13px" }}>{err}</div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: saving ? "#D1D5DB" : G, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Create Prebooking"}
        </button>
      </div>
    </div>
  );
}
/* ─── Collect payment on a "pay at visit" prebooking ───────────────── */
function PayPrebookingDialog({ booking, onClose, onPaid }) {
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleConfirm = async () => {
    setErr("");
    setSaving(true);
    try {
      await payPrebooking(booking.prebooking_id, { payment_method: paymentMethod });
      onPaid?.();
      onClose();
    } catch (e) {
      const data = e.response?.data;
      setErr(data ? (data.detail || Object.values(data).flat().join(" ")) : (e.message || "Failed to record payment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "380px", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Collect Payment</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
            <Ico d={ICONS.close} size={18} />
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 18px" }}>
          {booking.patient_name} · ₹{parseFloat(booking.consultation_fee ?? 0).toLocaleString("en-IN")}
        </p>

        <label style={label}>Payment method</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {["CASH", "UPI"].map(m => (
            <button key={m} type="button" onClick={() => setPaymentMethod(m)}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", border: paymentMethod === m ? `1.5px solid ${G}` : "1.5px solid #E8EDF4", background: paymentMethod === m ? LIGHT_G : "#fff", color: paymentMethod === m ? G : "#64748B", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              {m === "CASH" ? "Cash" : "UPI"}
            </button>
          ))}
        </div>

        {err && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "9px", padding: "10px 12px", marginBottom: "14px", fontSize: "13px" }}>{err}</div>
        )}

        <button onClick={handleConfirm} disabled={saving}
          style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: saving ? "#D1D5DB" : G, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Recording…" : "Mark as Paid"}
        </button>
      </div>
    </div>
  );
}




/* ─── Main page ─────────────────────────────────────────────────────── */
export default function PreBookingsPage() {
  // Local YYYY-MM-DD for today. Avoids toISOString(), which converts to UTC
  // first and can roll the date back/forward a day depending on the user's
  // timezone offset (e.g. early-morning IST).
  const todayISO = () => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [doctorFilter, setDoctorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    setLoading(true); setError("");
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (doctorFilter) params.doctor_id = doctorFilter;
    if (statusFilter) params.status = statusFilter;
    getPrebookings(params)
      .then(d => setBookings(toArray(d)))
      .catch(() => setError("Failed to load prebookings."))
      .finally(() => setLoading(false));
  }, [dateFilter, doctorFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.allSettled([getPatients({ page_size: 500 }), getDoctors()]).then(([pR, dR]) => {
      if (pR.status === "fulfilled") setPatients(toArray(pR.value));
      if (dR.status === "fulfilled") setDoctors([...(dR.value.registered_doctors ?? []), ...(dR.value.guest_doctors ?? [])]);
    });
  }, []);

  const handleCancel = async (booking) => {
    if (!window.confirm(`Cancel the prebooking for ${booking.patient_name}?`)) return;
    try {
      await cancelPrebooking(booking.prebooking_id);
      showToast("Prebooking cancelled.", true);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || e.message || "Failed to cancel.", false);
    }
  };

  const selInp = {
    padding: "8px 12px", borderRadius: "10px", border: "1.5px solid #E8EDF4",
    fontSize: "12px", fontWeight: 600, color: "#475569", background: "#F8FAFC",
    cursor: "pointer", outline: "none",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: LIGHT_G, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ico d={ICONS.calendar} size={20} color={G} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>Prebookings</h1>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 18px", borderRadius: "10px", border: "none", background: G, color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          <Ico d={ICONS.plus} size={15} color="#fff" /> New Prebooking
        </button>
      </div>

      {toast && (
        <div style={{ background: toast.ok ? LIGHT_G : "#FEF2F2", border: `1px solid ${toast.ok ? "#BBF7D0" : "#FECACA"}`, color: toast.ok ? "#15803D" : "#DC2626", borderRadius: "10px", padding: "10px 16px", marginBottom: "16px", fontSize: "13px" }}>{toast.msg}</div>
      )}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>
      )}

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E8EDF4", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...selInp, minWidth: "140px" }} title="Filter by requested date" />
          <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} style={selInp}>
            <option value="">All doctors</option>
            {doctors.filter(d => d.doctor_type !== "guest").map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selInp}>
            <option value="">All statuses</option>
            <option value="BOOKED">Booked</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CONVERTED">Converted</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
          {(dateFilter || doctorFilter || statusFilter) && (
            <button onClick={() => { setDateFilter(""); setDoctorFilter(""); setStatusFilter(""); }}
              style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.9fr 0.9fr 0.9fr 1.4fr", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
          {["Patient", "Mode", "Doctor", "Date / Time", "Status", "Payment", "Actions"].map((h, i) => (
            <div key={i} style={{ fontSize: "11.5px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "20px" }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: "52px", borderRadius: "8px", background: "#F1F5F9", marginBottom: "8px", animation: "shimmer 1.5s infinite", animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
            <Ico d={ICONS.calendar} size={36} color="#E2E8F0" />
            <p style={{ marginTop: "12px" }}>No prebookings found.</p>
          </div>
        ) : (
          bookings.map(b => (
            <div key={b.prebooking_id}
              style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.9fr 0.9fr 0.9fr 1.4fr", padding: "13px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B" }}>{b.patient_name}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>₹{parseFloat(b.consultation_fee ?? 0).toLocaleString("en-IN")}</div>
              </div>
              <span style={{ fontSize: "12px", color: "#475569" }}>{b.booking_mode === "CALL" ? "Call-in" : "Walk-in"}</span>
              <span style={{ fontSize: "13px", color: "#475569" }}>{b.doctor_display_name ? `Dr. ${b.doctor_display_name}` : "—"}</span>
              <span style={{ fontSize: "12.5px", color: "#475569" }}>
                {b.requested_date ? new Date(b.requested_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                {b.requested_time ? ` · ${b.requested_time.slice(0, 5)}` : ""}
              </span>
              <StatusBadge status={b.status} />
              <PayBadge status={b.payment_status} />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {b.status !== "CONVERTED" && b.status !== "CANCELLED" && b.status !== "NO_SHOW" && (
                  <>
                    {b.payment_status !== "PAID" && (
                      <button onClick={() => setPayTarget(b)}
                        style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #FDE68A", background: "#FFFBEB", color: AMBER, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                        Pay
                      </button>
                    )}
                    <button onClick={() => setConvertTarget(b)}
                      style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #E8EDF4", background: G, color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                      Convert to Bill
                    </button>
                    <button onClick={() => handleCancel(b)}
                      style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #FECACA", background: "#fff", color: "#DC2626", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </>
                )}
                {b.status === "CONVERTED" && b.converted_bill && (
                  <button onClick={() => navigate(`/reception/billing/print/${b.converted_bill}`)}
                    style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
                    View Bill
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showNew && (
        <NewPreBookingDialog patients={patients} doctors={doctors} onClose={() => setShowNew(false)} onCreated={() => { showToast("Prebooking created.", true); load(); }} />
      )}
      {convertTarget && (
        <ConvertDialog booking={convertTarget} doctors={doctors} onClose={() => setConvertTarget(null)} onConverted={() => { showToast("Converted to bill.", true); load(); }} />
      )}
      {payTarget && (
        <PayPrebookingDialog booking={payTarget} onClose={() => setPayTarget(null)} onPaid={() => { showToast("Payment recorded.", true); load(); }} />
      )}

      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}