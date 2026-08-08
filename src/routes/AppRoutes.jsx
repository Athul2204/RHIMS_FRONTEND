// src/routes/AppRoutes.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

// Auth
import Login from "../pages/auth/Login";

// Role dashboards (each wraps its own module router + DashboardLayout)
import AdminDashboard from "../pages/admin/AdminDashboard";
import DoctorDashboard from "../pages/doctor/DoctorDashboard";
import ReceptionDashboard from "../pages/receptionist/ReceptionDashboard";
import PharmacyDashboard from "../pages/pharmacist/PharmacyDashboard";
import LabDashboard from "../pages/lab/LabDashboard";
import ManagerDashboard from "../pages/manager/ManagerDashboard";

// Utility pages
import Unauthorized from "../pages/Unauthorized";
import NotFound from "../pages/NotFound";

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