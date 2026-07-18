// src/modules/receptionist/api/receptionApi.js
// ═════════════════════════════════════════════════════════════════
// ✅ FIXED VERSION - All endpoints match Django backend
// ✅ Corrected URL paths
// ✅ Proper parameter names
// ═════════════════════════════════════════════════════════════════

import API from "../../../api";

// ─── UTILITY ──────────────────────────────────────────────────────
const fetchList = async (defaultPath, arg = {}) => {
  if (typeof arg === "string") {
    const res = await API.get(arg);
    return res.data;
  }
  const res = await API.get(defaultPath, { params: arg });
  return res.data;
};

// ─── PATIENTS ─────────────────────────────────────────────────────

export const getPatients = async (arg = {}) =>
  fetchList("/reception/patients/", arg);

export const getPatientDetail = async (pk) => {
  const res = await API.get(`/reception/patients/${pk}/`);
  return res.data;
};

// POST /reception/patients/create/ — CreatePatientView (CreateAPIView, POST-only)
// NOTE: /reception/patients/ is PatientListView (GET-only, ListAPIView) — posting
// there returns 405 Method Not Allowed. This is why new patient registration failed.
export const createPatient = async (payload) => {
  const res = await API.post("/reception/patients/create/", payload);
  return res.data;
};

export const updatePatient = async (pk, payload) => {
  const res = await API.patch(`/reception/patients/${pk}/`, payload);
  return res.data;
};

export const deletePatient = async (pk) => {
  const res = await API.delete(`/reception/patients/${pk}/`);
  return res.data;
};

// ✅ FIXED: GET /reception/patients/{patient_id}/history/ (correct endpoint)
export const getPatientHistory = async (patientId, params = {}) => {
  const res = await API.get(`/reception/patients/${patientId}/history/`, { params });
  return res.data;
};

// ─── REVISIT CHECK ────────────────────────────────────────────────

/**
 * ✅ FIXED: Uses patient_id instead of patient parameter
 * GET /api/reception/revisit-check/?patient_id=<patient_id>
 * Returns { eligible, reason, latest_bill }
 */
export const checkFollowUp = async (patientId) => {
  const res = await API.get("/reception/revisit-check/", {
    params: { patient_id: patientId },
  });
  return res.data;
};

// ─── BILLS ────────────────────────────────────────────────────────

export const getBills = async (arg = {}) =>
  fetchList("/reception/bills/", arg);

export const getBillDetail = async (billId) => {
  const res = await API.get(`/reception/bills/${billId}/`);
  return res.data;
};

// POST /reception/bills/create/ — CreateConsultationBillView (CreateAPIView, POST-only)
// NOTE: /reception/bills/ is ConsultationBillListView (GET-only, ListAPIView) — posting
// there returns 405 Method Not Allowed. This is why bill creation failed.
export const createBill = async (payload) => {
  const res = await API.post("/reception/bills/create/", payload);
  return res.data;
};

export const updateBill = async (billId, payload) => {
  const res = await API.patch(`/reception/bills/${billId}/`, payload);
  return res.data;
};

/**
 * POST /api/reception/bills/{id}/pay/
 * Marks a bill as PAID. Optionally pass { payment_method, upi_reference } for UPI bills.
 * NOTE: MarkBillPaidView only implements post() — it is a plain APIView, not a
 * generic PATCH view — so calling this with PATCH always returned 405.
 */
export const payBill = async (billId, payload = {}) => {
  const res = await API.post(`/reception/bills/${billId}/pay/`, payload);
  return res.data;
};

/**
 * POST /api/reception/bills/{id}/reassign-doctor/
 * Hands an in-progress consultation to another doctor without starting a
 * new bill — all clinical data already entered (vitals, notes, etc.) is
 * kept as-is; only the doctor assignment changes.
 * payload: { doctor_id } OR { guest_doctor_id }, plus optional { reason }.
 * Blocked by the backend once the consultation's status is COMPLETED.
 */
export const reassignBillDoctor = async (billId, payload) => {
  const res = await API.post(`/reception/bills/${billId}/reassign-doctor/`, payload);
  return res.data;
};

/**
 * POST /api/reception/bills/{id}/cancel/
 * Cancels an appointment. Only succeeds while the linked consultation is
 * still untouched (status STARTED) — the backend rejects it once a doctor
 * has begun working the case. payload: optional { reason }.
 */
export const cancelBill = async (billId, payload = {}) => {
  const res = await API.post(`/reception/bills/${billId}/cancel/`, payload);
  return res.data;
};

// ─── CONSULTATION PREBOOKINGS ──────────────────────────────────────

/**
 * GET /api/reception/prebookings/
 * arg may include: date, doctor_id, status, payment_status.
 * NOTE: this endpoint returns a plain array (not paginated).
 */
export const getPrebookings = async (arg = {}) =>
  fetchList("/reception/prebookings/", arg);

export const getPrebookingDetail = async (pk) => {
  const res = await API.get(`/reception/prebookings/${pk}/`);
  return res.data;
};

/**
 * POST /api/reception/prebookings/
 * payload includes pay_now: true/false — if true, payment_method is
 * required and the booking is created already PAID.
 */
export const createPrebooking = async (payload) => {
  const res = await API.post("/reception/prebookings/", payload);
  return res.data;
};

/**
 * POST /api/reception/prebookings/{id}/pay/
 * payload: { payment_method: "CASH" | "UPI" }
 */
export const payPrebooking = async (pk, payload) => {
  const res = await API.post(`/reception/prebookings/${pk}/pay/`, payload);
  return res.data;
};

/**
 * POST /api/reception/prebookings/{id}/convert/
 * Creates the real ConsultationBill on the day of the visit.
 * payload: { payment_method, collect_payment, upi_reference? } — only
 * needed if the prebooking is still PENDING (already-PAID bookings convert
 * with no extra payment info required). If collect_payment is false, the
 * new bill is left PENDING (shows up in Billing → Pending) instead of
 * being marked paid immediately.
 */
export const convertPrebooking = async (pk, payload = {}) => {
  const res = await API.post(`/reception/prebookings/${pk}/convert/`, payload);
  return res.data;
};

/**
 * POST /api/reception/prebookings/{id}/cancel/
 */
export const cancelPrebooking = async (pk) => {
  const res = await API.post(`/reception/prebookings/${pk}/cancel/`);
  return res.data;
};

// ─── DOCTORS ──────────────────────────────────────────────────────

/**
 * GET /api/reception/active-doctors/
 * Returns { registered_doctors: [], guest_doctors: [], total: number }
 *
 * Backend field names differ by doctor type (registered doctors use
 * `profile_id`, guest doctors use `guest_doctor_id`; both use `name`/`type`).
 * Normalized here to a consistent shape (`id`, `full_name`, `doctor_type`)
 * so the rest of the app can treat both kinds of doctor the same way.
 */
const normalizeDoctor = (d) => ({
  ...d,
  id: d.type === "guest" ? d.guest_doctor_id : d.profile_id,
  full_name: d.name,
  doctor_type: d.type,
});

export const getDoctors = async () => {
  const res = await API.get("/reception/active-doctors/");
  const raw = res.data;
  return {
    registered_doctors: (raw.registered_doctors ?? []).map(normalizeDoctor),
    guest_doctors: (raw.guest_doctors ?? []).map(normalizeDoctor),
    total: raw.total ?? 0,
  };
};

// ─── HELPERS ──────────────────────────────────────────────────────

/** Normalise paginated or plain-list API response to a plain array */
export const toArray = (res) =>
  Array.isArray(res) ? res : res?.results ?? res?.data ?? [];