// src/modules/doctor/routes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import DoctorDashboardPage  from "./pages/DoctorDashboardPage";
import AppointmentsPage     from "./pages/AppointmentsPage";
import ConsultationsPage    from "./pages/ConsultationsPage";
import LabRequestsPage      from "./pages/LabRequestsPage";
import PrescriptionsPage    from "./pages/PrescriptionsPage";

export default function DoctorRoutes() {
  return (
    <Routes>
      <Route index                    element={<DoctorDashboardPage />} />
      <Route path="appointments"      element={<AppointmentsPage />} />
      {/* Bare /consultations has no standalone list page — redirect to appointments */}
      <Route path="consultations"     element={<Navigate to="/doctor/appointments" replace />} />
      <Route path="consultations/:id" element={<ConsultationsPage />} />
      <Route path="lab-requests"      element={<LabRequestsPage />} />
      <Route path="prescriptions"     element={<PrescriptionsPage />} />
      <Route path="*"                 element={<Navigate to="/doctor" replace />} />
    </Routes>
  );
}