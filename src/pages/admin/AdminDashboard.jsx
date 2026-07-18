// src/pages/admin/AdminDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import AdminRoutes from "../../modules/admin/routes";

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <AdminRoutes />
    </DashboardLayout>
  );
}
