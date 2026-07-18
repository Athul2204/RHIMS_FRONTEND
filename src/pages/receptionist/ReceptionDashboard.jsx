// src/pages/receptionist/ReceptionDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import ReceptionistRoutes from "../../modules/receptionist/routes";

export default function ReceptionDashboard() {
  return (
    <DashboardLayout>
      <ReceptionistRoutes />
    </DashboardLayout>
  );
}
