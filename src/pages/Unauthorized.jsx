// src/pages/Unauthorized.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_ROUTES } from "../context/AuthContext";

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const home = user ? ROLE_ROUTES[user.role] || "/" : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9.5 9.5 14.5 14.5 M14.5 9.5 9.5 14.5" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-800">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account doesn't have permission to view this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to={home}
            className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition-colors"
          >
            Go to my dashboard
          </Link>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}