// src/modules/labTechnician/pages/LabRequestsPage.jsx
import { useEffect, useState, useCallback } from "react";
import {
  getLabRequests,
  getLabRequestDetail,
  updateLabRequestStatus,
  getLabResultsByRequest,
  getLabReport,
  updateLabReport,
  createLabResult,
  updateLabResult,
  getLabBillByRequest,
  generateLabBill,
  payLabBill,
  updateLabBill,
  claimLabRequest,
} from "../api/labApi";
import { isValidISODate, toISODate } from "../utils/dateUtils";

const AMBER = "#F59E0B";

const STATUS_COLORS = {
  REQUESTED:        { bg: "#FEF3C7", color: "#D97706" },
  SAMPLE_COLLECTED: { bg: "#DBEAFE", color: "#2563EB" },
  PROCESSING:       { bg: "#EDE9FE", color: "#7C3AED" },
  COMPLETED:        { bg: "#D1FAE5", color: "#059669" },
  VERIFIED:         { bg: "#DCFCE7", color: "#15803D" },
  DELIVERED:        { bg: "#F0FDF4", color: "#16A34A" },
};

const NEXT_STATUS = {
  REQUESTED:        "SAMPLE_COLLECTED",
  SAMPLE_COLLECTED: "PROCESSING",
  PROCESSING:       "COMPLETED",
  COMPLETED:        "VERIFIED",
  VERIFIED:         "DELIVERED",
};

const STATUS_BTN_LABELS = {
  REQUESTED:        "Mark Sample Collected",
  SAMPLE_COLLECTED: "Start Processing",
  PROCESSING:       "Mark Completed",
  COMPLETED:        "Verify Report",
  VERIFIED:         "Mark Delivered",
};

const BILL_STATUS_COLORS = {
  PENDING: { bg: "#FEF3C7", color: "#D97706" },
  PAID:    { bg: "#D1FAE5", color: "#059669" },
};

// Results can only be entered once the sample is actually being processed
// (or after, for corrections while still COMPLETED). Entering a result at
// SAMPLE_COLLECTED would mean reporting a value before testing has even
// started, so that stage is intentionally excluded. Once a report has been
// verified or delivered, results are locked to preserve the integrity of
// what was reported to the patient.
const RESULT_ENTRY_STATUSES = ["PROCESSING", "COMPLETED"];

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {status?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}

// Parses a "70-100" / "70 - 100" / "70 to 100" style normal range string
// into { min, max } numbers. Returns null for ranges that aren't a plain
// numeric band (e.g. "Negative", "<5", free text) since those can't be
// auto-compared against a result value.
function parseNormalRange(range) {
  if (!range) return null;
  const match = String(range).match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
}

/* ─── Enter / Edit Result Modal ────────────────── */
function EnterResultModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.result;

  const [form, setForm] = useState({
    result_value: item?.result?.result_value ?? "",
    normal_range: item?.result?.normal_range ?? item?.test_normal_range ?? "",
    is_abnormal:  item?.result?.is_abnormal  ?? false,
    remarks:      item?.result?.remarks      ?? "",
  });
  const [autoFlagged, setAutoFlagged] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState(null);

  if (!item) return null;

  // Plain field updates. Changing the result value also auto-checks/
  // unchecks "Abnormal" whenever the value is a plain number and the
  // normal range is a comparable "min-max" band — the technician can
  // still override the checkbox by hand afterwards.
  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "result_value") {
        const range = parseNormalRange(f.normal_range);
        const num = parseFloat(v);
        if (range && v.trim() !== "" && !isNaN(num)) {
          next.is_abnormal = num < range.min || num > range.max;
          setAutoFlagged(true);
        } else {
          setAutoFlagged(false);
        }
      }
      return next;
    });
  };

  const validate = () => {
    const errs = {};
    if (!form.result_value.trim()) {
      errs.result_value = "Result value is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setToast(null);
    try {
      if (isEdit) {
        await updateLabResult(item.result.result_id, {
          result_value: form.result_value.trim(),
          normal_range: form.normal_range.trim() || null,
          is_abnormal:  form.is_abnormal,
          remarks:      form.remarks.trim() || null,
        });
      } else {
        await createLabResult({
          lab_request_item: item.item_id,
          result_value:     form.result_value.trim(),
          normal_range:     form.normal_range.trim() || null,
          is_abnormal:      form.is_abnormal,
          remarks:          form.remarks.trim() || null,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setToast({
        msg: "Error saving result: " + (err.response?.data?.detail || err.message),
        err: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "16px" }}>
          {isEdit ? "Edit Result" : "Enter Result"} — {item.test_name || "Test"}
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Result Value <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={form.result_value}
            onChange={(e) => set("result_value", e.target.value)}
            placeholder="e.g., 120, Positive, Normal"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: `1.5px solid ${errors.result_value ? "#DC2626" : "#E8EDF4"}`,
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          {errors.result_value && (
            <p style={{ color: "#DC2626", fontSize: "12px", margin: "6px 0 0" }}>
              {errors.result_value}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
              Normal Range <span style={{ fontWeight: 400, color: "#94A3B8" }}>(reference)</span>
            </label>
            <div
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1.5px solid #E8EDF4",
                background: "#F8FAFC",
                fontSize: "13px",
                color: form.normal_range ? "#475569" : "#94A3B8",
                boxSizing: "border-box",
              }}
            >
              {form.normal_range || "Not defined for this test"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={form.is_abnormal}
              onChange={(e) => { setAutoFlagged(false); set("is_abnormal", e.target.checked); }}
              id="abnormal"
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="abnormal" style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", cursor: "pointer", margin: 0 }}>
              Abnormal
            </label>
            {autoFlagged && form.is_abnormal && (
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#DC2626", background: "#FEF2F2", padding: "2px 6px", borderRadius: "10px" }}>
                Auto — out of range
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Remarks / Notes
          </label>
          <textarea
            value={form.remarks}
            onChange={(e) => set("remarks", e.target.value)}
            placeholder="Any additional notes..."
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {toast && (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: toast.err ? "#FEE2E2" : "#D1FAE5",
              color: toast.err ? "#DC2626" : "#059669",
              fontSize: "13px",
            }}
          >
            {toast.msg}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              background: "#F8FAFC",
              color: "#64748B",
              border: "1px solid #E8EDF4",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              background: AMBER,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Result"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Bill Section (generate / pay before sample collection) ────────────────── */
function BillSection({ bill, requestId, onChanged }) {
  const [generating, setGenerating] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ payment_method: "CASH", paid_amount: "", notes: "" });
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Flat discount — applied via PATCH /api/lab/bills/{id}/, same as the
  // discount UI in LabBillsPage.jsx. This section is the other place a
  // lab bill can be paid from (directly off the request), so it needs
  // the same field.
  const [discountInput, setDiscountInput] = useState(String(bill?.discount ?? "0"));
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState(null);

  const isLocked = bill?.payment_status === "PAID";
  const subtotal = parseFloat(bill?.subtotal ?? 0);
  const discount = parseFloat(bill?.discount ?? 0);

  const handleApplyDiscount = async () => {
    const val = parseFloat(discountInput || 0);
    if (isNaN(val) || val < 0) {
      setDiscountError("Discount amount cannot be negative.");
      return;
    }
    if (val > subtotal) {
      setDiscountError("Discount amount cannot exceed the bill subtotal.");
      return;
    }
    setDiscountSaving(true);
    setDiscountError(null);
    try {
      await updateLabBill(bill.bill_id, { discount: val });
      onChanged?.();
    } catch (err) {
      setDiscountError(err.message || "Failed to apply discount");
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      await generateLabBill(requestId);
      onChanged?.();
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.detail || err.message);
    } finally {
      setGenerating(false);
    }
  };

  const openPayForm = () => {
    setPayForm({
      payment_method: "CASH",
      paid_amount: bill?.total_amount ?? "",
      notes: "",
    });
    setActionError(null);
    setShowPayForm(true);
  };

  const handlePay = async () => {
    if (!bill) return;
    setPaying(true);
    setActionError(null);
    try {
      await payLabBill(bill.bill_id, {
        payment_method: payForm.payment_method,
        paid_amount: payForm.paid_amount,
        notes: payForm.notes.trim() || undefined,
      });
      setShowPayForm(false);
      onChanged?.();
    } catch (err) {
      setActionError(
        err.response?.data?.paid_amount?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message
      );
    } finally {
      setPaying(false);
    }
  };

  const statusCfg = bill ? (BILL_STATUS_COLORS[bill.payment_status] ?? { bg: "#F1F5F9", color: "#64748B" }) : null;

  return (
    <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #EEF2F7" }}>
      <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginBottom: "10px" }}>
        Bill &amp; Payment
      </h4>

      {!bill ? (
        <div
          style={{
            padding: "14px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontSize: "13px", color: "#92400E", margin: "0 0 10px" }}>
            No bill has been generated for this request yet. A bill must be generated and
            paid before the sample can be collected.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "8px 16px",
              background: AMBER,
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: generating ? "not-allowed" : "pointer",
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? "Generating..." : "Generate Bill"}
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: "14px",
            background: "#F8FAFC",
            border: "1px solid #EEF2F7",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#64748B" }}>Bill {bill.bill_number || `#${bill.bill_id}`}</span>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                background: statusCfg.bg,
                color: statusCfg.color,
              }}
            >
              {bill.payment_status}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "#1E293B", margin: "0 0 4px" }}>
            <strong>Subtotal:</strong> ₹{subtotal.toFixed(2)}
          </p>
          {discount > 0 && (
            <p style={{ fontSize: "13px", color: "#DC2626", margin: "0 0 4px" }}>
              <strong>Discount:</strong> − ₹{discount.toFixed(2)}
            </p>
          )}
          <p style={{ fontSize: "13px", color: "#1E293B", margin: "0 0 4px" }}>
            <strong>Total:</strong> {bill.total_amount}
          </p>
          <p style={{ fontSize: "13px", color: "#1E293B", margin: "0 0 4px" }}>
            <strong>Paid:</strong> {bill.paid_amount}
          </p>

          <div style={{ marginTop: "10px", marginBottom: "4px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
              Discount (₹)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isLocked}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1.5px solid #E8EDF4",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  background: isLocked ? "#F1F5F9" : "#fff",
                }}
              />
              <button
                onClick={handleApplyDiscount}
                disabled={isLocked || discountSaving}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: isLocked || discountSaving ? "#D1D5DB" : AMBER,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: isLocked || discountSaving ? "not-allowed" : "pointer",
                }}
              >
                {discountSaving ? "…" : "Apply"}
              </button>
            </div>
            {isLocked && (
              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                Discount can't be changed on a {bill.payment_status.toLowerCase()} bill.
              </p>
            )}
            {discountError && (
              <p style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px" }}>{discountError}</p>
            )}
          </div>

          {bill.payment_status !== "PAID" && !showPayForm && (
            <button
              onClick={openPayForm}
              style={{
                marginTop: "8px",
                padding: "8px 16px",
                background: AMBER,
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pay Bill
            </button>
          )}

          {bill.payment_status !== "PAID" && showPayForm && (
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #E8EDF4" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                    Payment Method
                  </label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1.5px solid #E8EDF4",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="INSURANCE">Insurance</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                    Paid Amount
                  </label>
                  <input
                    type="number"
                    value={payForm.paid_amount}
                    onChange={(e) => setPayForm((f) => ({ ...f, paid_amount: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1.5px solid #E8EDF4",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowPayForm(false)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "#fff",
                    color: "#64748B",
                    border: "1px solid #E8EDF4",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: AMBER,
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: paying ? "not-allowed" : "pointer",
                    opacity: paying ? 0.6 : 1,
                  }}
                >
                  {paying ? "Confirming..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div
          style={{
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "#FEE2E2",
            color: "#DC2626",
            fontSize: "13px",
          }}
        >
          {actionError}
        </div>
      )}
    </div>
  );
}

/* ─── Request Detail Modal (view + result entry + status workflow) ────────────────── */
function RequestDetailModal({ requestId, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [results, setResults] = useState(null);
  const [report, setReport] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportNotes, setReportNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [resultItem, setResultItem] = useState(null); // item currently being edited
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [notesMessage, setNotesMessage] = useState(null); // { ok: bool, msg: string }

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [detailData, resultsData] = await Promise.all([
        getLabRequestDetail(requestId),
        getLabResultsByRequest(requestId),
      ]);
      setDetail(detailData);
      setResults(resultsData?.items || []);

      if (detailData.status === "REQUESTED") {
        try {
          const billData = await getLabBillByRequest(requestId);
          setBill(billData);
        } catch (err) {
          setBill(null); // No bill generated yet
        }
      }

      if (["COMPLETED", "VERIFIED", "DELIVERED"].includes(detailData.status)) {
        try {
          const reportData = await getLabReport(requestId);
          setReport(reportData);
          setReportNotes(reportData.report_notes || "");
        } catch (err) {
          // Report might not exist yet
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to load request details");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const allResultsEntered = (results || []).length > 0 && (results || []).every((it) => !!it.result);
  // A claimed request is read-only for everyone except the claimant (or admin/manager,
  // which the backend already reflects via can_act).
  const isLocked = !!detail?.is_claimed && !detail?.can_act;
  const canEnterResults = RESULT_ENTRY_STATUSES.includes(detail?.status) && !isLocked;
  const billPaid = bill?.payment_status === "PAID";

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await claimLabRequest(requestId);
      onUpdated?.();
      fetchDetails();
    } catch (err) {
      setClaimError(err.response?.data?.error || err.response?.data?.detail || err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!detail || updatingStatus) return;
    const nextStatus = NEXT_STATUS[detail.status];
    if (!nextStatus) return;

    if (isLocked) {
      setStatusError(`This request has been claimed by ${detail.claimed_by_name}. Only they (or an admin/manager) can update its status.`);
      return;
    }

    // Frontend guardrail: a request cannot move to SAMPLE_COLLECTED until
    // its bill has been generated and paid in full.
    if (nextStatus === "SAMPLE_COLLECTED" && !billPaid) {
      setStatusError(
        "The lab bill must be generated and paid before the sample can be marked as collected."
      );
      return;
    }

    // Frontend guardrail: a request cannot be marked COMPLETED until every
    // test item on it has a result entered. The backend enforces this too,
    // but we check here first so the technician gets immediate feedback.
    if (nextStatus === "COMPLETED" && !allResultsEntered) {
      setStatusError(
        "All test results must be entered before this request can be marked as completed."
      );
      return;
    }

    setStatusError(null);
    setUpdatingStatus(true);
    try {
      await updateLabRequestStatus(requestId, { status: nextStatus });
      setDetail((prev) => ({ ...prev, status: nextStatus }));
      onUpdated?.();
      fetchDetails();
    } catch (err) {
      setStatusError(err.response?.data?.error || err.response?.data?.detail || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveReportNotes = async () => {
    if (!report) return;
    setNotesMessage(null);
    try {
      await updateLabReport(requestId, { report_notes: reportNotes });
      setReport((prev) => ({ ...prev, report_notes: reportNotes }));
      setNotesMessage({ ok: true, msg: "Notes saved successfully." });
    } catch (err) {
      setNotesMessage({ ok: false, msg: "Error: " + (err.response?.data?.detail || err.message) });
    } finally {
      setTimeout(() => setNotesMessage(null), 3200);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "40px",
            maxWidth: "600px",
            width: "90%",
            textAlign: "center",
          }}
        >
          Loading request details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "40px",
            maxWidth: "600px",
            width: "90%",
            textAlign: "center",
            color: "red",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        overflowY: "auto",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "700px",
          width: "100%",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
            Lab Request #{requestId}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            ✕
          </button>
        </div>

        {detail && (
          <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #EEF2F7" }}>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
              <strong>Status:</strong> <StatusBadge status={detail.status} />
            </p>

            {/* Claim workflow banner */}
            <div style={{ marginBottom: "8px" }}>
              {detail.is_claimed ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: detail.can_act ? "#DCFCE7" : "#F1F5F9",
                    color: detail.can_act ? "#15803D" : "#64748B",
                  }}
                >
                  Claimed by {detail.claimed_by_name}
                  {detail.can_act ? " (you)" : ""}
                </span>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    background: claiming ? "#D1D5DB" : AMBER,
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: claiming ? "not-allowed" : "pointer",
                  }}
                >
                  {claiming ? "Claiming…" : "Claim this request"}
                </button>
              )}
              {claimError && (
                <p style={{ fontSize: "12px", color: "#DC2626", margin: "6px 0 0" }}>{claimError}</p>
              )}
              {isLocked && (
                <p style={{ fontSize: "12px", color: "#94A3B8", margin: "6px 0 0" }}>
                  This request is read-only for you — only {detail.claimed_by_name} (or an admin/manager) can enter results or change its status.
                </p>
              )}
            </div>

            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
              <strong>Patient:</strong> {detail.patient_name || "N/A"}
            </p>
            <p style={{ fontSize: "13px", color: "#64748B" }}>
              <strong>Tests:</strong> {detail.items?.length ?? 0}
            </p>
          </div>
        )}

        {detail?.status === "REQUESTED" && (
          <BillSection bill={bill} requestId={requestId} onChanged={fetchDetails} />
        )}

        {results && results.length > 0 && (
          <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #EEF2F7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
                Test Results
              </h4>
              {canEnterResults && !allResultsEntered && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#D97706" }}>
                  {results.filter((it) => !it.result).length} pending
                </span>
              )}
              {!canEnterResults && detail?.status === "SAMPLE_COLLECTED" && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94A3B8" }}>
                  Locked until processing starts
                </span>
              )}
            </div>
            {!canEnterResults && detail?.status === "SAMPLE_COLLECTED" && (
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 10px" }}>
                Results can be entered once you start processing this request.
              </p>
            )}
            {results.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "10px 0",
                  borderBottom: idx < results.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B", margin: "0 0 4px" }}>
                    {item.test_name}
                  </p>
                  {item.result ? (
                    <>
                      <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                        Result: {item.result.result_value} {item.test_unit || ""}
                      </p>
                      {item.result.is_abnormal && (
                        <p style={{ color: "#DC2626", fontSize: "12px", margin: "4px 0 0" }}>⚠ Abnormal</p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>Pending result entry</p>
                  )}
                </div>
                {canEnterResults && (
                  <button
                    onClick={() => setResultItem(item)}
                    style={{
                      padding: "6px 12px",
                      background: "none",
                      border: "1px solid #E8EDF4",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: AMBER,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.result ? "Edit" : "Enter Result"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {report && (
          <div style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid #EEF2F7" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginBottom: "10px" }}>
              Report Notes
            </h4>
            <textarea
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #E8EDF4",
                fontSize: "13px",
                fontFamily: "inherit",
                boxSizing: "border-box",
                marginBottom: "10px",
              }}
              placeholder="Add clinical notes or findings..."
            />
            <button
              onClick={handleSaveReportNotes}
              style={{
                padding: "8px 16px",
                background: AMBER,
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Notes
            </button>
            {notesMessage && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  background: notesMessage.ok ? "#D1FAE5" : "#FEE2E2",
                  color:      notesMessage.ok ? "#059669" : "#DC2626",
                }}
              >
                {notesMessage.msg}
              </div>
            )}
          </div>
        )}

        {statusError && (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#FEE2E2",
              color: "#DC2626",
              fontSize: "13px",
            }}
          >
            {statusError}
          </div>
        )}

        {detail && NEXT_STATUS[detail.status] && (() => {
          const next = NEXT_STATUS[detail.status];
          const blockedByBill = next === "SAMPLE_COLLECTED" && !billPaid;
          const blockedByResults = next === "COMPLETED" && !allResultsEntered;
          const blockedByClaim = isLocked;
          const blocked = blockedByBill || blockedByResults || blockedByClaim;
          const blockedReason = blockedByClaim
            ? `Claimed by ${detail.claimed_by_name} — only they (or an admin/manager) can act`
            : blockedByBill
              ? "Generate and pay the lab bill before marking the sample as collected"
              : blockedByResults
                ? "Enter all test results before marking as completed"
                : undefined;

          return (
            <>
              <button
                onClick={handleStatusUpdate}
                disabled={updatingStatus || blocked}
                title={blockedReason}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: AMBER,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: updatingStatus || blocked ? "not-allowed" : "pointer",
                  opacity: updatingStatus || blocked ? 0.5 : 1,
                }}
              >
                {updatingStatus ? "Updating..." : STATUS_BTN_LABELS[detail.status]}
              </button>
              {blockedByBill && (
                <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", marginTop: "8px" }}>
                  Pay the bill above to unlock this action.
                </p>
              )}
              {blockedByResults && (
                <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", marginTop: "8px" }}>
                  Enter results for every test above to unlock this action.
                </p>
              )}
            </>
          );
        })()}
      </div>

      {resultItem && (
        <EnterResultModal
          item={resultItem}
          onClose={() => setResultItem(null)}
          onSaved={fetchDetails}
        />
      )}
    </div>
  );
}

function ClaimCell({ req, onClaimed }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);

  if (req.is_claimed) {
    return (
      <span
        style={{
          display: "inline-flex",
          padding: "3px 9px",
          borderRadius: "999px",
          fontSize: "11px",
          fontWeight: 600,
          background: req.can_act ? "#DCFCE7" : "#F1F5F9",
          color: req.can_act ? "#15803D" : "#64748B",
          whiteSpace: "nowrap",
        }}
      >
        {req.claimed_by_name}{req.can_act ? " (you)" : ""}
      </span>
    );
  }

  const handleClaim = async (e) => {
    e.stopPropagation();
    if (claiming) return;
    setClaiming(true);
    setError(null);
    try {
      await claimLabRequest(req.request_id);
      onClaimed?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleClaim}
        disabled={claiming}
        style={{
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid #FDE68A",
          background: claiming ? "#F1F5F9" : "#FFFBEB",
          color: claiming ? "#94A3B8" : "#D97706",
          fontSize: "11px",
          fontWeight: 700,
          cursor: claiming ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {claiming ? "Claiming…" : "Claim"}
      </button>
      {error && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            background: "#FEE2E2",
            color: "#DC2626",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "11px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {error}
        </div>
      )}
    </span>
  );
}

export default function LabRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  // Single date filter (request_date) — defaults to today so the work
  // queue opens showing today's requests. No separate from/to range:
  // changing the date just moves which single day is shown.
  const todayISO = toISODate(new Date());
  const [date, setDate] = useState(todayISO);
  const hasDateFilter = isValidISODate(date);

  const resetToToday = () => {
    setDate(todayISO);
  };

  const fetchRequests = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (hasDateFilter) { params.start = date; params.end = date; }
      const data = await getLabRequests(params);
      setRequests(data.results || []);
    } catch (err) {
      if (!silent) setError(err.response?.data?.detail || err.message || "Failed to load requests");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterStatus, hasDateFilter, date]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Poll in the background so lab staff see claim status (and new/updated
  // requests) update across the team without needing a manual refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequests({ silent: true });
    }, 18000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const statuses = ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "COMPLETED", "VERIFIED", "DELIVERED"];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
          Lab Requests
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B" }}>
          Track requests, enter test results, and move each request through its workflow
        </p>
      </div>

      <div style={{ marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilterStatus("")}
          style={{
            padding: "8px 16px",
            background: filterStatus === "" ? AMBER : "#F8FAFC",
            color: filterStatus === "" ? "#fff" : "#64748B",
            border: "1px solid #EEF2F7",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: "8px 16px",
              background: filterStatus === status ? AMBER : "#F8FAFC",
              color: filterStatus === status ? "#fff" : "#64748B",
              border: "1px solid #EEF2F7",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }}
          />
        </div>
        {date !== todayISO && (
          <button
            onClick={resetToToday}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
          >
            ↺ Today
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>Loading...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "red" }}>{error}</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
          No lab requests found
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #EEF2F7",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #EEF2F7" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Request ID
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Patient
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Tests
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Claimed By
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Date
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.request_id} style={{ borderBottom: "1px solid #EEF2F7" }}>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                      #{req.request_id}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                      {req.patient_name || "N/A"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                      {req.items?.length ?? 0}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={req.status} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <ClaimCell req={req} onClaimed={() => fetchRequests()} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#64748B" }}>
                      {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => setSelectedId(req.request_id)}
                        style={{
                          padding: "6px 12px",
                          background: "none",
                          border: "1px solid #E8EDF4",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: AMBER,
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <RequestDetailModal
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchRequests}
        />
      )}
    </div>
  );
}