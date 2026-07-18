// src/modules/admin/api/adminApi.js
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

// ─── DASHBOARD ────────────────────────────────────────────────────
export const getDashboardStats = async () => {
  const res = await API.get("/administration/dashboard/");
  return res.data;
};

// ─── STAFF ────────────────────────────────────────────────────────
// Backend filters: ?role=<role>  ?all=true  ?search=<term>
export const getStaffList = async (arg = {}) => {
  return fetchList("/administration/staff/", arg);
};

export const createStaff = async (payload) => {
  const res = await API.post("/administration/staff/", payload);
  return res.data; // { message, id, data: StaffProfile }
};

export const updateStaff = async (id, payload) => {
  const res = await API.put(`/administration/staff/${id}/`, payload);
  return res.data;
};

export const patchStaff = async (id, payload) => {
  const res = await API.patch(`/administration/staff/${id}/`, payload);
  return res.data;
};

export const deactivateStaff = async (id) => {
  const res = await API.post(`/administration/staff/${id}/deactivate/`);
  return res.data;
};

export const reactivateStaff = async (id) => {
  const res = await API.post(`/administration/staff/${id}/reactivate/`);
  return res.data;
};

// ─── MANAGERS ─────────────────────────────────────────────────────
// Managers are plain StaffProfile rows — no separate profile model.
// Uses the shared /staff/ endpoint filtered by role=Manager.
export const getManagerList = async (arg = {}) => {
  if (typeof arg === "string") {
    const res = await API.get(arg);
    return res.data;
  }
  const res = await API.get("/administration/staff/", { params: { role: "Manager", ...arg } });
  return res.data;
};

// ─── RECEPTIONISTS ────────────────────────────────────────────────
export const getReceptionistList = async (arg = {}) => {
  return fetchList("/administration/receptionist/", arg);
};

export const createReceptionist = async (payload) => {
  const res = await API.post("/administration/receptionist/", payload);
  return res.data;
};

export const updateReceptionist = async (id, payload) => {
  const res = await API.put(`/administration/receptionist/${id}/`, payload);
  return res.data;
};

export const patchReceptionist = async (id, payload) => {
  const res = await API.patch(`/administration/receptionist/${id}/`, payload);
  return res.data;
};

// ─── DOCTORS ──────────────────────────────────────────────────────
// Backend: /api/administration/doctors/ (DoctorProfile, nested `staff`)
// Filters: ?all=true  ?search=<term>
export const getDoctorList = async (arg = {}) => {
  return fetchList("/administration/doctors/", arg);
};

export const patchDoctor = async (id, payload) => {
  const res = await API.patch(`/administration/doctors/${id}/`, payload);
  return res.data;
};

// ─── GUEST DOCTORS ────────────────────────────────────────────────
// Backend: /api/administration/guest-doctors/
// Filters: ?all=true  ?search=<term>

export const getGuestDoctorList = async (arg = {}) => {
  return fetchList("/administration/guest-doctors/", arg);
};

export const createGuestDoctor = async (payload) => {
  const res = await API.post("/administration/guest-doctors/", payload);
  return res.data; // { message, id, data: GuestDoctorProfile }
};

export const patchGuestDoctor = async (id, payload) => {
  const res = await API.patch(`/administration/guest-doctors/${id}/`, payload);
  return res.data;
};

export const deactivateGuestDoctor = async (id) => {
  const res = await API.post(`/administration/guest-doctors/${id}/deactivate/`);
  return res.data;
};

export const reactivateGuestDoctor = async (id) => {
  const res = await API.post(`/administration/guest-doctors/${id}/reactivate/`);
  return res.data;
};

// ─── COMMON RECEPTIONISTS ─────────────────────────────────────────
// Backend: /api/administration/common-receptionists/
// Login-only accounts, admin-managed like Guest Doctor.
// Filters: ?all=true  ?search=<term>

export const getCommonReceptionistList = async (arg = {}) => {
  return fetchList("/administration/common-receptionists/", arg);
};

export const createCommonReceptionist = async (payload) => {
  const res = await API.post("/administration/common-receptionists/", payload);
  return res.data; // { message, id, data: CommonReceptionistProfile }
};

export const patchCommonReceptionist = async (id, payload) => {
  const res = await API.patch(`/administration/common-receptionists/${id}/`, payload);
  return res.data;
};

export const deactivateCommonReceptionist = async (id) => {
  const res = await API.post(`/administration/common-receptionists/${id}/deactivate/`);
  return res.data;
};

export const reactivateCommonReceptionist = async (id) => {
  const res = await API.post(`/administration/common-receptionists/${id}/reactivate/`);
  return res.data;
};

// ─── COMMON PHARMACISTS ───────────────────────────────────────────
// Backend: /api/administration/common-pharmacists/
// Login-only accounts, admin-managed like Guest Doctor.
// Filters: ?all=true  ?search=<term>

export const getCommonPharmacistList = async (arg = {}) => {
  return fetchList("/administration/common-pharmacists/", arg);
};

export const createCommonPharmacist = async (payload) => {
  const res = await API.post("/administration/common-pharmacists/", payload);
  return res.data; // { message, id, data: CommonPharmacistProfile }
};

export const patchCommonPharmacist = async (id, payload) => {
  const res = await API.patch(`/administration/common-pharmacists/${id}/`, payload);
  return res.data;
};

export const deactivateCommonPharmacist = async (id) => {
  const res = await API.post(`/administration/common-pharmacists/${id}/deactivate/`);
  return res.data;
};

export const reactivateCommonPharmacist = async (id) => {
  const res = await API.post(`/administration/common-pharmacists/${id}/reactivate/`);
  return res.data;
};

// ─── PHARMACISTS ──────────────────────────────────────────────────
export const getPharmacistList = async (arg = {}) => {
  return fetchList("/administration/pharmacist/", arg);
};

export const createPharmacist = async (payload) => {
  const res = await API.post("/administration/pharmacist/", payload);
  return res.data;
};

export const updatePharmacist = async (id, payload) => {
  const res = await API.put(`/administration/pharmacist/${id}/`, payload);
  return res.data;
};

export const patchPharmacist = async (id, payload) => {
  const res = await API.patch(`/administration/pharmacist/${id}/`, payload);
  return res.data;
};

// ─── PROCEDURES ───────────────────────────────────────────────────
export const getProcedureList = async (arg = {}) => {
  return fetchList("/administration/procedures/", arg);
};

export const createProcedure = async (payload) => {
  const res = await API.post("/administration/procedures/", payload);
  return res.data;
};

export const updateProcedure = async (id, payload) => {
  const res = await API.put(`/administration/procedures/${id}/`, payload);
  return res.data;
};

export const patchProcedure = async (id, payload) => {
  const res = await API.patch(`/administration/procedures/${id}/`, payload);
  return res.data;
};

// Soft-delete: sets is_active=False on the backend
export const deleteProcedure = async (id) => {
  const res = await API.delete(`/administration/procedures/${id}/`);
  return res.data;
};

// ─── AUDIT LOGS ───────────────────────────────────────────────────
export const getAuditLogs = async (arg = {}) => {
  return fetchList("/administration/audit/", arg);
};
// ─── HOSPITAL SETTINGS ────────────────────────────────────────────
export const getHospitalSettings = async () => {
  const res = await API.get("/administration/settings/");
  return res.data;
};

export const patchHospitalSettings = async (payload) => {
  const res = await API.patch("/administration/settings/", payload);
  return res.data;
};