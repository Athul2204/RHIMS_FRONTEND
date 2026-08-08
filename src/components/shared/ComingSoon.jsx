// src/components/shared/ComingSoon.jsx
export default function ComingSoon({ title, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center", maxWidth: "380px" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "16px", margin: "0 auto 18px",
          background: "#F0FDF4", border: "1px solid #BBF7D0",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>{title}</h2>
        <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
          {note || "This module is being rebuilt for the new multi-branch backend and will be available soon."}
        </p>
      </div>
    </div>
  );
}