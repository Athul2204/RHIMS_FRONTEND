// src/components/shared/ConfirmDialog.jsx
//
// In-app replacement for window.confirm(). Browser-native confirm popups
// (e.g. "localhost:5173 says...") look broken/unprofessional and can't be
// themed, so any "are you sure?" action should render this instead.
//
// Usage:
//   const [confirmTarget, setConfirmTarget] = useState(null);
//   ...
//   <button onClick={() => setConfirmTarget(booking)}>Cancel</button>
//   ...
//   {confirmTarget && (
//     <ConfirmDialog
//       title="Cancel prebooking?"
//       message={`Cancel the prebooking for ${confirmTarget.patient_name}?`}
//       confirmLabel="Yes, cancel"
//       danger
//       onConfirm={() => { doCancel(confirmTarget); setConfirmTarget(null); }}
//       onClose={() => setConfirmTarget(null)}
//     />
//   )}

const G = "#16A34A";
const RED = "#DC2626";

const Ico = ({ d, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export default function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  const accent = danger ? RED : G;
  const accentBg = danger ? "#FEF2F2" : "#DCFCE7";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "400px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}
      >
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "20px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Ico d="M12 9v4 M12 17h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={20} color={accent} />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>{title}</h2>
            {message && <p style={{ fontSize: "13.5px", color: "#64748B", margin: 0, lineHeight: 1.5 }}>{message}</p>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ flex: 1, padding: "10px", borderRadius: "9px", border: "1.5px solid #E8EDF4", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ flex: 1, padding: "10px", borderRadius: "9px", border: "none", background: loading ? "#D1D5DB" : accent, color: "#fff", fontSize: "13px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}