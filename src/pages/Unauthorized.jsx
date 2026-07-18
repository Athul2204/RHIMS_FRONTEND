// src/pages/Unauthorized.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#060F1E", color: "white" }}>
      <p className="text-6xl font-bold mb-4" style={{ color: "#EF4444" }}>403</p>
      <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
      <p className="text-slate-400 text-sm mb-8">You don't have permission to view this page.</p>
      <button onClick={() => navigate(-1)}
        className="text-sm px-5 py-2 rounded-lg"
        style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
        Go Back
      </button>
    </div>
  );
}
