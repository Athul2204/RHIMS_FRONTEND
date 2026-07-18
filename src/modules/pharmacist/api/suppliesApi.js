/**
 * FILE: src/modules/pharmacist/api/suppliesApi.js
 *
 * Supplies & Consumables stock system — hospital consumables that are NOT
 * dispensable medicines (syringes, gloves, IV sets, dressings, PPE, etc).
 * Lives inside the pharmacist module (same module, new "Supplies" page)
 * rather than as a separate module. Backend endpoints live at
 * /api/pharmacist/supplies/... in the existing `pharmacist` Django app.
 */

import API from "../../../api";

// ═════════════════════════════════════════════════════════════════════
// RESPONSE HANDLERS (same pattern as pharmacistApi.js)
// ═════════════════════════════════════════════════════════════════════

const err = (e, msg) => {
  const errorData = e.response?.data;

  if (errorData?.error) {
    const error = new Error(errorData.error);
    if (errorData.available_stock !== undefined) {
      error.available_stock = errorData.available_stock;
    }
    throw error;
  }
  if (errorData?.detail) {
    throw new Error(errorData.detail);
  }
  if (errorData?.message) {
    throw new Error(errorData.message);
  }

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
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════

/**
 * Get supplies dashboard summary (totals, low stock, alerts, categories,
 * recent usage, expiring soon).
 * @returns {Promise<Object>}
 */
export const getSuppliesDashboard = () => {
  return API.get("/pharmacist/supplies/dashboard/")
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to fetch supplies dashboard"));
};

// ═════════════════════════════════════════════════════════════════════
// SUPPLY ITEMS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get list of supply items.
 * @param {Object} filters - search, category, low_stock, is_active
 * @returns {Promise<Array>}
 */
export const getSupplyItems = (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category && filters.category !== "ALL") params.append("category", filters.category);
  if (filters.low_stock) params.append("low_stock", "true");
  if (filters.is_active !== undefined) params.append("is_active", filters.is_active);

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/supplies/items/?${queryString}` : "/pharmacist/supplies/items/";

  return API.get(url)
    .then((res) => (Array.isArray(res.data) ? res.data : res.data.items || []))
    .catch((e) => {
      err(e, "Failed to fetch supply items");
      return [];
    });
};

/**
 * Create a new supply item (catalogue entry).
 * @param {Object} data - name, category, unit, description, low_stock_threshold
 * @returns {Promise<Object>}
 */
export const createSupplyItem = (data) => {
  if (!data || !data.name) {
    return Promise.reject(new Error("Item name is required"));
  }
  return API.post("/pharmacist/supplies/items/create/", data)
    .then((res) => res.data.item || res.data)
    .catch((e) => err(e, "Failed to create supply item"));
};

/**
 * Get supply item detail with batches + recent usage.
 * @param {number} itemId
 * @returns {Promise<Object>}
 */
export const getSupplyItemDetail = (itemId) => {
  if (!itemId) return Promise.reject(new Error("Item ID is required"));
  return API.get(`/pharmacist/supplies/items/${itemId}/`)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to fetch supply item details"));
};

/**
 * Update a supply item (name, category, unit, description, threshold, is_active).
 * @param {number} itemId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const updateSupplyItem = (itemId, data) => {
  if (!itemId) return Promise.reject(new Error("Item ID is required"));
  return API.patch(`/pharmacist/supplies/items/${itemId}/update/`, data)
    .then((res) => res.data.item || res.data)
    .catch((e) => err(e, "Failed to update supply item"));
};

// ═════════════════════════════════════════════════════════════════════
// STOCK: ADD / USE / ADJUST
// ═════════════════════════════════════════════════════════════════════

/**
 * Add stock — create a new purchase batch for an item.
 * @param {number} itemId
 * @param {Object} data - batch_number (required), quantity, unit_cost, supplier_name,
 *                        supplier_contact, invoice_number, purchase_date, expiry_date, notes
 * @returns {Promise<Object>} { message, batch, total_stock }
 */
export const addStock = (itemId, data) => {
  if (!itemId) return Promise.reject(new Error("Item ID is required"));
  const { dealer_id, ...rest } = data;
  return API.post(`/pharmacist/supplies/items/${itemId}/add-stock/`, {
    ...rest,
    // OPTIONAL — links this purchase to a predefined manager.Dealer, same
    // as the medicine/general-item add-stock flows. Omit entirely when
    // blank so existing plain-entry behavior is unaffected.
    ...(dealer_id ? { dealer_id: parseInt(dealer_id) } : {}),
  })
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to add stock"));
};

/**
 * Deduct stock (issue to a department) — FIFO from oldest batch.
 * @param {number} itemId
 * @param {Object} data - quantity_used, department, notes
 * @returns {Promise<Object>} { message, log, total_stock, is_low_stock }
 */
export const useStock = (itemId, data) => {
  if (!itemId) return Promise.reject(new Error("Item ID is required"));
  return API.post(`/pharmacist/supplies/items/${itemId}/use/`, data)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to record stock usage"));
};

/**
 * Return (part of) a batch to the supplier/provider.
 * @param {number} batchId
 * @param {Object} data - quantity_returned, reason, reason_details, reference_number
 * @returns {Promise<Object>} { message, return, total_stock, is_low_stock }
 */
export const returnToProvider = (batchId, data) => {
  if (!batchId) return Promise.reject(new Error("Batch ID is required"));
  return API.post(`/pharmacist/supplies/batches/${batchId}/return/`, data)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to return stock to provider"));
};

/**
 * Get return-to-provider history.
 * @param {Object} filters - item_id, search, date_from, date_to, limit
 * @returns {Promise<{results: Array, total_count: number}>}
 */
export const getReturns = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.item_id) params.append("item_id", filters.item_id);
  if (filters.search) params.append("search", filters.search);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);
  if (filters.limit) params.append("limit", filters.limit);

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/supplies/returns/?${queryString}` : "/pharmacist/supplies/returns/";

  return API.get(url)
    .then((res) => {
      if (Array.isArray(res.data)) return { results: res.data, total_count: res.data.length };
      if (Array.isArray(res.data?.results)) return { results: res.data.results, total_count: res.data.total_count ?? res.data.results.length };
      return { results: [], total_count: 0 };
    })
    .catch((e) => {
      err(e, "Failed to fetch return history");
      return { results: [], total_count: 0 };
    });
};

/**
 * Get a single batch's detail.
 * @param {number} batchId
 * @returns {Promise<Object>}
 */
export const getSupplyBatchDetail = (batchId) => {
  if (!batchId) return Promise.reject(new Error("Batch ID is required"));
  return API.get(`/pharmacist/supplies/batches/${batchId}/`)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to fetch batch details"));
};

// ═════════════════════════════════════════════════════════════════════
// USAGE LOGS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get usage log history.
 * @param {Object} filters - item_id, department, category, search, date_from, date_to, limit
 * @returns {Promise<{results: Array, total_count: number}>}
 */
export const getUsageLogs = (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.item_id) params.append("item_id", filters.item_id);
  if (filters.department) params.append("department", filters.department);
  if (filters.category) params.append("category", filters.category);
  if (filters.search) params.append("search", filters.search);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);
  if (filters.limit) params.append("limit", filters.limit);

  const queryString = params.toString();
  const url = queryString ? `/pharmacist/supplies/usage-logs/?${queryString}` : "/pharmacist/supplies/usage-logs/";

  return API.get(url)
    .then((res) => {
      if (Array.isArray(res.data)) return { results: res.data, total_count: res.data.length };
      if (Array.isArray(res.data?.results)) return { results: res.data.results, total_count: res.data.total_count ?? res.data.results.length };
      if (Array.isArray(res.data?.logs)) return { results: res.data.logs, total_count: res.data.logs.length };
      return { results: [], total_count: 0 };
    })
    .catch((e) => {
      err(e, "Failed to fetch usage logs");
      return { results: [], total_count: 0 };
    });
};

// ═════════════════════════════════════════════════════════════════════
// STOCK ALERTS
// ═════════════════════════════════════════════════════════════════════

/**
 * Get supply stock alerts.
 * @param {Object} params - resolved (default false = only open alerts)
 * @returns {Promise<Array>}
 */
export const getAlerts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.resolved !== undefined) query.append("resolved", params.resolved);

  const queryString = query.toString();
  const url = queryString ? `/pharmacist/supplies/alerts/?${queryString}` : "/pharmacist/supplies/alerts/";

  return API.get(url)
    .then((res) => (Array.isArray(res.data) ? res.data : res.data.alerts || []))
    .catch((e) => {
      err(e, "Failed to fetch alerts");
      return [];
    });
};

/**
 * Resolve a supply stock alert.
 * @param {number} alertId
 * @returns {Promise<Object>}
 */
export const resolveAlert = (alertId) => {
  if (!alertId) return Promise.reject(new Error("Alert ID is required"));
  return API.post(`/pharmacist/supplies/alerts/${alertId}/resolve/`)
    .then((res) => res.data)
    .catch((e) => err(e, "Failed to resolve alert"));
};