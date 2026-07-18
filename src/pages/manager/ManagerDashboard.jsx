// src/pages/manager/ManagerDashboard.jsx
// Entry wrapper that wires DashboardLayout + ManagerRoutes

import DashboardLayout from "../../components/layout/DashboardLayout";
import ManagerRoutes   from "../../modules/manager/routes";

export default function ManagerDashboard() {
  return (
    <DashboardLayout>
      <ManagerRoutes />
    </DashboardLayout>
  );
}