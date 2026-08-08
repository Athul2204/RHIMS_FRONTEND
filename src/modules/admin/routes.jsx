// src/modules/admin/routes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import AdminDashboardPage   from "./pages/AdminDashboardPage";
import BranchesPage         from "./pages/BranchesPage";
import StaffPage            from "./pages/StaffPage";
import DoctorsPage          from "./pages/DoctorsPage";
import ReceptionistsPage    from "./pages/ReceptionistsPage";
import LabTechsPage         from "./pages/LabTechsPage";
import PharmacistsPage      from "./pages/PharmacistsPage";
import GuestDoctorsPage     from "./pages/GuestDoctorsPage";
import AuditPage            from "./pages/AuditPage";
import ProceduresPage       from "./pages/ProceduresPage";
import HospitalSettingsPage from "./pages/HospitalSettingsPage";
import ManagersPage         from "./pages/ManagersPage";
import CommonReceptionistsPage from "./pages/CommonReceptionistsPage";
import CommonPharmacistsPage   from "./pages/CommonPharmacistsPage";
// Reused from the manager module rather than duplicated — same backend
// endpoints (IsAdminOrManager on every /manager/website/... view already
// grants Admin full access; "manager" in the URL is legacy naming, not a
// role gate) and the page itself has no manager-specific assumptions.
// Admin/DoctorsPage already imports from manager/api/websiteApi, so this
// cross-module reuse matches an existing pattern in this codebase.
import WebsiteManagementPage from "../manager/pages/WebsiteManagementPage";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index                    element={<AdminDashboardPage />} />
      <Route path="branches"          element={<BranchesPage />} />
      <Route path="staff"             element={<StaffPage />} />
      <Route path="doctors"           element={<DoctorsPage />} />
      <Route path="receptionists"     element={<ReceptionistsPage />} />
      <Route path="lab-techs"         element={<LabTechsPage />} />
      <Route path="pharmacists"       element={<PharmacistsPage />} />
      <Route path="guest-doctors"     element={<GuestDoctorsPage />} />
      <Route path="common-receptionists" element={<CommonReceptionistsPage />} />
      <Route path="common-pharmacists"   element={<CommonPharmacistsPage />} />
      <Route path="managers"          element={<ManagersPage />} />
      <Route path="audit"             element={<AuditPage />} />
      <Route path="procedures"        element={<ProceduresPage />} />
      <Route path="website"           element={<WebsiteManagementPage />} />
      <Route path="settings"          element={<HospitalSettingsPage />} />
      <Route path="*"                 element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}