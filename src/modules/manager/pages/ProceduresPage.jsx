// src/modules/manager/pages/ProceduresPage.jsx
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "../../../components/shared/Toast";
import {
  getProcedureList, createProcedure, patchProcedure, deleteProcedure
} from "../api/managerApi";

const G = "#16A34A";

const Ico = ({ path, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus:   "M12 5v14 M5 12h14",
  edit:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  close:  "M18 6L6 18 M6 6l12 12",
  proc:   "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
  deact:  "M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636",
  react:  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9 12l2 2 4-4",
  rupee:  "M6 3h12 M6 8h12 M6 13h8a4 4 0 0 1 0 8H6l3-4H6",
};

const EMPTY = { name: "", description: "", charge: "", is_active: true };

const Modal = ({ title, children, onClose }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", zIndex:1000, backdropFilter:"blur(4px)" }}>
    <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"560px", padding:"28px", boxShadow:"0 20px 40px rgba(0,0,0,0.14)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px" }}>
        <h2 style={{ fontSize:"18px", fontWeight:700, color:"#0F172A", margin:0 }}>{title}</h2>
        <button onClick={onClose} style={{ background:"#F1F5F9", border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico path={ICONS.close} size={17} color="#64748B" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children, required }) => (
  <div style={{ marginBottom:"15px" }}>
    <label style={{ display:"block", fontSize:"13px", fontWeight:500, color:"#475569", marginBottom:"5px" }}>
      {label}{required && <span style={{ color:"#EF4444" }}> *</span>}
    </label>
    {children}
  </div>
);

const inp = {
  width:"100%", padding:"10px 13px", borderRadius:"9px", border:"1px solid #E2E8F0",
  outline:"none", fontSize:"14px", color:"#1E293B", boxSizing:"border-box",
};

const Badge = ({ active }) => (
  <span style={{
    fontSize:"11px", fontWeight:600, padding:"3px 10px", borderRadius:"20px",
    background: active ? "#DCFCE7" : "#FEE2E2",
    color: active ? "#15803D" : "#DC2626",
  }}>
    {active ? "Active" : "Inactive"}
  </span>
);

export default function ProceduresPage() {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [count, setCount]       = useState(0);
  const [next, setNext]         = useState(null);
  const [prev, setPrev]         = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);

  const [modal, setModal]       = useState(null); // "add" | "edit"
  const [form, setForm]         = useState(EMPTY);
  const [editTarget, setEditTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [toast, showToast]        = useToast();

  const load = useCallback((arg = {}) => {
    setLoading(true);
    const params = typeof arg === "string" ? arg : { include_inactive: showInactive ? "true" : undefined };
    getProcedureList(params)
      .then(d => {
        setList(d.results ?? []);
        setCount(d.count ?? 0);
        setNext(d.next);
        setPrev(d.previous);
        setCurrentUrl(typeof arg === "string" ? arg : null);
      })
      .catch(() => setError("Failed to load procedures."))
      .finally(() => setLoading(false));
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const displayed = list.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(EMPTY); setFormError(""); setModal("add"); };
  const openEdit = (p) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? "", charge: p.charge ?? "", is_active: p.is_active });
    setFormError(""); setModal("edit");
  };

  const handleChange = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSubmit = async () => {
    setSubmitting(true); setFormError("");
    try {
      const payload = { ...form, charge: parseFloat(form.charge) || 0 };
      if (modal === "add") {
        await createProcedure(payload);
        showToast("Procedure created!");
      } else {
        await patchProcedure(editTarget.procedure_id, payload);
        showToast("Procedure updated!");
      }
      setModal(null);
      load(currentUrl ?? {});
    } catch (err) {
      const data = err?.response?.data?.errors ?? err?.response?.data;
      if (data && typeof data === "object") {
        const msgs = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([k, v]) => {
            const l = prefix ? `${prefix} ${k}` : k;
            if (Array.isArray(v)) msgs.push(`${l}: ${v.join(" ")}`);
            else if (typeof v === "object" && v) extract(v, l);
            else msgs.push(`${l}: ${v}`);
          });
        };
        extract(data);
        setFormError(msgs.join(" | "));
      } else {
        setFormError(err.message || "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (p) => {
    try {
      if (p.is_active) {
        await deleteProcedure(p.procedure_id); // soft-delete → deactivate
      } else {
        await patchProcedure(p.procedure_id, { is_active: true });
      }
      load(currentUrl ?? {});
    } catch { showToast("Action failed.", false); }
  };

  return (
    <div style={{ background:"#F8FAFC", minHeight:"100%", margin:"-20px -16px", padding:"24px" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px", fontWeight:700, color:"#0F172A", margin:0 }}>Procedures</h1>
          <p style={{ fontSize:"13px", color:"#64748B", marginTop:"3px" }}>{count} procedure{count !== 1 ? "s" : ""} total</p>
        </div>
        <button onClick={openAdd} style={{ display:"flex", alignItems:"center", gap:"7px", background:G, color:"#fff", border:"none", borderRadius:"10px", padding:"10px 18px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          <Ico path={ICONS.plus} size={15} color="#fff" /> Add Procedure
        </button>
      </div>

      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", fontSize:"14px" }}>{error}</div>
      )}

      {/* Filters */}
      <div style={{ background:"#fff", borderRadius:"14px", padding:"16px", border:"1px solid #F1F5F9", marginBottom:"16px", display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
          <span style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)" }}>
            <Ico path={ICONS.search} size={15} color="#94A3B8" />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or description…" style={{ ...inp, paddingLeft:"34px" }} />
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:"#475569", cursor:"pointer", userSelect:"none" }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            style={{ width:"16px", height:"16px", accentColor:G, cursor:"pointer" }} />
          Show inactive
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ background:"#fff", borderRadius:"14px", padding:"24px", border:"1px solid #F1F5F9" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height:"48px", borderRadius:"8px", background:"#E2E8F0", marginBottom:"10px", animation:"pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ background:"#fff", borderRadius:"14px", padding:"64px", textAlign:"center", border:"1px solid #F1F5F9" }}>
          <div style={{ width:"56px", height:"56px", borderRadius:"14px", background:`${G}12`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            <Ico path={ICONS.proc} size={26} color={G} />
          </div>
          <p style={{ color:"#94A3B8", fontSize:"14px" }}>No procedures found.</p>
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid #F1F5F9", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"2px solid #F1F5F9", background:"#FAFBFC" }}>
                  {["Procedure Name", "Description", "Charge (₹)", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:"11px", fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.6px", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(p => (
                  <tr key={p.procedure_id}
                    style={{ borderBottom:"1px solid #F8FAFC" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <div style={{ width:"34px", height:"34px", borderRadius:"9px", background:`${G}10`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Ico path={ICONS.proc} size={16} color={G} />
                        </div>
                        <span style={{ fontSize:"14px", fontWeight:600, color:"#0F172A" }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:"13px", color:"#64748B", maxWidth:"260px" }}>
                      <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description || "—"}</div>
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <span style={{ fontSize:"14px", fontWeight:600, color:"#0F172A" }}>₹{parseFloat(p.charge).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
                    </td>
                    <td style={{ padding:"12px 16px" }}><Badge active={p.is_active} /></td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex", gap:"8px" }}>
                        <button onClick={() => openEdit(p)}
                          style={{ padding:"6px 14px", borderRadius:"8px", border:`1px solid #DBEAFE`, background:"#EFF6FF", cursor:"pointer", fontSize:"12px", fontWeight:500, color:"#3B82F6" }}>
                          Edit
                        </button>
                        <button onClick={() => toggleStatus(p)}
                          style={{ padding:"6px 14px", borderRadius:"8px", border:`1px solid ${p.is_active ? "#FECACA" : "#BBF7D0"}`, background: p.is_active ? "#FEF2F2" : "#F0FDF4", cursor:"pointer", fontSize:"12px", fontWeight:500, color: p.is_active ? "#EF4444" : "#16A34A" }}>
                          {p.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(next || prev) && (
        <div style={{ display:"flex", justifyContent:"center", gap:"10px", marginTop:"20px" }}>
          <button onClick={() => prev && load(prev)} disabled={!prev} style={{ padding:"8px 18px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor: prev ? "pointer" : "not-allowed", fontSize:"13px", color:"#475569" }}>&larr; Previous</button>
          <button onClick={() => next && load(next)} disabled={!next} style={{ padding:"8px 18px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor: next ? "pointer" : "not-allowed", fontSize:"13px", color:"#475569" }}>Next &rarr;</button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <Modal title={modal === "add" ? "Add New Procedure" : `Edit — ${editTarget?.name}`} onClose={() => setModal(null)}>
          {formError && (
            <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", borderRadius:"8px", padding:"10px 14px", marginBottom:"16px", fontSize:"13px" }}>{formError}</div>
          )}

          <Field label="Procedure Name" required>
            <input style={inp} value={form.name} onChange={e => handleChange("name", e.target.value)} placeholder="e.g. Blood Pressure Monitoring" />
          </Field>
          <Field label="Charge (₹)" required>
            <input style={inp} type="number" min="0" step="0.01" value={form.charge} onChange={e => handleChange("charge", e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Description">
            <textarea style={{ ...inp, minHeight:"80px", resize:"vertical" }} value={form.description} onChange={e => handleChange("description", e.target.value)} placeholder="Brief description of the procedure…" />
          </Field>

          {modal === "edit" && (
            <Field label="Status">
              <label style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={form.is_active} onChange={e => handleChange("is_active", e.target.checked)}
                  style={{ width:"18px", height:"18px", accentColor:G, cursor:"pointer" }} />
                <span style={{ fontSize:"14px", color:"#475569" }}>Active</span>
              </label>
            </Field>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px", marginTop:"22px", paddingTop:"18px", borderTop:"1px solid #F1F5F9" }}>
            <button onClick={() => setModal(null)} style={{ padding:"9px 20px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:"13px", color:"#475569" }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding:"9px 22px", borderRadius:"9px", border:"none", background: submitting ? "#86EFAC" : G, cursor:"pointer", fontSize:"13px", fontWeight:600, color:"#fff" }}>
              {submitting ? "Saving…" : modal === "add" ? "Add Procedure" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}