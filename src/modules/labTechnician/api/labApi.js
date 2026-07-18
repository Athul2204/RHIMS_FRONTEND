// src/modules/labTechnician/api/labApi.js
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

// ─── RESPONSE / ERROR HELPERS (mirrors pharmacistApi.js) ──────────
const ok = (res) => res.data;

const err = (e, msg) => {
  const errorData = e.response?.data;

  // 409 Conflict — an active walk-in request already exists today.
  // Attach existing_request_id / existing_bill_id so callers can resume it.
  if (e.response?.status === 409 && errorData) {
    const conflict = new Error(errorData.error || "Duplicate lab request conflict.");
    conflict.status = 409;
    conflict.existing_request_id = errorData.existing_request_id;
    conflict.existing_bill_id    = errorData.existing_bill_id;
    conflict.request = errorData.request;
    conflict.bill     = errorData.bill;
    throw conflict;
  }

  if (errorData?.error) {
    throw new Error(errorData.error);
  }
  if (errorData?.detail) {
    throw new Error(errorData.detail);
  }
  if (errorData?.message) {
    throw new Error(errorData.message);
  }

  // DRF serializer validation errors: { non_field_errors: [...] } or
  // per-field arrays like { walkin_name: ["..."] }.
  if (errorData && typeof errorData === "object") {
    if (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors.length) {
      throw new Error(errorData.non_field_errors.join(" "));
    }
    const fieldErrors = Object.entries(errorData)
      .map(([field, val]) => {
        const text = Array.isArray(val) ? val.join(" ") : String(val);
        return `${field}: ${text}`;
      })
      .join(" | ");
    if (fieldErrors) {
      throw new Error(fieldErrors);
    }
  }

  throw new Error(msg || "Request failed");
};

// ─── LAB TESTS (catalogue) ────────────────────────────────────────

export const getLabTests = async (arg = {}) => {
  return fetchList("/lab/tests/", arg);
};

export const getLabTestDetail = async (id) => {
  const res = await API.get(`/lab/tests/${id}/`);
  return res.data;
};

export const createLabTest = async (payload) => {
  const res = await API.post("/lab/tests/", payload);
  return res.data;
};

export const updateLabTest = async (id, payload) => {
  const res = await API.patch(`/lab/tests/${id}/`, payload);
  return res.data;
};

export const deleteLabTest = async (id) => {
  const res = await API.delete(`/lab/tests/${id}/`);
  return res.data;
};

// ─── TEST GROUPS (panels billed as one unit, e.g. LFT/KFT/LIPID) ──

/**
 * GET /api/lab/test-groups/
 * Returns an array of active panels, each with a nested `sub_tests` list
 * (test_id, name, code, unit, normal_range) for the expandable preview.
 */
export const getTestGroups = async (arg = {}) => {
  const res = await API.get("/lab/test-groups/", { params: arg });
  return res.data;
};

/**
 * GET /api/lab/test-groups/{id}/
 */
export const getTestGroupDetail = async (id) => {
  const res = await API.get(`/lab/test-groups/${id}/`);
  return res.data;
};

/**
 * POST /api/lab/test-groups/
 * Payload: { name, code, price, description?, is_active? }
 */
export const createTestGroup = async (payload) => {
  const res = await API.post("/lab/test-groups/", payload);
  return res.data;
};

/**
 * PATCH /api/lab/test-groups/{id}/
 */
export const updateTestGroup = async (id, payload) => {
  const res = await API.patch(`/lab/test-groups/${id}/`, payload);
  return res.data;
};

/**
 * DELETE /api/lab/test-groups/{id}/
 * Admin only. Sub-tests revert to standalone (their `group` FK is cleared
 * server-side) — they are not deleted, and historical bills are untouched.
 */
export const deleteTestGroup = async (id) => {
  const res = await API.delete(`/lab/test-groups/${id}/`);
  return res.data;
};

// ─── LAB REQUESTS (incoming from doctors) ────────────────────────

/**
 * GET /api/lab/requests/
 * Supports query params: status, patient_id, consultation_id, start, end
 * (start/end are YYYY-MM-DD and filter on request_date; omit both for
 * no date filter — the previous default of showing every request)
 * Response: { count, next, previous, results: [...] }
 */
export const getLabRequests = async (arg = {}) => {
  return fetchList("/lab/requests/", arg);
};

export const getLabRequestDetail = async (pk) => {
  const res = await API.get(`/lab/requests/${pk}/`);
  return res.data;
};

/**
 * PATCH /api/lab/requests/{pk}/status/
 * Payload: { status: "SAMPLE_COLLECTED" | "PROCESSING" | "COMPLETED" | "VERIFIED" | "DELIVERED" }
 * Only advances in strict order — backend validates transitions.
 */
export const updateLabRequestStatus = async (pk, payload) => {
  const res = await API.patch(`/lab/requests/${pk}/status/`, payload);
  return res.data;
};

/**
 * POST /api/lab/requests/{pk}/claim/
 * Claims an unclaimed request for the current user. 409 if already claimed.
 */
export const claimLabRequest = async (pk) => {
  const res = await API.post(`/lab/requests/${pk}/claim/`);
  return res.data;
};

/**
 * POST /api/lab/requests/{pk}/unclaim/
 * Admin/manager only — releases a stuck claim.
 */
export const unclaimLabRequest = async (pk) => {
  const res = await API.post(`/lab/requests/${pk}/unclaim/`);
  return res.data;
};

// ─── LAB RESULTS ──────────────────────────────────────────────────

/**
 * GET /api/lab/requests/{requestPk}/results/
 * Returns { request_id, status, items: [...] } where each item has a `result` field.
 */
export const getLabResultsByRequest = async (requestPk) => {
  const res = await API.get(`/lab/requests/${requestPk}/results/`);
  return res.data;
};

export const getLabResultDetail = async (pk) => {
  const res = await API.get(`/lab/results/${pk}/`);
  return res.data;
};

/**
 * POST /api/lab/results/
 * Payload: { lab_request_item, result_value, normal_range?, is_abnormal, remarks? }
 * performed_by is set server-side from the logged-in user.
 */
export const createLabResult = async (payload) => {
  const res = await API.post("/lab/results/", payload);
  return res.data;
};

/**
 * PATCH /api/lab/results/{pk}/
 * Cannot edit once request is VERIFIED or DELIVERED.
 */
export const updateLabResult = async (pk, payload) => {
  const res = await API.patch(`/lab/results/${pk}/`, payload);
  return res.data;
};

// ─── LAB REPORTS ──────────────────────────────────────────────────

/**
 * GET /api/lab/requests/{requestPk}/report/
 * Report is auto-created when status reaches COMPLETED.
 */
export const getLabReport = async (requestPk) => {
  const res = await API.get(`/lab/requests/${requestPk}/report/`);
  return res.data;
};

/**
 * PATCH /api/lab/requests/{requestPk}/report/
 * Update report_notes field.
 */
export const updateLabReport = async (requestPk, payload) => {
  const res = await API.patch(`/lab/requests/${requestPk}/report/`, payload);
  return res.data;
};

// ─── PATIENT LAB HISTORY ──────────────────────────────────────────

/**
 * GET /api/lab/patients/{patientId}/history/
 * All lab requests for a patient (paginated).
 */
export const getPatientLabHistory = async (patientId, params = {}) => {
  const res = await API.get(`/lab/patients/${patientId}/history/`, { params });
  return res.data;
};

// ─── LAB DASHBOARD ────────────────────────────────────────────────

/**
 * GET /api/lab/dashboard/
 * Returns { total, by_status: { REQUESTED: n, ... } }
 * Optional params: { start, end } as YYYY-MM-DD — filters the counts to
 * requests whose request_date falls in that range. Omit both to see
 * totals across all time (the previous default behaviour).
 */
export const getLabDashboard = async (params = {}) => {
  const res = await API.get("/lab/dashboard/", { params });
  return res.data;
};

// ─── LAB BILLS ────────────────────────────────────────────────────

/**
 * GET /api/lab/bills/
 * Query params: payment_status, patient_id, request_id, search, page,
 * start, end (start/end are YYYY-MM-DD and filter on the bill's
 * created_at; omit both for no date filter)
 */
export const getLabBills = async (params = {}) => {
  const res = await API.get("/lab/bills/", { params });
  return res.data;
};

export const getLabBillDetail = async (pk) => {
  const res = await API.get(`/lab/bills/${pk}/`);
  return res.data;
};

/**
 * POST /api/lab/bills/
 * Payload: { lab_request, patient, subtotal, discount, paid_amount,
 *            payment_method, notes? }
 * billed_by is set server-side from the logged-in user.
 */
export const createLabBill = async (payload) => {
  const res = await API.post("/lab/bills/", payload);
  return res.data;
};

/**
 * PATCH /api/lab/bills/{pk}/
 * Update payment_status, paid_amount, payment_method, notes.
 */
export const updateLabBill = async (pk, payload) => {
  return API.patch(`/lab/bills/${pk}/`, payload)
    .then(ok)
    .catch((e) => err(e, "Failed to update bill"));
};

// ─── LAB REQUEST — CREATE (Lab Tech / Doctor) ──────────────────────────────
//
//  POST /api/lab/requests/create/
//  Permission: IsAdminOrDoctor
//  Payload: { consultation, patient, notes?, test_ids: [id, ...] }
//  Auto-creates a LabBill and updates consultation status to LAB_REQUESTED.
//
//  Note: This endpoint also exists in doctorApi.js as createLabRequest().
//  This copy in labApi.js is for completeness so lab-side code can call it
//  without importing from the doctor module.
// ──────────────────────────────────────────────────────────────────────────────
export const createLabRequest = async (payload) => {
  const res = await API.post("/lab/requests/create/", payload);
  return res.data;
};

// ─── LAB REQUEST — WALK-IN CREATE (Lab Tech / Admin) ───────────────────────
//
//  POST /api/lab/requests/walkin/create/
//  Permission: IsAdminOrLabTechnician
//  Payload: { walkin_name, walkin_phone?, walkin_gender?, walkin_age?,
//             notes?, test_ids: [id, ...] }
//
//  For a patient who walks directly into the lab — no doctor consultation,
//  no MRD registration. Mirrors the pharmacy "walk-in bill" workflow:
//  creates the LabRequest + items and auto-generates an unpaid LabBill in
//  one call. Returns { message, request: {...}, bill: {...} }.
//
//  If an active (unpaid) walk-in request already exists today for the same
//  name/phone, the backend returns 409 with `existing_request_id` /
//  `existing_bill_id` so the frontend can resume it instead of duplicating.
// ──────────────────────────────────────────────────────────────────────────────
export const createWalkInLabRequest = (payload) => {
  if (!payload) {
    return Promise.reject(new Error("Walk-in request data is required"));
  }
  return API.post("/lab/requests/walkin/create/", payload)
    .then(ok)
    .catch((e) => err(e, "Failed to create walk-in lab request"));
};

// ─── LAB BILL — BY REQUEST ─────────────────────────────────────────────────
//
//  GET /api/lab/requests/{requestPk}/bill/
//  Permission: IsAuthenticated (doctors see only their own requests)
//  Returns the LabBill linked to this request, or 404 if none generated yet.
// ──────────────────────────────────────────────────────────────────────────────
export const getLabBillByRequest = async (requestPk) => {
  const res = await API.get(`/lab/requests/${requestPk}/bill/`);
  return res.data;
};

// ─── LAB BILL — GENERATE / RECALCULATE ────────────────────────────────────
//
//  POST /api/lab/requests/{requestPk}/bill/generate/
//  Permission: IsAdminOrLabTechnician
//  Creates the bill if none exists; recalculates subtotal if one already
//  exists and it is not PAID. Returns { message, bill: { ... } }.
// ──────────────────────────────────────────────────────────────────────────────
export const generateLabBill = async (requestPk) => {
  const res = await API.post(`/lab/requests/${requestPk}/bill/generate/`);
  return res.data;
};

// ─── LAB BILL — PAY (dedicated payment endpoint) ──────────────────────────
//
//  PATCH /api/lab/bills/{pk}/pay/
//  Permission: IsAuthenticated
//  Payload: { payment_method: "CASH"|"CARD"|"UPI"|"INSURANCE", paid_amount, notes? }
//
//  ⚠️  Use this instead of updateLabBill() for payment collection.
//  This endpoint:
//    • Validates paid_amount >= total_amount (full payment required)
//    • Marks bill PAID
//    • Unlocks sample collection for the lab request
//  Returns: { message, bill_id, payment_status, total_amount, paid_amount, lab_request_id }
// ──────────────────────────────────────────────────────────────────────────────
export const payLabBill = async (billId, payload) => {
  // payload: { payment_method, paid_amount, notes? }
  return API.patch(`/lab/bills/${billId}/pay/`, payload)
    .then(ok)
    .catch((e) => err(e, "Failed to process payment"));
};