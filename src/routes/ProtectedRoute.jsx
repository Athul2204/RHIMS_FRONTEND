// src/routes/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a route and enforces authentication + optional role-based access.
 *
 * Props:
 *  - allowedRoles  string[]  — if provided, only these roles may access the route
 *  - children      ReactNode — the page/layout to render when access is granted
 *
 * FIX 1: Changed `loading` → `bootLoading`.
 * AuthContext never exported `loading`; it exports `bootLoading` (initial
 * session check) and `authLoading` (login/logout in progress). Using the
 * wrong name meant the guard was always undefined/falsy, so the route
 * evaluated auth state before the /auth/me/ boot check finished — causing
 * an instant redirect to /login even for users with valid cookies.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, bootLoading } = useAuth();
  const location = useLocation();

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400 animate-pulse">Loading…</div>
      </div>
    );
  }

  // Not authenticated → send to login, preserve intended path
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role → unauthorized
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
