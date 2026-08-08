// src/modules/receptionist/routes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ReceptionDashboardPage from "./pages/ReceptionDashboardPage";
import PatientsPage           from "./pages/PatientsPage";
import AppointmentsPage       from "./pages/AppointmentsPage";
import BillingPage            from "./pages/BillingPage";
import FollowUpRemindersPage  from "./pages/FollowUpRemindersPage";
import PreBookingsPage        from "./pages/PreBookingsPage";
import PrintConsultationBillPage from "./pages/PrintConsultationBillPage";
import PharmacyBillsPage      from "./pages/PharmacyBillsPage";
import PrintPharmacyBillPage  from "./pages/PrintPharmacyBillPage";

export default function ReceptionistRoutes() {
  return (
    <Routes>
      <Route index                      element={<ReceptionDashboardPage />} />
      <Route path="patients"            element={<PatientsPage />} />
      <Route path="appointments"        element={<AppointmentsPage />} />
      <Route path="billing"             element={<BillingPage />} />
      <Route path="billing/print/:billId" element={<PrintConsultationBillPage />} />
      <Route path="follow-up-reminders" element={<FollowUpRemindersPage />} />
      <Route path="pharmacy-bills"            element={<PharmacyBillsPage />} />
      <Route path="pharmacy-bills/print/:billId" element={<PrintPharmacyBillPage />} />
    
      <Route path="prebookings"         element={<PreBookingsPage />} />
      <Route path="*"                   element={<Navigate to="/reception" replace />} />
    </Routes>
  );
}