// src/modules/manager/api/managerApi.js
import API from "../../../api";

// ─── BRANCH ACCESS (self-service) ──────────────────────────────────────────
// A manager's own accessible branches (home branch + anything a group admin
// granted via ManagerBranchAccess). Powers BranchSwitcher.jsx for the
// manager role. See manager/views.py:ManagerBranchesView.
export const getManagerBranches = async () => {
  const res = await API.get("/manager/branches/");
  return res.data; // { branches: [...], active_branch_id }
};

// ─── FINANCE DASHBOARD ────────────────────────────────────────────────────
export const getFinanceDashboard = async (params = {}) => {
  const res = await API.get("/manager/finance/", { params });
  return res.data;
};

// ─── ALL BILLS ────────────────────────────────────────────────────────────
export const getAllBills = async (params = {}) => {
  const res = await API.get("/manager/bills/", { params });
  return res.data;
};

// source: "reception" | "pharmacy" | "lab" | "prebooking", id: the bill's numeric id
export const getBillDetail = async (source, id) => {
  const res = await API.get("/manager/bills/detail/", { params: { source, id } });
  return res.data;
};

// ─── PURCHASES & REFUNDS (medicine + supplies, read-only) ────────────────
export const getPurchasesAndRefunds = async (params = {}) => {
  const res = await API.get("/manager/purchases/", { params });
  return res.data;
};

// ─── SUPPORT STAFF ────────────────────────────────────────────────────────
export const getSupportStaffList = async (params = {}) => {
  const res = await API.get("/manager/support-staff/", { params });
  return res.data;
};

export const createSupportStaff = async (payload) => {
  const res = await API.post("/manager/support-staff/", payload);
  return res.data;
};

export const updateSupportStaff = async (id, payload) => {
  const res = await API.put(`/manager/support-staff/${id}/`, payload);
  return res.data;
};

export const patchSupportStaff = async (id, payload) => {
  const res = await API.patch(`/manager/support-staff/${id}/`, payload);
  return res.data;
};

export const deactivateSupportStaff = async (id) => {
  const res = await API.delete(`/manager/support-staff/${id}/`);
  return res.data;
};

export const activateSupportStaff = async (id) => {
  const res = await API.post(`/manager/support-staff/${id}/activate/`);
  return res.data;
};

// ─── ALL STAFF (EMR + Support) ────────────────────────────────────────────
export const getAllStaff = async (params = {}) => {
  const res = await API.get("/manager/all-staff/", { params });
  return res.data;
};

// ─── ATTENDANCE ───────────────────────────────────────────────────────────
export const getAttendance = async (params = {}) => {
  const res = await API.get("/manager/attendance/", { params });
  return res.data;
};

export const markAttendance = async (payload) => {
  const res = await API.post("/manager/attendance/", payload);
  return res.data;
};

export const bulkMarkAttendance = async (payload) => {
  const res = await API.post("/manager/attendance/bulk/", payload);
  return res.data;
};

export const getAttendanceSummary = async (params = {}) => {
  const res = await API.get("/manager/attendance/summary/", { params });
  return res.data;
};

// ─── LEAVE MANAGEMENT ─────────────────────────────────────────────────────
export const getLeaveRequests = async (params = {}) => {
  const res = await API.get("/manager/leaves/", { params });
  return res.data;
};

export const createLeaveRequest = async (payload) => {
  const res = await API.post("/manager/leaves/", payload);
  return res.data;
};

export const patchLeaveRequest = async (id, payload) => {
  const res = await API.patch(`/manager/leaves/${id}/`, payload);
  return res.data;
};

export const approveLeave = async (id) => {
  const res = await API.post(`/manager/leaves/${id}/approve/`);
  return res.data;
};

export const rejectLeave = async (id, rejection_reason = "") => {
  const res = await API.post(`/manager/leaves/${id}/reject/`, { rejection_reason });
  return res.data;
};

// ─── SALARY ───────────────────────────────────────────────────────────────
export const getSalaryRecords = async (params = {}) => {
  const res = await API.get("/manager/salary/", { params });
  return res.data;
};

export const generateSalary = async (payload) => {
  const res = await API.post("/manager/salary/generate/", payload);
  return res.data;
};

export const patchSalaryRecord = async (id, payload) => {
  const res = await API.patch(`/manager/salary/${id}/`, payload);
  return res.data;
};

export const markSalaryPaid = async (id) => {
  const res = await API.post(`/manager/salary/${id}/mark-paid/`);
  return res.data;
};

// Note: the delete endpoint lives at /manager/salary/<id>/delete/ (DELETE),
// not /manager/salary/<id>/ — matches SalaryDeleteView in manager/urls.py.
export const deleteSalaryRecord = async (id) => {
  const res = await API.delete(`/manager/salary/${id}/delete/`);
  return res.data;
};

// ─── SALARY ENTRIES ─────────────────────────────────────────────────────────
// Lets a manager build up net_salary from tagged line items instead of typing
// one final number: each entry is (entry_type: Salary/Bonus/Deduction, amount,
// note), and the backend adds/removes its amount from the record's
// net_salary/bonus/deductions totals automatically.
export const getSalaryEntries = async (recordId) => {
  const res = await API.get(`/manager/salary/${recordId}/entries/`);
  return res.data;
};

export const addSalaryEntry = async (recordId, { entry_type, amount, note }) => {
  const res = await API.post(`/manager/salary/${recordId}/entries/`, { entry_type, amount, note });
  return res.data; // { entry, net_salary, bonus, deductions }
};

export const deleteSalaryEntry = async (recordId, entryId) => {
  const res = await API.delete(`/manager/salary/${recordId}/entries/${entryId}/`);
  return res.data;
};

// ─── EXPENSES ─────────────────────────────────────────────────────────────
export const getExpenses = async (params = {}) => {
  const res = await API.get("/manager/expenses/", { params });
  return res.data;
};

export const createExpense = async (payload) => {
  const res = await API.post("/manager/expenses/", payload);
  return res.data;
};

export const patchExpense = async (id, payload) => {
  const res = await API.patch(`/manager/expenses/${id}/`, payload);
  return res.data;
};

export const deleteExpense = async (id) => {
  const res = await API.delete(`/manager/expenses/${id}/`);
  return res.data;
};

// ─── OTHER INCOME ─────────────────────────────────────────────────────────
export const listIncome = async (params = {}) => {
  const res = await API.get("/manager/income/", { params });
  return res.data;
};

export const createIncome = async (payload) => {
  const res = await API.post("/manager/income/", payload);
  return res.data;
};

export const patchIncome = async (id, payload) => {
  const res = await API.patch(`/manager/income/${id}/`, payload);
  return res.data;
};

export const deleteIncome = async (id) => {
  const res = await API.delete(`/manager/income/${id}/`);
  return res.data;
};

// ─── HOME VISIT FEE SETTINGS ────────────────────────────────────────────────
// GET readable by receptionist/manager/admin, PATCH manager/admin only.
export const getHomeVisitSettings = async () => {
  const res = await API.get("/manager/home-visit-settings/");
  return res.data;
};

export const patchHomeVisitSettings = async (payload) => {
  const res = await API.patch("/manager/home-visit-settings/", payload);
  return res.data;
};

// ─── DEALERS + CREDIT LEDGER ────────────────────────────────────────────────
export const getDealers = async (params = {}) => {
  const res = await API.get("/manager/dealers/", { params });
  return res.data;
};

export const createDealer = async (payload) => {
  const res = await API.post("/manager/dealers/", payload);
  return res.data;
};

// Returns the dealer record plus its most recent ledger transactions
// (server includes a `transactions` array on the detail payload).
export const getDealer = async (id) => {
  const res = await API.get(`/manager/dealers/${id}/`);
  return res.data;
};

export const updateDealer = async (id, payload) => {
  const res = await API.patch(`/manager/dealers/${id}/`, payload);
  return res.data;
};

// Soft-deactivate only — dealers with ledger history are never hard-deleted.
export const deactivateDealer = async (id) => {
  const res = await API.delete(`/manager/dealers/${id}/`);
  return res.data;
};

export const getDealerTransactions = async (params = {}) => {
  const res = await API.get("/manager/dealers/transactions/", { params });
  return res.data;
};

export const createDealerTransaction = async (payload) => {
  const res = await API.post("/manager/dealers/transactions/", payload);
  return res.data;
};

// action: "CONFIRM" | "REJECT"
export const finalizeDealerTransaction = async (id, payload) => {
  const res = await API.post(`/manager/dealers/transactions/${id}/finalize/`, payload);
  return res.data;
};

// payload: { transaction_ids: [id, ...], action, settlement_method?, due_date?,
//            reference_number?, notes? } — settles a whole batch of one
// dealer's PENDING transactions in a single call.
export const bulkFinalizeDealerTransactions = async (payload) => {
  const res = await API.post("/manager/dealers/transactions/bulk-finalize/", payload);
  return res.data;
};

// Reverses a mistaken CONFIRMED entry (e.g. a stray/duplicate manual
// payment) without deleting it — sets it to REJECTED so it drops out of
// Dealer.balance while staying on the ledger for audit history.
// payload: { reason? }
export const voidDealerTransaction = async (id, payload = {}) => {
  const res = await API.post(`/manager/dealers/transactions/${id}/void/`, payload);
  return res.data;
};

// ─── PROCEDURES ───────────────────────────────────────────────────────────
// Shared catalog with Admin — same backend endpoint, same data, Manager just
// gets full CRUD on it too (see authentication.permissions.IsAdminOrManager).
const fetchList = async (defaultPath, arg = {}) => {
  if (typeof arg === "string") {
    const res = await API.get(arg);
    return res.data;
  }
  const res = await API.get(defaultPath, { params: arg });
  return res.data;
};

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