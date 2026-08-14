// src/routes/AppRoutes.jsx
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

// Auth
import Login from "../pages/auth/Login";

// Role dashboards (each wraps its own module router + DashboardLayout)
// Lazy-loaded so a given user only downloads the code for their own role,
// instead of every role's module landing in the single main bundle.
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const DoctorDashboard = lazy(() => import("../pages/doctor/DoctorDashboard"));
const ReceptionDashboard = lazy(() => import("../pages/receptionist/ReceptionDashboard"));
const PharmacyDashboard = lazy(() => import("../pages/pharmacist/PharmacyDashboard"));
const LabDashboard = lazy(() => import("../pages/lab/LabDashboard"));
const ManagerDashboard = lazy(() => import("../pages/manager/ManagerDashboard"));

// Utility pages
import Unauthorized from "../pages/Unauthorized";
import NotFound from "../pages/NotFound";

function RouteFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      Loading…
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      {/* AuthProvider lives inside BrowserRouter so useNavigate works */}
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Protected — role-gated */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/*"
            element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reception/*"
            element={
              <ProtectedRoute allowedRoles={["receptionist"]}>
                <ReceptionDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pharmacy/*"
            element={
              <ProtectedRoute allowedRoles={["pharmacist"]}>
                <PharmacyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lab/*"
            element={
              <ProtectedRoute allowedRoles={["labtechnician"]}>
                <LabDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute allowedRoles={["manager"]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Legacy singular-role redirect routes — kept for old bookmarks/links */}
          <Route path="/receptionist/*" element={<Navigate to="/reception" replace />} />
          <Route path="/pharmacist/*" element={<Navigate to="/pharmacy" replace />} />
          <Route path="/labtechnician/*" element={<Navigate to="/lab" replace />} />
          <Route path="/lab-technician/*" element={<Navigate to="/lab" replace />} />

          {/* Misc */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRoutes;