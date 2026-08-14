// src/modules/manager/routes.jsx
import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Lazy-loaded so a manager only downloads the code for the sub-page they
// actually open, instead of every manager page (incl. xlsx/jspdf-heavy
// ones like Bills/Expenses/Income) landing in one large chunk.
const ManagerDashboardPage    = lazy(() => import("./pages/ManagerDashboardPage"));
const SupportStaffPage        = lazy(() => import("./pages/SupportStaffPage"));
const AttendancePage          = lazy(() => import("./pages/AttendancePage"));
const LeavePage                = lazy(() => import("./pages/LeavePage"));
const SalaryPage               = lazy(() => import("./pages/SalaryPage"));
const BillsPage                = lazy(() => import("./pages/BillsPage"));
const ExpensesPage             = lazy(() => import("./pages/ExpensesPage"));
const IncomePage               = lazy(() => import("./pages/IncomePage"));
const DealersPage              = lazy(() => import("./pages/DealersPage"));
const ProceduresPage           = lazy(() => import("./pages/ProceduresPage"));
const BillingDepartmentsPage   = lazy(() => import("./pages/BillingDepartmentsPage"));
const WebsiteManagementPage    = lazy(() => import("./pages/WebsiteManagementPage"));

function RouteFallback() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
      Loading…
    </div>
  );
}

export default function ManagerRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index                  element={<ManagerDashboardPage />} />
        <Route path="support-staff"   element={<SupportStaffPage />} />
        <Route path="attendance"      element={<AttendancePage />} />
        <Route path="leaves"          element={<LeavePage />} />
        <Route path="salary"          element={<SalaryPage />} />
        <Route path="bills"           element={<BillsPage />} />
        <Route path="expenses"        element={<ExpensesPage />} />
        <Route path="income"          element={<IncomePage />} />
        <Route path="dealers"         element={<DealersPage />} />
        <Route path="procedures"      element={<ProceduresPage />} />
        <Route path="billing-departments" element={<BillingDepartmentsPage />} />
        <Route path="website"         element={<WebsiteManagementPage />} />
        <Route path="*"               element={<Navigate to="/manager" replace />} />
      </Routes>
    </Suspense>
  );
}