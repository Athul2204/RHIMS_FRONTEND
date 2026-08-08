// src/modules/manager/pages/IncomePage.jsx
import { useState, useEffect, useCallback } from "react";
import { listIncome, createIncome, patchIncome, deleteIncome } from "../api/managerApi";
import ExportButtons from "../../../components/shared/ExportButtons";

const ACCENT = "#16A34A";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Backend enum values ↔ display labels
const CATEGORIES = ["LAB_COMMISSION", "DONATION", "OTHER"];
const CAT_LABEL = { LAB_COMMISSION: "Lab Commission", DONATION: "Donation", OTHER: "Other" };

const CAT_STYLE = {
  "LAB_COMMISSION": { bg: "#FFF7ED", text: "#EA580C", icon: "🔬" },
  "DONATION":        { bg: "#EDE9FE", text: "#5B21B6", icon: "🎁" },
  "OTHER":           { bg: "#F1F5F9", text: "#475569", icon: "📋" },
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

// ── Income form ───────────────────────────────────────────────
const EMPTY = { title:"", category:"LAB_COMMISSION", amount:"", date:new Date().toISOString().split("T")[0], description:"", receipt_number:"" };

function IncomeForm({ initial, onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"10px 14px",color:"#DC2626",fontSize:"13px",marginBottom:"12px" }}>{error}</div>}
      <div style={{ marginBottom:"14px" }}>
        <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Title <span style={{ color:"#EF4444" }}>*</span></label>
        <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Lab referral commission - June" style={inp} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px" }}>
        <div>
          <label style={{ display:"block",fontSize:"12px",fontWeight:600,color:"#374151",marginBottom:"5px" }}>Category <span style={{ color:"#EF4444" }}>*</span></label>
          <select value={form.category} onChange={e=>set("category",e.target.value)} style={inp}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{CAT_LABEL[c]}</option>
            ))}
          </select>
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
          {saving ? "Saving…" : "Save Income"}
        </button>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
// Root page — Other Income list + add/edit modal + filters
// ════════════════════════════════════════════════════════
export default function IncomePage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [income, setIncome]         = useState([]);
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
      const res = await listIncome(params);
      setIncome(res?.income || []);
    } catch { setError("Failed to load income."); }
    finally { setLoading(false); }
  }, [start, end, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await createIncome(form);
      setShowAdd(false);
      load();
    } catch(e) {
      setFormError(e?.response?.data?.title || e?.response?.data?.error || JSON.stringify(e?.response?.data) || "Failed to add income.");
    } finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setSaving(true); setFormError(null);
    try {
      await patchIncome(editTarget.income_id, form);
      setEditTarget(null);
      load();
    } catch(e) {
      setFormError(e?.response?.data?.error || "Failed to update.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteIncome(id);
      setDeleteConfirm(null);
      load();
    } catch { alert("Failed to delete income."); }
  };

  const total = income.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCat = CATEGORIES.map(cat => ({
    cat,
    total: income.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0),
    count: income.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px",flexWrap:"wrap",gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px",fontWeight:800,color:"#0F172A",margin:0 }}>Other Income</h1>
          <p style={{ fontSize:"13px",color:"#64748B",margin:"4px 0 0" }}>Lab commissions, donations, and other one-off income entries</p>
        </div>
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
            <label style={{ display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px",textTransform:"uppercase" }}>Category</label>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
              style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </div>
          <button onClick={load} style={{ padding:"8px 16px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>↻ Refresh</button>
          <ExportButtons
            rows={income}
            columns={[
              { header: "Date", accessor: "date" },
              { header: "Category", accessor: e => CAT_LABEL[e.category] || e.category },
              { header: "Description", accessor: "description" },
              { header: "Amount", accessor: e => Number(e.amount || 0) },
            ]}
            filename={`other_income_${start}_to_${end}`}
            title="Other Income"
            dateRange={{ from: start, to: end }}
          />
          <button onClick={() => { setShowAdd(true); setFormError(null); }}
            style={{ padding:"8px 16px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",marginLeft:"auto" }}>
            + Add Income
          </button>
        </div>
      </div>

      {/* Total + breakdown */}
      <div style={{ display:"grid",gridTemplateColumns:"auto 1fr",gap:"14px",marginBottom:"20px" }}>
        <div style={{ background:"#fff",borderRadius:"12px",padding:"20px 24px",border:"1px solid #E8EDF4",minWidth:"200px" }}>
          <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 6px",textTransform:"uppercase" }}>Total Other Income</p>
          <p style={{ fontSize:"26px",fontWeight:800,color:ACCENT,margin:"0 0 4px" }}>{fmt(total)}</p>
          <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>{income.length} records</p>
        </div>
        {byCat.length > 0 && (
          <div style={{ background:"#fff",borderRadius:"12px",padding:"16px 20px",border:"1px solid #E8EDF4" }}>
            <p style={{ fontSize:"12px",fontWeight:700,color:"#0F172A",margin:"0 0 12px" }}>By Category</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"10px" }}>
              {byCat.map(c => {
                const s = CAT_STYLE[c.cat] || CAT_STYLE["OTHER"];
                const pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : 0;
                return (
                  <div key={c.cat} style={{ padding:"8px 14px",borderRadius:"10px",background:s.bg,border:`1px solid ${s.text}22` }}>
                    <p style={{ fontSize:"11px",fontWeight:700,color:s.text,margin:"0 0 3px" }}>{s.icon} {CAT_LABEL[c.cat]}</p>
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
        <div style={{ textAlign:"center",padding:"60px",color:"#94A3B8" }}>Loading income…</div>
      ) : income.length === 0 ? (
        <div style={{ background:"#fff",borderRadius:"12px",padding:"48px",textAlign:"center",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"14px",color:"#94A3B8",margin:0 }}>No income recorded for this period.</p>
          <p style={{ fontSize:"12px",color:"#CBD5E1",margin:"6px 0 0" }}>Click "+ Add Income" to record one.</p>
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
                {income.map(e => {
                  const s = CAT_STYLE[e.category] || CAT_STYLE["OTHER"];
                  return (
                    <tr key={e.income_id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"10px 14px",color:"#64748B",whiteSpace:"nowrap" }}>{e.date}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{ padding:"2px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:s.bg,color:s.text }}>{s.icon} {CAT_LABEL[e.category] || e.category}</span>
                      </td>
                      <td style={{ padding:"10px 14px",fontWeight:600,color:"#0F172A" }}>{e.title}</td>
                      <td style={{ padding:"10px 14px",color:"#94A3B8",fontFamily:"monospace",fontSize:"12px" }}>{e.receipt_number || "—"}</td>
                      <td style={{ padding:"10px 14px",fontWeight:800,color:ACCENT,fontSize:"13px" }}>{fmt(e.amount)}</td>
                      <td style={{ padding:"10px 14px",color:"#64748B",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.description || "—"}</td>
                      <td style={{ padding:"10px 14px",color:"#94A3B8",fontSize:"12px" }}>{e.added_by_name || "—"}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex",gap:"6px" }}>
                          <button onClick={() => { setEditTarget(e); setFormError(null); }}
                            style={{ padding:"4px 10px",borderRadius:"6px",border:`1px solid ${ACCENT}`,background:"none",color:ACCENT,fontWeight:600,fontSize:"11px",cursor:"pointer" }}>
                            Edit
                          </button>
                          <button onClick={() => setDeleteConfirm(e.income_id)}
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
                  <td style={{ padding:"12px 14px",fontWeight:800,color:ACCENT,fontSize:"14px" }}>{fmt(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Income" onClose={() => setShowAdd(false)}>
          <IncomeForm initial={EMPTY} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} error={formError} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Edit Income" onClose={() => setEditTarget(null)}>
          <IncomeForm
            initial={{ title:editTarget.title, category:editTarget.category, amount:editTarget.amount, date:editTarget.date, description:editTarget.description||"", receipt_number:editTarget.receipt_number||"" }}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
            saving={saving}
            error={formError}
          />
        </Modal>
      )}
      {deleteConfirm && (
        <Modal title="Delete Income" onClose={() => setDeleteConfirm(null)}>
          <p style={{ fontSize:"14px",color:"#374151",marginBottom:"20px" }}>Are you sure you want to delete this income entry? This cannot be undone.</p>
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