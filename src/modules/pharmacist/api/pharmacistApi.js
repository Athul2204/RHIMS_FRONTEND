/**
 * FILE: src/modules/pharmacist/api/pharmacistApi.js
 * 
 * COMPLETE PRODUCTION-READY IMPLEMENTATION
 * For Pharmacy Bill Transition & Completion
 * 
 * Copy this entire content into your React API file
 */

// ═════════════════════════════════════════════════════════════════════
// IMPORTS
// ═════════════════════════════════════════════════════════════════════

import API from "../../../api";

// ═════════════════════════════════════════════════════════════════════
// RESPONSE HANDLERS
// ═════════════════════════════════════════════════════════════════════

const ok = (res) => res.data;

const err = (e, msg) => {
  const errorData = e.response?.data;

  // 409 Conflict — duplicate bill. Attach existing_bill_id so callers can resume.
  if (e.response?.status === 409 && errorData) {
    const conflict = new Error(errorData.error || "Duplicate bill conflict.");
    conflict.status = 409;
    conflict.existing_bill_id     = errorData.existing_bill_id;
    conflict.existing_bill_number = errorData.existing_bill_number;
    conflict.existing_bill_status = errorData.existing_bill_status;
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

  // ✅ FIX: DRF serializer validation errors (e.g. from CreateBillSerializer's
  // object-level `validate()`) come back as { non_field_errors: [...] } or as
  // per-field arrays like { walkin_name: ["..."], prescription_id: ["..."] }
  // — none of which match .error/.detail/.message above, so every validation
  // failure was silently replaced with a generic "Request failed" message,
  // hiding the actual reason (e.g. "For registered patient, provide at
  // least one of: patient_id, mrd_number, or prescription_id.").
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

// ═════════════════════════════════════════════════════════════════════
// BILL MANAGEMENT FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Create a new pharmacy bill
 *
 * @param {Object} billData - Bill creation data
 * @param {string} billData.bill_type - WALK_IN|PATIENT|MIXED
 * @param {string} billData.patient_type - walkin|patient
 * @param {string} billData.patient_id - Patient ID (if registered)
 * @param {string} billData.walkin_name - Walk-in patient name
 * @param {string} billData.walkin_age - Walk-in patient age
 * @param {string} billData.walkin_gender - Walk-in patient gender
 * @param {string} billData.walkin_phone - Walk-in patient phone
 *
 * @returns {Promise<Object>} Created bill with bill_id and status=DRAFT
 */
export const createBill = (billData) => {
  if (!billData) {
    return Promise.reject(new Error("Bill data is required"));
  }

  return API.post("/pharmacist/bills/create/", billData)
    .then(ok)
    .catch((e) => err(e, "Failed to create bill"));
};

/**
 * Get list of all bills
 *
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by bill status (DRAFT, OPEN, COMPLETED, PAID, CANCELLED)
 *
 * @returns {Promise<Array>} List of bills
 */
export const getBills = (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.status) {
    params.append("status", filters.status);
  }
  // Also support bill_status parameter
  if (filters.bill_status) {
    params.append("bill_status", filters.bill_status);
  }

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/bills/?${queryString}` : "/pharmacist/bills/";

  return API.get(url)
    .then((res) => {
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(res.data)) {
        return res.data;  // Direct array from backend
      }
      return res.data.bills || [];  // Wrapped response
    })
    .catch((e) => {
      console.error("[API] Failed to fetch bills:", e);
      err(e, "Failed to fetch bills");
      return [];
    });
};

/**
 * Get detailed information about a specific bill
 *
 * @param {number} billId - Bill ID
 *
 * @returns {Promise<Object>} Bill details with items and totals
 */
export const getBillDetail = (billId) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  return API.get(`/pharmacist/bills/${billId}/`)
    .then((res) => res.data.bill || res.data)
    .catch((e) => err(e, "Failed to fetch bill details"));
};

// ═════════════════════════════════════════════════════════════════════
// BILL TRANSITION FUNCTIONS - NEW ENDPOINTS
// ═════════════════════════════════════════════════════════════════════

/**
 * ✅ TRANSITION BILL TO OPEN (DRAFT → OPEN)
 *
 * Transitions bill from DRAFT to OPEN status
 * Opens the bill for completion after pharmacist review
 *
 * Requires:
 * - Bill must be in DRAFT status
 * - Bill must have at least one medicine or procedure item
 *
 * @param {number} billId - Bill ID (required)
 *
 * @returns {Promise<Object>} Updated bill with status=OPEN
 *
 * Success Response:
 * {
 *   message: "Bill transitioned to OPEN...",
 *   bill: { bill_id, bill_status: "OPEN", ... },
 *   bill_status: "OPEN"
 * }
 *
 * Error Cases:
 * - billId missing: "Bill ID is required"
 * - Bill not DRAFT: "Bill must be in 'DRAFT' status..."
 * - Empty bill: "Cannot transition an empty bill..."
 */
export const transitionBillToOpen = (billId) => {
  // Guard against missing billId
  if (!billId || billId === null || billId === undefined) {
    return Promise.reject(new Error("Bill ID is required to transition bill"));
  }

  console.log(`[API] Transitioning bill ${billId} to OPEN`);

  return API.post(`/pharmacist/bills/${billId}/transition-open/`)
    .then((response) => {
      console.log(`[API] ✅ Bill ${billId} transitioned to OPEN successfully`);
      console.log("[API] Response:", response.data);
      return response.data;
    })
    .catch((e) => {
      // Handle "already open" case gracefully
      const errorData = e.response?.data;
      const isAlreadyOpen =
        e.response?.status === 200 ||
        (e.response?.status === 400 &&
          (String(errorData?.message || "").includes("already") ||
            String(errorData?.error || "").includes("OPEN")));

      if (isAlreadyOpen) {
        console.log(`[API] ℹ️ Bill ${billId} is already OPEN - continuing`);
        return {
          message: "Bill is already in OPEN status",
          bill: { bill_id: billId, bill_status: "OPEN" },
          bill_status: "OPEN",
        };
      }

      console.error(`[API] ❌ Failed to transition bill ${billId}:`, errorData);
      throw err(e, `Failed to transition bill to OPEN status`);
    });
};

/**
 * ✅ COMPLETE BILL (OPEN → COMPLETED)
 *
 * Completes a bill by transitioning from OPEN to COMPLETED status
 * Freezes item quantities but does NOT deduct stock
 *
 * Requires:
 * - Bill must be in OPEN status
 * - Bill must have at least one medicine or procedure item
 *
 * Stock deduction ONLY happens when marked as PAID
 *
 * @param {number} billId - Bill ID (required)
 *
 * @returns {Promise<Object>} Completed bill with status=COMPLETED
 *
 * Success Response:
 * {
 *   message: "Bill completed successfully...",
 *   bill: {
 *     bill_id, bill_status: "COMPLETED",
 *     medicine_items: [...],
 *     procedure_items: [...],
 *     total_amount: 3000
 *   },
 *   bill_status: "COMPLETED"
 * }
 *
 * Error Cases:
 * - billId missing: "Bill ID is required"
 * - Bill not OPEN: "Bill must be 'OPEN' to complete..."
 * - Empty bill: "Cannot complete an empty bill..."
 *
 * Important:
 * - Stock is NOT deducted when bill is completed
 * - Stock deduction only happens when marked as PAID
 * - This allows customer to change mind before payment
 */
export const completeBill = (billId) => {
  // Guard against missing billId
  if (!billId || billId === null || billId === undefined) {
    return Promise.reject(new Error("Bill ID is required to complete bill"));
  }

  console.log(`[API] Completing bill ${billId} (OPEN → COMPLETED)`);

  return API.post(`/pharmacist/bills/${billId}/complete/`)
    .then((response) => {
      console.log(`[API] ✅ Bill ${billId} completed successfully`);
      console.log("[API] Response:", response.data);
      return response.data;
    })
    .catch((e) => {
      const errorData = e.response?.data;
      console.error(`[API] ❌ Failed to complete bill ${billId}:`, errorData);
      throw err(e, "Failed to complete bill");
    });
};

// ═════════════════════════════════════════════════════════════════════
// BILL ITEM MANAGEMENT FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Add medicine to bill
 *
 * @param {number} billId - Bill ID
 * @param {Object} medicineData - Medicine data
 * @param {number} medicineData.batch_id - Batch ID
 * @param {number} medicineData.quantity - Quantity (default: 1)
 * @param {number} [medicineData.prescription_item_id] - Source prescription
 *   item, when adding a prescribed medicine. Links the bill line back to its
 *   dose/frequency/meal-timing/duration for display on the bill & receipt.
 *
 * @returns {Promise<Object>} Added item and updated bill total
 */
export const addMedicine = (billId, medicineData) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  console.log(`[API] Adding medicine to bill ${billId}`);

  return API.post(`/pharmacist/bills/${billId}/add-medicine/`, medicineData)
    .then((response) => {
      console.log(`[API] ✅ Medicine added to bill ${billId}`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to add medicine to bill"));
};

/**
 * Add procedure to bill
 *
 * @param {number} billId - Bill ID
 * @param {Object} procedureData - Procedure data
 * @param {number} procedureData.procedure_id - Procedure ID
 * @param {number} procedureData.quantity - Quantity (default: 1)
 *
 * @returns {Promise<Object>} Added item and updated bill total
 */
export const addProcedure = (billId, procedureData) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  console.log(`[API] Adding procedure to bill ${billId}`);

  return API.post(`/pharmacist/bills/${billId}/add-procedure/`, procedureData)
    .then((response) => {
      console.log(`[API] ✅ Procedure added to bill ${billId}`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to add procedure to bill"));
};

/**
 * Remove medicine item from bill
 *
 * @param {number} billId - Bill ID
 * @param {number} itemId - Medicine item ID
 *
 * @returns {Promise<Object>} Updated bill total
 */
export const removeMedicineItem = (billId, itemId) => {
  if (!billId || !itemId) {
    return Promise.reject(new Error("Bill ID and item ID are required"));
  }

  console.log(`[API] Removing medicine item ${itemId} from bill ${billId}`);

  return API.delete(`/pharmacist/bills/${billId}/medicine-items/${itemId}/`)
    .then((response) => {
      console.log(`[API] ✅ Medicine item removed`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to remove medicine item"));
};

/**
 * Remove procedure item from bill
 *
 * @param {number} billId - Bill ID
 * @param {number} itemId - Procedure item ID
 *
 * @returns {Promise<Object>} Updated bill total
 */
export const removeProcedureItem = (billId, itemId) => {
  if (!billId || !itemId) {
    return Promise.reject(new Error("Bill ID and item ID are required"));
  }

  console.log(`[API] Removing procedure item ${itemId} from bill ${billId}`);

  return API.delete(
    `/pharmacist/bills/${billId}/procedure-items/${itemId}/`
  )
    .then((response) => {
      console.log(`[API] ✅ Procedure item removed`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to remove procedure item"));
};

/**
 * Update medicine item quantity
 *
 * @param {number} billId - Bill ID
 * @param {number} itemId - Medicine item ID
 * @param {Object} updateData - Update data
 * @param {number} updateData.quantity - New quantity
 *
 * @returns {Promise<Object>} Updated item and bill total
 */
export const updateMedicineItem = (billId, itemId, updateData) => {
  if (!billId || !itemId) {
    return Promise.reject(new Error("Bill ID and item ID are required"));
  }

  console.log(
    `[API] Updating medicine item ${itemId} in bill ${billId}:`,
    updateData
  );

  return API.patch(
    `/pharmacist/bills/${billId}/medicine-items/${itemId}/`,
    updateData
  )
    .then((response) => {
      console.log(`[API] ✅ Medicine item updated`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to update medicine item"));
};

/**
 * Update procedure item
 *
 * @param {number} billId - Bill ID
 * @param {number} itemId - Procedure item ID
 * @param {Object} updateData - Update data
 * @param {number} updateData.quantity - New quantity
 *
 * @returns {Promise<Object>} Updated item and bill total
 */
export const updateProcedureItem = (billId, itemId, updateData) => {
  if (!billId || !itemId) {
    return Promise.reject(new Error("Bill ID and item ID are required"));
  }

  console.log(
    `[API] Updating procedure item ${itemId} in bill ${billId}:`,
    updateData
  );

  return API.patch(
    `/pharmacist/bills/${billId}/procedure-items/${itemId}/`,
    updateData
  )
    .then((response) => {
      console.log(`[API] ✅ Procedure item updated`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to update procedure item"));
};

// ═════════════════════════════════════════════════════════════════════
// BILL PAYMENT & CANCELLATION FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Mark bill as paid (COMPLETED → PAID)
 * ⚠️ STOCK DEDUCTION HAPPENS HERE
 *
 * @param {number} billId - Bill ID
 * @param {Object} paymentData - Payment data
 * @param {string} paymentData.payment_method - CASH|CARD|UPI|CHEQUE
 * @param {string} paymentData.upi_reference - UPI reference (optional)
 * @param {string} paymentData.cheque_number - Cheque number (optional)
 *
 * @returns {Promise<Object>} Updated bill with status=PAID
 */
export const markBillPaid = (billId, paymentData = {}) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  const defaultPayment = { payment_method: "CASH", ...paymentData };

  console.log(`[API] Marking bill ${billId} as PAID`);
  console.log(`[API] ⚠️ STOCK WILL BE DEDUCTED`);

  return API.post(`/pharmacist/bills/${billId}/mark-paid/`, defaultPayment)
    .then((response) => {
      console.log(`[API] ✅ Bill ${billId} marked as PAID`);
      console.log(`[API] ✅ STOCK DEDUCTED`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to mark bill as paid"));
};

/**
 * Set (or clear, with amount 0) the flat discount on a bill.
 * POST /api/pharmacist/bills/{billId}/discount/
 * Flat amount only (not a percentage) — re-validated server-side against
 * the bill's current subtotal.
 *
 * @param {number} billId - Bill ID
 * @param {number} discountAmount - Flat discount amount (>= 0)
 *
 * @returns {Promise<Object>} Updated bill with new discount_amount/total_amount
 */
export const setBillDiscount = (billId, discountAmount) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  console.log(`[API] Setting discount on bill ${billId} to ${discountAmount}`);

  return API.post(`/pharmacist/bills/${billId}/discount/`, { discount_amount: discountAmount })
    .then((response) => {
      console.log(`[API] ✅ Discount applied to bill ${billId}`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to apply discount"));
};

/**
 * Cancel a bill
 *
 * @param {number} billId - Bill ID
 * @param {string} reason - Cancellation reason
 *
 * @returns {Promise<Object>} Cancelled bill
 */
export const cancelBill = (billId, reason = "No reason provided") => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  console.log(`[API] Cancelling bill ${billId}`);

  return API.post(`/pharmacist/bills/${billId}/cancel/`, { reason })
    .then((response) => {
      console.log(`[API] ✅ Bill ${billId} cancelled`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to cancel bill"));
};

/**
 * Reopen a cancelled bill
 *
 * @param {number} billId - Bill ID
 *
 * @returns {Promise<Object>} Reopened bill with status=DRAFT
 */
export const reopenBill = (billId) => {
  if (!billId) {
    return Promise.reject(new Error("Bill ID is required"));
  }

  console.log(`[API] Reopening bill ${billId}`);

  return API.post(`/pharmacist/bills/${billId}/reopen/`)
    .then((response) => {
      console.log(`[API] ✅ Bill ${billId} reopened`);
      return response.data;
    })
    .catch((e) => err(e, "Failed to reopen bill"));
};

// ═════════════════════════════════════════════════════════════════════
// MEDICINE MANAGEMENT FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get list of all medicines
 *
 * @param {Object} filters - Optional filters
 * @param {string} filters.search - Search by name or strength
 *
 * @returns {Promise<Array>} List of medicines
 */
export const getMedicines = (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.append("search", filters.search);
  }
  
  // ✅ ADD support for show_inactive filter
  if (filters.show_inactive !== undefined) {
    params.append("show_inactive", filters.show_inactive);
  }
  
  // ✅ ADD support for category filter
  if (filters.category) {
    params.append("category", filters.category);
  }
  
  // ✅ ADD support for in_stock filter
  if (filters.in_stock !== undefined) {
    params.append("in_stock", filters.in_stock);
  }

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/medicines/?${queryString}` : "/pharmacist/medicines/";

  return API.get(url)
    .then((res) => {
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(res.data)) {
        return res.data;  // Direct array from backend
      }
      return res.data.medicines || [];  // Wrapped response
    })
    .catch((e) => {
      console.error("[API] Failed to fetch medicines:", e);
      err(e, "Failed to fetch medicines");
      return [];
    });
};

/**
 * Create new medicine
 *
 * @param {Object} medicineData - Medicine data
 * @param {string} medicineData.name - Medicine name
 * @param {string} medicineData.strength - Strength (e.g., "500mg")
 * @param {string} medicineData.category - Category
 *
 * @returns {Promise<Object>} Created medicine
 */
export const createMedicine = (medicineData) => {
  if (!medicineData || !medicineData.name) {
    return Promise.reject(new Error("Medicine name is required"));
  }

  return API.post("/pharmacist/medicines/create/", medicineData)
    .then((res) => res.data.medicine || res.data)
    .catch((e) => err(e, "Failed to create medicine"));
};

/**
 * Update medicine
 *
 * @param {number} medicineId - Medicine ID
 * @param {Object} updateData - Update data
 *
 * @returns {Promise<Object>} Updated medicine
 */
export const updateMedicine = (medicineId, updateData) => {
  if (!medicineId) {
    return Promise.reject(new Error("Medicine ID is required"));
  }

  return API.patch(`/pharmacist/medicines/${medicineId}/update/`, updateData)
    .then((res) => res.data.medicine || res.data)
    .catch((e) => err(e, "Failed to update medicine"));
};

// ═════════════════════════════════════════════════════════════════════
// BATCH MANAGEMENT FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get list of medicine batches
 *
 * @param {Object} filters - Optional filters
 * @param {string} filters.search - Search by batch number or medicine name
 *
 * @returns {Promise<Array>} List of batches
 */
export const getBatches = (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.append("search", filters.search);
  }

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/batches/?${queryString}` : "/pharmacist/batches/";

  return API.get(url)
    .then((res) => {
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(res.data)) {
        return res.data;  // Direct array from backend
      }
      return res.data.batches || [];  // Wrapped response
    })
    .catch((e) => {
      console.error("[API] Failed to fetch batches:", e);
      err(e, "Failed to fetch batches");
      return [];
    });
};

/**
 * Get batch detail
 *
 * @param {number} batchId - Batch ID
 *
 * @returns {Promise<Object>} Batch details
 */
export const getBatchDetail = (batchId) => {
  if (!batchId) {
    return Promise.reject(new Error("Batch ID is required"));
  }

  return API.get(`/pharmacist/batches/${batchId}/`)
    .then((res) => res.data.batch || res.data)
    .catch((e) => err(e, "Failed to fetch batch details"));
};

/**
 * Get batch (alias for getBatchDetail)
 * Used for backward compatibility
 * 
 * @param {number} batchId - Batch ID
 * @returns {Promise<Object>} Batch details
 */
export const getBatch = (batchId) => getBatchDetail(batchId);

/**
 * Create new batch (stock-in)
 *
 * @param {Object} batchData - Batch data
 * @param {number} batchData.medicine_id - Medicine ID
 * @param {string} batchData.batch_number - Batch number
 * @param {number} batchData.quantity - Quantity
 * @param {number} batchData.mrp - MRP
 * @param {number} batchData.cost_price - Cost price
 * @param {string} batchData.expiry_date - Expiry date
 * @param {string} batchData.manufacturer - Manufacturer
 *
 * @returns {Promise<Object>} Created batch
 */
export const createBatch = (batchData) => {
  if (!batchData || !batchData.medicine_id || !batchData.batch_number) {
    return Promise.reject(
      new Error("Medicine ID and batch number are required")
    );
  }

  return API.post("/pharmacist/batches/create/", batchData)
    .then((res) => res.data.batch || res.data)
    .catch((e) => err(e, "Failed to create batch"));
};

/**
 * Update batch
 *
 * @param {number} batchId - Batch ID
 * @param {Object} updateData - Update data
 *
 * @returns {Promise<Object>} Updated batch
 */
export const updateBatch = (batchId, updateData) => {
  if (!batchId) {
    return Promise.reject(new Error("Batch ID is required"));
  }

  return API.patch(`/pharmacist/batches/${batchId}/update/`, updateData)
    .then((res) => res.data.batch || res.data)
    .catch((e) => err(e, "Failed to update batch"));
};

// ═════════════════════════════════════════════════════════════════════
// DEALERS (read-only from the pharmacist side — the Dealers page itself
// lives in the manager module; pharmacists just need the list to link a
// batch/return to a dealer). OPTIONAL feature: safe to ignore entirely.
// ═════════════════════════════════════════════════════════════════════

/**
 * Get active dealers (for the dealer picker on Add Batch / Return modals).
 *
 * @returns {Promise<Array>} List of dealers, each with a live `balance`
 *   (positive = we owe them, negative = they owe us).
 */
export const getDealers = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.deals_in) params.append("deals_in", filters.deals_in);
  const qs = params.toString();
  return API.get(qs ? `/manager/dealers/?${qs}` : "/manager/dealers/")
    .then((res) => (Array.isArray(res.data) ? res.data : []))
    .catch((e) => {
      console.error("[API] Failed to fetch dealers:", e);
      return [];
    });
};

// ═════════════════════════════════════════════════════════════════════
// STOCK MANAGEMENT FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get stock alerts (low stock, expiry)
 *
 * @returns {Promise<Array>} List of stock alerts
 */
export const getStockAlerts = () => {
  return API.get("/pharmacist/stock-alerts/")
    .then((res) => {
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(res.data)) {
        return res.data;  // Direct array from backend
      }
      return res.data.alerts || [];  // Wrapped response
    })
    .catch((e) => {
      console.error("[API] Failed to fetch stock alerts:", e);
      err(e, "Failed to fetch stock alerts");
      return [];
    });
};

/**
 * Resolve stock alert
 *
 * @param {number} alertId - Alert ID
 *
 * @returns {Promise<Object>} Resolved alert
 */
/**
 * Get stock transaction logs
 *
 * @returns {Promise<Array>} List of stock logs
 */
// ═════════════════════════════════════════════════════════════════════
// PATIENT SEARCH FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Search for patients
 *
 * @param {string} query - Search query (name, phone, or MRD ID)
 *
 * @returns {Promise<Array>} List of matching patients
 */
export const searchPatients = (query) => {
  if (!query || query.length < 2) {
    return Promise.resolve([]);
  }

  const params = new URLSearchParams({ q: query });

  return API.get(`/pharmacist/patients/search/?${params.toString()}`)
    .then((res) => {
      // Handle both wrapped and unwrapped responses
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return res.data.patients || [];
    })
    .catch((e) => {
      console.error("[API] Failed to search patients:", e);
      err(e, "Failed to search patients");
      return [];
    });
};

// ═════════════════════════════════════════════════════════════════════
// ALERTS & CONSULTATIONS FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Fetch alerts (stock alerts, low inventory, etc.)
 * 
 * @param {Object} filters - Filter options
 * @param {boolean} filters.resolved - Filter by resolution status (optional)
 * 
 * @returns {Promise<Object>} Alerts data with results array
 */
export const getAlerts = (filters = {}) => {
  return API.get("/pharmacist/stock-alerts/", { params: filters })
    .then((res) => {
      // Handle both array and object response formats
      const alerts = Array.isArray(res.data) ? res.data : (res.data?.alerts || res.data?.results || []);
      return { results: alerts };
    })
    .catch((e) => {
      err(e, "Failed to fetch alerts");
      return { results: [] };
    });
};

/**
 * Fetch consultations with their prescriptions (pharmacy queue)
 *
 * ✅ FIX: previously called GET /doctor/consultations/ directly, which
 * always returned an empty list for a pharmacist (that endpoint only
 * returns data for 'doctor'/'admin' roles), then tried to fetch each
 * consultation's prescriptions from a URL
 * (/doctor/consultations/{id}/prescriptions/) that was never registered
 * on the backend and always 404'd. Now calls the dedicated pharmacist
 * endpoint in a single request.
 *
 * @param {Object} filters - Filter options
 * @param {string} filters.date - Filter by consultation date (YYYY-MM-DD)
 * @param {string} filters.search - Free text search (patient/MRD/OP/doctor)
 *
 * @returns {Promise<Array>} Array of consultations with prescriptions
 */
export const getConsultationsWithRx = (filters = {}) => {
  const params = {};
  if (filters.date) params.date = filters.date;
  if (filters.search) params.search = filters.search;

  return API.get("/pharmacist/prescriptions/", { params })
    .then((res) => (Array.isArray(res.data) ? res.data : (res.data?.results || [])))
    .catch((e) => {
      console.error("[API] Failed to fetch consultations with prescriptions:", e);
      err(e, "Failed to fetch consultations with prescriptions");
      return [];
    });
};

/**
 * Fetch prescription items/medicines
 * 
 * @param {number} prescriptionId - Prescription ID
 * 
 * @returns {Promise<Array>} List of prescription items
 */
export const getPrescriptionItems = (prescriptionId) => {
  if (!prescriptionId) {
    return Promise.reject(new Error("Prescription ID is required"));
  }
  
  return API.get(`/pharmacist/prescriptions/${prescriptionId}/medicines/`)
    .then((res) => {
      return Array.isArray(res.data)
        ? res.data
        : (res.data?.results || res.data?.items || res.data?.medicines || res.data?.data || []);
    })
    .catch((e) => {
      console.error(`[API] Failed to fetch prescription items for prescription ${prescriptionId}:`, e);
      err(e, `Failed to fetch prescription items for prescription ${prescriptionId}`);
      return [];
    });
};

// ═════════════════════════════════════════════════════════════════════
// DASHBOARD FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get pharmacy dashboard summary
 *
 * @returns {Promise<Object>} Dashboard data with stats
 */
export const getDashboardSummary = () => {
  return API.get("/pharmacist/dashboard/")
    .then((res) => {
      // Handle both direct object and wrapped response
      if (res.data.total_bills !== undefined) {
        return res.data;  // Already unwrapped
      }
      return res.data.dashboard || res.data;  // Might be wrapped
    })
    .catch((e) => {
      console.error("[API] Failed to fetch dashboard summary:", e);
      err(e, "Failed to fetch dashboard summary");
      // Return default dashboard data
      return {
        total_bills: 0,
        draft_bills: 0,
        open_bills: 0,
        completed_bills: 0,
        paid_bills: 0,
        cancelled_bills: 0
      };
    });
};

// ═════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * Extract bill data from API response
 * Handles both wrapped and unwrapped responses
 *
 * @param {Object} response - API response
 *
 * @returns {Object} Bill data
 */
/**
 * Format bill status for UI display
 *
 * @param {string} status - Bill status
 *
 * @returns {Object} Formatted status with label and color
 */
/**
 * Validate bill readiness for completion
 *
 * @param {Object} bill - Bill data
 * @param {Array} medicines - Medicine items
 * @param {Array} procedures - Procedure items
 *
 * @returns {Object} Validation result
 */
/**
 * Complete bill workflow - orchestrate entire process
 *
 * @param {Object} params - Parameters
 * @param {number} params.billId - Bill ID
 * @param {Array} params.medicines - Medicine items
 * @param {Array} params.procedures - Procedure items
 * @param {Function} params.onProgress - Progress callback
 * @param {Function} params.onError - Error callback
 *
 * @returns {Promise<Object>} Completed bill
 */
/**
 * Categorize error for better handling
 *
 * @param {Error} error - Error object
 *
 * @returns {Object} Categorized error with type and message
 */
/**
 * Retry API call with exponential backoff
 *
 * @param {Function} apiCall - API call function
 * @param {number} maxRetries - Maximum retries (default: 3)
 * @param {number} delayMs - Initial delay in ms (default: 1000)
 *
 * @returns {Promise} API call result
 */
// ═════════════════════════════════════════════════════════════════════
// GENERAL ITEMS (non-medicine retail: diapers, tissues, soap, etc.)
// Same call/response shape as the Medicine functions above.
// ═════════════════════════════════════════════════════════════════════

export const getGeneralItems = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.show_inactive !== undefined) params.append("show_inactive", filters.show_inactive);
  if (filters.category) params.append("category", filters.category);
  if (filters.in_stock !== undefined) params.append("in_stock", filters.in_stock);

  const qs = params.toString();
  const url = qs ? `/pharmacist/general-items/?${qs}` : "/pharmacist/general-items/";

  return API.get(url)
    .then((res) => (Array.isArray(res.data) ? res.data : (res.data?.results ?? [])))
    .catch((e) => { err(e, "Failed to fetch general items"); return []; });
};

export const createGeneralItem = (itemData) => {
  if (!itemData?.name) return Promise.reject(new Error("Item name is required"));
  return API.post("/pharmacist/general-items/create/", itemData)
    .then((res) => res.data.item || res.data)
    .catch((e) => err(e, "Failed to create item"));
};

export const updateGeneralItem = (itemId, updateData) => {
  if (!itemId) return Promise.reject(new Error("Item ID is required"));
  return API.patch(`/pharmacist/general-items/${itemId}/update/`, updateData)
    .then((res) => res.data.item || res.data)
    .catch((e) => err(e, "Failed to update item"));
};

export const searchGeneralItems = (q = "", limit = 12) => {
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  params.append("limit", limit);
  return API.get(`/pharmacist/general-items/search/?${params.toString()}`)
    .then((res) => res.data?.results ?? [])
    .catch((e) => { err(e, "Failed to search items"); return []; });
};

export const getGeneralItemBatches = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.general_item_id) params.append("general_item_id", filters.general_item_id);
  if (filters.status) params.append("status", filters.status);
  const qs = params.toString();
  const url = qs ? `/pharmacist/general-item-batches/?${qs}` : "/pharmacist/general-item-batches/";
  return API.get(url)
    .then((res) => (Array.isArray(res.data) ? res.data : (res.data?.results ?? [])))
    .catch((e) => { err(e, "Failed to fetch batches"); return []; });
};

export const createGeneralItemBatch = (batchData) => {
  if (!batchData?.general_item_id || !batchData?.batch_number) {
    return Promise.reject(new Error("Item and batch number are required"));
  }
  return API.post("/pharmacist/general-item-batches/create/", batchData)
    .then((res) => res.data.batch || res.data)
    .catch((e) => err(e, "Failed to create batch"));
};

// Bill integration — add/remove a general item on a pharmacy bill,
// same pattern as addMedicine/removeMedicineItem above.
export const addGeneralItem = (billId, itemData) => {
  if (!billId) return Promise.reject(new Error("Bill ID is required"));
  return API.post(`/pharmacist/bills/${billId}/add-general-item/`, itemData)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to add item to bill"));
};

export const removeGeneralItem = (billId, itemId) => {
  if (!billId || !itemId) return Promise.reject(new Error("Bill ID and item ID are required"));
  return API.delete(`/pharmacist/bills/${billId}/general-items/${itemId}/`)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to remove item from bill"));
};

export const updateGeneralItemBillItem = (billId, itemId, updateData) => {
  if (!billId || !itemId) return Promise.reject(new Error("Bill ID and item ID are required"));
  return API.patch(`/pharmacist/bills/${billId}/general-items/${itemId}/`, updateData)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to update item quantity"));
};

/**
 * Return (part of) a general item batch to the dealer/provider.
 * @param {number} batchId
 * @param {Object} data - quantity_returned, reason, reason_details, reference_number, dealer_id, settlement_method
 * @returns {Promise<Object>} { message, return, total_stock }
 */
export const returnGeneralItemToProvider = (batchId, data) => {
  if (!batchId) return Promise.reject(new Error("Batch ID is required"));
  return API.post(`/pharmacist/general-item-batches/${batchId}/return/`, data)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to return stock to provider"));
};