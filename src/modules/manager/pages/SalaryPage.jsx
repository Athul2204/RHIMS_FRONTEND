// src/modules/manager/pages/SalaryPage.jsx
import { useState, useEffect, useCallback } from "react";
import {
  getSalaryRecords, generateSalary, markSalaryPaid,
  deleteSalaryRecord, patchSalaryRecord,
} from "../api/managerApi";
import ExportButtons from "../../../components/shared/ExportButtons";

// DRF error responses aren't all shaped the same way:
//   - permission/auth failures  -> { detail: "..." }
//   - our own custom views      -> { error: "..." }
//   - serializer validation     -> { field_name: ["msg", ...] }
// Previously only `.error` was read, so permission-denied responses (e.g.
// "Access denied. Manager role required.") silently fell back to a generic
// message instead of showing the real reason.
const extractErrorMessage = (e, fallback) => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  const firstField = Object.values(data).find(v => v);
  if (Array.isArray(firstField)) return firstField[0];
  if (typeof firstField === "string") return firstField;
  return fallback;
};

const ACCENT = "#6366F1";
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STAFF_TYPES = [
  { value: "",               label: "All Staff" },
  { value: "doctor",         label: "Doctors" },
  { value: "manager",        label: "Managers" },
  { value: "support_staff",  label: "Support Staff" },
  { value: "other",          label: "Other Staff" },
];

// Small numeric field used for the Net Salary / Bonus / Deductions inputs —
// keeps its own text value so the user can clear/retype freely without the
// parent re-rendering on every keystroke fighting the cursor.
function AmountInput({ value, onChange, disabled, accent }) {
  return (
    <input
      type="number" min="0" step="0.01" inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      placeholder="0.00"
      style={{
        width: "104px", padding: "6px 8px", borderRadius: "7px",
        border: "1px solid #E2E8F0", fontSize: "12.5px", fontWeight: 700,
        color: disabled ? "#94A3B8" : (accent || "#1E293B"),
        background: disabled ? "#F8FAFC" : "#fff",
        outline: "none",
      }}
    />
  );
}

const r_name = (r) => r.staff_name || r.staff_code || "Staff";

// ── Per-row: manager types Base Salary, Bonus, Deductions and Remarks;
// Net Salary is auto-computed (Base + Bonus − Deductions) and saved via
// PATCH /manager/salary/<id>/ — no separate "entries" step, no extra modal.
// The record only stores net_salary/bonus/deductions, so on load the Base
// figure is recovered as net_salary − bonus + deductions (exact inverse of
// how it was combined on save).
function SalaryRow({ r, onChanged, onDelete }) {
  const deriveBase = (row) => Number(row.net_salary ?? 0) - Number(row.bonus ?? 0) + Number(row.deductions ?? 0);

  const [base, setBase]       = useState(String(deriveBase(r)));
  const [bonus, setBonus]     = useState(String(r.bonus ?? "0"));
  const [ded, setDed]         = useState(String(r.deductions ?? "0"));
  const [remarks, setRemarks] = useState(r.notes ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState(null);
  const [paying, setPaying]   = useState(false);
  const [deleting, setDel]    = useState(false);

  // Re-sync local drafts if the row refreshes from the server (e.g. after
  // another manager's edit, or a page reload) and nothing is being edited.
  useEffect(() => {
    if (!saving) {
      setBase(String(deriveBase(r)));
      setBonus(String(r.bonus ?? "0"));
      setDed(String(r.deductions ?? "0"));
      setRemarks(r.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.net_salary, r.bonus, r.deductions, r.notes]);

  // Auto-calculated — never typed directly.
  const net = Number(base || 0) + Number(bonus || 0) - Number(ded || 0);

  const dirty =
    Number(base || 0)  !== deriveBase(r) ||
    Number(bonus || 0) !== Number(r.bonus ?? 0) ||
    Number(ded || 0)   !== Number(r.deductions ?? 0) ||
    (remarks || "")     !== (r.notes || "");

  const handleSave = async () => {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const updated = await patchSalaryRecord(r.record_id, {
        net_salary: Math.max(0, net),
        bonus: Number(bonus || 0),
        deductions: Number(ded || 0),
        notes: remarks,
      });
      onChanged(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setErr(extractErrorMessage(e, "Could not save — please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async () => {
    if (net <= 0) return;
    setPaying(true); setErr(null);
    try {
      await markSalaryPaid(r.record_id);
      onChanged({ ...r, is_paid: true, paid_at: new Date().toISOString(), net_salary: net, bonus, deductions: ded, notes: remarks });
    } catch (e) {
      setErr(extractErrorMessage(e, "Failed to mark as paid."));
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    setDel(true); setErr(null);
    try {
      await deleteSalaryRecord(r.record_id);
      onDelete(r.record_id);
    } catch (e) {
      setErr(extractErrorMessage(e, "Delete failed."));
      setDel(false);
    }
  };

  return (
    <tr style={{ borderBottom:"1px solid #F1F5F9", background: r.is_paid ? "#FAFAFA" : "#fff" }}>
      {/* Staff */}
      <td style={{ padding:"10px 12px" }}>
        <p style={{ margin:0,fontWeight:700,color:"#0F172A",fontSize:"12.5px" }}>{r_name(r)}</p>
        <p style={{ margin:"2px 0 0",fontSize:"10.5px",fontFamily:"monospace",color:"#6366F1" }}>{r.staff_code}</p>
      </td>
      {/* Role */}
      <td style={{ padding:"10px 12px",color:"#64748B",fontSize:"12px" }}>{r.staff_role}</td>
      {/* Reference rate (informational only — never auto-filled into net_salary) */}
      <td style={{ padding:"10px 12px" }}>
        <span style={{ fontSize:"12px",color:"#334155",fontWeight:600 }}>{fmt(r.reference_rate)}</span>
        <span style={{ display:"block",fontSize:"10px",color:"#94A3B8" }}>/ month</span>
      </td>
      {/* Attendance (read-only badges) */}
      <td style={{ padding:"10px 12px" }}>
        <div style={{ display:"flex",gap:"4px",flexWrap:"wrap" }}>
          <span title="Present" style={{ padding:"2px 7px",borderRadius:"20px",fontSize:"10px",fontWeight:700,background:"#D1FAE5",color:"#065F46" }}>
            P:{r.present_days ?? "—"}
          </span>
          <span title="Absent" style={{ padding:"2px 7px",borderRadius:"20px",fontSize:"10px",fontWeight:700,background:"#FEE2E2",color:"#991B1B" }}>
            A:{r.absent_days ?? "—"}
          </span>
          {r.mandatory_working_days != null && (
            <span title="Minimum Duty Days Required This Month" style={{ padding:"2px 7px",borderRadius:"20px",fontSize:"10px",fontWeight:700,background:"#EDE9FE",color:"#5B21B6" }}>
              Min:{r.mandatory_working_days}
            </span>
          )}
          {(r.paid_leave_days > 0) && (
            <span title="Paid Leave" style={{ padding:"2px 7px",borderRadius:"20px",fontSize:"10px",fontWeight:700,background:"#DBEAFE",color:"#1E40AF" }}>
              PL:{r.paid_leave_days}
            </span>
          )}
          {(r.half_days > 0) && (
            <span title="Half Days" style={{ padding:"2px 7px",borderRadius:"20px",fontSize:"10px",fontWeight:700,background:"#FCE7F3",color:"#9D174D" }}>
              H:{r.half_days}
            </span>
          )}
        </div>
      </td>
      {/* Editable Base Salary / Bonus / Deductions, auto-computed Net */}
      <td style={{ padding:"10px 12px" }}>
        <AmountInput value={base} onChange={setBase} disabled={r.is_paid} accent="#334155" />
      </td>
      <td style={{ padding:"10px 12px" }}>
        <AmountInput value={bonus} onChange={setBonus} disabled={r.is_paid} accent="#10B981" />
      </td>
      <td style={{ padding:"10px 12px" }}>
        <AmountInput value={ded} onChange={setDed} disabled={r.is_paid} accent="#EF4444" />
      </td>
      {/* Net Salary — auto-calculated, never typed directly */}
      <td style={{ padding:"10px 12px" }}>
        <span style={{ fontSize:"13px",fontWeight:800,color: net < 0 ? "#EF4444" : ACCENT }}>{fmt(Math.max(0, net))}</span>
        <span style={{ display:"block",fontSize:"9.5px",color:"#94A3B8" }}>auto = base+bonus−ded.</span>
      </td>
      {/* Remarks */}
      <td style={{ padding:"10px 12px" }}>
        <input
          type="text" value={remarks} disabled={r.is_paid}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Optional note…"
          style={{
            width:"140px", padding:"6px 8px", borderRadius:"7px",
            border:"1px solid #E2E8F0", fontSize:"12px",
            color: r.is_paid ? "#94A3B8" : "#1E293B",
            background: r.is_paid ? "#F8FAFC" : "#fff", outline:"none",
          }}
        />
      </td>
      {/* Status */}
      <td style={{ padding:"10px 12px" }}>
        <span style={{ padding:"3px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:700,background:r.is_paid?"#D1FAE5":"#FEF3C7",color:r.is_paid?"#065F46":"#92400E" }}>
          {r.is_paid ? "✓ Paid" : "Pending"}
        </span>
        {err && <div style={{ fontSize:"10px",color:"#EF4444",marginTop:"4px",maxWidth:"140px" }} title={err}>⚠ {err}</div>}
      </td>
      {/* Actions */}
      <td style={{ padding:"10px 10px" }}>
        <div style={{ display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap" }}>
          {!r.is_paid && (
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              title={dirty ? "Save changes" : "No changes to save"}
              style={{
                padding:"5px 11px",borderRadius:"6px",border:"none",fontSize:"11px",fontWeight:700,
                background: saving ? "#E0E7FF" : dirty ? ACCENT : "#E2E8F0",
                color: dirty || saving ? "#fff" : "#94A3B8",
                cursor: (saving || !dirty) ? "not-allowed" : "pointer",
              }}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
            </button>
          )}
          {!r.is_paid && (
            <button
              onClick={handlePay}
              disabled={paying || Number(net || 0) === 0 || dirty}
              title={dirty ? "Save your changes first" : Number(net||0) === 0 ? "Enter a Net Salary first" : "Mark as Paid"}
              style={{ padding:"5px 10px",borderRadius:"6px",border:"none",background: (Number(net||0) === 0 || dirty) ? "#E2E8F0":"#10B981",color:"#fff",fontWeight:700,fontSize:"11px",cursor:(paying||Number(net||0)===0||dirty)?"not-allowed":"pointer",opacity:paying?0.7:1 }}>
              {paying ? "…" : "Mark Paid"}
            </button>
          )}
          {!r.is_paid && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete record"
              style={{ padding:"4px 8px",borderRadius:"6px",border:"1px solid #FECACA",background:"none",color:"#EF4444",fontWeight:700,fontSize:"12px",cursor:"pointer" }}>
              {deleting ? "…" : "🗑"}
            </button>
          )}
          {r.is_paid && r.paid_at && (
            <span style={{ fontSize:"10px",color:"#10B981" }}>
              Paid {new Date(r.paid_at).toLocaleDateString("en-IN",{ day:"2-digit",month:"short" })}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════
export default function SalaryPage() {
  const today        = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear  = today.getFullYear();

  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [prepResult, setPrepResult] = useState(null);
  const [prepError, setPrepError] = useState(null);

  const [month, setMonth]         = useState(currentMonth);
  const [year, setYear]           = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch]       = useState("");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchRecords = useCallback(async (type, srch) => {
    const params = { month, year };
    if (type) params.staff_type = type;
    if (srch) params.search = srch;
    const res = await getSalaryRecords(params);
    return Array.isArray(res) ? res : (res?.results || []);
  }, [month, year]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rows = await fetchRecords(typeFilter, search);
      setRecords(rows);
    } catch(e) {
      setError(extractErrorMessage(e, "Failed to load salary records."));
    } finally { setLoading(false); }
  }, [fetchRecords, typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  // A row saved/paid successfully — patch it into local state in place so
  // the whole table doesn't need a round-trip reload for every keystroke-save.
  const handleRowChanged = (updated) => {
    setRecords(prev => prev.map(row => row.record_id === updated.record_id ? { ...row, ...updated } : row));
  };
  const handleRowDeleted = (recordId) => {
    setRecords(prev => prev.filter(row => row.record_id !== recordId));
  };

  // ── Prepare sheet ──────────────────────────────────────────
  const handlePrepare = async () => {
    setPreparing(true); setPrepError(null); setPrepResult(null);
    try {
      const res = await generateSalary({ month, year });
      setPrepResult(res);
      await load();
    } catch(e) {
      setPrepError(extractErrorMessage(e, "Failed to prepare sheet."));
    } finally { setPreparing(false); }
  };

  // ── Summaries ──────────────────────────────────────────────
  const totalNet    = records.reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const paidTotal   = records.filter(r => r.is_paid).reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const pendingTotal= records.filter(r => !r.is_paid).reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const paidCount   = records.filter(r => r.is_paid).length;
  const pendingCount= records.filter(r => !r.is_paid).length;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"18px",flexWrap:"wrap",gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px",fontWeight:800,color:"#0F172A",margin:0 }}>Salary Management</h1>
          <p style={{ fontSize:"13px",color:"#64748B",margin:"4px 0 0" }}>
            Tracked by calendar month — type in Net Salary, Bonus & Deductions for each staff member and hit Save
          </p>
        </div>
        <button
          onClick={handlePrepare}
          disabled={preparing}
          style={{ display:"flex",alignItems:"center",gap:"6px",padding:"9px 18px",borderRadius:"9px",border:"none",background:preparing?"#E0E7FF":ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:preparing?"not-allowed":"pointer" }}>
          {preparing ? "⏳ Preparing…" : "📋 Prepare Sheet"}
        </button>
      </div>

      {/* ── Prep result / error banners ── */}
      {prepResult && !preparing && (
        <div style={{ background:"#D1FAE5",border:"1px solid #6EE7B7",borderRadius:"10px",padding:"10px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ fontSize:"13px",fontWeight:700,color:"#065F46" }}>
            ✅ {prepResult.message || `Sheet ready for ${MONTH_FULL[month-1]} ${year}`}
            {prepResult.created > 0 && ` · ${prepResult.created} new row${prepResult.created>1?"s":""} added`}
            {prepResult.skipped > 0 && ` · ${prepResult.skipped} already existed`}
          </span>
          <button onClick={() => setPrepResult(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"#065F46",fontSize:"16px",lineHeight:1,padding:"0 4px" }}>×</button>
        </div>
      )}
      {prepResult && !preparing && Array.isArray(prepResult.errors) && prepResult.errors.length > 0 && (
        <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"10px 16px",marginBottom:"14px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:"13px",fontWeight:700,color:"#DC2626" }}>
              ⚠️ {prepResult.errors.length} staff row{prepResult.errors.length>1?"s":""} could not be created for this month:
            </span>
            <button onClick={() => setPrepResult({ ...prepResult, errors: [] })} style={{ background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:"16px",lineHeight:1,padding:"0 4px" }}>×</button>
          </div>
          <ul style={{ margin:"8px 0 0",paddingLeft:"18px" }}>
            {prepResult.errors.map((err, i) => (
              <li key={i} style={{ fontSize:"12.5px",color:"#991B1B",marginBottom:"2px" }}>
                <strong>{err.staff}</strong>: {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      {prepError && (
        <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"10px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between" }}>
          <span style={{ fontSize:"13px",color:"#DC2626" }}>⚠️ {prepError}</span>
          <button onClick={() => setPrepError(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:"16px" }}>×</button>
        </div>
      )}

      {/* ── Attendance note ── */}
      <div style={{ background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"10px",padding:"10px 16px",marginBottom:"16px" }}>
        <p style={{ fontSize:"12px",color:"#1E40AF",margin:0 }}>
          ℹ️ <strong>Attendance shown for reference only</strong> — type Net Salary, Bonus and Deductions directly into each row, then click <strong>Save</strong>. Click "Prepare Sheet" first to ensure all active staff have a row for the selected month.
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap",alignItems:"center" }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
          {MONTH_FULL.map((mn, i) => <option key={i} value={i+1}>{mn}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff" }}>
          {years.map(yr => <option key={yr}>{yr}</option>)}
        </select>

        {/* Staff type filter */}
        <div style={{ display:"flex",gap:"4px" }}>
          {STAFF_TYPES.map(t => (
            <button key={t.value} onClick={() => setTypeFilter(t.value)}
              style={{ padding:"7px 12px",borderRadius:"8px",fontSize:"12px",fontWeight:600,border:typeFilter===t.value?"none":"1px solid #E8EDF4",background:typeFilter===t.value?ACCENT:"#fff",color:typeFilter===t.value?"#fff":"#64748B",cursor:"pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
          style={{ padding:"8px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",fontSize:"13px",color:"#374151",background:"#fff",outline:"none" }} />
        <button onClick={load}
          style={{ padding:"8px 14px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontWeight:600,fontSize:"12px",cursor:"pointer" }}>
          ↻ Refresh
        </button>
        <ExportButtons
          rows={records}
          columns={[
            { header: "Staff Code", accessor: "staff_code" },
            { header: "Name", accessor: r => r_name(r) },
            { header: "Role", accessor: "staff_role" },
            { header: "Reference Rate", accessor: r => Number(r.reference_rate || 0) },
            { header: "Present", accessor: r => r.present_days ?? "" },
            { header: "Absent", accessor: r => r.absent_days ?? "" },
            { header: "Min Duty Days", accessor: r => r.mandatory_working_days ?? "" },
            { header: "Net Salary", accessor: r => Number(r.net_salary || 0) },
            { header: "Bonus", accessor: r => Number(r.bonus || 0) },
            { header: "Deductions", accessor: r => Number(r.deductions || 0) },
            { header: "Status", accessor: r => r.is_paid ? "Paid" : "Unpaid" },
          ]}
          filename={`salary_${MONTH_FULL[month-1]}_${year}`}
          title={`Salary Sheet — ${MONTH_FULL[month-1]} ${year}`}
          dateRange={`${MONTH_FULL[month-1]} ${year}`}
        />
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px",marginBottom:"18px" }}>
        {[
          { label:"Total Staff",    value:records.length,         sub:"this month",                 color:"#6366F1" },
          { label:"Total Payroll",  value:fmt(totalNet),          sub:"net salary sum",              color:"#0F172A" },
          { label:"Paid",           value:fmt(paidTotal),         sub:`${paidCount} staff`,          color:"#10B981" },
          { label:"Pending",        value:fmt(pendingTotal),      sub:`${pendingCount} staff`,       color:"#F59E0B" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff",borderRadius:"12px",padding:"14px 16px",border:"1px solid #E8EDF4" }}>
            <p style={{ fontSize:"11px",color:"#94A3B8",fontWeight:600,margin:"0 0 4px",textTransform:"uppercase" }}>{s.label}</p>
            <p style={{ fontSize:"17px",fontWeight:800,color:s.color,margin:"0 0 2px" }}>{s.value}</p>
            <p style={{ fontSize:"11px",color:"#94A3B8",margin:0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"12px 16px",color:"#DC2626",fontSize:"13px",marginBottom:"16px" }}>{error}</div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ background:"#fff",borderRadius:"12px",padding:"52px",textAlign:"center",border:"1px solid #E8EDF4" }}>
          <div style={{ fontSize:"28px",marginBottom:"12px" }}>⏳</div>
          <p style={{ fontSize:"14px",fontWeight:700,color:"#0F172A",margin:0 }}>Loading salary records…</p>
        </div>
      ) : records.length === 0 ? (
        <div style={{ background:"#fff",borderRadius:"12px",padding:"52px",textAlign:"center",border:"1px solid #E8EDF4" }}>
          <p style={{ fontSize:"14px",color:"#94A3B8",margin:"0 0 16px" }}>
            No salary records for {MONTH_FULL[month-1]} {year}.
          </p>
          <button onClick={handlePrepare} disabled={preparing}
            style={{ padding:"9px 22px",borderRadius:"9px",border:"none",background:ACCENT,color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer" }}>
            📋 Prepare Sheet for This Month
          </button>
        </div>
      ) : (
        <div style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF4",overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"12.5px" }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Staff","Role","Monthly Rate (Ref)","Attendance ⓘ","Net Salary (₹)","Bonus (₹)","Deductions (₹)","Status","Actions"].map(h => (
                    <th key={h} style={{ padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#475569",borderBottom:"1px solid #E8EDF4",whiteSpace:"nowrap",fontSize:"11.5px" }}
                      title={h==="Attendance ⓘ" ? "Read-only — for reference only" : ""}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <SalaryRow
                    key={r.record_id}
                    r={r}
                    onChanged={handleRowChanged}
                    onDelete={handleRowDeleted}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"#F8FAFC",borderTop:"2px solid #E8EDF4" }}>
                  <td colSpan={4} style={{ padding:"10px 12px",fontWeight:700,color:"#0F172A",fontSize:"13px" }}>
                    Total ({records.length} staff)
                  </td>
                  <td style={{ padding:"10px 12px",fontWeight:800,color:"#6366F1",fontSize:"14px" }}>{fmt(totalNet)}</td>
                  <td style={{ padding:"10px 12px",fontWeight:700,color:"#10B981" }}>
                    {fmt(records.reduce((s,r) => s + Number(r.bonus||0), 0))}
                  </td>
                  <td style={{ padding:"10px 12px",fontWeight:700,color:"#EF4444" }}>
                    {fmt(records.reduce((s,r) => s + Number(r.deductions||0), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}