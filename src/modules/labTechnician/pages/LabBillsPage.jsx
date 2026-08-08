// src/modules/labTechnician/pages/LabBillsPage.jsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getLabBills,
  payLabBill,
  updateLabBill,
} from "../api/labApi";
import { toISODate, isValidISODate, PRESET_RANGES } from "../utils/dateUtils";

const AMBER = "#F59E0B";

const PAYMENT_STATUS_CFG = {
  PENDING: { bg: "#FEF3C7", color: "#D97706", label: "Pending" },
  PAID:    { bg: "#D1FAE5", color: "#059669", label: "Paid"    },
};

const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "INSURANCE"];

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

function StatusBadge({ status }) {
  const cfg = PAYMENT_STATUS_CFG[status] ?? { bg: "#F1F5F9", color: "#64748B", label: status };
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
      {cfg.label}
    </span>
  );
}

/* ─── Bill Detail / Payment Modal ──────────────── */
function BillModal({ bill, onClose, onSaved }) {
  // FIX: Use bill_id from API response, fallback to id
  const billId = bill?.bill_id ?? bill?.id;
  
  if (!billId) {
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
            maxWidth: "500px",
            width: "100%",
            color: "red",
            textAlign: "center",
          }}
        >
          Error: Bill ID is missing
        </div>
      </div>
    );
  }

  const [paidAmount, setPaidAmount] = useState(bill.paid_amount ?? 0);
  const [paymentMethod, setPaymentMethod] = useState(
    PAYMENT_METHODS.includes(bill.payment_method) ? bill.payment_method : "CASH"
  );
  const [notes, setNotes] = useState(bill.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Flat discount — applied via PATCH /api/lab/bills/{id}/ before payment,
  // same pattern as the pharmacy and consultation bill discount flows.
  const [discountInput, setDiscountInput] = useState(String(bill.discount ?? "0"));
  const [discount, setDiscount] = useState(parseFloat(bill.discount ?? 0));
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState(null);

  const subtotal = parseFloat(bill.subtotal ?? 0);
  const isLocked = bill.payment_status === "PAID";

  const total = Math.max(subtotal - (isNaN(discount) ? 0 : discount), 0);
  const balance = Math.max(total - parseFloat(paidAmount || 0), 0);

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
      await updateLabBill(billId, { discount: val });
      setDiscount(val);
      onSaved?.();
    } catch (err) {
      setDiscountError(err.message || "Failed to apply discount");
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleSave = async () => {
    if (parseFloat(paidAmount) < total) {
      setError(`Payment must be ₹${total}. Balance: ₹${balance}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // FIX: Use billId instead of bill.id
      await payLabBill(billId, {
        payment_method: paymentMethod,
        paid_amount: parseFloat(paidAmount),
        notes: notes.trim() || null,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error processing payment");
    } finally {
      setSaving(false);
    }
  };

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
          maxWidth: "500px",
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "16px" }}>
          Process Payment - Bill {bill?.bill_number || `#${billId}`}
        </h3>

        <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#64748B", marginBottom: "4px" }}>
            <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#DC2626", marginBottom: "4px" }}>
              <span>Discount</span><span>− ₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid #E8EDF4" }}>
            <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>Total Payable</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              ₹{total.toFixed(2)}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
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
                padding: "9px 12px",
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

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Payment Amount <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          {balance > 0 && (
            <p style={{ fontSize: "11px", color: "#D97706", marginTop: "4px" }}>
              Balance due: ₹{balance.toFixed(2)}
            </p>
          )}
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment notes..."
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

        {error && (
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
            {error}
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
            {saving ? "Processing..." : "Process Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────── */
export default function LabBillsPage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  // Period presets + calendar picker — same pattern as the Manager's
  // Bills page (manager/pages/BillsPage.jsx). Defaults to "This Month".
  // Manually editing either date input switches the mode to "custom" so
  // presets and manual dates never fight each other.
  const [datePreset, setDatePreset] = useState("month");
  const [start, setStart] = useState(toISODate(firstOfMonth));
  const [end, setEnd] = useState(toISODate(today));

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const { start: s, end: e } = PRESET_RANGES[preset]();
    setStart(s);
    setEnd(e);
  };

  const fetchBills = useCallback(async () => {
    if (!isValidISODate(start) || !isValidISODate(end)) return;
    if (start > end) { setError("'From' date must be before 'To' date."); return; }
    try {
      setLoading(true);
      setError(null);
      const params = { start, end };
      if (filterStatus) params.payment_status = filterStatus;
      const data = await getLabBills(params);
      setBills(data.results || []);
    } catch (err) {
      setError(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, start, end]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const statuses = ["PENDING", "PAID"];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
          Lab Bills
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B" }}>
          Manage and collect payments for lab services
        </p>
      </div>

      {/* Date filters — period presets + calendar picker, same pattern as the Manager's Bills page */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #EEF2F7", padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>Period</label>
            <div style={{ display: "flex", gap: "4px" }}>
              {[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["year", "This Year"]].map(([v, l]) => (
                <button key={v} onClick={() => applyPreset(v)}
                  style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: datePreset === v ? "none" : "1px solid #EEF2F7", background: datePreset === v ? AMBER : "#fff", color: datePreset === v ? "#fff" : "#64748B", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>From</label>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); setDatePreset(""); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>To</label>
            <input type="date" value={end} onChange={e => { setEnd(e.target.value); setDatePreset(""); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }} />
          </div>
          <button onClick={fetchBills} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
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
            {PAYMENT_STATUS_CFG[status]?.label || status}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
          Loading bills...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "red" }}>
          {error}
        </div>
      ) : bills.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
          No bills found
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
                    Bill ID
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Date
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Patient
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Amount
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Discount
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Paid
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  // FIX: Use bill_id from API response
                  const billId = bill.bill_id ?? bill.id;
                  return (
                    <tr key={billId} style={{ borderBottom: "1px solid #EEF2F7" }}>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                        {bill.bill_number || `#${billId}`}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>
                        {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                        {bill.patient_name || "N/A"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                        ₹{parseFloat(bill.total_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: parseFloat(bill.discount || 0) > 0 ? "#DC2626" : "#94A3B8" }}>
                        {parseFloat(bill.discount || 0) > 0 ? `− ₹${parseFloat(bill.discount).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#64748B" }}>
                        ₹{parseFloat(bill.paid_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={bill.payment_status} />
                      </td>
                      <td style={{ padding: "12px 16px", display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => setSelectedBill(bill)}
                          disabled={bill.payment_status === "PAID"}
                          style={{
                            padding: "6px 12px",
                            background: bill.payment_status === "PAID" ? "#E8EDF4" : "none",
                            border: "1px solid #E8EDF4",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: bill.payment_status === "PAID" ? "#94A3B8" : AMBER,
                            cursor: bill.payment_status === "PAID" ? "not-allowed" : "pointer",
                            opacity: bill.payment_status === "PAID" ? 0.5 : 1,
                          }}
                        >
                          {bill.payment_status === "PAID" ? "Paid" : "Pay"}
                        </button>
                        <Link
                          to={`/lab/bills/print/${billId}`}
                          style={{
                            padding: "6px 12px",
                            border: "1px solid #E8EDF4",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#475569",
                            textDecoration: "none",
                          }}
                        >
                          Print
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {selectedBill && (
        <BillModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onSaved={fetchBills}
        />
      )}
    </div>
  );
}