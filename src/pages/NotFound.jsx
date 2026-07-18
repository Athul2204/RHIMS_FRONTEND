// src/pages/NotFound.jsx
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#060F1E", color: "white" }}>
      <p className="text-6xl font-bold mb-4" style={{ color: "#C9A84C" }}>404</p>
      <h1 className="text-xl font-semibold mb-2">Page Not Found</h1>
      <p className="text-slate-400 text-sm mb-8">The page you're looking for doesn't exist.</p>
      <button onClick={() => navigate("/")}
        className="text-sm px-5 py-2 rounded-lg"
        style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
        Back to Login
      </button>
    </div>
  );
}
