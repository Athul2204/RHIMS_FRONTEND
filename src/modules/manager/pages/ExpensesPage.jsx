// src/modules/manager/pages/ExpensesPage.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getExpenses, createExpense, patchExpense, deleteExpense,
  getPurchasesAndRefunds, getSalaryRecords, getFinanceDashboard,
} from "../api/managerApi";
import ExportButtons from "../../../components/shared/ExportButtons";

const ACCENT = "#6366F1";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const CATEGORIES = ["Salary", "Utilities", "Equipment", "Supplies", "Maintenance", "Rent", "Other"];

const CAT_STYLE = {
  "Salary":      { bg: "#EDE9FE", text: "#5B21B6", icon: "👥" },
  "Utilities":   { bg: "#DBEAFE", text: "#1E40AF", icon: "⚡" },
  "Equipment":   { bg: "#FFF7ED", text: "#EA580C", icon: "🔧" },
  "Supplies":    { bg: "#F0FDF4", text: "#16A34A", icon: "📦" },
  "Maintenance": { bg: "#FEF3C7", text: "#92400E", icon: "🏗️" },
  "Rent":        { bg: "#FCE7F3", text: "#9D174D", icon: "🏢" },
  "Other":       { bg: "#F1F5F9", text: "#475569", icon: "📋" },
};

// ── Shared Modal ─────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"500px",maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.22)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"18px 24px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
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

// ── Expense form (unchanged from original) ───────────────────
const EMPTY = { title:"", category:"Utilities", amount:"", date:new Date().toISOString().split("T")[0], description:"", receipt_number:"" };

function ExpenseForm({ initial, onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}
      <div style={{ marginBottom:"14px" }}>
        <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Title <span style={{ color:"#EF4444" }}>*</span></label>
        <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Electricity Bill - June" style={inp} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Category <span style={{ color:"#EF4444" }}>*</span></label>
          <select value={form.category} onChange={e=>set("category",e.target.value)} style={inp}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}{(c === "Salary" || c === "Supplies") ? " *" : ""}
              </option>
            ))}
          </select>
          {(form.category === "Salary" || form.category === "Supplies") && (
            <p style={{ fontSize:"11px",color:"#64748B",margin:"4px 0 0",lineHeight:"1.4" }}>
              Auto-tracked below — only use this category for a one-off manual entry.
            </p>
          )}
        </div>
        <div>
          <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Amount (₹) <span style={{ color:"#EF4444" }}>*</span></label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0.00" style={inp} />
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Date <span style={{ color:"#EF4444" }}>*</span></label>
          <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Receipt No.</label>
          <input value={form.receipt_number} onChange={e=>set("receipt_number",e.target.value)} placeholder="Optional" style={inp} />
        </div>
      </div>
      <div style={{ marginBottom:"20px" }}>
        <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Description</label>
        <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Additional details…" style={{ ...inp, resize:"vertical" }} />
      </div>
      <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
        <button onClick={onCancel} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
        <button onClick={() => onSubmit(form)} disabled={saving || !form.title || !form.amount}
          style={{ padding:"9px 20px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:(saving||!form.title||!form.amount)?0.6:1 }}>
          {saving ? "Saving…" : "Save Expense"}
        </button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// Tab 1: Manual Expenses (existing behavior)
// ════════════════════════════════════════════════════════
function ManualExpensesTab() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [expenses, setExpenses]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [start, setStart]           = useState(firstOfMonth.toISOString().split("T")[0]);
  const [end, setEnd]               = useState(today.toISOString().split("T")[0]);
  const [catFilter, setCatFilter]   = useState("");
  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { start, end };
      if (catFilter) params.category = catFilter;
      const res = await getExpenses(params);
      setExpenses(res?.expenses || []);
    } catch { setError("Failed to load expenses."); }
    finally { setLoading(false); }
  }, [start, end, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await createExpense(form);
      setShowAdd(false);
      load();
    } catch(e) {
      setFormError(e?.response?.data?.title || e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to add expense.");
    } finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await patchExpense(editTarget.expense_id, form);
      setEditTarget(null);
      load();
    } catch(e) {
      setFormError(e?.response?.data?.error || "Failed to update.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      setDeleteConfirm(null);
      load();
    } catch { alert("Failed to delete expense."); }
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCat = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0),
    count: expenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0);

  return (
    <div>
      {/* Filters */}
      <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",padding:"14px 18px",marginBottom:"20px" }}>
        <div style={{ display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"flex-end" }}>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>From</label>
            <input type="date" value={start} onChange={e=>setStart(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>To</label>
            <input type="date" value={end} onChange={e=>setEnd(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Category</label>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={load} style={{ padding:"8px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>↻ Refresh</button>
          <ExportButtons
            rows={expenses}
            columns={[
              { header: "Date", accessor: "date" },
              { header: "Category", accessor: "category" },
              { header: "Description", accessor: "description" },
              { header: "Amount", accessor: e => Number(e.amount || 0) },
            ]}
            filename={`manual_expenses_${start}_to_${end}`}
            title="Manual Expenses"
            dateRange={{ from: start, to: end }}
          />
          <button onClick={() => { setShowAdd(true); setFormError(null); }}
            style={{ padding:"8px 16px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",marginLeft:"auto" }}>
            + Add Expense
          </button>
        </div>
      </div>

      {/* Total + breakdown */}
      <div style={{ display:"grid",gridTemplateColumns:"auto 1fr",gap:"14px",marginBottom:"20px" }}>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"20px 24px",border:"1px solid #E8EDF4",minWidth:"200px" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Total Expenses</p>
          <p style={{ fontSize:"26px",fontWeight:800,color:"#EF4444",margin:"0 0 4px" }}>{fmt(total)}</p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{expenses.length} records</p>
        </div>
        {byCat.length > 0 && (
          <div style={{ background:"#fff",borderRadius:"12px",padding:"16px 20px",border:"1px solid #E8EDF4" }}>
            <p style={{ fontSize:"12px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>By Category</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"10px" }}>
              {byCat.map(c => {
                const s = CAT_STYLE[c.cat] || CAT_STYLE["Other"];
                const pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : 0;
                return (
                  <div key={c.cat} style={{ padding:"8px 14px",borderRadius:"10px",background:s.bg,border:`1px solid ${s.text}22` }}>
                    <p style={{ fontSize:"11px",fontWeight:700,color:s.text,margin:"0 0 3px" }}>{s.icon} {c.cat}</p>
                    <p style={{ fontSize:"13px",fontWeight:800,color:s.text,margin:0 }}>{fmt(c.total)}</p>
                    <p style={{ fontSize:"10px",color:s.text,opacity:0.7,margin:"2px 0 0" }}>{pct}% · {c.count} records</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading expenses…</div>
      ) : expenses.length === 0 ? (
        <div style={{ background:"#fff",borderRadius:"12px",padding:"48px",textAlign:"center",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"14px",color:"#94A3B8",margin:0 }}>No expenses recorded for this period.</p>
          <p style={{ fontSize:"12px",color:"#CBD5E1",margin:"6px 0 0" }}>Click "+ Add Expense" to record one.</p>
        </div>
      ) : (
        <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12.5px" }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Date","Category","Title","Receipt No.","Amount","Description","Added By",""].map(h => (
                    <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#475569",borderBottom:"1px solid #E8EDF4",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => {
                  const s = CAT_STYLE[e.category] || CAT_STYLE["Other"];
                  return (
                    <tr key={e.expense_id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"10px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{e.date}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{ padding:"2px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:s.bg,color:s.text }}>{s.icon} {e.category}</span>
                      </td>
                      <td style={{ padding:"10px 14px",fontWeight:600,color:"#0F172A" }}>{e.title}</td>
                      <td style={{ padding:"10px 14px",color:"#94A3B8",fontFamily:"monospace",fontSize:"12px" }}>{e.receipt_number || "—"}</td>
                      <td style={{ padding:"10px 14px",fontWeight:800,color:"#DC2626",fontSize:"13px" }}>{fmt(e.amount)}</td>
                      <td style={{ padding:"10px 14px",color:"#64748B",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.description || "—"}</td>
                      <td style={{ padding:"10px 14px",color:"#94A3B8",fontSize:"12px" }}>{e.added_by_name || "—"}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex",gap:"6px" }}>
                          <button onClick={() => { setEditTarget(e); setFormError(null); }}
                            style={{ padding:"4px 10px",borderRadius:"6px",border:`1px solid ${ACCENT}`,background:"none",color:ACCENT,fontWeight:600,fontSize:"11px",cursor:"pointer" }}>
                            Edit
                          </button>
                          <button onClick={() => setDeleteConfirm(e.expense_id)}
                            style={{ padding:"4px 10px",borderRadius:"6px",border:"1px solid #FECACA",background:"none",color:"#EF4444",fontWeight:600,fontSize:"11px",cursor:"pointer" }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:"#F8FAFC" }}>
                  <td colSpan={4} style={{ padding:"12px 14px",fontWeight:700,color:"#0F172A",fontSize:"13px" }}>Total</td>
                  <td style={{ padding:"12px 14px",fontWeight:800,color:"#DC2626",fontSize:"14px" }}>{fmt(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Expense" onClose={() => setShowAdd(false)}>
          <ExpenseForm initial={EMPTY} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Edit Expense" onClose={() => setEditTarget(null)}>
          <ExpenseForm
            initial={{ title:editTarget.title, category:editTarget.category, amount:editTarget.amount, date:editTarget.date, description:editTarget.description||"", receipt_number:editTarget.receipt_number||"" }}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
            saving={saving}
            error={formError}
          />
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Expense" onClose={() => setDeleteConfirm(null)}>
          <p style={{ fontSize:"14px",color:"#374151",marginBottom:"20px" }}>Are you sure you want to delete this expense? This cannot be undone.</p>
          <div style={{ display:"flex",justifyContent:"flex-end",gap:"10px" }}>
            <button onClick={() => setDeleteConfirm(null)} style={{ padding:"9px 20px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"13px",cursor:"pointer" }}>Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)}
              style={{ padding:"9px 20px",borderRadius:"9px",border:"none",background:"#EF4444",color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer" }}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 2: Purchases & Refunds (new, read-only)
// ════════════════════════════════════════════════════════
const TYPE_STYLE = {
  "medicine": { bg:"#EDE9FE", text:"#5B21B6", icon:"💊", label:"Medicine" },
  "supply":   { bg:"#F0FDF4", text:"#16A34A", icon:"📦", label:"Supply" },
};

function PurchasesTab() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [start, setStart]   = useState(firstOfMonth.toISOString().split("T")[0]);
  const [end, setEnd]       = useState(today.toISOString().split("T")[0]);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { start, end };
      if (typeFilter) params.type = typeFilter;
      const res = await getPurchasesAndRefunds(params);
      setData(res);
    } catch { setError("Failed to load purchases & refunds."); }
    finally { setLoading(false); }
  }, [start, end, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const purchases = data?.purchases || [];
  const refunds   = data?.refunds   || [];
  const totalPurchases = purchases.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalRefunds   = refunds.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div>
      {/* Read-only caption */}
      <div style={{ background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:"10px",padding:"10px 16px",marginBottom:"18px",display:"flex",alignItems:"center",gap:"10px" }}>
        <span style={{ fontSize:"16px" }}>ℹ️</span>
        <p style={{ fontSize:"12px",color:"#64748B",margin:0 }}>
          Purchases and returns are recorded in the <strong>Pharmacist module</strong> — shown here for financial visibility only.
        </p>
      </div>

      {/* Filters */}
      <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",padding:"14px 18px",marginBottom:"20px" }}>
        <div style={{ display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"flex-end" }}>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>From</label>
            <input type="date" value={start} onChange={e=>setStart(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>To</label>
            <input type="date" value={end} onChange={e=>setEnd(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Type</label>
            <div style={{ display:"flex",gap:"4px" }}>
              {[["","All"],["medicine","💊 Medicine"],["supply","📦 Supply"]].map(([v,l]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  style={{ padding:"7px 12px",borderRadius:"8px",fontSize:"12px",fontWeight:600,border:typeFilter===v?"none":"1px solid #E8EDF4",background:typeFilter===v?ACCENT:"#fff",color:typeFilter===v?"#fff":"#64748B",cursor:"pointer" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={load} style={{ padding:"8px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"14px",marginBottom:"20px" }}>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"2px solid #FECACA" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Total Purchases</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:"#EF4444",margin:"0 0 4px" }}>{fmt(totalPurchases)}</p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{purchases.length} records</p>
        </div>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"2px solid #99F6E4" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Total Refunds</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:"#0D9488",margin:"0 0 4px" }}>{fmt(totalRefunds)}</p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{refunds.length} records</p>
        </div>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Net Outflow</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:totalPurchases-totalRefunds>=0?"#EF4444":"#0D9488",margin:"0 0 4px" }}>
            {fmt(Math.abs(totalPurchases - totalRefunds))}
          </p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>purchases − refunds</p>
        </div>
      </div>

      {/* Medicine approximate-stock warning */}
      {(typeFilter === "medicine" || typeFilter === "") && (
        <div style={{ background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"10px 16px",marginBottom:"18px" }}>
          <p style={{ fontSize:"12px",color:"#92400E",margin:0 }}>
            ⚠️ <strong>Note:</strong> Medicine purchase totals are approximate — based on current stock, not the original quantity received.
          </p>
        </div>
      )}

      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading purchases & refunds…</div>
      ) : (
        <>
          {/* Purchases table */}
          <div style={{ marginBottom:"24px" }}>
            <h3 style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>
              Purchases
              <span style={{ marginLeft:"8px",fontSize:"12px",color:"#EF4444",fontWeight:700 }}>{fmt(totalPurchases)}</span>
            </h3>
            {purchases.length === 0 ? (
              <div style={{ background:"#fff",borderRadius:"12px",padding:"32px",textAlign:"center",border:"1px solid #E8EDF4" }}>
                <p style={{ fontSize:"13px",color:"#94A3B8",margin:0 }}>No purchases in this period.</p>
              </div>
            ) : (
              <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12.5px" }}>
                    <thead>
                      <tr style={{ background:"#F8FAFC" }}>
                        {["Type","Item","Batch No.","Quantity","Unit Cost","Amount","Date"].map(h => (
                          <th key={h} style={{ padding:"9px 14px",textAlign:"left",fontWeight:700,color:"#475569",borderBottom:"1px solid #E8EDF4",whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p, i) => {
                        const ts = TYPE_STYLE[p.type] || { bg:"#F1F5F9",text:"#475569",icon:"📄",label:p.type };
                        return (
                          <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                            <td style={{ padding:"9px 14px" }}>
                              <span style={{ padding:"2px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:ts.bg,color:ts.text }}>{ts.icon} {ts.label}</span>
                            </td>
                            <td style={{ padding:"9px 14px",fontWeight:600,color:"#0F172A" }}>{p.item || p.name || "—"}</td>
                            <td style={{ padding:"9px 14px",color:"#94A3B8",fontFamily:"monospace",fontSize:"12px" }}>{p.batch_number || "—"}</td>
                            <td style={{ padding:"9px 14px",color:"#475569" }}>{p.quantity ?? "—"}</td>
                            <td style={{ padding:"9px 14px",color:"#475569" }}>{p.unit_cost ? fmt(p.unit_cost) : "—"}</td>
                            <td style={{ padding:"9px 14px",fontWeight:800,color:"#DC2626",fontSize:"13px" }}>{fmt(p.amount)}</td>
                            <td style={{ padding:"9px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{p.date || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"#F8FAFC" }}>
                        <td colSpan={5} style={{ padding:"10px 14px",fontWeight:700,color:"#0F172A",fontSize:"13px" }}>Total ({purchases.length})</td>
                        <td style={{ padding:"10px 14px",fontWeight:800,color:"#DC2626",fontSize:"14px" }}>{fmt(totalPurchases)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Refunds table */}
          <div>
            <h3 style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>
              Refunds / Returns
              <span style={{ marginLeft:"8px",fontSize:"12px",color:"#0D9488",fontWeight:700 }}>{fmt(totalRefunds)}</span>
            </h3>
            {refunds.length === 0 ? (
              <div style={{ background:"#fff",borderRadius:"12px",padding:"32px",textAlign:"center",border:"1px solid #E8EDF4" }}>
                <p style={{ fontSize:"13px",color:"#94A3B8",margin:0 }}>No refunds in this period.</p>
              </div>
            ) : (
              <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12.5px" }}>
                    <thead>
                      <tr style={{ background:"#F8FAFC" }}>
                        {["Type","Item","Quantity","Amount","Reason","Status","Date"].map(h => (
                          <th key={h} style={{ padding:"9px 14px",textAlign:"left",fontWeight:700,color:"#475569",borderBottom:"1px solid #E8EDF4",whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((r, i) => {
                        const ts = TYPE_STYLE[r.type] || { bg:"#F1F5F9",text:"#475569",icon:"📄",label:r.type };
                        return (
                          <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                            <td style={{ padding:"9px 14px" }}>
                              <span style={{ padding:"2px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:ts.bg,color:ts.text }}>{ts.icon} {ts.label}</span>
                            </td>
                            <td style={{ padding:"9px 14px",fontWeight:600,color:"#0F172A" }}>{r.item || r.name || "—"}</td>
                            <td style={{ padding:"9px 14px",color:"#475569" }}>{r.quantity ?? "—"}</td>
                            <td style={{ padding:"9px 14px",fontWeight:800,color:"#0D9488",fontSize:"13px" }}>{fmt(r.amount)}</td>
                            <td style={{ padding:"9px 14px",color:"#64748B",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.reason || "—"}</td>
                            <td style={{ padding:"9px 14px" }}>
                              {r.status ? (
                                <span style={{ padding:"2px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:"#D1FAE5",color:"#065F46" }}>{r.status}</span>
                              ) : "—"}
                            </td>
                            <td style={{ padding:"9px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{r.date || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:"#F8FAFC" }}>
                        <td colSpan={3} style={{ padding:"10px 14px",fontWeight:700,color:"#0F172A",fontSize:"13px" }}>Total ({refunds.length})</td>
                        <td style={{ padding:"10px 14px",fontWeight:800,color:"#0D9488",fontSize:"14px" }}>{fmt(totalRefunds)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 3: Salary Paid (read-only — salary is entered/paid from
// the Salary module; this view is the "expense" side of it)
// ════════════════════════════════════════════════════════
function SalaryPaidTab() {
  const today = new Date();

  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [month, setMonth]       = useState(String(today.getMonth() + 1));
  const [year, setYear]         = useState(String(today.getFullYear()));
  const [staffType, setStaffType] = useState("");
  const [search, setSearch]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { is_paid: "true" };
      if (month) params.month = month;
      if (year) params.year = year;
      if (staffType) params.staff_type = staffType;
      if (search) params.search = search;
      const res = await getSalaryRecords(params);
      setRecords(Array.isArray(res) ? res : (res?.results || []));
    } catch { setError("Failed to load paid salaries."); }
    finally { setLoading(false); }
  }, [month, year, staffType, search]);

  useEffect(() => { load(); }, [load]);

  const total = records.reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const totalBonus = records.reduce((s, r) => s + Number(r.bonus || 0), 0);
  const totalDeductions = records.reduce((s, r) => s + Number(r.deductions || 0), 0);

  const months = [
    "", "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  return (
    <div>
      <div style={{ background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:"10px",padding:"10px 16px",marginBottom:"18px",display:"flex",alignItems:"center",gap:"10px" }}>
        <span style={{ fontSize:"16px" }}>ℹ️</span>
        <p style={{ fontSize:"12px",color:"#64748B",margin:0 }}>
          Salary is decided and marked paid from the <strong>Salary module</strong> — shown here as the salary portion of hospital expenses.
        </p>
      </div>

      {/* Filters */}
      <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",padding:"14px 18px",marginBottom:"20px" }}>
        <div style={{ display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"flex-end" }}>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Month</label>
            <select value={month} onChange={e=>setMonth(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
              <option value="">All months</option>
              {months.slice(1).map((m, i) => <option key={m} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Year</label>
            <input type="number" value={year} onChange={e=>setYear(e.target.value)} placeholder="Year"
              style={{ width:"90px",padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Staff Type</label>
            <select value={staffType} onChange={e=>setStaffType(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
              <option value="">All</option>
              <option value="doctor">Doctor</option>
              <option value="manager">Manager</option>
              <option value="support_staff">Support Staff</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Search</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Staff name / code"
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#F8FAFC",outline:"none" }} />
          </div>
          <button onClick={load} style={{ padding:"8px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"12px",cursor:"pointer",marginLeft:"auto" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"14px",marginBottom:"20px" }}>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"2px solid #EDE9FE" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Total Salary Paid</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:"#5B21B6",margin:"0 0 4px" }}>{fmt(total)}</p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{records.length} payslips</p>
        </div>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Bonuses Included</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:"#16A34A",margin:"0 0 4px" }}>{fmt(totalBonus)}</p>
        </div>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Deductions Included</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:"#DC2626",margin:"0 0 4px" }}>{fmt(totalDeductions)}</p>
        </div>
      </div>

      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading paid salaries…</div>
      ) : records.length === 0 ? (
        <div style={{ background:"#fff",borderRadius:"12px",padding:"48px",textAlign:"center",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"14px",color:"#94A3B8",margin:0 }}>No salary payments found for these filters.</p>
        </div>
      ) : (
        <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12.5px" }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Staff","Role","Month/Year","Net Salary","Bonus","Deductions","Paid On"].map(h => (
                    <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#475569",borderBottom:"1px solid #E8EDF4",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.record_id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"10px 14px",fontWeight:600,color:"#0F172A" }}>{r.staff_name || "—"}</td>
                    <td style={{ padding:"10px 14px",color:"#64748B" }}>{r.staff_role || r.staff_type || "—"}</td>
                    <td style={{ padding:"10px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{months[r.month] || r.month}/{r.year}</td>
                    <td style={{ padding:"10px 14px",fontWeight:800,color:"#5B21B6",fontSize:"13px" }}>{fmt(r.net_salary)}</td>
                    <td style={{ padding:"10px 14px",color:"#16A34A" }}>{r.bonus ? fmt(r.bonus) : "—"}</td>
                    <td style={{ padding:"10px 14px",color:"#DC2626" }}>{r.deductions ? fmt(r.deductions) : "—"}</td>
                    <td style={{ padding:"10px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"#F8FAFC" }}>
                  <td colSpan={3} style={{ padding:"10px 14px",fontWeight:700,color:"#0F172A",fontSize:"13px" }}>Total ({records.length})</td>
                  <td style={{ padding:"10px 14px",fontWeight:800,color:"#5B21B6",fontSize:"14px" }}>{fmt(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Tab 4: Total / Overview — combines manual expenses, salary
// paid, medicine + supply purchases, and refunds into one
// profit & loss style summary, backed by FinanceDashboardView.
// ════════════════════════════════════════════════════════
function OverviewTab() {
  const [period, setPeriod] = useState("month");
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getFinanceDashboard({ period });
      setData(res);
    } catch { setError("Failed to load overview."); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const periodBtn = (value, label) => (
    <button key={value} onClick={() => setPeriod(value)}
      style={{ padding:"7px 14px",borderRadius:"8px",fontSize:"12px",fontWeight:600,border:period===value?"none":"1px solid #E8EDF4",background:period===value?ACCENT:"#fff",color:period===value?"#fff":"#64748B",cursor:"pointer" }}>
      {label}
    </button>
  );

  if (loading && !data) {
    return <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading overview…</div>;
  }

  const rev = data?.revenue || {};
  const exp = data?.expenses || {};
  const ref = data?.refunds || {};
  const profit = data?.profit_loss ?? 0;

  const card = (label, value, color, sub) => (
    <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:"1px solid #E8EDF4" }}>
      <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>{label}</p>
      <p style={{ fontSize:"22px",fontWeight:800,color,margin:"0 0 4px" }}>{fmt(value)}</p>
      {sub && <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{sub}</p>}
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex",gap:"6px",marginBottom:"20px" }}>
        {periodBtn("today","Today")}
        {periodBtn("week","This Week")}
        {periodBtn("month","This Month")}
        {periodBtn("year","This Year")}
      </div>

      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>}

      {/* Top-line: revenue / expenses / profit */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"14px",marginBottom:"20px" }}>
        {card("Total Revenue", rev.total, "#16A34A", `${(rev.consultation?.count||0)+(rev.pharmacy?.count||0)} bills`)}
        {card("Total Expenses (net)", exp.total, "#EF4444", "after refunds")}
        <div style={{ background:"#fff",borderRadius:"12px",padding:"18px 22px",border:`2px solid ${profit>=0?"#BBF7D0":"#FECACA"}` }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>{profit>=0?"Net Profit":"Net Loss"}</p>
          <p style={{ fontSize:"22px",fontWeight:800,color:profit>=0?"#16A34A":"#DC2626",margin:"0 0 4px" }}>{fmt(Math.abs(profit))}</p>
        </div>
      </div>

      {/* Expense breakdown */}
      <div style={{ marginBottom:"24px" }}>
        <h3 style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>Expense Breakdown</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"12px" }}>
          {card("Manual Expenses", exp.manual?.total, "#475569", `${(exp.manual?.by_category||[]).reduce((s,c)=>s+c.count,0)} entries`)}
          {card("Salary Paid", exp.salary_paid?.amount, "#5B21B6", `${exp.salary_paid?.count||0} payslips`)}
          {card("Medicine Purchases", exp.medicine_purchases?.amount, "#EA580C", `${exp.medicine_purchases?.count||0} batches`)}
          {card("Supply Purchases", exp.supply_purchases?.amount, "#0EA5E9", `${exp.supply_purchases?.count||0} batches`)}
        </div>
        <p style={{ fontSize:"11px",color:"#94A3B8",margin:"10px 0 0" }}>
          Gross expenses: {fmt(exp.gross_total)} — Total refunds: {fmt(ref.total)} — Net expenses: {fmt(exp.total)}
        </p>
      </div>

      {/* Refunds */}
      <div>
        <h3 style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>Refunds Received</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"12px" }}>
          {card("Medicine Refunds", ref.medicine?.amount, "#0D9488", `${ref.medicine?.count||0} returns`)}
          {card("Supply Refunds", ref.supply?.amount, "#0D9488", `${ref.supply?.count||0} returns`)}
          {card("Total Refunds", ref.total, "#0D9488")}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// Root page — four tabs
// ════════════════════════════════════════════════════════
export default function ExpensesPage() {
  const [tab, setTab] = useState("manual");

  const tabBtn = (value, label) => (
    <button
      onClick={() => setTab(value)}
      style={{
        padding:"9px 20px", borderRadius:"8px", fontSize:"13px", fontWeight:700,
        border:"none",
        background: tab === value ? ACCENT : "transparent",
        color: tab === value ? "#fff" : "#64748B",
        cursor:"pointer",
        transition:"all 0.15s",
      }}>
      {label}
    </button>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px",flexWrap:"wrap",gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px",fontWeight:800,color:"#0F172A",margin:0 }}>Expenses</h1>
          <p style={{ fontSize:"13px",color:"#64748B",margin:"4px 0 0" }}>Manual entries, salary paid, pharmacist purchase records, and the full financial overview</p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background:"#F1F5F9",borderRadius:"10px",padding:"4px",display:"inline-flex",gap:"2px",marginBottom:"22px",flexWrap:"wrap" }}>
        {tabBtn("manual", "📋 Manual Expenses")}
        {tabBtn("salary", "👥 Salary Paid")}
        {tabBtn("purchases", "📦 Purchases & Refunds")}
        {tabBtn("overview", "📊 Total / Overview")}
      </div>

      {/* ── Tab content ── */}
      {tab === "manual"    && <ManualExpensesTab />}
      {tab === "salary"    && <SalaryPaidTab />}
      {tab === "purchases" && <PurchasesTab />}
      {tab === "overview"  && <OverviewTab />}
    </div>
  );
}