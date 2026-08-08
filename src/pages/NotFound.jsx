// src/pages/NotFound.jsx
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-slate-200">404</p>
        <h1 className="mt-4 text-xl font-bold text-slate-800">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}