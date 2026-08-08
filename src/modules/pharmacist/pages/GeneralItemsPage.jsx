// src/modules/pharmacist/pages/GeneralItemsPage.jsx
// Catalog + stock management for non-medicine retail items sold through the
// pharmacy (diapers, tissues, chocolates, soap, shampoo, toothpaste, etc.)
// Mirrors MedicinesPage.jsx's structure, trimmed of anything medicine-only
// (route, dosage form, strength, prescription linkage).

import { useEffect, useState, useCallback, useRef } from "react";
import { flattenFormError } from "../../../utils/formErrors";
import {
  getGeneralItems, createGeneralItem, updateGeneralItem,
  getGeneralItemBatches, createGeneralItemBatch, returnGeneralItemToProvider,
  getDealers,
} from "../api/pharmacistApi";

const RETURN_REASONS = [
  { key: "EXPIRED",   label: "Expired" },
  { key: "DAMAGED",   label: "Damaged" },
  { key: "DEFECTIVE", label: "Defective" },
  { key: "RECALL",    label: "Recall" },
  { key: "EXCESS",    label: "Excess / Over-ordered" },
  { key: "OTHER",     label: "Other" },
];

const G = "#0EA5E9";
const INP = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#1E293B", outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
const LBL = { fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 };

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  box:     "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  plus:    "M12 5v14 M5 12h14",
  edit:    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  x:       "M18 6 6 18 M6 6l12 12",
  chevron: "M6 9l6 6 6-6",
  stock:   "M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4Z",
  undo:    "M3 7v6h6 M21 17a9 9 0 0 0-15-6.7L3 13",
};

// Must match GeneralItemCategoryChoices in pharmacist/models.py
const CATEGORY_OPTS = [
  { value: "BABY_CARE",     label: "Baby Care" },
  { value: "PERSONAL_CARE", label: "Personal Care & Toiletries" },
  { value: "FOOD_BEVERAGE", label: "Food & Beverages" },
  { value: "HOUSEHOLD",     label: "Household & Cleaning" },
  { value: "STATIONERY",    label: "Stationery & Sundries" },
  { value: "OTHER",         label: "Other" },
];
const CATEGORY_COLORS = {
  BABY_CARE:     { bg: "#FDF2F8", color: "#BE185D" },
  PERSONAL_CARE: { bg: "#EFF6FF", color: "#1D4ED8" },
  FOOD_BEVERAGE: { bg: "#FFF7ED", color: "#C2410C" },
  HOUSEHOLD:     { bg: "#F0FDF4", color: "#15803D" },
  STATIONERY:    { bg: "#F5F3FF", color: "#6D28D9" },
  OTHER:         { bg: "#F1F5F9", color: "#64748B" },
};

function Toast({ msg, ok }) {
  if (!msg) return null;
  return <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: ok ? "#F0FDF4" : "#FEF2F2", color: ok ? "#166534" : "#B91C1C", border: `1px solid ${ok ? "#BBF7D0" : "#FECACA"}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>{msg}</div>;
}

function ItemModal({ item, onSave, onClose }) {
  const isEdit = !!item?.item_id;
  const [form, setForm] = useState({
    name:        item?.name        || "",
    brand:       item?.brand       || "",
    category:    item?.category    || "OTHER",
    unit:        item?.unit        || "",
    description: item?.description || "",
    is_active:   item?.is_active   ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("Item name is required."); return; }
    setSaving(true); setErr("");
    try {
      if (isEdit) await updateGeneralItem(item.item_id, form);
      else await createGeneralItem(form);
      onSave();
    } catch (e) { setErr(flattenFormError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "26px 28px", width: 460, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>{isEdit ? "Edit Item" : "Add General Item"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d={ICONS.x} size={16} color="#94A3B8" /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Item name <span style={{ color: "#EF4444" }}>*</span></label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="e.g. Pampers Diapers (Medium)" style={INP} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Brand</label>
            <input value={form.brand} onChange={e => set("brand", e.target.value)}
              placeholder="e.g. Pampers, Dove…" style={INP} />
          </div>
          <div>
            <label style={LBL}>Unit</label>
            <input value={form.unit} onChange={e => set("unit", e.target.value)}
              placeholder="e.g. pack, piece, bottle" style={INP} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ ...LBL, marginBottom: 8 }}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORY_OPTS.map(o => {
              const active = form.category === o.value;
              const c = CATEGORY_COLORS[o.value] || CATEGORY_COLORS.OTHER;
              return (
                <button key={o.value} type="button" onClick={() => set("category", o.value)}
                  style={{
                    padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: active ? `2px solid ${G}` : "1.5px solid #E5E7EB",
                    background: active ? c.bg : "#F8FAFC",
                    color: active ? c.color : "#475569",
                  }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Description</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
            style={{ ...INP, resize: "vertical", height: 60, fontFamily: "inherit" }} placeholder="Optional notes…" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set("is_active", e.target.checked)}
            style={{ width: 15, height: 15, cursor: "pointer" }} />
          <label htmlFor="is_active" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>Active (available for billing)</label>
        </div>

        {err && <p style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", padding: "8px 12px", borderRadius: 7, margin: "0 0 14px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: saving ? "#BAE6FD" : G, color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    batch_number: "", quantity: "", cost_price: "", mrp: "",
    gst_percentage: "0", expiry_date: "", low_stock_threshold: "10",
    dealer_id: "",
  });
  const [dealers, setDealers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    getDealers().then(list => { if (!cancelled) setDealers(list || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!form.batch_number.trim()) { setErr("Batch number is required."); return; }
    if (form.quantity === "" || form.cost_price === "" || form.mrp === "") {
      setErr("Quantity, cost price, and MRP are required."); return;
    }
    setSaving(true); setErr("");
    try {
      await createGeneralItemBatch({
        general_item_id: item.item_id,
        batch_number: form.batch_number.trim(),
        quantity: parseInt(form.quantity, 10),
        cost_price: parseFloat(form.cost_price),
        mrp: parseFloat(form.mrp),
        gst_percentage: parseFloat(form.gst_percentage || 0),
        expiry_date: form.expiry_date || null,
        low_stock_threshold: parseInt(form.low_stock_threshold || 10, 10),
        ...(form.dealer_id ? { dealer_id: parseInt(form.dealer_id, 10) } : {}),
      });
      onSave();
    } catch (e) { setErr(flattenFormError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "26px 28px", width: 440, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Add Stock</h2>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>{item.name}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d={ICONS.x} size={16} color="#94A3B8" /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Batch number <span style={{ color: "#EF4444" }}>*</span></label>
          <input value={form.batch_number} onChange={e => set("batch_number", e.target.value)} placeholder="e.g. GI-2026-001" style={INP} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Quantity <span style={{ color: "#EF4444" }}>*</span></label>
            <input type="number" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>GST %</label>
            <input type="number" min="0" step="0.01" value={form.gst_percentage} onChange={e => set("gst_percentage", e.target.value)} style={INP} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Cost price (₹) <span style={{ color: "#EF4444" }}>*</span></label>
            <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => set("cost_price", e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>MRP (₹) <span style={{ color: "#EF4444" }}>*</span></label>
            <input type="number" min="0" step="0.01" value={form.mrp} onChange={e => set("mrp", e.target.value)} style={INP} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Expiry date <span style={{ fontWeight: 400, textTransform: "none", color: "#94A3B8" }}>(optional)</span></label>
            <input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} style={INP} />
          </div>
          <div>
            <label style={LBL}>Low stock alert at</label>
            <input type="number" min="0" value={form.low_stock_threshold} onChange={e => set("low_stock_threshold", e.target.value)} style={INP} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={LBL}>Dealer <span style={{ fontWeight: 400, textTransform: "none", color: "#94A3B8" }}>(optional — links this purchase to the Dealers ledger)</span></label>
          <select value={form.dealer_id} onChange={e => set("dealer_id", e.target.value)} style={{ ...INP, cursor: "pointer" }}>
            <option value="">No dealer — plain stock entry</option>
            {dealers.map(d => (
              <option key={d.dealer_id} value={d.dealer_id}>{d.name}</option>
            ))}
          </select>
          {form.dealer_id && (
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "6px 0 0" }}>
              This purchase will be sent to the Manager's Dealers page for review.
            </p>
          )}
        </div>

        {err && <p style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", padding: "8px 12px", borderRadius: 7, margin: "0 0 14px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: saving ? "#BAE6FD" : G, color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : "Add stock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnModal({ item, batch, onSave, onClose }) {
  const [form, setForm] = useState({
    quantity_returned: "", reason: "", reason_details: "",
    reference_number: "", settlement_method: "", dealer_id: "",
  });
  const [dealers, setDealers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // If the batch was itself bought from a known dealer, default the return
  // to go back to that same dealer (still fully editable/optional).
  useEffect(() => {
    let cancelled = false;
    getDealers().then(list => { if (!cancelled) setDealers(list || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (batch?.dealer) set("dealer_id", String(batch.dealer));
  }, [batch]);

  const handleSave = async () => {
    const qty = parseInt(form.quantity_returned, 10);
    if (!qty || qty < 1) { setErr("Enter a valid quantity."); return; }
    if (qty > (batch.quantity ?? 0)) { setErr(`Only ${batch.quantity} unit(s) remain in this batch.`); return; }
    if (!form.reason) { setErr("Select a reason."); return; }
    setSaving(true); setErr("");
    try {
      await returnGeneralItemToProvider(batch.batch_id, {
        quantity_returned: qty,
        reason: form.reason,
        reason_details: form.reason_details || undefined,
        reference_number: form.reference_number || undefined,
        settlement_method: form.settlement_method || undefined,
        ...(form.dealer_id ? { dealer_id: parseInt(form.dealer_id, 10) } : {}),
      });
      onSave();
    } catch (e) { setErr(flattenFormError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "26px 28px", width: 460, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Return to Provider</h2>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>{item.name} · Batch {batch.batch_number}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><Ico d={ICONS.x} size={16} color="#94A3B8" /></button>
        </div>

        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: "#64748B" }}>
          Dealer <strong style={{ color: "#0F172A" }}>{batch.dealer_name || "— (not set on this batch)"}</strong>
          {" · "}Remaining <strong style={{ color: "#0F172A" }}>{batch.quantity}</strong>
          {" · "}Cost price <strong style={{ color: "#0F172A" }}>₹{parseFloat(batch.cost_price || 0).toFixed(2)}</strong>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Quantity to return <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="number" min="1" max={batch.quantity} value={form.quantity_returned}
            onChange={e => set("quantity_returned", e.target.value)} style={INP} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
          <select value={form.reason} onChange={e => set("reason", e.target.value)} style={{ ...INP, cursor: "pointer" }}>
            <option value="">Select reason</option>
            {RETURN_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Reason details</label>
          <textarea value={form.reason_details} onChange={e => set("reason_details", e.target.value)} rows={2}
            style={{ ...INP, resize: "vertical", height: 56, fontFamily: "inherit" }}
            placeholder="e.g. Batch found leaking on inspection" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Settlement</label>
            <select value={form.settlement_method} onChange={e => set("settlement_method", e.target.value)} style={{ ...INP, cursor: "pointer" }}>
              <option value="">— optional —</option>
              <option value="CREDIT">Credit (carried forward)</option>
              <option value="REFUND">Cash refund</option>
              <option value="EXCHANGE">Exchange</option>
            </select>
          </div>
          <div>
            <label style={LBL}>Credit note / RMA no.</label>
            <input value={form.reference_number} onChange={e => set("reference_number", e.target.value)} style={INP} placeholder="Optional" />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Dealer <span style={{ fontWeight: 400, textTransform: "none", color: "#94A3B8" }}>(optional — who this is going back to)</span></label>
          <select value={form.dealer_id} onChange={e => set("dealer_id", e.target.value)} style={{ ...INP, cursor: "pointer" }}>
            <option value="">No dealer — plain return</option>
            {dealers.map(d => (
              <option key={d.dealer_id} value={d.dealer_id}>{d.name}</option>
            ))}
          </select>
          {form.dealer_id && (
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "6px 0 0" }}>
              This return will be sent to the Manager's Dealers page for review.
            </p>
          )}
        </div>

        {err && <p style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", padding: "8px 12px", borderRadius: 7, margin: "0 0 14px" }}>{err}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: saving ? "#FCA5A5" : "#EF4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Returning…" : "Confirm return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ NEW: full status badge — handles PENDING_APPROVAL and REJECTED
// statuses added in pharmacist/migrations/0002.
function GeneralBatchStatusBadge({ status }) {
  const MAP = {
    ACTIVE:           { bg: "#F0FDF4", color: "#15803D", label: "Active" },
    DEPLETED:         { bg: "#F3E8FF", color: "#7C3AED", label: "Depleted" },
    EXPIRED:          { bg: "#FEF2F2", color: "#B91C1C", label: "Expired" },
    PENDING_APPROVAL: { bg: "#FFFBEB", color: "#B45309", label: "⏳ Pending Approval" },
    REJECTED:         { bg: "#FEF2F2", color: "#B91C1C", label: "✕ Rejected" },
  };
  const s = MAP[status] || { bg: "#F1F5F9", color: "#64748B", label: status };
  return (
    <span style={{ padding: "2px 7px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function BatchesPanel({ item, batches, onReturn }) {
  const active = batches.filter(b => b.general_item === item.item_id);
  const today = new Date().toISOString().split("T")[0];
  const cols = "1.3fr 55px 65px 70px 75px 70px 70px";

  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden", marginTop: 8 }}>
      {active.length === 0 ? (
        <p style={{ padding: "12px 14px", fontSize: 12, color: "#94A3B8", margin: 0 }}>No active batches.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "6px 14px", background: "#F1F5F9", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span>Batch</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>MRP</span><span style={{ textAlign: "right" }}>GST</span><span style={{ textAlign: "center" }}>Expiry</span><span style={{ textAlign: "center" }}>Status</span><span style={{ textAlign: "right" }}>Action</span>
          </div>
          {active.map(b => {
            const expired = b.expiry_date && b.expiry_date < today;
            const nearExpiry = !expired && b.expiry_date && new Date(b.expiry_date) <= new Date(Date.now() + 30 * 86400000);
            return (
              <div key={b.batch_id} style={{ display: "grid", gridTemplateColumns: cols, padding: "9px 14px", borderTop: "1px solid #F1F5F9", fontSize: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace" }}>{b.batch_number}</span>
                <span style={{ textAlign: "center", color: b.quantity === 0 ? "#EF4444" : "#475569", fontWeight: b.quantity === 0 ? 700 : 400 }}>{b.quantity}</span>
                <span style={{ textAlign: "right", color: "#475569" }}>₹{parseFloat(b.mrp || 0).toFixed(2)}</span>
                <span style={{ textAlign: "right", color: "#94A3B8" }}>{parseFloat(b.gst_percentage || 0).toFixed(0)}%</span>
                <span style={{ textAlign: "center", color: expired ? "#B91C1C" : nearExpiry ? "#C2410C" : "#64748B", fontWeight: expired || nearExpiry ? 700 : 400, fontSize: 11 }}>
                  {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("en-IN") : "—"}
                </span>
                <div style={{ textAlign: "center" }}>
                  <GeneralBatchStatusBadge status={b.status} />
                </div>
                <div style={{ textAlign: "right" }}>
                  {b.quantity > 0 && (
                    <button onClick={() => onReturn(item, b)} title="Return to provider/dealer"
                      style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#B91C1C", fontWeight: 600, fontSize: 10.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Ico d={ICONS.undo} size={11} color="#B91C1C" /> Return
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function ItemRow({ item, batches, onEdit, onAddStock, onReturn }) {
  const [expanded, setExpanded] = useState(false);
  const activeBatchCount = batches.filter(b => b.general_item === item.item_id && b.status === "ACTIVE").length;
  const catClr = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER;
  const catLabel = CATEGORY_OPTS.find(c => c.value === item.category)?.label ?? item.category ?? "—";

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.9fr 70px 70px 70px 100px", padding: "12px 20px", alignItems: "center", fontSize: 13, cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

        <div>
          <p style={{ fontWeight: 600, color: "#0F172A", margin: 0 }}>{item.name}</p>
          {item.brand && <p style={{ fontSize: 11, color: "#94A3B8", margin: "1px 0 0" }}>{item.brand}</p>}
        </div>

        <span>
          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: catClr.bg, color: catClr.color }}>
            {catLabel}
          </span>
        </span>

        <span style={{ fontSize: 12, color: "#475569" }}>{item.unit || "—"}</span>

        <span style={{ textAlign: "center", color: item.total_stock === 0 ? "#B91C1C" : item.total_stock <= 10 ? "#C2410C" : "#15803D", fontWeight: 700 }}>{item.total_stock ?? 0}</span>

        <span style={{ textAlign: "center", color: "#64748B" }}>{activeBatchCount}</span>

        <div>
          <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: item.is_active ? "#F0FDF4" : "#F1F5F9", color: item.is_active ? "#15803D" : "#64748B" }}>{item.is_active ? "Active" : "Inactive"}</span>
        </div>

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={e => { e.stopPropagation(); onAddStock(item); }}
            title="Add stock"
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ICONS.stock} size={13} color="#64748B" />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(item); }}
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ico d={ICONS.edit} size={13} color="#64748B" />
          </button>
          <button onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Ico d={ICONS.chevron} size={13} color="#64748B" />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 14px" }}>
          <BatchesPanel item={item} batches={batches} onReturn={onReturn} />
        </div>
      )}
    </div>
  );
}

export default function GeneralItemsPage() {
  const [items,    setItems]    = useState([]);
  const [batches,  setBatches]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category,        setCategory]        = useState("");
  const [inStock,         setInStock]         = useState(false);
  const [modal,           setModal]           = useState(null);   // "add" | item object
  const [batchModalFor,   setBatchModalFor]   = useState(null);   // item object
  const [returnModalFor,  setReturnModalFor]  = useState(null);   // { item, batch }
  const [toast,           setToast]           = useState(null);
  const debounceTimer = useRef(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      const [itemData, batchData] = await Promise.all([
        getGeneralItems({ ...params, show_inactive: true }),
        // ✅ FIX: also fetch PENDING_APPROVAL batches so the pharmacist
        // can see dealer-linked stock awaiting manager sign-off. REJECTED
        // batches are excluded — they've been zeroed out and returned.
        getGeneralItemBatches({ status: "ACTIVE,PENDING_APPROVAL" }),
      ]);
      let itemList = Array.isArray(itemData) ? itemData : (itemData?.results ?? []);
      if (inStock) itemList = itemList.filter(i => (i.total_stock ?? 0) > 0);
      setItems(itemList);
      setBatches(Array.isArray(batchData) ? batchData : (batchData?.results ?? []));
    } catch (e) { showToast(flattenFormError(e), false); }
    finally { setLoading(false); }
  }, [debouncedSearch, category, inStock]);

  useEffect(() => { load(); }, [load]);

  const totalStock = items.reduce((s, i) => s + (i.total_stock ?? 0), 0);
  const COL = { fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 1200 }}>
      <Toast {...(toast || {})} msg={toast?.msg} />
      {modal && (
        <ItemModal
          item={modal === "add" ? null : modal}
          onSave={() => { setModal(null); showToast(modal === "add" ? "Item added." : "Item updated."); load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {batchModalFor && (
        <BatchModal
          item={batchModalFor}
          onSave={() => { setBatchModalFor(null); showToast("Stock added."); load(); }}
          onClose={() => setBatchModalFor(null)}
        />
      )}
      {returnModalFor && (
        <ReturnModal
          item={returnModalFor.item}
          batch={returnModalFor.batch}
          onSave={() => { setReturnModalFor(null); showToast("Stock returned to provider."); load(); }}
          onClose={() => setReturnModalFor(null)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>General Items</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "4px 0 0" }}>
            {loading ? "Loading…" : `${items.length} items · ${totalStock} units total`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setModal("add")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: G, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Ico d={ICONS.plus} size={14} color="#fff" /> Add item
          </button>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B" }}>
            <Ico d={ICONS.refresh} size={14} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Ico d={ICONS.search} size={13} color="#94A3B8" />
          </span>
          <input placeholder="Search items…" value={search} onChange={handleSearchChange}
            style={{ ...INP, paddingLeft: 32 }} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...INP, width: 190 }}>
          <option value="">All categories</option>
          {CATEGORY_OPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} style={{ cursor: "pointer" }} />
          In stock only
        </label>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.9fr 70px 70px 70px 100px", padding: "9px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", gap: 8 }}>
          <span style={COL}>Item</span>
          <span style={COL}>Category</span>
          <span style={COL}>Unit</span>
          <span style={{ ...COL, textAlign: "center" }}>Stock</span>
          <span style={{ ...COL, textAlign: "center" }}>Batches</span>
          <span style={COL}>Status</span>
          <span style={{ ...COL, textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: "52px", textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${G}20`, borderTop: `3px solid ${G}`, animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: "#94A3B8" }}>Loading items…</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${G}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Ico d={ICONS.box} size={22} color={G} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#64748B", margin: 0 }}>
              {search || category ? "No items match your filters." : "No general items yet. Add your first item (e.g. diapers, soap, shampoo)."}
            </p>
          </div>
        ) : (
          items.map(item => (
            <ItemRow key={item.item_id} item={item} batches={batches} onEdit={setModal} onAddStock={setBatchModalFor} onReturn={(it, b) => setReturnModalFor({ item: it, batch: b })} />
          ))
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}