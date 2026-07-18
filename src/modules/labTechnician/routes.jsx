import { Routes, Route, Navigate } from "react-router-dom";
import LabDashboardPage  from "./pages/LabDashboardPage";
import LabRequestsPage   from "./pages/LabRequestsPage";
import LabTestsPage      from "./pages/LabTestsPage";
import LabPanelsPage     from "./pages/LabPanelsPage";
import LabBillsPage      from "./pages/LabBillsPage";
import WalkInLabRequestPage from "./pages/WalkInLabRequestPage";
import PrintLabBillPage  from "./pages/PrintLabBillPage";

export default function LabTechnicianRoutes() {
  return (
    <Routes>
      <Route index               element={<LabDashboardPage />} />
      <Route path="requests"     element={<LabRequestsPage />} />
      <Route path="walkin"       element={<WalkInLabRequestPage />} />
      <Route path="tests"        element={<LabTestsPage />} />
      <Route path="panels"       element={<LabPanelsPage />} />
      <Route path="bills"        element={<LabBillsPage />} />
      <Route path="bills/print/:billId" element={<PrintLabBillPage />} />
      <Route path="*"            element={<Navigate to="/lab" replace />} />
    </Routes>
  );
}
