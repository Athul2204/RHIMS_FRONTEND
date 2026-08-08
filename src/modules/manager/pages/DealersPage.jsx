// src/modules/manager/pages/DealersPage.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getDealers, createDealer, getDealer, updateDealer, deactivateDealer,
  finalizeDealerTransaction, createDealerTransaction,
  bulkFinalizeDealerTransactions, voidDealerTransaction,
} from "../api/managerApi";
import { Toast, useToast } from "../../../components/shared/Toast";
import { isValidPhone, sanitizePhoneInput, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";

const ACCENT = "#6366F1";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const DEALS_IN_NAMES = { MEDICINE: "Medicine", SUPPLY: "Supplies", GENERAL: "General Items" };
const ALL_DEALS_IN_CODES = ["MEDICINE", "SUPPLY", "GENERAL"];

// Builds a readable label from a stored deals_in value, which may be a
// legacy single code, the legacy "BOTH" (= all three), or a comma-separated
// combination like "MEDICINE,SUPPLY" (any two, or all three).
function dealsInLabel(value) {
  if (!value) return "";
  if (value === "BOTH") return "All";
  const codes = value.split(",").map(s => s.trim()).filter(Boolean);
  if (codes.length === 0) return "";
  if (codes.length === ALL_DEALS_IN_CODES.length) return "All";
  return codes.map(c => DEALS_IN_NAMES[c] || c).join(" + ");
}

// Normalizes a deals_in value into an array of category codes, for
// pre-checking the right checkboxes when editing an existing dealer.
function dealsInToCodes(value) {
  if (!value) return [];
  if (value === "BOTH") return [...ALL_DEALS_IN_CODES];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

const TXN_TYPE_LABEL = {
  PURCHASE:    "Purchase",
  PAYMENT:     "Payment made",
  CREDIT_NOTE: "Credit note",
  CASH_REFUND: "Cash refund",
  ADJUSTMENT:  "Adjustment",
};
const TXN_TYPE_COLOR = {
  PURCHASE:    "#EA580C",
  PAYMENT:     "#16A34A",
  CREDIT_NOTE: "#0EA5E9",
  CASH_REFUND: "#16A34A",
  ADJUSTMENT:  "#64748B",
};
const SETTLEMENT_LABEL = { CREDIT: "Credit", PAID: "Paid", REFUND: "Refund", EXCHANGE: "Exchange" };
const SOURCE_LABEL = {
  MEDICINE_BATCH: "Medicine batch", SUPPLY_BATCH: "Supply batch", GENERAL_ITEM_BATCH: "General item batch",
  MEDICINE_RETURN: "Medicine return", SUPPLY_RETURN: "Supply return", GENERAL_ITEM_RETURN: "General item return",
  MANUAL: "Manual",
};

// ── Shared bits ───────────────────────────────────────────────
function Modal({ title, onClose, children, width = "520px" }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:width,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.22)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"18px 24px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1 }}>
          <h2 style={{ margin:0,fontSize:"15px",fontWeight:700,color:"#0F172A" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:"22px",cursor:"pointer",color:"#94A3B8",lineHeight:1,padding:"2px 6px" }}>×</button>
        </div>
        <div style={{ padding:"24px" }}>{children}</div>
      </div>
    </div>
  );
}

const inp = {
  width:"100%", padding:"9px 12px", borderRadius:"8px",
  border:"1px solid #E2E8F0", fontSize:"13px", color:"#1E293B",
  outline:"none", boxSizing:"border-box", background:"#F8FAFC",
};
const lbl = { display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" };

function StatCard({ label, value, color = "#0F172A", sub }) {
  return (
    <div style={{ background:"#fff",borderRadius:"12px",padding:"16px 20px",border:"1px solid #E8EDF4" }}>
      <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>{label}</p>
      <p style={{ fontSize:"20px",fontWeight:800,color,margin:"0 0 4px" }}>{value}</p>
      {sub && <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{sub}</p>}
    </div>
  );
}

function Badge({ children, bg, color }) {
  return (
    <span style={{ display:"inline-block",padding:"3px 9px",borderRadius:"999px",fontSize:"11px",fontWeight:700,background:bg,color }}>
      {children}
    </span>
  );
}

// ════════════════════════════════════════════════════════
// Add / Edit dealer form
// ════════════════════════════════════════════════════════
const EMPTY_DEALER = {
  name:"", contact_person:"", phone:"", email:"", address:"",
  gst_number:"", deals_in:"BOTH", opening_balance:"0", notes:"",
};

function DealerForm({ initial, onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY_DEALER);
  const [phoneError, setPhoneError] = useState("");
  const [dealsInError, setDealsInError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Checkbox-backed selection, initialized from whatever deals_in value
  // was passed in (legacy single code, legacy "BOTH", or a combo string).
  const [dealsInCodes, setDealsInCodes] = useState(
    () => dealsInToCodes((initial || EMPTY_DEALER).deals_in)
  );
  const toggleDealsIn = (code) => {
    setDealsInCodes(codes =>
      codes.includes(code) ? codes.filter(c => c !== code) : [...codes, code]
    );
    setDealsInError("");
  };

  const handleSubmitClick = () => {
    if (form.phone?.trim() && !isValidPhone(form.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (dealsInCodes.length === 0) {
      setDealsInError("Select at least one category.");
      return;
    }
    setPhoneError("");
    setDealsInError("");
    // Send "BOTH" when all three are picked (keeps existing backend
    // filtering/defaults working); otherwise send the exact combination,
    // e.g. "MEDICINE,SUPPLY" for any two categories.
    const deals_in = dealsInCodes.length === ALL_DEALS_IN_CODES.length
      ? "BOTH"
      : ALL_DEALS_IN_CODES.filter(c => dealsInCodes.includes(c)).join(",");
    onSubmit({ ...form, deals_in });
  };

  return (
    <>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}

      <div style={{ marginBottom:"14px" }}>
        <label style={lbl}>Dealer Name <span style={{ color:"#EF4444" }}>*</span></label>
        <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Sunrise Pharma Distributors" style={inp} />
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={lbl}>Contact Person</label>
          <input value={form.contact_person || ""} onChange={e=>set("contact_person",e.target.value)} placeholder="Optional" style={inp} />
        </div>
        <div>
          <label style={lbl}>Phone</label>
          <input value={form.phone || ""} maxLength={10} inputMode="numeric"
            onChange={e=>{ set("phone", sanitizePhoneInput(e.target.value)); setPhoneError(""); }}
            placeholder="Starts with 6-9, 10 digits" style={inp} />
          {phoneError && <p style={{ fontSize:"11px", color:"#EF4444", margin:"4px 0 0" }}>{phoneError}</p>}
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={lbl}>Email</label>
          <input type="email" value={form.email || ""} onChange={e=>set("email",e.target.value)} placeholder="Optional" style={inp} />
        </div>
        <div>
          <label style={lbl}>GST Number</label>
          <input value={form.gst_number || ""} onChange={e=>set("gst_number",e.target.value)} placeholder="Optional" style={inp} />
        </div>
      </div>

      <div style={{ marginBottom:"14px" }}>
        <label style={lbl}>Address</label>
        <textarea value={form.address || ""} onChange={e=>set("address",e.target.value)} rows={2} placeholder="Optional" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={lbl}>Deals In</label>
          <div style={{ display:"flex",flexDirection:"column",gap:"6px",padding:"8px 10px",border:"1px solid #E2E8F0",borderRadius:"8px" }}>
            {ALL_DEALS_IN_CODES.map(code => (
              <label key={code} style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#374151",cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={dealsInCodes.includes(code)}
                  onChange={() => toggleDealsIn(code)}
                />
                {DEALS_IN_NAMES[code]}
              </label>
            ))}
          </div>
          {dealsInError && <p style={{ fontSize:"11px", color:"#EF4444", margin:"4px 0 0" }}>{dealsInError}</p>}
          <p style={{ fontSize:"11px", color:"#94A3B8", margin:"4px 0 0" }}>
            Pick one, two, or all three — e.g. Medicine + Supplies only.
          </p>
        </div>
        <div>
          <label style={lbl}>Opening Balance (₹)</label>
          <input type="number" step="0.01" value={form.opening_balance} onChange={e=>set("opening_balance",e.target.value)} style={inp} />
          <p style={{ fontSize:"11px",color:"#94A3B8",margin:"4px 0 0" }}>Positive = we already owe them before the ledger starts.</p>
        </div>
      </div>

      <div style={{ marginBottom:"20px" }}>
        <label style={lbl}>Notes</label>
        <textarea value={form.notes || ""} onChange={e=>set("notes",e.target.value)} rows={2} placeholder="Optional" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onCancel} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={handleSubmitClick} disabled={saving || !form.name?.trim()}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:(saving||!form.name?.trim())?0.6:1 }}>
          {saving ? "Saving…" : "Save Dealer"}
        </button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// Finalize (confirm/reject) a pending ledger transaction
// ════════════════════════════════════════════════════════
function FinalizeModal({ txn, onClose, onDone }) {
  const [action, setAction] = useState("CONFIRM");
  // transaction_type is FIXED — it was set when this row was created
  // (by the pharmacist's batch/return, or by whoever logged it manually)
  // and is never editable here. Changing it used to let a real PURCHASE
  // get silently confirmed as a lone PAYMENT (or a real CREDIT_NOTE as a
  // lone CASH_REFUND), which discarded the actual event and left the
  // ledger showing false credit/debt. Only how it was settled is editable.
  const transactionType = txn.transaction_type;
  const [settlementMethod, setSettlementMethod] = useState(txn.settlement_method || "");
  const [amount, setAmount] = useState(String(txn.amount));
  const [referenceNumber, setReferenceNumber] = useState(txn.reference_number || "");
  const [dueDate, setDueDate] = useState(txn.due_date || "");
  const [notes, setNotes] = useState("");
  const [autoSettle, setAutoSettle] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isPurchase = transactionType === "PURCHASE";
  const isCreditNote = transactionType === "CREDIT_NOTE";
  // "Paid now" means settled immediately — PAID for a purchase (we hand
  // over cash), REFUND for a credit note (the dealer hands cash back to
  // us). "Pending — pay later" always means CREDIT either way: left
  // outstanding on the running balance, optionally with a due date.
  const paidNowMethod = isCreditNote ? "REFUND" : "PAID";
  const isPaidNow = settlementMethod === paidNowMethod;
  const isPending = settlementMethod === "CREDIT";
  // Matches the backend's AUTO_SETTLE_PAIRS: a PURCHASE paid in full auto-
  // logs a matching Payment; a CREDIT_NOTE refunded in cash auto-logs a
  // matching Cash refund — either way the event nets to ₹0 immediately.
  const canAutoSettle =
    (isPurchase && settlementMethod === "PAID") ||
    (isCreditNote && settlementMethod === "REFUND");
  const autoSettleLabel = isPurchase
    ? "Auto-log a matching payment so this purchase nets to ₹0 on the ledger"
    : "Auto-log a matching cash refund so this return nets to ₹0 on the ledger";

  // ✅ FIX: "Amount" above corrects the TRUE value of this purchase/return
  // (e.g. the invoice was actually a different figure) — it is NOT "how
  // much I'm paying today". Those used to be the same field, so entering
  // 100 here against a ₹150 purchase and picking "Paid Now" silently
  // rewrote the purchase down to ₹100 *and* marked it fully paid, instead
  // of recording a ₹100 partial payment against the real ₹150 owed — the
  // ledger then read "Settled, ₹0 balance" instead of "₹50 still due".
  // `paidAmount` is a separate field for that: how much is actually
  // changing hands right now. Defaults to the full amount (unchanged,
  // full-settlement behaviour); lower it for a partial payment/refund —
  // the ₹150 purchase stays ₹150, only ₹100 is logged as paid, and the
  // remaining ₹50 stays open on the ledger as Due.
  const [paidAmount, setPaidAmount] = useState(String(txn.amount));
  const amountNum = parseFloat(amount) || 0;
  const paidAmountNum = parseFloat(paidAmount) || 0;
  const isPartialPayment = canAutoSettle && autoSettle && paidAmountNum > 0 && paidAmountNum < amountNum;
  const remainingNum = Math.max(0, amountNum - paidAmountNum);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { action };
      if (action === "CONFIRM") {
        if (settlementMethod) payload.settlement_method = settlementMethod;
        payload.amount = amountNum;
        // Only send paid_amount when it's genuinely a partial payment —
        // if it's equal to (or, after an amount correction above, now
        // exceeds) the amount, leave it out so the backend just settles
        // in full at the (possibly corrected) amount, same as before.
        if (isPartialPayment) payload.paid_amount = paidAmountNum;
        if (referenceNumber) payload.reference_number = referenceNumber;
        payload.due_date = isPending && dueDate ? dueDate : null;
        payload.auto_settle_payment = canAutoSettle ? autoSettle : false;
      }
      if (notes) payload.notes = notes;
      await finalizeDealerTransaction(txn.transaction_id, payload);
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to finalize transaction.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Review Transaction #${txn.transaction_id}`} onClose={onClose}>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}

      <div style={{ background:"#F8FAFC",borderRadius:"10px",padding:"12px 14px",marginBottom:"16px",fontSize:"13px",color:"#334155" }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"4px" }}>
          <span>Source</span><strong>{SOURCE_LABEL[txn.source_model] || txn.source_model}</strong>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between" }}>
          <span>Originally requested</span>
          <strong>{TXN_TYPE_LABEL[txn.transaction_type]} · {fmt(txn.amount)}{txn.settlement_method ? ` · ${SETTLEMENT_LABEL[txn.settlement_method]}` : ""}</strong>
        </div>
      </div>

      <div style={{ display:"flex",gap:"8px",marginBottom:"18px" }}>
        <button onClick={()=>setAction("CONFIRM")} style={{ flex:1,padding:"9px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",background:action==="CONFIRM"?"#16A34A":"#F1F5F9",color:action==="CONFIRM"?"#fff":"#64748B" }}>✓ Confirm</button>
        <button onClick={()=>setAction("REJECT")} style={{ flex:1,padding:"9px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",background:action==="REJECT"?"#DC2626":"#F1F5F9",color:action==="REJECT"?"#fff":"#64748B" }}>✕ Reject</button>
      </div>

      {/* A PURCHASE-sourced batch sits at PENDING_APPROVAL — not sellable/
          dispensable yet — until this transaction is resolved either way.
          Make that consequence visible right where the manager decides. */}
      {isPurchase && (
        <div style={{
          background: action === "REJECT" ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${action === "REJECT" ? "#FECACA" : "#BBF7D0"}`,
          borderRadius:"9px", padding:"10px 14px", marginBottom:"18px",
          fontSize:"12px", color: action === "REJECT" ? "#991B1B" : "#166534",
        }}>
          {action === "REJECT"
            ? "Rejecting this purchase returns the remaining (unsold) stock from that batch to the dealer — it will be zeroed out and marked as rejected. Anything already dispensed to patients is unaffected."
            : "Confirming this purchase makes that batch's stock available for sale. Until confirmed, it stays reserved and cannot be dispensed or billed."}
        </div>
      )}

      {action === "CONFIRM" && (
        <>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
            <div>
              <label style={lbl}>Transaction Type</label>
              <div style={{ ...inp, display:"flex", alignItems:"center", background:"#F1F5F9", color:"#475569", fontWeight:600, cursor:"default" }}>
                {TXN_TYPE_LABEL[transactionType]}
              </div>
              <p style={{ fontSize:"10.5px",color:"#94A3B8",margin:"4px 0 0" }}>Fixed — set when this was created, not editable here.</p>
            </div>
            <div>
              <label style={lbl}>Amount (₹)</label>
              <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ marginBottom:"14px" }}>
            <label style={lbl}>How is this being settled?</label>
            <div style={{ display:"flex",gap:"8px" }}>
              <button type="button" onClick={()=>setSettlementMethod(paidNowMethod)}
                style={{ flex:1,padding:"11px",borderRadius:"9px",border:isPaidNow?"2px solid #16A34A":"1px solid #E2E8F0",
                  background:isPaidNow?"#F0FDF4":"#fff",color:isPaidNow?"#166534":"#475569",fontWeight:700,fontSize:"12.5px",cursor:"pointer",textAlign:"left" }}>
                💰 Paid Now
                <div style={{ fontWeight:400,fontSize:"11px",color:"#94A3B8",marginTop:"2px" }}>
                  {isPurchase ? "We've paid the dealer" : "Dealer refunded us"} — settles immediately
                </div>
              </button>
              <button type="button" onClick={()=>setSettlementMethod("CREDIT")}
                style={{ flex:1,padding:"11px",borderRadius:"9px",border:isPending?"2px solid #D97706":"1px solid #E2E8F0",
                  background:isPending?"#FFFBEB":"#fff",color:isPending?"#92400E":"#475569",fontWeight:700,fontSize:"12.5px",cursor:"pointer",textAlign:"left" }}>
                🕒 Pending — Pay Later
                <div style={{ fontWeight:400,fontSize:"11px",color:"#94A3B8",marginTop:"2px" }}>
                  Left as credit on the balance
                </div>
              </button>
            </div>
          </div>

          {isPending && (
            <div style={{ marginBottom:"14px" }}>
              <label style={lbl}>Expected Due Date <span style={{ fontWeight:400,color:"#94A3B8" }}>(optional)</span></label>
              <input type="date" value={dueDate || ""} onChange={e=>setDueDate(e.target.value)} style={{ ...inp, maxWidth:"220px" }} />
            </div>
          )}

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
            <div>
              <label style={lbl}>Settlement Method <span style={{ fontWeight:400,color:"#94A3B8" }}>(or pick Exchange below)</span></label>
              <select value={settlementMethod} onChange={e=>setSettlementMethod(e.target.value)} style={inp}>
                <option value="">— Not specified —</option>
                {Object.entries(SETTLEMENT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Reference No.</label>
              <input value={referenceNumber} onChange={e=>setReferenceNumber(e.target.value)} placeholder="Cheque / UTR / etc." style={inp} />
            </div>
          </div>

          {canAutoSettle && (
            <label style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:"#374151",marginBottom:"14px",cursor:"pointer" }}>
              <input type="checkbox" checked={autoSettle} onChange={e=>setAutoSettle(e.target.checked)} />
              {autoSettleLabel}
            </label>
          )}

          {canAutoSettle && autoSettle && (
            <div style={{ marginBottom:"14px" }}>
              <label style={lbl}>
                {isPurchase ? "Paying Now (₹)" : "Refunded Now (₹)"}
                <span style={{ fontWeight:400,color:"#94A3B8" }}> — lower this for a partial {isPurchase ? "payment" : "refund"}</span>
              </label>
              <input type="number" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} style={inp} />
              {isPartialPayment ? (
                <p style={{ fontSize:"11px",color:"#D97706",margin:"4px 0 0",fontWeight:600 }}>
                  {fmt(remainingNum)} will stay outstanding on the ledger as Due — the {fmt(amountNum)} {TXN_TYPE_LABEL[transactionType].toLowerCase()} itself won't be changed.
                </p>
              ) : (
                <p style={{ fontSize:"10.5px",color:"#94A3B8",margin:"4px 0 0" }}>
                  Matches the amount above by default — settles this in full.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ marginBottom:"20px" }}>
        <label style={lbl}>Notes</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={submit} disabled={saving || (action==="CONFIRM" && !amount)}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",
            background: action==="CONFIRM" ? "#16A34A" : "#DC2626", color:"#fff",
            opacity:(saving||(action==="CONFIRM"&&!amount))?0.6:1 }}>
          {saving ? "Saving…" : action === "CONFIRM" ? "Confirm Transaction" : "Reject Transaction"}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
// Bulk finalize — settle several of one dealer's PENDING items
// together as one "bill" instead of one at a time. Every entry
// shares the same action/settlement here (each still keeps its
// own amount and its own auto-paired settlement leg server-side).
// ════════════════════════════════════════════════════════
function BulkFinalizeModal({ dealerId, txns, onClose, onDone }) {
  const [action, setAction] = useState("CONFIRM");
  const [settlementMethod, setSettlementMethod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const total = txns.reduce((s, t) => s + Number(t.amount || 0), 0);
  const isPending = settlementMethod === "CREDIT";
  const hasPurchase = txns.some(t => t.transaction_type === "PURCHASE");
  const hasCreditNote = txns.some(t => t.transaction_type === "CREDIT_NOTE");
  const mixedTypes = hasPurchase && hasCreditNote;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { transaction_ids: txns.map(t => t.transaction_id), action };
      if (action === "CONFIRM") {
        if (settlementMethod) payload.settlement_method = settlementMethod;
        if (referenceNumber) payload.reference_number = referenceNumber;
        payload.due_date = isPending && dueDate ? dueDate : null;
      }
      if (notes) payload.notes = notes;
      await bulkFinalizeDealerTransactions(payload);
      onDone();
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to settle selected items.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Settle ${txns.length} Items As One Bill`} onClose={onClose}>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}

      <div style={{ background:"#F8FAFC",borderRadius:"10px",padding:"4px",marginBottom:"16px",maxHeight:"180px",overflow:"auto" }}>
        {txns.map(t => (
          <div key={t.transaction_id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 10px",fontSize:"12.5px",color:"#334155",borderBottom:"1px solid #EEF2F7" }}>
            <span>{TXN_TYPE_LABEL[t.transaction_type]} · {SOURCE_LABEL[t.source_model] || t.source_model}</span>
            <strong>{fmt(t.amount)}</strong>
          </div>
        ))}
        <div style={{ display:"flex",justifyContent:"space-between",padding:"10px",fontSize:"13px",fontWeight:800,color:"#0F172A" }}>
          <span>Total</span><span>{fmt(total)}</span>
        </div>
      </div>

      {mixedTypes && (
        <div style={{ background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"8px",padding:"10px 14px",marginBottom:"14px",fontSize:"12px",color:"#1E40AF" }}>
          This batch mixes purchases and returns — each still auto-pairs its own matching payment/refund leg individually.
        </div>
      )}

      {hasPurchase && (
        <div style={{
          background: action === "REJECT" ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${action === "REJECT" ? "#FECACA" : "#BBF7D0"}`,
          borderRadius:"8px", padding:"10px 14px", marginBottom:"14px",
          fontSize:"12px", color: action === "REJECT" ? "#991B1B" : "#166534",
        }}>
          {action === "REJECT"
            ? "Rejecting the purchase(s) in this batch returns their remaining (unsold) stock to the dealer and zeroes it out."
            : "Confirming the purchase(s) in this batch makes their stock available for sale — until confirmed it stays reserved."}
        </div>
      )}

      <div style={{ display:"flex",gap:"8px",marginBottom:"18px" }}>
        <button onClick={()=>setAction("CONFIRM")} style={{ flex:1,padding:"9px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",background:action==="CONFIRM"?"#16A34A":"#F1F5F9",color:action==="CONFIRM"?"#fff":"#64748B" }}>✓ Confirm All</button>
        <button onClick={()=>setAction("REJECT")} style={{ flex:1,padding:"9px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",background:action==="REJECT"?"#DC2626":"#F1F5F9",color:action==="REJECT"?"#fff":"#64748B" }}>✕ Reject All</button>
      </div>

      {action === "CONFIRM" && (
        <>
          <div style={{ marginBottom:"14px" }}>
            <label style={lbl}>How is this batch being settled?</label>
            <div style={{ display:"flex",gap:"8px" }}>
              <button type="button" onClick={()=>setSettlementMethod(hasCreditNote && !hasPurchase ? "REFUND" : "PAID")}
                style={{ flex:1,padding:"11px",borderRadius:"9px",border:!isPending&&settlementMethod?"2px solid #16A34A":"1px solid #E2E8F0",
                  background:!isPending&&settlementMethod?"#F0FDF4":"#fff",color:!isPending&&settlementMethod?"#166534":"#475569",fontWeight:700,fontSize:"12.5px",cursor:"pointer" }}>
                💰 Paid Now
              </button>
              <button type="button" onClick={()=>setSettlementMethod("CREDIT")}
                style={{ flex:1,padding:"11px",borderRadius:"9px",border:isPending?"2px solid #D97706":"1px solid #E2E8F0",
                  background:isPending?"#FFFBEB":"#fff",color:isPending?"#92400E":"#475569",fontWeight:700,fontSize:"12.5px",cursor:"pointer" }}>
                🕒 Pending — Pay Later
              </button>
            </div>
          </div>

          {isPending && (
            <div style={{ marginBottom:"14px" }}>
              <label style={lbl}>Expected Due Date <span style={{ fontWeight:400,color:"#94A3B8" }}>(optional)</span></label>
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={{ ...inp, maxWidth:"220px" }} />
            </div>
          )}

          <div style={{ marginBottom:"14px" }}>
            <label style={lbl}>Reference No. <span style={{ fontWeight:400,color:"#94A3B8" }}>(applies to all)</span></label>
            <input value={referenceNumber} onChange={e=>setReferenceNumber(e.target.value)} placeholder="Cheque / UTR / bill no." style={inp} />
          </div>
        </>
      )}

      <div style={{ marginBottom:"20px" }}>
        <label style={lbl}>Notes</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={submit} disabled={saving}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",
            background: action==="CONFIRM" ? "#16A34A" : "#DC2626", color:"#fff", opacity:saving?0.6:1 }}>
          {saving ? "Settling…" : action === "CONFIRM" ? `Confirm ${txns.length} Items` : `Reject ${txns.length} Items`}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
// Manually log a transaction (payment, adjustment, etc. that
// wasn't auto-created from a stock batch/return) — e.g. to
// correct an earlier entry that was confirmed with the wrong
// transaction type. Created as PENDING like any other entry,
// so it still goes through the normal Review → Confirm step.
// ════════════════════════════════════════════════════════
function LogTransactionModal({ dealerId, dealerName, onClose, onDone, initial }) {
  const [transactionType, setTransactionType] = useState(initial?.transaction_type || "ADJUSTMENT");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [settlementMethod, setSettlementMethod] = useState(initial?.settlement_method || "");
  const [referenceNumber, setReferenceNumber] = useState(initial?.reference_number || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isAdjustment = transactionType === "ADJUSTMENT";
  const lockType = !!initial?.lockType;

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = {
        dealer: dealerId,
        transaction_type: transactionType,
        amount: parseFloat(amount),
      };
      if (settlementMethod) payload.settlement_method = settlementMethod;
      if (referenceNumber) payload.reference_number = referenceNumber;
      if (notes) payload.notes = notes;
      if (initial?.linked_transaction) payload.linked_transaction = initial.linked_transaction;
      await createDealerTransaction(payload);
      onDone();
    } catch (e) {
      setError(e?.response?.data?.amount?.[0] || e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to log transaction.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={initial?.modalTitle || `Log Transaction — ${dealerName}`} onClose={onClose}>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}

      <div style={{ background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"8px",padding:"10px 14px",marginBottom:"16px",fontSize:"12px",color:"#1E40AF",lineHeight:1.5 }}>
        {initial?.banner || (
          <>
            Use this for anything that isn't auto-created by a stock purchase or return — e.g. a
            correcting <strong>Adjustment</strong> if an earlier entry was confirmed with the wrong
            type, or a standalone cash payment. This is created as <strong>Pending</strong> and still
            needs to be confirmed under "Awaiting Your Review" below.
          </>
        )}
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={lbl}>Transaction Type</label>
          <select value={transactionType} onChange={e=>setTransactionType(e.target.value)} disabled={lockType}
            style={{ ...inp, ...(lockType ? { background:"#F1F5F9", color:"#64748B", cursor:"not-allowed" } : {}) }}>
            {Object.entries(TXN_TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Amount (₹) {isAdjustment && <span style={{ fontWeight:400,color:"#94A3B8" }}>(+ we owe more, − we owe less)</span>}</label>
          <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={isAdjustment ? "e.g. 100 or -100" : "e.g. 100"} style={inp} />
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={lbl}>Settlement Method</label>
          <select value={settlementMethod} onChange={e=>setSettlementMethod(e.target.value)} style={inp}>
            <option value="">— Not specified —</option>
            {Object.entries(SETTLEMENT_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Reference No.</label>
          <input value={referenceNumber} onChange={e=>setReferenceNumber(e.target.value)} placeholder="Cheque / UTR / etc." style={inp} />
        </div>
      </div>

      <div style={{ marginBottom:"20px" }}>
        <label style={lbl}>Notes</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Why this entry is being logged" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={submit} disabled={saving || !amount || parseFloat(amount) === 0}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:(saving||!amount||parseFloat(amount)===0)?0.6:1 }}>
          {saving ? "Logging…" : (initial?.submitLabel || "Log Transaction")}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
// Bulk "Pay Now / Collect Refund" — the manual-create endpoint
// only supports one linked_transaction per row (no M2M), so this
// loops client-side and logs one PAYMENT (or CASH_REFUND) per
// selected due item, each still correctly linked back to its own
// original PURCHASE/CREDIT_NOTE. Every row lands as its own
// Pending entry — same as clicking "Pay Now" one at a time — so
// they can then be bulk-confirmed together via "Settle Selected"
// under Awaiting Your Review.
// ════════════════════════════════════════════════════════
function BulkPayModal({ dealerId, txns, onClose, onDone }) {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const payables = txns.filter(t => t.transaction_type === "PURCHASE");
  const collectibles = txns.filter(t => t.transaction_type === "CREDIT_NOTE");
  const payTotal = payables.reduce((s, t) => s + Number(t.amount), 0);
  const collectTotal = collectibles.reduce((s, t) => s + Number(t.amount), 0);

  const submit = async () => {
    setSaving(true); setError(null);
    const failedIds = [];
    for (const t of txns) {
      try {
        const payload = {
          dealer: dealerId,
          transaction_type: t.transaction_type === "CREDIT_NOTE" ? "CASH_REFUND" : "PAYMENT",
          amount: Number(t.amount),
          settlement_method: t.transaction_type === "CREDIT_NOTE" ? "REFUND" : "PAID",
          notes: notes || `Settling ${TXN_TYPE_LABEL[t.transaction_type]} #${t.transaction_id}`,
          linked_transaction: t.transaction_id,
        };
        if (referenceNumber) payload.reference_number = referenceNumber;
        await createDealerTransaction(payload);
      } catch {
        failedIds.push(t.transaction_id);
      }
    }
    setSaving(false);
    if (failedIds.length > 0) {
      setError(`Logged ${txns.length - failedIds.length} of ${txns.length}. Failed: #${failedIds.join(", #")}.`);
      if (failedIds.length < txns.length) onDone();
    } else {
      onDone();
    }
  };

  return (
    <Modal title={`Pay / Collect ${txns.length} Due Items`} onClose={onClose}>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}

      <div style={{ background:"#F8FAFC",borderRadius:"10px",padding:"4px",marginBottom:"16px",maxHeight:"200px",overflow:"auto" }}>
        {txns.map(t => (
          <div key={t.transaction_id} style={{ display:"flex",justifyContent:"space-between",padding:"8px 10px",fontSize:"12.5px",color:"#334155",borderBottom:"1px solid #EEF2F7" }}>
            <span>{t.transaction_type === "PURCHASE" ? "💰 Pay" : "↩ Collect"} · {TXN_TYPE_LABEL[t.transaction_type]} #{t.transaction_id}</span>
            <strong>{fmt(t.amount)}</strong>
          </div>
        ))}
      </div>

      <div style={{ background:"#F8FAFC",borderRadius:"10px",padding:"12px 14px",marginBottom:"16px",fontSize:"13px",color:"#334155" }}>
        {payTotal > 0 && (
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom: collectTotal > 0 ? "4px" : 0 }}>
            <span>Total to pay dealer</span><strong style={{ color:"#16A34A" }}>{fmt(payTotal)}</strong>
          </div>
        )}
        {collectTotal > 0 && (
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <span>Total to collect from dealer</span><strong style={{ color:ACCENT }}>{fmt(collectTotal)}</strong>
          </div>
        )}
      </div>

      <div style={{ background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"8px",padding:"10px 14px",marginBottom:"16px",fontSize:"12px",color:"#1E40AF",lineHeight:1.5 }}>
        Logs one entry per item, each linked back to its original purchase/return. All are created as <strong>Pending</strong> — confirm them together under "Awaiting Your Review" afterwards.
      </div>

      <div style={{ marginBottom:"14px" }}>
        <label style={lbl}>Reference No. <span style={{ fontWeight:400,color:"#94A3B8" }}>(applies to all, optional)</span></label>
        <input value={referenceNumber} onChange={e=>setReferenceNumber(e.target.value)} placeholder="Cheque / UTR / bill no." style={inp} />
      </div>

      <div style={{ marginBottom:"20px" }}>
        <label style={lbl}>Notes <span style={{ fontWeight:400,color:"#94A3B8" }}>(optional, applies to all)</span></label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Optional" style={{ ...inp, resize:"vertical" }} />
      </div>

      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onClose} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={submit} disabled={saving}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",fontWeight:700,fontSize:"13px",cursor:"pointer",background:"#16A34A",color:"#fff",opacity:saving?0.6:1 }}>
          {saving ? "Logging…" : `Log ${txns.length} ${txns.length === 1 ? "Entry" : "Entries"}`}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════
// Dealer detail drawer — profile, balance, full ledger
// ════════════════════════════════════════════════════════
function DealerDetail({ dealerId, onClose, onChanged }) {
  const [dealer, setDealer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [finalizeTarget, setFinalizeTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showLogTxn, setShowLogTxn] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkFinalize, setShowBulkFinalize] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [duePayIds, setDuePayIds] = useState([]);
  const [showBulkPay, setShowBulkPay] = useState(false);
  const [showSettleBalance, setShowSettleBalance] = useState(false);
  const [voidingId, setVoidingId] = useState(null);
  const [toast, showToast] = useToast();

  // NOTE: setLoading(true) intentionally does NOT run again in here.
  // `loading` starts true only for the initial fetch (see useState(true)
  // below) and is set false forever after. Every subsequent call to
  // load() — after Cancel, Void, Pay Now, Settle, etc. — just quietly
  // swaps in fresh dealer data. Re-arming `loading` on every refresh used
  // to blank the whole drawer out to a bare "Loading dealer…" screen (see
  // the `if (loading || !dealer)` branch below), which doesn't render
  // <Toast/> — so a showToast() call immediately followed by load() had
  // its toast wiped out mid-flight almost every time.
  const load = useCallback(async () => {
    try {
      const res = await getDealer(dealerId);
      setDealer(res);
    } finally { setLoading(false); }
  }, [dealerId]);

  useEffect(() => { load(); }, [load]);

  const handleEdit = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await updateDealer(dealerId, {
        ...form,
        opening_balance: form.opening_balance === "" ? 0 : form.opening_balance,
      });
      setShowEdit(false);
      load();
      onChanged?.();
    } catch (e) {
      setFormError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to update dealer.");
    } finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate ${dealer.name}? Their ledger history is kept, they just won't show up when adding new stock.`)) return;
    await deactivateDealer(dealerId);
    onChanged?.();
    onClose();
  };

  const handleFinalizeDone = () => {
    setFinalizeTarget(null);
    load();
    onChanged?.();
  };

  // Quick one-click cancel for a PENDING entry — same REJECT action the
  // full Review modal offers, just without opening it first. Useful for
  // e.g. a "Pay Now" that was logged by mistake and never should have
  // gone to review at all.
  const [cancellingId, setCancellingId] = useState(null);
  const handleQuickCancel = async (t) => {
    const stockNote = t.transaction_type === "PURCHASE"
      ? " Its batch's remaining (unsold) stock will be returned to the dealer and zeroed out."
      : "";
    if (!window.confirm(`Cancel this ${TXN_TYPE_LABEL[t.transaction_type]} of ${fmt(t.amount)}? It will be marked Rejected and won't affect the balance.${stockNote}`)) return;
    setCancellingId(t.transaction_id);
    try {
      await finalizeDealerTransaction(t.transaction_id, { action: "REJECT" });
      showToast("Entry cancelled.");
      load();
      onChanged?.();
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to cancel entry.", false);
    } finally {
      setCancellingId(null);
    }
  };

  const handleBulkFinalizeDone = () => {
    setShowBulkFinalize(false);
    setSelectedIds([]);
    // Reload gives a fresh state: settled items drop out of "Awaiting Your
    // Review" and whatever's left of this dealer's unpaid batch (or the
    // next one, if this was the last item) is what shows next.
    load();
    onChanged?.();
  };

  const toggleSelected = (id) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const toggleDueSelected = (id) => {
    setDuePayIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleLogTxnDone = () => {
    setShowLogTxn(false);
    showToast("Transaction logged — confirm it under \"Awaiting Your Review\" to apply it.");
    load();
    onChanged?.();
  };

  const handlePayDone = () => {
    setPayTarget(null);
    showToast("Payment logged — confirm it under \"Awaiting Your Review\" to apply it.");
    load();
    onChanged?.();
  };

  const handleBulkPayDone = () => {
    setShowBulkPay(false);
    setDuePayIds([]);
    showToast("Payments logged — confirm them under \"Awaiting Your Review\" to apply them.");
    load();
    onChanged?.();
  };

  const handleSettleBalanceDone = () => {
    setShowSettleBalance(false);
    showToast("Settlement logged — confirm it under \"Awaiting Your Review\" to apply it.");
    load();
    onChanged?.();
  };

  // Reverses a mistaken CONFIRMED entry (e.g. a stray/duplicate manual
  // payment throwing the balance off) — asks for a short reason, then
  // voids it (and its auto-paired leg, if any) via the backend, which
  // drops it out of Dealer.balance while keeping it on the ledger.
  const handleVoid = async (txn) => {
    const stockNote = txn.transaction_type === "PURCHASE"
      ? "\nIts batch's remaining (unsold) stock will also be returned to the dealer and zeroed out.\n"
      : "";
    const reason = window.prompt(
      `Void this ${TXN_TYPE_LABEL[txn.transaction_type]} of ${fmt(txn.amount)}?\n` +
      `This removes it from the balance calculation but keeps it visible in history.${stockNote}\n` +
      `Optional reason (e.g. "duplicate entry"):`
    );
    if (reason === null) return; // cancelled
    setVoidingId(txn.transaction_id);
    try {
      const res = await voidDealerTransaction(txn.transaction_id, { reason: reason.trim() });
      showToast(res.message || "Transaction voided.");
      load();
      onChanged?.();
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to void transaction.", false);
    } finally {
      setVoidingId(null);
    }
  };

  if (loading || !dealer) {
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:1000,display:"flex",justifyContent:"flex-end" }} onClick={onClose}>
        <div style={{ background:"#fff",width:"100%",maxWidth:"640px",height:"100%",padding:"40px",textAlign:"center",color:"#94A3B8" }} onClick={e=>e.stopPropagation()}>Loading dealer…</div>
      </div>
    );
  }

  const balance = dealer.balance;
  const owedByUs = balance > 0;
  const txns = dealer.transactions || [];
  const filteredTxns = statusFilter ? txns.filter(t => t.status === statusFilter) : txns;
  const pendingTxns = txns.filter(t => t.status === "PENDING");
  const dueTxns = txns.filter(t =>
    t.status === "CONFIRMED" && t.settlement_method === "CREDIT" && !t.is_settled &&
    (t.transaction_type === "PURCHASE" || t.transaction_type === "CREDIT_NOTE")
  );

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:1000,display:"flex",justifyContent:"flex-end" }} onClick={onClose}>
      <div style={{ background:"#F8FAFC",width:"100%",maxWidth:"680px",height:"100%",overflow:"auto",boxShadow:"-16px 0 48px rgba(0,0,0,0.18)" }} onClick={e=>e.stopPropagation()}>
        <Toast toast={toast} />

        {/* Header */}
        <div style={{ background:"#fff",padding:"22px 28px",borderBottom:"1px solid #E8EDF4",position:"sticky",top:0,zIndex:2 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <h2 style={{ margin:0,fontSize:"18px",fontWeight:800,color:"#0F172A" }}>{dealer.name}</h2>
              <p style={{ margin:"4px 0 0",fontSize:"13px",color:"#64748B" }}>
                {dealer.contact_person || "No contact person"} {dealer.phone ? `· ${dealer.phone}` : ""}
              </p>
            </div>
            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:"24px",cursor:"pointer",color:"#94A3B8",lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"flex",gap:"8px",marginTop:"14px",flexWrap:"wrap" }}>
            <Badge bg={dealer.is_active ? "#DCFCE7" : "#FEE2E2"} color={dealer.is_active ? "#166534" : "#991B1B"}>
              {dealer.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge bg="#EDE9FE" color="#5B21B6">{dealsInLabel(dealer.deals_in)}</Badge>
            {pendingTxns.length > 0 && <Badge bg="#FEF3C7" color="#92400E">{pendingTxns.length} pending</Badge>}
          </div>
          <div style={{ display:"flex",gap:"8px",marginTop:"14px" }}>
            <button onClick={() => setShowEdit(true)} style={{ padding:"7px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#374151",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>Edit Details</button>
            <button onClick={() => setShowLogTxn(true)} style={{ padding:"7px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:ACCENT,fontWeight:600,fontSize:"12px",cursor:"pointer" }}>+ Log Transaction</button>
            {dealer.is_active && (
              <button onClick={handleDeactivate} style={{ padding:"7px 16px",borderRadius:"8px",border:"1px solid #FECACA",background:"#fff",color:"#DC2626",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>Deactivate</button>
            )}
          </div>
        </div>

        <div style={{ padding:"22px 28px" }}>
          {/* Balance */}
          <div style={{ background:"#fff",borderRadius:"12px",padding:"20px 22px",border:`2px solid ${balance===0?"#E2E8F0":owedByUs?"#FED7AA":"#BBF7D0"}`,marginBottom:"20px" }}>
            <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>
              Current Balance
            </p>
            <p style={{ fontSize:"26px",fontWeight:800,margin:"0 0 4px",color: balance===0 ? "#0F172A" : owedByUs ? "#EA580C" : "#16A34A" }}>
              {fmt(Math.abs(balance))}
            </p>
            <p style={{ fontSize:"12px",color:"#64748B",margin:"0 0 14px" }}>
              {balance === 0 ? "Fully settled" : owedByUs ? "We owe this dealer" : "This dealer owes us"}
            </p>
            {balance !== 0 && (
              <button onClick={() => setShowSettleBalance(true)}
                style={{ padding:"8px 16px",borderRadius:"8px",border:"none",background:owedByUs?"#EA580C":"#16A34A",color:"#fff",fontWeight:700,fontSize:"12.5px",cursor:"pointer" }}>
                {owedByUs ? "Settle — Pay Dealer" : "Settle — Receive Payment"}
              </button>
            )}
          </div>

          {dealer.gst_number || dealer.email || dealer.address ? (
            <div style={{ background:"#fff",borderRadius:"12px",padding:"16px 20px",border:"1px solid #E8EDF4",marginBottom:"20px",fontSize:"13px",color:"#334155" }}>
              {dealer.gst_number && <div style={{ marginBottom:"6px" }}><strong>GST:</strong> {dealer.gst_number}</div>}
              {dealer.email && <div style={{ marginBottom:"6px" }}><strong>Email:</strong> {dealer.email}</div>}
              {dealer.address && <div><strong>Address:</strong> {dealer.address}</div>}
            </div>
          ) : null}

          {/* Pending transactions needing review */}
          {pendingTxns.length > 0 && (
            <div style={{ marginBottom:"24px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",flexWrap:"wrap",gap:"8px" }}>
                <h3 style={{ fontSize:"13px",fontWeight:700,color:"#92400E",margin:0 }}>⏳ Awaiting Your Review ({pendingTxns.length})</h3>
                <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                  {pendingTxns.length > 1 && (
                    <label style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"11.5px",color:"#64748B",cursor:"pointer" }}>
                      <input type="checkbox"
                        checked={selectedIds.length === pendingTxns.length}
                        onChange={e => setSelectedIds(e.target.checked ? pendingTxns.map(t => t.transaction_id) : [])} />
                      Select all
                    </label>
                  )}
                  {selectedIds.length > 0 && (
                    <button onClick={() => setShowBulkFinalize(true)}
                      style={{ padding:"7px 14px",borderRadius:"8px",border:"none",background:"#0F172A",color:"#fff",fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap" }}>
                      Settle Selected ({selectedIds.length})
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                {pendingTxns.map(t => (
                  <div key={t.transaction_id} style={{ background: selectedIds.includes(t.transaction_id) ? "#FEF3C7" : "#FFFBEB",border: selectedIds.includes(t.transaction_id) ? "1px solid #F59E0B" : "1px solid #FDE68A",borderRadius:"10px",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px" }}>
                    <div style={{ display:"flex",alignItems:"flex-start",gap:"10px" }}>
                      {pendingTxns.length > 1 && (
                        <input type="checkbox" style={{ marginTop:"3px" }}
                          checked={selectedIds.includes(t.transaction_id)}
                          onChange={() => toggleSelected(t.transaction_id)} />
                      )}
                      <div>
                        <div style={{ fontSize:"13px",fontWeight:700,color:"#0F172A" }}>
                          {TXN_TYPE_LABEL[t.transaction_type]} · {fmt(t.amount)}
                        </div>
                        <div style={{ fontSize:"11px",color:"#92400E",marginTop:"2px" }}>
                          {SOURCE_LABEL[t.source_model] || t.source_model}
                          {t.settlement_method ? ` · ${SETTLEMENT_LABEL[t.settlement_method]}` : ""}
                          {" · "}{new Date(t.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>
                    {selectedIds.length <= 1 && (
                      <div style={{ display:"flex", gap:"8px" }}>
                        <button onClick={() => handleQuickCancel(t)} disabled={cancellingId === t.transaction_id}
                          style={{ padding:"7px 12px",borderRadius:"8px",border:"1px solid #FCA5A5",background:"#fff",color:"#DC2626",fontWeight:700,fontSize:"12px",cursor: cancellingId === t.transaction_id ? "not-allowed" : "pointer",whiteSpace:"nowrap" }}>
                          {cancellingId === t.transaction_id ? "Cancelling…" : "Cancel"}
                        </button>
                        <button onClick={() => setFinalizeTarget(t)} style={{ padding:"7px 14px",borderRadius:"8px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap" }}>
                          Review
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full ledger */}
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",flexWrap:"wrap",gap:"8px" }}>
              <h3 style={{ fontSize:"13px",fontWeight:700,color:"#0F172A",margin:0 }}>Ledger History</h3>
              <div style={{ display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap" }}>
                {dueTxns.length > 1 && (
                  <label style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"11.5px",color:"#64748B",cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={duePayIds.length === dueTxns.length}
                      onChange={e => setDuePayIds(e.target.checked ? dueTxns.map(t => t.transaction_id) : [])} />
                    Select all due
                  </label>
                )}
                {duePayIds.length > 0 && (
                  <button onClick={() => setShowBulkPay(true)}
                    style={{ padding:"7px 14px",borderRadius:"8px",border:"none",background:"#16A34A",color:"#fff",fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap" }}>
                    Pay/Collect Selected ({duePayIds.length})
                  </button>
                )}
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...inp, width:"auto",padding:"5px 10px",fontSize:"12px" }}>
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {(() => {
              // A settlement leg is any PAYMENT/CASH_REFUND that points back
              // at another transaction via linked_transaction — whether the
              // backend auto-paired it (see AUTO_SETTLE_PAIRS) or a manager
              // manually logged it via "Pay Remaining"/"Collect Remaining"
              // or the bulk "Pay / Collect Due Items" flow. It's shown
              // nested under its parent instead of as its own raw row.
              // ✅ FIX: this used to only recognise the auto-paired case
              // (notes starting with "Auto-logged:"), so every manually
              // logged partial payment — the whole point of "Pay
              // Remaining" — showed up as its own top-level ledger row
              // instead of nesting under the purchase/return it settles,
              // flooding the ledger with what's really one event split
              // across several rows. `is_settled` (from the backend)
              // marks the parent as fully settled regardless.
              const isSettlementLeg = (t) =>
                !!t.linked_transaction && (t.transaction_type === "PAYMENT" || t.transaction_type === "CASH_REFUND");
              // A parent can now have MORE than one settlement leg (e.g.
              // two separate partial payments before it's paid off) —
              // collect all of them, not just the first, so a second
              // partial payment doesn't silently disappear instead of
              // nesting once every leg is correctly recognised above.
              const findChildren = (t) => txns.filter(o => o.linked_transaction === t.transaction_id && isSettlementLeg(o));
              const mainTxns = filteredTxns.filter(t => !isSettlementLeg(t));

              if (mainTxns.length === 0) {
                return (
                  <div style={{ textAlign:"center",padding:"40px",color:"#94A3B8",fontSize:"13px",background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4" }}>
                    No transactions yet.
                  </div>
                );
              }

              return (
              <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
                {mainTxns.map((t, i) => {
                  const children = findChildren(t);
                  // ✅ FIX: trust the backend's is_settled as-is instead of
                  // re-deriving "settled" from "does any confirmed child
                  // exist" — that used to mark a ₹150 purchase "✓ Settled"
                  // the moment a linked ₹100 partial payment was confirmed,
                  // hiding the ₹50 still owed. is_settled now checks the
                  // linked amount(s) actually cover the full amount.
                  const settled = t.is_settled;
                  const isDue = t.status === "CONFIRMED" && t.settlement_method === "CREDIT" && !settled &&
                    (t.transaction_type === "PURCHASE" || t.transaction_type === "CREDIT_NOTE");
                  const amountDue = Number(t.amount_due || 0);
                  const hasPartialPayment = amountDue > 0 && amountDue < Number(t.amount || 0);
                  return (
                  <div key={t.transaction_id} style={{ padding:"12px 16px",borderBottom: i < mainTxns.length-1 ? "1px solid #F1F5F9" : "none",display:"flex",alignItems:"flex-start",gap:"10px" }}>
                  {isDue && dueTxns.length > 1 && (
                    <input type="checkbox" style={{ marginTop:"14px" }}
                      checked={duePayIds.includes(t.transaction_id)}
                      onChange={() => toggleDueSelected(t.transaction_id)} />
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px" }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap" }}>
                        <span style={{ fontSize:"13px",fontWeight:700,color:TXN_TYPE_COLOR[t.transaction_type] }}>
                          {TXN_TYPE_LABEL[t.transaction_type]}
                        </span>
                        {settled ? (
                          <Badge bg="#DCFCE7" color="#166534">✓ Settled</Badge>
                        ) : (
                          <Badge
                            bg={t.status==="CONFIRMED"?"#DCFCE7":t.status==="REJECTED"?"#FEE2E2":"#FEF3C7"}
                            color={t.status==="CONFIRMED"?"#166534":t.status==="REJECTED"?"#991B1B":"#92400E"}>
                            {t.status}
                          </Badge>
                        )}
                        {t.is_overdue && <Badge bg="#FEE2E2" color="#991B1B">Overdue</Badge>}
                        {!t.is_overdue && t.due_date && t.status === "CONFIRMED" && !settled && (
                          <Badge bg="#FEF3C7" color="#92400E">Due {new Date(t.due_date).toLocaleDateString("en-IN")}</Badge>
                        )}
                      </div>
                      <div style={{ fontSize:"11px",color:"#94A3B8",marginTop:"3px" }}>
                        {SOURCE_LABEL[t.source_model] || t.source_model}
                        {t.settlement_method ? ` · ${SETTLEMENT_LABEL[t.settlement_method]}` : ""}
                        {t.reference_number ? ` · Ref: ${t.reference_number}` : ""}
                        {" · "}{new Date(t.created_at).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",whiteSpace:"nowrap" }}>
                      <div style={{ fontSize:"14px",fontWeight:800,color:"#0F172A" }}>{fmt(t.amount)}</div>
                      {hasPartialPayment && (
                        <div style={{ fontSize:"11px",color:"#D97706",fontWeight:700 }}>{fmt(amountDue)} due</div>
                      )}
                      {t.status === "CONFIRMED" && t.balance_after != null && (
                        <div style={{ fontSize:"11px",color:"#94A3B8" }}>bal: {fmt(t.balance_after)}</div>
                      )}
                      {isDue && duePayIds.length <= 1 && (
                        <button onClick={() => setPayTarget(hasPartialPayment ? { ...t, amount: amountDue } : t)}
                          style={{ marginTop:"6px",padding:"5px 12px",borderRadius:"7px",border:"none",background: t.transaction_type === "PURCHASE" ? "#16A34A" : ACCENT,color:"#fff",fontWeight:700,fontSize:"11.5px",cursor:"pointer",whiteSpace:"nowrap" }}>
                          {t.transaction_type === "PURCHASE"
                            ? (hasPartialPayment ? "Pay Remaining" : "Pay Now")
                            : (hasPartialPayment ? "Collect Remaining" : "Collect Refund")}
                        </button>
                      )}
                      {t.status === "CONFIRMED" && (
                        <button onClick={() => handleVoid(t)} disabled={voidingId === t.transaction_id}
                          title="Reverse this entry — e.g. a duplicate or stray manual entry"
                          style={{ display:"block",marginTop:"4px",marginLeft:"auto",padding:"2px 0",border:"none",background:"transparent",color:"#CBD5E1",fontWeight:600,fontSize:"10.5px",cursor: voidingId === t.transaction_id ? "not-allowed" : "pointer" }}>
                          {voidingId === t.transaction_id ? "Voiding…" : "Void"}
                        </button>
                      )}
                    </div>
                  </div>
                  {children.length > 0 && (
                    <div style={{ marginTop:"8px",paddingTop:"8px",borderTop:"1px dashed #F1F5F9" }}>
                      {children.map(c => {
                        const isAutoLogged = (c.notes || "").startsWith("Auto-logged:");
                        const label = c.status !== "CONFIRMED"
                          ? c.status.charAt(0) + c.status.slice(1).toLowerCase()
                          : isAutoLogged
                            ? "Auto-settled"
                            : (c.transaction_type === "CASH_REFUND" ? "Refund logged" : "Payment logged");
                        return (
                          <div key={c.transaction_id} style={{ display:"flex",justifyContent:"space-between",fontSize:"11px",color: c.status !== "CONFIRMED" ? "#94A3B8" : hasPartialPayment ? "#D97706" : "#16A34A", marginTop:"2px" }}>
                            <span>
                              ↳ {label}: {TXN_TYPE_LABEL[c.transaction_type]}
                              {c.reference_number ? ` · Ref: ${c.reference_number}` : ""}
                            </span>
                            <strong>{fmt(c.amount)}</strong>
                          </div>
                        );
                      })}
                      {hasPartialPayment && (
                        <div style={{ display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#D97706",fontWeight:700,marginTop:"4px" }}>
                          <span>Total paid so far</span>
                          <strong>{fmt(t.amount_paid)} of {fmt(t.amount)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                  </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      </div>

      {showEdit && (
        <Modal title="Edit Dealer" onClose={() => setShowEdit(false)}>
          <DealerForm
            initial={{
              name: dealer.name, contact_person: dealer.contact_person || "",
              phone: dealer.phone || "", email: dealer.email || "",
              address: dealer.address || "", gst_number: dealer.gst_number || "",
              deals_in: dealer.deals_in, opening_balance: String(dealer.opening_balance),
              notes: dealer.notes || "",
            }}
            onSubmit={handleEdit}
            onCancel={() => setShowEdit(false)}
            saving={saving}
            error={formError}
          />
        </Modal>
      )}

      {finalizeTarget && (
        <FinalizeModal txn={finalizeTarget} onClose={() => setFinalizeTarget(null)} onDone={handleFinalizeDone} />
      )}

      {showBulkFinalize && selectedIds.length > 0 && (
        <BulkFinalizeModal
          dealerId={dealerId}
          txns={pendingTxns.filter(t => selectedIds.includes(t.transaction_id))}
          onClose={() => setShowBulkFinalize(false)}
          onDone={handleBulkFinalizeDone}
        />
      )}

      {showBulkPay && duePayIds.length > 0 && (
        <BulkPayModal
          dealerId={dealerId}
          txns={dueTxns.filter(t => duePayIds.includes(t.transaction_id))}
          onClose={() => setShowBulkPay(false)}
          onDone={handleBulkPayDone}
        />
      )}

      {showLogTxn && (
        <LogTransactionModal
          dealerId={dealerId}
          dealerName={dealer.name}
          onClose={() => setShowLogTxn(false)}
          onDone={handleLogTxnDone}
        />
      )}

      {payTarget && (
        <LogTransactionModal
          dealerId={dealerId}
          dealerName={dealer.name}
          onClose={() => setPayTarget(null)}
          onDone={handlePayDone}
          initial={{
            transaction_type: payTarget.transaction_type === "CREDIT_NOTE" ? "CASH_REFUND" : "PAYMENT",
            amount: payTarget.amount,
            settlement_method: payTarget.transaction_type === "CREDIT_NOTE" ? "REFUND" : "PAID",
            reference_number: "",
            notes: `Settling ${TXN_TYPE_LABEL[payTarget.transaction_type]} #${payTarget.transaction_id}`,
            linked_transaction: payTarget.transaction_id,
            lockType: true,
            modalTitle: payTarget.transaction_type === "CREDIT_NOTE" ? "Collect Refund" : "Pay Dealer",
            submitLabel: payTarget.transaction_type === "CREDIT_NOTE" ? "Log Refund" : "Log Payment",
            banner: payTarget.transaction_type === "CREDIT_NOTE"
              ? `Recording cash the dealer refunds us for their ${fmt(payTarget.amount)} credit note (#${payTarget.transaction_id}). Adjust the amount below for a partial refund. This is created as Pending and still needs to be confirmed under "Awaiting Your Review".`
              : `Recording a payment against the ${fmt(payTarget.amount)} purchase${payTarget.due_date ? ` due ${new Date(payTarget.due_date).toLocaleDateString("en-IN")}` : ""} (#${payTarget.transaction_id}). Adjust the amount below for a partial payment. This is created as Pending and still needs to be confirmed under "Awaiting Your Review".`,
          }}
        />
      )}

      {showSettleBalance && (
        <LogTransactionModal
          dealerId={dealerId}
          dealerName={dealer.name}
          onClose={() => setShowSettleBalance(false)}
          onDone={handleSettleBalanceDone}
          initial={{
            // Overall net-balance settlement — not tied to any single
            // purchase/return row (unlike payTarget's "Pay Now"/"Collect
            // Refund", which settles one specific due item). This nets
            // against the dealer's whole running balance instead, e.g.
            // when several small items add up or an opening_balance/
            // adjustment is part of what's owed.
            transaction_type: owedByUs ? "PAYMENT" : "CASH_REFUND",
            amount: Math.abs(balance),
            settlement_method: owedByUs ? "PAID" : "REFUND",
            reference_number: "",
            notes: owedByUs ? "Settling outstanding balance" : "Collecting outstanding balance owed to us",
            lockType: true,
            modalTitle: owedByUs ? "Pay Dealer — Settle Balance" : "Receive Payment — Settle Balance",
            submitLabel: owedByUs ? "Log Payment" : "Log Receipt",
            banner: owedByUs
              ? `Recording a payment to settle the outstanding ${fmt(Math.abs(balance))} balance with this dealer. Adjust the amount below for a partial payment. This is created as Pending and still needs to be confirmed under "Awaiting Your Review".`
              : `Recording cash received to settle the ${fmt(Math.abs(balance))} this dealer owes us. Adjust the amount below for a partial receipt. This is created as Pending and still needs to be confirmed under "Awaiting Your Review".`,
          }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Root page — dealer list + stats
// ════════════════════════════════════════════════════════
export default function DealersPage() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [selectedDealer, setSelectedDealer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (activeFilter) params.active = activeFilter;
      const res = await getDealers(params);
      setDealers(Array.isArray(res) ? res : []);
    } catch { setError("Failed to load dealers."); }
    finally { setLoading(false); }
  }, [search, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await createDealer({ ...form, opening_balance: form.opening_balance === "" ? 0 : form.opening_balance });
      setShowAdd(false);
      load();
    } catch (e) {
      setFormError(e?.response?.data?.name?.[0] || e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to add dealer.");
    } finally { setSaving(false); }
  };

  const totalPayable = dealers.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const totalReceivable = dealers.reduce((s, d) => s + Math.max(0, -d.balance), 0);
  const totalPending = dealers.reduce((s, d) => s + (d.pending_count || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px",flexWrap:"wrap",gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px",fontWeight:800,color:"#0F172A",margin:0 }}>Dealers</h1>
          <p style={{ fontSize:"13px",color:"#64748B",margin:"4px 0 0" }}>Manage dealers, track purchases, and settle credit &amp; refunds</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding:"10px 18px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px" }}>
          + Add Dealer
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"14px",marginBottom:"20px" }}>
        <StatCard label="Total Dealers" value={dealers.length} />
        <StatCard label="We Owe (Payable)" value={fmt(totalPayable)} color="#EA580C" />
        <StatCard label="Owed To Us" value={fmt(totalReceivable)} color="#16A34A" />
        <StatCard label="Pending Review" value={totalPending} color={totalPending > 0 ? "#D97706" : "#0F172A"} />
      </div>

      {/* Filters */}
      <div style={{ display:"flex",gap:"10px",marginBottom:"18px",flexWrap:"wrap" }}>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search by name, contact, phone, or GST…"
          style={{ ...inp, maxWidth:"320px" }}
        />
        <select value={activeFilter} onChange={e=>setActiveFilter(e.target.value)} style={{ ...inp, width:"auto" }}>
          <option value="true">Active dealers</option>
          <option value="false">Inactive dealers</option>
          <option value="">All dealers</option>
        </select>
      </div>

      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading dealers…</div>
      ) : dealers.length === 0 ? (
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8",background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4" }}>
          No dealers yet. Click "+ Add Dealer" to get started.
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"14px" }}>
          {dealers.map(d => {
            const owedByUs = d.balance > 0;
            return (
              <div key={d.dealer_id} onClick={() => setSelectedDealer(d.dealer_id)}
                style={{ background:"#fff",borderRadius:"12px",padding:"16px 18px",border:"1px solid #E8EDF4",cursor:"pointer",transition:"box-shadow 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.name}</div>
                    <div style={{ fontSize:"12px",color:"#94A3B8",marginTop:"2px" }}>{d.contact_person || "No contact"}</div>
                  </div>
                  {d.pending_count > 0 && <Badge bg="#FEF3C7" color="#92400E">{d.pending_count} pending</Badge>}
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <Badge bg="#EDE9FE" color="#5B21B6">{dealsInLabel(d.deals_in)}</Badge>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"15px",fontWeight:800,color: d.balance===0 ? "#0F172A" : owedByUs ? "#EA580C" : "#16A34A" }}>
                      {fmt(Math.abs(d.balance))}
                    </div>
                    <div style={{ fontSize:"10px",color:"#94A3B8" }}>{d.balance===0 ? "settled" : owedByUs ? "we owe" : "they owe us"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Dealer" onClose={() => setShowAdd(false)}>
          <DealerForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}

      {selectedDealer && (
        <DealerDetail dealerId={selectedDealer} onClose={() => setSelectedDealer(null)} onChanged={load} />
      )}
    </div>
  );
}