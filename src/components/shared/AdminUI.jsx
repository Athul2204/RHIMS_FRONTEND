// src/components/shared/AdminUI.jsx
//
// Shared visual primitives for every admin-module page (Staff, Doctors,
// Guest Doctors, Common Staff, Procedures, Branches, Audit, Settings).
// Pulled out of what used to be per-page copies (see the old frontend's
// StaffPage/GuestDoctorsPage/ProceduresPage/etc, which each hand-rolled
// their own Ico/Modal/Field/StatusDot) so the multi-branch rebuild has one
// implementation to keep branch-aware instead of eight near-identical ones.
// Visual output is intentionally unchanged from the old frontend's inline-
// SVG, hand-rolled style — no icon library, comparable bundle size.

export const G = "#16A34A";

export const Ico = ({ path, size = 16, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

export const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  plus: "M12 5v14 M5 12h14",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  deact: "M18 6L6 18 M6 6l12 12",
  react: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4",
  close: "M18 6L6 18 M6 6l12 12",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  eyeOff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22",
  building: "M3 21h18 M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14 M9 9h1 M14 9h1 M9 13h1 M14 13h1 M9 17h1 M14 17h1",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  crown: "M2 20h20 M4 20 2 8l5.5 4L12 4l4.5 8L22 8l-2 12",
};

export const inp = {
  width: "100%", padding: "9px 12px", borderRadius: "9px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", background: "#fff", boxSizing: "border-box",
};

export const StatusDot = ({ active }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: active ? G : "#EF4444", fontWeight: 500 }}>
    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: active ? G : "#EF4444" }} />
    {active ? "Active" : "Inactive"}
  </span>
);

export const Field = ({ label, required, hint, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px" }}>
      {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
    </label>
    {children}
    {hint && <p style={{ fontSize: "11.5px", color: "#94A3B8", margin: 0 }}>{hint}</p>}
  </div>
);

export const Modal = ({ title, subtitle, onClose, children, maxWidth = "680px" }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
    <div style={{
      position: "relative", background: "#fff", borderRadius: "16px",
      width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto",
      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", padding: "28px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "20px", color: "#64748B", lineHeight: 1 }}>&times;</span>
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>{title}</h1>
      {subtitle && <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const PrimaryButton = ({ onClick, children, disabled, color = G }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ display: "flex", alignItems: "center", gap: "7px", background: disabled ? `${color}80` : color, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>
    {children}
  </button>
);

export const ErrorBanner = ({ children }) => !children ? null : (
  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>
    {children}
  </div>
);

export const Toolbar = ({ children }) => (
  <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
    {children}
  </div>
);

export const SearchInput = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", flex: "1 1 220px" }}>
    <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
      <Ico path={ICONS.search} size={15} color="#94A3B8" />
    </span>
    <input value={value} onChange={onChange} placeholder={placeholder} style={{ ...inp, paddingLeft: "34px" }} />
  </div>
);

export const TableShell = ({ children }) => (
  <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid #F1F5F9", overflow: "hidden" }}>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
    </div>
  </div>
);

export const Thead = ({ columns }) => (
  <thead style={{ background: "#F8FAFC" }}>
    <tr>
      {columns.map(h => (
        <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
      ))}
    </tr>
  </thead>
);

export const SkeletonRows = ({ rows = 6, cols = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} style={{ borderTop: "1px solid #F8FAFC" }}>
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} style={{ padding: "14px" }}>
            <div style={{ height: "14px", borderRadius: "4px", background: "#F1F5F9", animation: "pulse 1.5s infinite" }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const EmptyRow = ({ colSpan, label = "No records found." }) => (
  <tr>
    <td colSpan={colSpan} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
      <Ico path={ICONS.user} size={36} color="#CBD5E1" /><br />
      <span style={{ marginTop: "8px", display: "block" }}>{label}</span>
    </td>
  </tr>
);

export const Pagination = ({ next, prev, count, onNext, onPrev }) => !(next || prev) ? null : (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #F1F5F9" }}>
    <button onClick={() => prev && onPrev()} disabled={!prev}
      style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: prev ? "pointer" : "not-allowed", fontSize: "13px", color: prev ? "#1E293B" : "#CBD5E1" }}>
      ← Previous
    </button>
    <span style={{ fontSize: "13px", color: "#64748B" }}>{count} total</span>
    <button onClick={() => next && onNext()} disabled={!next}
      style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: next ? "pointer" : "not-allowed", fontSize: "13px", color: next ? "#1E293B" : "#CBD5E1" }}>
      Next →
    </button>
  </div>
);

export const PulseKeyframes = () => <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }`}</style>;

/**
 * Branch cell used in table rows across every admin list — renders the
 * branch code/name for a group admin (who may be looking at cross-branch
 * data) and nothing for a branch-scoped user (redundant: always their own
 * branch). `branch` is whatever the row's serializer sent back — either a
 * nested {branch_id, name, code} object (Branch itself) or a raw FK id
 * plus separately-looked-up branch objects; pass whichever your page has.
 */
export const BranchCell = ({ branch, branches, show }) => {
  if (!show) return null;
  let label = null;
  if (branch && typeof branch === "object") {
    label = branch.code || branch.name;
  } else if (branch != null && Array.isArray(branches)) {
    const found = branches.find(b => b.branch_id === branch);
    label = found ? found.code : null;
  }
  if (!label) {
    return <span style={{ fontSize: "12px", color: "#CBD5E1" }}>—</span>;
  }
  return (
    <span style={{ fontFamily: "monospace", fontSize: "11px", background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
      {label}
    </span>
  );
};