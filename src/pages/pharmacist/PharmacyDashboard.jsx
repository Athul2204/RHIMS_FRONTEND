// src/pages/pharmacist/PharmacyDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import PharmacistRoutes from "../../modules/pharmacist/routes";

export default function PharmacyDashboard() {
  return (
    <DashboardLayout>
      <PharmacistRoutes />
    </DashboardLayout>
  );
}
