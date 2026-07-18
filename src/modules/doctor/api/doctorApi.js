// src/modules/doctor/api/doctorApi.js
// ═════════════════════════════════════════════════════════════════
// ✅ FIXED VERSION - All endpoints match Django backend
// ✅ Corrected URL paths
// ✅ Proper error handling
// ✅ Lab results properly fetched
// ═════════════════════════════════════════════════════════════════

import API from "../../../api";

// ─────────────────────────────────────────────
// 🔹 Shared Error Handler
// ─────────────────────────────────────────────
const handleError = (error, fallback) => {
  console.error("API Error:", error);
  if (error.response?.data) {
    const errData = error.response.data;
    if (typeof errData === "string") throw new Error(errData);
    const msg = errData.message ?? errData.detail ?? errData.error ?? JSON.stringify(errData);
    throw new Error(msg);
  }
  if (error.message) throw new Error(error.message);
  throw new Error(fallback);
};

const getData = (res) => res.data;

// ─────────────────────────────────────────────
// 🔹 PATIENTS
// ─────────────────────────────────────────────

export const getPatients = async (params = {}) => {
  try {
    const res = await API.get("/doctor/patients/", { params });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch patients");
  }
};

// ─────────────────────────────────────────────
// 🔹 CONSULTATIONS
// ─────────────────────────────────────────────

export const getConsultations = async (params = {}) => {
  try {
    const res = await API.get("/doctor/consultations/", { params });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch consultations");
  }
};

export const getConsultationDetail = async (id) => {
  try {
    const res = await API.get(`/doctor/consultations/${id}/`);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch consultation data");
  }
};

export const updateConsultationDetail = async (id, data) => {
  try {
    const res = await API.patch(`/doctor/consultations/${id}/`, data);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to update consultation");
  }
};

export const completeConsultation = async (id) => {
  try {
    const res = await API.patch(`/doctor/consultations/${id}/`, { status: "COMPLETED" });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to complete consultation");
  }
};

export const updateConsultationStatus = async (id, status) => {
  try {
    const res = await API.patch(`/doctor/consultations/${id}/`, { status });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to update consultation status");
  }
};

export const getConsultationTimeline = async (id) => {
  try {
    const res = await API.get(`/doctor/consultations/${id}/timeline/`);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch consultation timeline");
  }
};

// ✅ FIXED: Removed /create/ endpoint (Django doesn't need it)
// POST to /consultations/ directly creates a consultation
export const createConsultation = async (data) => {
  try {
    const res = await API.post("/doctor/consultations/", data);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to create consultation");
  }
};

// ✅ Previous consultation history for a patient (vitals, notes, labs, prescriptions)
export const getPatientConsultationHistory = async (patientId, params = {}) => {
  try {
    const res = await API.get(`/doctor/patients/${patientId}/history/`, { params });
    const data = getData(res);
    return Array.isArray(data) ? data : (data?.results ?? []);
  } catch (e) {
    handleError(e, "Failed to fetch patient history");
  }
};

// ─────────────────────────────────────────────
// 🔹 PRESCRIPTIONS
// ─────────────────────────────────────────────

// ✅ FIXED: accepts either a consultation id (integer) or a params object
export const getPrescriptions = async (paramsOrId = {}) => {
  try {
    const params = typeof paramsOrId === "object" ? paramsOrId : { consultation: paramsOrId };
    const res = await API.get("/doctor/prescriptions/", { params });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch prescriptions");
  }
};

// ✅ FIXED: accepts (consultationId, data) matching ConsultationsPage call signature
export const createPrescription = async (consultationId, data) => {
  try {
    const payload = { consultation: consultationId, ...data };
    const res = await API.post("/doctor/prescriptions/", payload);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to create prescription");
  }
};

export const getPrescriptionDetail = async (id) => {
  try {
    const res = await API.get(`/doctor/prescriptions/${id}/`);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch prescription");
  }
};

export const updatePrescription = async (id, data) => {
  try {
    const res = await API.patch(`/doctor/prescriptions/${id}/`, data);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to update prescription");
  }
};

export const deletePrescription = async (id) => {
  try {
    const res = await API.delete(`/doctor/prescriptions/${id}/`);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to delete prescription");
  }
};

// ─────────────────────────────────────────────
// 🔹 PRESCRIPTION ITEMS
// ─────────────────────────────────────────────

export const createPrescriptionItem = async (prescriptionId, data) => {
  try {
    const res = await API.post(
      `/doctor/prescriptions/${prescriptionId}/items/`,
      data
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to add prescription item");
  }
};

export const deletePrescriptionItem = async (prescriptionId, itemId) => {
  try {
    const res = await API.delete(
      `/doctor/prescriptions/${prescriptionId}/items/${itemId}/`
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to delete item");
  }
};

// ─────────────────────────────────────────────
// 🔹 PRESCRIPTION OVERRIDES
// ─────────────────────────────────────────────

export const overridePrescriptionRoute = async (prescriptionId, itemId, route) => {
  try {
    const res = await API.patch(
      `/doctor/prescriptions/${prescriptionId}/items/${itemId}/override-route/`,
      { route }
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to override route");
  }
};

export const overridePrescriptionQuantity = async (prescriptionId, itemId, quantity) => {
  try {
    const res = await API.patch(
      `/doctor/prescriptions/${prescriptionId}/items/${itemId}/override-quantity/`,
      { quantity }
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to override quantity");
  }
};

export const recalculatePrescriptionQuantity = async (prescriptionId, itemId) => {
  try {
    const res = await API.post(
      `/doctor/prescriptions/${prescriptionId}/items/${itemId}/recalculate-quantity/`
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to recalculate quantity");
  }
};

export const validatePrescription = async (prescriptionId) => {
  try {
    const res = await API.post(
      `/doctor/prescriptions/${prescriptionId}/validate/`
    );
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to validate prescription");
  }
};

// ─────────────────────────────────────────────
// 🔹 LAB REQUESTS
// ─────────────────────────────────────────────

export const getLabRequests = async (params = {}) => {
  try {
    const res = await API.get("/lab/requests/", { params });
    const data = getData(res);
    // Handle both paginated and non-paginated responses
    return Array.isArray(data) ? data : (data?.results ?? data ?? []);
  } catch (e) {
    handleError(e, "Failed to fetch lab requests");
  }
};

export const getLabRequestDetail = async (requestId) => {
  try {
    const res = await API.get(`/lab/requests/${requestId}/`);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch lab request detail");
  }
};

export const createLabRequest = async (data) => {
  try {
    const res = await API.post("/lab/requests/create/", data);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to create lab request");
  }
};

// ─────────────────────────────────────────────
// 🔹 LAB TESTS
// ─────────────────────────────────────────────

export const getLabTests = async () => {
  try {
    const res = await API.get("/lab/tests/");
    const data = getData(res);
    // Handle both paginated and non-paginated responses
    return Array.isArray(data) ? data : (data?.results ?? data ?? []);
  } catch (e) {
    handleError(e, "Failed to fetch lab tests");
  }
};

// ─────────────────────────────────────────────
// 🔹 TEST GROUPS (panels billed as one unit, e.g. LFT/KFT/LIPID)
// ─────────────────────────────────────────────

export const getTestGroups = async () => {
  try {
    const res = await API.get("/lab/test-groups/");
    const data = getData(res);
    // Handle both paginated and non-paginated responses
    return Array.isArray(data) ? data : (data?.results ?? data ?? []);
  } catch (e) {
    handleError(e, "Failed to fetch test groups");
  }
};

// ─────────────────────────────────────────────
// 🔹 LAB RESULTS
// ─────────────────────────────────────────────

export const getLabResultsByRequest = async (requestId) => {
  try {
    const res = await API.get(`/lab/requests/${requestId}/results/`);
    const data = getData(res);

    // Normalize response - might come as direct data or wrapped
    if (data?.items) {
      return {
        request_id: data.request_id,
        status: data.status,
        items: data.items || [],
      };
    }

    // If it's a direct array of items
    if (Array.isArray(data)) {
      return {
        request_id: requestId,
        items: data,
      };
    }

    // Default fallback
    return {
      request_id: requestId,
      items: [],
    };
  } catch (e) {
    console.error("Lab Results Error:", e);
    handleError(e, "Failed to fetch lab results");
  }
};

export const transformLabResults = (resultData) => {
  if (!resultData?.items) return [];

  return resultData.items.map((item) => ({
    item_id: item.item_id,
    test_code: item.test_code,
    test_name: item.test_name,
    test_unit: item.test_unit,
    test_normal_range: item.test_normal_range,
    item_notes: item.notes,
    result: item.result ? {
      result_id: item.result.result_id,
      result_value: item.result.result_value,
      normal_range: item.result.normal_range,
      is_abnormal: item.result.is_abnormal,
      remarks: item.result.remarks,
      performed_by_username: item.result.performed_by_username,
      performed_at: item.result.performed_at,
    } : null,
  }));
};

// ─────────────────────────────────────────────
// 🔹 MEDICINE SEARCH (Autocomplete)
// ─────────────────────────────────────────────

export const searchMedicines = async (q = "", recentIds = "", limit = 12) => {
  try {
    const params = { limit };
    if (q.trim()) params.q = q.trim();
    if (recentIds) params.recent = recentIds;
    const res = await API.get("/pharmacist/medicines/search/", { params });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to search medicines");
  }
};

// NOTE: a getMedicines() hitting /pharmacist/medicines/ used to live here.
// It required IsAdminOrPharmacist on the backend, so a doctor calling it
// would get a 403 — it was unused dead code and has been removed. Use
// searchMedicines() above (backed by the IsAuthenticated-only
// /pharmacist/medicines/search/ endpoint) for anything doctor-facing.

// ─────────────────────────────────────────────
// 🔹 DOCTOR PROFILE
// ─────────────────────────────────────────────

// ✅ FIXED: GET /doctor/profile/ (singular, not /profiles/)
export const getDoctorProfile = async () => {
  try {
    const res = await API.get("/doctor/profile/");
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch doctor profile");
  }
};

// ─────────────────────────────────────────────
// 🔹 FOLLOW-UP REMINDERS
// ─────────────────────────────────────────────

// ✅ FIXED: GET /doctor/reminders/ (not /followup-reminders/)
export const getFollowUpReminders = async (params = {}) => {
  try {
    const res = await API.get("/doctor/reminders/", { params });
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch follow-up reminders");
  }
};

// ✅ FIXED: GET /doctor/reminders/summary/ (not /followup-reminders/summary/)
export const getFollowUpReminderSummary = async () => {
  try {
    const res = await API.get("/doctor/reminders/summary/");
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to fetch follow-up reminder summary");
  }
};

// ✅ FIXED: PATCH /doctor/reminders/{id}/ (not /followup-reminders/)
export const updateFollowUpReminder = async (pk, data) => {
  try {
    const res = await API.patch(`/doctor/reminders/${pk}/`, data);
    return getData(res);
  } catch (e) {
    handleError(e, "Failed to update follow-up reminder");
  }
};

// ─────────────────────────────────────────────
// 🔹 UTILITIES
// ─────────────────────────────────────────────

// NOTE: a searchPatients() hitting /reception/patients/ used to live here.
// It required IsAdminOrReceptionist on the backend, so a doctor calling it
// would get a 403 — it was unused dead code and has been removed. Doctors
// already have their own patient list at /doctor/patients/ (getPatients()
// above), which is IsAdminOrDoctor-scoped correctly.

// ─────────────────────────────────────────────
// 🔹 BILLING PLACEHOLDERS
// ─────────────────────────────────────────────

export const addToCart = async (data) => ({
  name: data?.prescription_id
    ? `Prescription ${data.prescription_id}`
    : "CartItem",
});

export const createBilling = async (data) => ({
  id: Date.now(),
  total_amount:
    data?.cart?.reduce((s, i) => s + (i.price || 0), 0) || 0,
});

export const dispenseMedicine = async () => ({
  success: true,
});