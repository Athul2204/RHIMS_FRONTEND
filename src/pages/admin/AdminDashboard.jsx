// src/pages/admin/AdminDashboard.jsx
import DashboardLayout from "../../components/layout/DashboardLayout";
import AdminRoutes from "../../modules/admin/routes";
import SelectBranchPage from "./SelectBranchPage";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboard() {
  const { isGroupAdmin, branchChosen, branchContextLoading } = useAuth();

  // A group admin who hasn't picked a branch yet this session lands here
  // first — full list of branches (+ "All Branches") — instead of going
  // straight into the dashboard. Once chosen (either here or later via the
  // header's BranchSwitcher), branchChosen stays true for the session and
  // this never shows again. Ordinary branch-scoped admins skip this
  // entirely — they have nothing to choose.
  if (isGroupAdmin && !branchChosen && !branchContextLoading) {
    return <SelectBranchPage />;
  }

  return (
    <DashboardLayout>
      <AdminRoutes />
    </DashboardLayout>
  );
}