// src/pages/lab/LabDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import LabTechnicianRoutes from "../../modules/labTechnician/routes";

export default function LabDashboard() {
  return (
    <DashboardLayout>
      <LabTechnicianRoutes />
    </DashboardLayout>
  );
}
