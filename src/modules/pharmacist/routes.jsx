// src/modules/pharmacist/routes.jsx - UPDATED (DispensePage removed)
// ✅ DispensePage functionality now integrated into BillsPage detail view
// ✅ All other pages remain intact

import { Routes, Route, Navigate } from "react-router-dom";
import PharmacistDashboardPage  from "./pages/PharmacistDashboardPage";
import PrescriptionsPage        from "./pages/PrescriptionsPage";
import PrescriptionDetailPage   from "./pages/PrescriptionDetailPage";
import MedicinesPage            from "./pages/MedicinesPage";
import StockPage                from "./pages/StockPage";
import SuppliesPage              from "./pages/SuppliesPage";
import GeneralItemsPage         from "./pages/GeneralItemsPage";
import BillsPage                from "./pages/BillsPage";
import PrintBillPage            from "./pages/PrintBillPage";
import MonthlyDispensePage      from "./pages/MonthlyDispensePage";

export default function PharmacistRoutes() {
  return (
    <Routes>
      <Route index                              element={<PharmacistDashboardPage />} />
      <Route path="prescriptions"              element={<PrescriptionsPage />} />
      <Route path="prescriptions/:billId"      element={<PrescriptionDetailPage />} />
      <Route path="medicines"                  element={<MedicinesPage />} />
      <Route path="stock"                      element={<StockPage />} />
      <Route path="supplies"                   element={<SuppliesPage />} />
      <Route path="general-items"              element={<GeneralItemsPage />} />
      <Route path="bills"                      element={<BillsPage />} />
      <Route path="bills/print/:billId"        element={<PrintBillPage />} />
      <Route path="monthly-report"             element={<MonthlyDispensePage />} />
      <Route path="*"                          element={<Navigate to="/pharmacy" replace />} />
    </Routes>
  );
}