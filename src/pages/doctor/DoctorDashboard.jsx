// src/pages/doctor/DoctorDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import DoctorRoutes from "../../modules/doctor/routes";

export default function DoctorDashboard() {
  return (
    <DashboardLayout>
      <DoctorRoutes />
    </DashboardLayout>
  );
}
