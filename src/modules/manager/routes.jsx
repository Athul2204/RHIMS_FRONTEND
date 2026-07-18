// src/modules/manager/routes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import SupportStaffPage     from "./pages/SupportStaffPage";
import AttendancePage       from "./pages/AttendancePage";
import LeavePage            from "./pages/LeavePage";
import SalaryPage           from "./pages/SalaryPage";
import BillsPage            from "./pages/BillsPage";
import ExpensesPage         from "./pages/ExpensesPage";
import DealersPage          from "./pages/DealersPage";
import ProceduresPage       from "./pages/ProceduresPage";

export default function ManagerRoutes() {
  return (
    <Routes>
      <Route index                  element={<ManagerDashboardPage />} />
      <Route path="support-staff"   element={<SupportStaffPage />} />
      <Route path="attendance"      element={<AttendancePage />} />
      <Route path="leaves"          element={<LeavePage />} />
      <Route path="salary"          element={<SalaryPage />} />
      <Route path="bills"           element={<BillsPage />} />
      <Route path="expenses"        element={<ExpensesPage />} />
      <Route path="dealers"         element={<DealersPage />} />
      <Route path="procedures"      element={<ProceduresPage />} />
      <Route path="*"               element={<Navigate to="/manager" replace />} />
    </Routes>
  );
}