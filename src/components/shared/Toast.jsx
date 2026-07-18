// src/components/shared/Toast.jsx
//
// Small, self-dismissing toast notification. Mirrors the local Toast
// pattern already used in the doctor/pharmacist/lab modules, extracted
// here so every module (including admin) can share one implementation
// instead of re-implementing window.alert() popups.
import { useCallback, useState } from "react";

const G = "#16A34A";

const Ico = ({ d, size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 4000,
      padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: toast.ok ? "#F0FDF4" : "#FEF2F2",
      color:      toast.ok ? "#166534" : "#B91C1C",
      border: `1px solid ${toast.ok ? "#BBF7D0" : "#FECACA"}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "toast-slide-in 0.2s ease-out",
    }}>
      <Ico d={toast.ok ? "M20 6 9 17l-5-5" : "M18 6 6 18 M6 6l12 12"} size={14}
        color={toast.ok ? G : "#DC2626"} />
      {toast.msg}
      <style>{`@keyframes toast-slide-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/**
 * useToast() — returns [toast, showToast].
 * showToast(message, ok = true) displays the toast for ~2.8s.
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  return [toast, showToast];
}
