// src/components/layout/DashboardLayout.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../api";
import BranchSwitcher from "./BranchSwitcher";

/* ─── SVG Icon ─── */
const Icon = ({ d, size = 18, extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  dashboard:     { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", extra: "M9 22V12h6v10" },
  staff:         { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  patient:       { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
  appointment:   { d: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" },
  medicine:      { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" },
  lab:           { d: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11 M5 14H3 M21 14h-2 M9 14h6" },
  prescription:  { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
  billing:       { d: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  audit:         { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4" },
  results:       { d: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  plus:          { d: "M12 5v14 M5 12h14" },
  equipment:     { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" },
  logout:        { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" },
  menu:          { d: "M3 12h18 M3 6h18 M3 18h18" },
  search:        { d: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" },
  bell:          { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" },
  chevDown:      { d: "M6 9l6 6 6-6" },
  stock:         { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  supplies:      { d: "M3 7h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z", extra: "M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" },
  settings:      { d: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  user:          { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
  mail:          { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" },
  shield:        { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  clock:         { d: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2" },
  guest:         { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8l2 2 M21 6l-2 2" },
  procedure:     { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8" },
  monthlyReport: { d: "M8 2v4 M16 2v4 M3 10h18 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01" },
  dealer:        { d: "M1 3h15v13H1z M16 8h4l3 3v5h-7V8z", extra: "M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  generalItems:  { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", extra: "M3 6h18 M16 10a4 4 0 0 1-8 0" },
  globe:         { d: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20", extra: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" },
  building:      { d: "M3 21h18 M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14", extra: "M9 9h1 M14 9h1 M9 13h1 M14 13h1 M9 17h1 M14 17h1" },
};

/* ─── Nav config ─── */
const NAV = {
  admin: {
    main: [
      { label: "Dashboard",       to: "/admin",               icon: "dashboard" },
      { label: "Branches",        to: "/admin/branches",      icon: "building" },
      { label: "Staff",           to: "/admin/staff",         icon: "staff" },
    ],
    catalog: [
      { label: "Doctors",         to: "/admin/doctors",       icon: "staff" },
      { label: "Receptionists",   to: "/admin/receptionists", icon: "patient" },
      { label: "Common Receptionists", to: "/admin/common-receptionists", icon: "patient" },
      { label: "Lab Technicians", to: "/admin/lab-techs",     icon: "lab" },
      { label: "Pharmacists",     to: "/admin/pharmacists",   icon: "medicine" },
      { label: "Common Pharmacists",   to: "/admin/common-pharmacists",   icon: "medicine" },
      { label: "Managers",        to: "/admin/managers",      icon: "user" },
      { label: "Guest Doctors",   to: "/admin/guest-doctors", icon: "guest" },
      { label: "Procedures",      to: "/admin/procedures",    icon: "procedure" },
    ],
    website: [
      { label: "Website Management", to: "/admin/website",    icon: "globe" },
    ],
    help: [
      { label: "Audit Logs",      to: "/admin/audit",         icon: "audit" },
      { label: "Settings",        to: "/admin/settings",      icon: "settings" },
    ],
  },
  doctor: {
    main: [
      { label: "Dashboard",     to: "/doctor",               icon: "dashboard" },
      { label: "Appointments",  to: "/doctor/appointments",  icon: "appointment" },
      { label: "Consultations", to: "/doctor/consultations", icon: "prescription" },
    ],
    catalog: [
      { label: "Lab Requests",  to: "/doctor/lab-requests",  icon: "lab" },
      { label: "Prescriptions", to: "/doctor/prescriptions", icon: "medicine" },
    ],
    help: [],
  },
  receptionist: {
    main: [
      { label: "Dashboard",    to: "/reception",              icon: "dashboard" },
      { label: "Patients",     to: "/reception/patients",     icon: "patient" },
      { label: "Appointments", to: "/reception/appointments", icon: "appointment" },
      { label: "Prebookings",  to: "/reception/prebookings",  icon: "appointment" },
    ],
    catalog: [
      { label: "Billing",             to: "/reception/billing",             icon: "billing" },
      { label: "Pharmacy Bills",      to: "/reception/pharmacy-bills",      icon: "billing" },
      { label: "Follow-up Reminders", to: "/reception/follow-up-reminders", icon: "appointment" },
    ],
    help: [],
  },
  pharmacist: {
    main: [
      { label: "Dashboard",     to: "/pharmacy",               icon: "dashboard" },
      { label: "Prescriptions", to: "/pharmacy/prescriptions", icon: "prescription" },
    ],
    catalog: [
      { label: "Medicines",       to: "/pharmacy/medicines",      icon: "medicine" },
      { label: "Stock & Batches", to: "/pharmacy/stock",          icon: "stock" },
      { label: "Supplies",        to: "/pharmacy/supplies",       icon: "supplies" },
      { label: "General Items",   to: "/pharmacy/general-items",  icon: "generalItems" },
      { label: "Bills",           to: "/pharmacy/bills",          icon: "billing" },
    ],
    reports: [
      { label: "Monthly Report",  to: "/pharmacy/monthly-report", icon: "monthlyReport" },
    ],
    help: [],
  },
  labtechnician: {
    main: [
      { label: "Dashboard",    to: "/lab",           icon: "dashboard" },
      { label: "Lab Requests", to: "/lab/requests",  icon: "lab" },
      { label: "Walk-in Test", to: "/lab/walkin",    icon: "plus" },
      { label: "Lab Tests",    to: "/lab/tests",     icon: "results" },
      { label: "Test Panels",  to: "/lab/panels",    icon: "results" },
    ],
    catalog: [
      { label: "Bills",        to: "/lab/bills",     icon: "billing" },
    ],
    help: [],
  },
  manager: {
    main: [
      { label: "Dashboard",      to: "/manager",                icon: "dashboard" },
      { label: "Support Staff",  to: "/manager/support-staff",  icon: "staff" },
      { label: "Attendance",     to: "/manager/attendance",     icon: "appointment" },
    ],
    catalog: [
      { label: "Leave Requests", to: "/manager/leaves",         icon: "clock" },
      { label: "Salary",         to: "/manager/salary",         icon: "billing" },
      { label: "Expenses",       to: "/manager/expenses",       icon: "billing" },
      { label: "Income",        to: "/manager/income",         icon: "billing" },
      { label: "Dealers",        to: "/manager/dealers",        icon: "dealer" },
      { label: "Procedures",     to: "/manager/procedures",     icon: "procedure" },
    ],
    reports: [
      { label: "Bills Overview", to: "/manager/bills",          icon: "monthlyReport" },
    ],
    website: [
      { label: "Website Management", to: "/manager/website",    icon: "globe" },
    ],
    help: [],
  },
};

const GROUP_LABELS = {
  admin:         { catalog: "CATALOG",    reports: "",        help: "HELP & SETTINGS" },
  doctor:        { catalog: "CLINICAL",   reports: "",        help: "" },
  receptionist:  { catalog: "MANAGEMENT", reports: "",        help: "" },
  pharmacist:    { catalog: "INVENTORY",  reports: "REPORTS", help: "" },
  labtechnician: { catalog: "OPERATIONS", reports: "",        help: "" },
  manager:       { catalog: "HR & OPS",   reports: "FINANCE", help: "" },
};
const WEBSITE_GROUP_LABEL = "WEBSITE";

const ROLE_META = {
  admin:         { label: "Administrator",  color: "#16A34A", initials: "AD" },
  doctor:        { label: "Doctor",         color: "#3B82F6", initials: "DR" },
  receptionist:  { label: "Receptionist",   color: "#10B981", initials: "RC" },
  pharmacist:    { label: "Pharmacist",     color: "#8B5CF6", initials: "PH" },
  labtechnician: { label: "Lab Technician", color: "#F59E0B", initials: "LT" },
  manager:       { label: "Manager",        color: "#EA580C", initials: "MG" },
};

const SEARCH_PLACEHOLDER = {
  admin:         "Search staff, doctors…",
  doctor:        "Search patients, consultations…",
  receptionist:  "Search patients, appointments…",
  pharmacist:    "Search medicines, prescriptions…",
  labtechnician: "Search tests, requests…",
  manager:       "Search staff, expenses…",
};

/* ─── Notifications fetcher ───
   Each notification carries a `link` (the page it relates to) so that
   clicking it redirects to the exact place where the user can act on it. */
async function fetchNotifications(role) {
  try {
    if (role === "labtechnician") {
      const res = await API.get("/lab/dashboard/");
      const d   = res.data;
      const items = [];
      if (d.by_status?.REQUESTED       > 0) items.push({ id: "r1", icon: "lab",      color: "#F59E0B", title: `${d.by_status.REQUESTED} new lab request(s) awaiting`, time: "Now", link: "/lab/requests?status=REQUESTED" });
      if (d.by_status?.SAMPLE_COLLECTED > 0) items.push({ id: "r2", icon: "clock",    color: "#3B82F6", title: `${d.by_status.SAMPLE_COLLECTED} sample(s) ready to process`, time: "Now", link: "/lab/requests?status=SAMPLE_COLLECTED" });
      if (d.by_status?.PROCESSING       > 0) items.push({ id: "r3", icon: "clock",    color: "#7C3AED", title: `${d.by_status.PROCESSING} request(s) currently processing`, time: "Now", link: "/lab/requests?status=PROCESSING" });
      if (d.by_status?.COMPLETED        > 0) items.push({ id: "r4", icon: "results",  color: "#059669", title: `${d.by_status.COMPLETED} result(s) pending verification`, time: "Now", link: "/lab/requests?status=COMPLETED" });
      return items;
    }
    if (role === "receptionist") {
      const res = await API.get("/reception/bills/", { params: { payment_status: "PENDING", page_size: 5 } });
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results ?? res.data?.data ?? []);
      return arr.length > 0
        ? [{ id: "b1", icon: "billing", color: "#EF4444", title: `${arr.length} unpaid bill(s) pending payment`, time: "Now", link: "/reception/billing?filter=pending" }]
        : [];
    }
    if (role === "doctor") {
      const res   = await API.get("/lab/requests/", { params: { status: "VERIFIED" } });
      const d     = res.data;
      const count = d?.count ?? (Array.isArray(d) ? d.length : (d?.results?.length ?? 0));
      return count > 0
        ? [{ id: "d1", icon: "results", color: "#059669", title: `${count} lab result(s) ready for review`, time: "Now", link: "/doctor/lab-requests?status=VERIFIED" }]
        : [];
    }
    return [];
  } catch {
    return [];
  }
}

const SIDEBAR_W   = 232;
const COLLAPSED_W = 64;

export default function DashboardLayout({ children }) {
  const { user, logout, isGroupAdmin } = useAuth();
  const [collapsed,     setCollapsed]     = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [notifs,        setNotifs]        = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const navigate   = useNavigate();
  const location   = useLocation();
  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  const role        = user?.role ?? "admin";
  const baseNavGroups = NAV[role] ?? NAV.admin;
  // Branch Management is group-admin (or superuser) only — an ordinary
  // branch-scoped admin has nothing to do there (their one branch can't be
  // edited from that page), so the link shouldn't even appear for them.
  const navGroups = (role === "admin" && !isGroupAdmin)
    ? { ...baseNavGroups, main: (baseNavGroups.main ?? []).filter(item => item.to !== "/admin/branches") }
    : baseNavGroups;
  const groupLabels = GROUP_LABELS[role] ?? GROUP_LABELS.admin;
  const meta        = ROLE_META[role] ?? ROLE_META.admin;
  const { label: roleLabel, color: accent, initials } = meta;

  const username  = user?.username   ?? user?.name ?? "User";
  const firstName = user?.first_name ?? "";
  const lastName  = user?.last_name  ?? "";
  const fullName  = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : username;
  const email     = user?.email      ?? "";
  const staffCode = user?.staff_code ?? "";
  const searchPH  = SEARCH_PLACEHOLDER[role] ?? "Search…";

  /* ── Notifications ── */
  const loadNotifs = useCallback(() => {
    setNotifsLoading(true);
    fetchNotifications(role)
      .then(setNotifs)
      .finally(() => setNotifsLoading(false));
  }, [role]);

  // Refetch whenever the user navigates to a new page — actions like
  // converting a prebooking or paying a bill happen on other pages, and
  // the bell needs to reflect that as soon as the user moves around, not
  // just once at login.
  useEffect(() => { loadNotifs(); }, [loadNotifs, location.pathname]);

  // Also poll periodically so the badge doesn't go stale during a long
  // stay on a single page (e.g. someone else pays the last pending bill).
  useEffect(() => {
    const id = setInterval(loadNotifs, 60000);
    return () => clearInterval(id);
  }, [loadNotifs]);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current   && !notifRef.current.contains(e.target))   setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Close mobile sidebar on route change ── */
  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleLogout = () => { logout(); navigate("/", { replace: true }); };

  /* ── Notification click: redirect to its page, then drop it from the list ── */
  const handleNotifClick = (n) => {
    setShowNotif(false);
    if (n.link) navigate(n.link);
    setNotifs(prev => prev.filter(item => item.id !== n.id));
  };

  /* ── Dismiss a notification in place, without navigating anywhere ── */
  const handleNotifDismiss = (e, id) => {
    e.stopPropagation();
    setNotifs(prev => prev.filter(item => item.id !== id));
  };

  /* ─── NavItem ─── */
  const NavItem = ({ label, to, icon, onClose }) => (
    <NavLink
      to={to}
      end={to.split("/").length <= 2}
      onClick={onClose}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center",
        gap: "10px",
        padding: collapsed ? "9px 0" : "9px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "9px", marginBottom: "2px",
        textDecoration: "none", fontSize: "13.5px",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "#fff" : "rgba(100,116,139,0.95)",
        background: isActive ? accent : "transparent",
        transition: "all 0.15s", position: "relative",
      })}
      className="nav-item"
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          <span style={{ flexShrink: 0, color: isActive ? "#fff" : "rgba(100,116,139,0.9)", display: "flex" }}>
            <Icon d={ICONS[icon]?.d ?? ICONS.dashboard.d} extra={ICONS[icon]?.extra} size={17} />
          </span>
          {!collapsed && (
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  const NavGroup = ({ label, items, onClose }) =>
    !items || items.length === 0 ? null : (
      <div style={{ marginBottom: "4px" }}>
        {!collapsed && label && (
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#CBD5E1", letterSpacing: "0.9px", textTransform: "uppercase", padding: "10px 12px 5px", margin: 0 }}>{label}</p>
        )}
        {collapsed && label && <div style={{ height: "10px" }} />}
        {items.map(item => <NavItem key={item.to} {...item} onClose={onClose} />)}
      </div>
    );

  /* ─── Sidebar content ─── */
  const SidebarInner = ({ isCol, onClose }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Brand */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: isCol ? "16px 0" : "16px 16px",
        borderBottom: "1px solid #F1F5F9",
        justifyContent: isCol ? "center" : "flex-start",
        flexShrink: 0, background: "#fff",
      }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
          background: `${accent}15`, border: `1.5px solid ${accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        {!isCol && (
          <div>
            <div style={{ color: "#0F172A", fontWeight: 800, fontSize: "15px", letterSpacing: "-0.3px" }}>RHIMS</div>
            <div style={{ color: "#94A3B8", fontSize: "10.5px", marginTop: "1px" }}>Hospital Information System</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }} className="rhims-scrollbar">
        <NavGroup label="MAIN"             items={navGroups.main    ?? []} onClose={onClose} />
        <NavGroup label={groupLabels.catalog} items={navGroups.catalog ?? []} onClose={onClose} />
        {(navGroups.reports ?? []).length > 0 && (
          <NavGroup label={groupLabels.reports} items={navGroups.reports} onClose={onClose} />
        )}
        {(navGroups.website ?? []).length > 0 && (
          <NavGroup label={WEBSITE_GROUP_LABEL} items={navGroups.website} onClose={onClose} />
        )}
        {(navGroups.help ?? []).length > 0 && (
          <NavGroup label={groupLabels.help} items={navGroups.help} onClose={onClose} />
        )}
      </nav>

      {/* User card + logout */}
      <div style={{ borderTop: "1px solid #F1F5F9", padding: "10px 8px", flexShrink: 0, background: "#fff" }}>
        {!isCol && (
          <div style={{
            display: "flex", alignItems: "center", gap: "9px",
            padding: "9px 12px", marginBottom: "4px",
            borderRadius: "9px", background: "#F8FAFC",
          }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
              background: `${accent}15`, border: `1.5px solid ${accent}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700, color: accent,
            }}>
              {initials}
            </div>
            <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
              <div style={{ color: "#0F172A", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
              <div style={{ color: accent, fontSize: "11px", fontWeight: 500 }}>{roleLabel}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="logout-btn"
          style={{
            display: "flex", alignItems: "center", gap: "9px", width: "100%",
            padding: isCol ? "9px 0" : "9px 12px",
            justifyContent: isCol ? "center" : "flex-start",
            borderRadius: "9px", background: "none", border: "none",
            cursor: "pointer", color: "#94A3B8", fontSize: "13px", transition: "all 0.15s",
          }}
          title={isCol ? "Log out" : undefined}>
          <Icon d={ICONS.logout.d} size={16} />
          {!isCol && <span>Log out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-shell" style={{ display: "flex", height: "100vh", height: "100dvh", overflow: "hidden", background: "#F8FAFC" }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="dashboard-sidebar"
        style={{
          display: "none", flexDirection: "column", flexShrink: 0,
          width: collapsed ? `${COLLAPSED_W}px` : `${SIDEBAR_W}px`,
          background: "#fff", borderRight: "1px solid #E8EDF4",
          transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
          overflow: "hidden", boxShadow: "1px 0 0 #F1F5F9",
        }}>
        <SidebarInner isCol={collapsed} onClose={() => {}} />
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setMobileOpen(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)" }} />
          <aside
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${SIDEBAR_W}px`, background: "#fff", borderRight: "1px solid #E8EDF4", zIndex: 51 }}
            onClick={e => e.stopPropagation()}>
            <SidebarInner isCol={false} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="dashboard-main-col" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>

        {/* ── Top Header ── */}
        <header className="dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: "60px", flexShrink: 0, background: "#fff", borderBottom: "1px solid #E8EDF4" }}>

          {/* Left: burger + search */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <button className="mobile-menu-btn"
              style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "5px", borderRadius: "7px", flexShrink: 0 }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu">
              <Icon d={ICONS.menu.d} size={20} />
            </button>
            <button className="desktop-collapse-btn"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "5px", borderRadius: "7px", transition: "all 0.15s", flexShrink: 0 }}
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onMouseEnter={e => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "#F1F5F9"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#94A3B8"; e.currentTarget.style.background = "none"; }}>
              <Icon d={ICONS.menu.d} size={18} />
            </button>
            <div style={{ position: "relative", flex: 1, maxWidth: "400px" }} className="header-search">
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94A3B8" }}>
                <Icon d={ICONS.search.d} size={15} />
              </span>
              <input type="text" placeholder={searchPH}
                style={{ width: "100%", padding: "8px 12px 8px 36px", borderRadius: "10px", border: "1.5px solid #E8EDF4", fontSize: "13px", color: "#475569", background: "#F8FAFC", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, background 0.15s" }}
                onFocus={e  => { e.target.style.borderColor = accent; e.target.style.background = "#fff"; }}
                onBlur={e   => { e.target.style.borderColor = "#E8EDF4"; e.target.style.background = "#F8FAFC"; }}
              />
            </div>
          </div>

          {/* Right: bell + divider + user */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "16px" }}>

            {/* ── Notification Bell ── */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={() => { setShowNotif(v => !v); if (!showNotif) loadNotifs(); setShowProfile(false); }}
                style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "7px", borderRadius: "9px", color: "#64748B", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#334155"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none";    e.currentTarget.style.color = "#64748B"; }}
                aria-label="Notifications">
                <Icon d={ICONS.bell.d} size={19} />
                {notifs.length > 0 && (
                  <span style={{ position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444", border: "1.5px solid #fff" }} />
                )}
              </button>

              {showNotif && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "340px", background: "#fff", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: "1px solid #E8EDF4", zIndex: 200, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>Notifications</span>
                    {notifs.length > 0 && (
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff", background: "#EF4444", borderRadius: "10px", padding: "1px 7px" }}>{notifs.length}</span>
                    )}
                  </div>
                  <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                    {notifsLoading ? (
                      <div style={{ padding: "32px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>Loading…</div>
                    ) : notifs.length === 0 ? (
                      <div style={{ padding: "32px", textAlign: "center" }}>
                        <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                        <p style={{ fontSize: "13px", color: "#94A3B8", fontWeight: 500, margin: 0 }}>You're all caught up!</p>
                        <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "4px", margin: "4px 0 0" }}>No pending items right now.</p>
                      </div>
                    ) : notifs.map(n => {
                      const iconCfg = ICONS[n.icon] ?? ICONS.bell;
                      return (
                        <div key={n.id}
                          onClick={() => handleNotifClick(n)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleNotifClick(n); }}
                          style={{ padding: "12px 18px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: "12px", alignItems: "flex-start", cursor: "pointer", transition: "background 0.12s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${n.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={n.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d={iconCfg.d} />
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "13px", color: "#1E293B", fontWeight: 500, lineHeight: "1.4", margin: "0 0 3px" }}>{n.title}</p>
                            <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>{n.time}</p>
                          </div>
                          <button
                            onClick={e => handleNotifDismiss(e, n.id)}
                            aria-label="Dismiss notification"
                            title="Dismiss"
                            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", color: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#64748B"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#CBD5E1"; }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18 M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: "10px 18px", borderTop: "1px solid #F1F5F9", textAlign: "center" }}>
                    <button onClick={() => { setShowNotif(false); loadNotifs(); }}
                      style={{ fontSize: "12px", color: accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Branch Switcher (group admins) / Branch Badge (branch admins) ── */}
            <BranchSwitcher />

            {/* Divider */}
            <div style={{ width: "1px", height: "24px", background: "#E8EDF4", margin: "0 4px" }} />

            {/* ── User Profile ── */}
            <div ref={profileRef} style={{ position: "relative" }}>
              <button
                onClick={() => { setShowProfile(v => !v); setShowNotif(false); }}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: "5px 8px 5px 5px", borderRadius: "10px", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${accent}15`, border: `1.5px solid ${accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: accent, flexShrink: 0 }}>
                  {initials}
                </div>
                <span className="header-username" style={{ color: "#334155", fontSize: "13px", fontWeight: 600, display: "none", whiteSpace: "nowrap" }}>{fullName || username}</span>
                <span className="header-chevron" style={{ display: "none", color: "#94A3B8" }}>
                  <Icon d={ICONS.chevDown.d} size={13} />
                </span>
              </button>

              {/* Profile Dropdown */}
              {showProfile && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "280px", background: "#fff", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: "1px solid #E8EDF4", zIndex: 200, overflow: "hidden" }}>
                  {/* Avatar + name */}
                  <div style={{ padding: "18px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: `${accent}15`, border: `2px solid ${accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, color: accent, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{fullName || username}</p>
                      <p style={{ fontSize: "12px", color: accent, fontWeight: 600, margin: "2px 0 0" }}>{roleLabel}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[
                      { icon: ICONS.user.d,   label: "Username",   value: username },
                      email     ? { icon: ICONS.mail.d,   label: "Email",     value: email }     : null,
                      staffCode ? { icon: ICONS.shield.d, label: "Staff Code", value: staffCode } : null,
                    ].filter(Boolean).map(row => (
                      <div key={row.label} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d={row.icon} />
                        </svg>
                        <div>
                          <p style={{ fontSize: "10.5px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{row.label}</p>
                          <p style={{ fontSize: "13px", color: "#475569", fontWeight: 500, margin: "1px 0 0", wordBreak: "break-all" }}>{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Role badge */}
                  <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", background: `${accent}12`, color: accent, fontSize: "12px", fontWeight: 600 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={ICONS.shield.d} />
                      </svg>
                      {roleLabel}
                    </span>
                  </div>

                  {/* Sign Out */}
                  <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9" }}>
                    <button onClick={handleLogout}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "9px 14px", borderRadius: "9px", border: "none", background: "#FEF2F2", color: "#EF4444", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FEE2E2"}
                      onMouseLeave={e => e.currentTarget.style.background = "#FEF2F2"}>
                      <Icon d={ICONS.logout.d} size={15} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="dashboard-content" style={{ flex: 1, overflowY: "auto", padding: "24px 20px", background: "#F8FAFC" }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .dashboard-sidebar    { display: flex !important; }
          .mobile-menu-btn      { display: none !important; }
          .desktop-collapse-btn { display: flex !important; }
          .header-username,
          .header-chevron       { display: flex !important; }
          main { padding: 28px !important; }
        }
        @media (max-width: 767px) {
          .desktop-collapse-btn { display: none !important; }
          .mobile-menu-btn      { display: flex !important; }
          .header-search        { display: none !important; }
        }
        .nav-item:hover:not([aria-current="page"]) {
          background: #F1F5F9 !important;
          color: #1E293B !important;
        }
        .nav-item:hover:not([aria-current="page"]) span {
          color: #475569 !important;
        }
        .logout-btn:hover { background: #FEF2F2 !important; color: #EF4444 !important; }
        .rhims-scrollbar::-webkit-scrollbar       { width: 4px; }
        .rhims-scrollbar::-webkit-scrollbar-track  { background: transparent; }
        .rhims-scrollbar::-webkit-scrollbar-thumb  { background: #E2E8F0; border-radius: 4px; }
        .rhims-scrollbar { scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }

        /* ─── Global print reset ───
           Whenever any page inside the dashboard is printed, strip away the
           app chrome (sidebar, header, scroll containers) so only the
           printable content the page itself supplies (e.g. #bill-print)
           ends up on paper — no nav, no bell, no avatar. */
        @media print {
          .dashboard-sidebar,
          .dashboard-header,
          .mobile-menu-btn,
          .no-print {
            display: none !important;
          }
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .dashboard-shell,
          .dashboard-main-col,
          .dashboard-content {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}