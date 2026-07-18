// src/modules/labTechnician/pages/LabDashboardPage.jsx
import { useEffect, useState, useCallback } from "react";
import { getLabDashboard, getLabRequests } from "../api/labApi";
import { isValidISODate, toISODate } from "../utils/dateUtils";

const AMBER = "#F59E0B";

const STATUS_COLORS = {
  REQUESTED:        { bg: "#FEF3C7", color: "#D97706" },
  SAMPLE_COLLECTED: { bg: "#DBEAFE", color: "#2563EB" },
  PROCESSING:       { bg: "#EDE9FE", color: "#7C3AED" },
  COMPLETED:        { bg: "#D1FAE5", color: "#059669" },
  VERIFIED:         { bg: "#DCFCE7", color: "#15803D" },
  DELIVERED:        { bg: "#F0FDF4", color: "#16A34A" },
};

const StatCard = ({ label, value, icon, accent, sub }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "14px",
      padding: "20px 22px",
      border: "1px solid #EEF2F7",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      display: "flex",
      alignItems: "flex-start",
      gap: "14px",
    }}
  >
    <div
      style={{
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        background: `${accent}14`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
    </div>
    <div>
      <p
        style={{
          fontSize: "11px",
          color: "#94A3B8",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          marginBottom: "4px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "28px", fontWeight: 700, color: "#0F172A", lineHeight: 1.1 }}>
        {value ?? 0}
      </p>
      {sub && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "3px" }}>{sub}</p>}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_COLORS[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {status?.replace(/_/g, " ") ?? "—"}
    </span>
  );
};

export default function LabDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Single date filter — defaults to today so the dashboard opens showing
  // today's activity. No separate from/to range: start and end are always
  // the same day. Changing the date just moves which single day is shown.
  const todayISO = toISODate(new Date());
  const [date, setDate] = useState(todayISO);
  const hasDateFilter = isValidISODate(date);
  const dateParams = hasDateFilter ? { start: date, end: date } : {};

  const resetToToday = () => {
    setDate(todayISO);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashData, reqsData] = await Promise.all([
        getLabDashboard(dateParams),
        getLabRequests({ ...dateParams, limit: 5 }),
      ]);
      setDashboard(dashData);
      setRecent(reqsData.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = dashboard?.by_status || {};

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
          Lab Dashboard
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B" }}>
          Overview of lab requests and recent activity
        </p>
      </div>

      {/* Date filter */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #EEF2F7",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px", textTransform: "uppercase" }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#374151", background: "#F8FAFC", outline: "none" }}
          />
        </div>
        {date !== todayISO && (
          <button
            onClick={resetToToday}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
          >
            ↺ Today
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
          Loading dashboard...
        </div>
      ) : error ? (
        <div style={{ padding: "40px", textAlign: "center", color: "red" }}>
          <p style={{ fontSize: "14px", fontWeight: 600 }}>Error</p>
          <p style={{ fontSize: "13px" }}>{error}</p>
        </div>
      ) : (
      <>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <StatCard
          label="Total Requests"
          value={dashboard?.total || 0}
          icon="M9 12l2 2 4-4"
          accent={AMBER}
        />
        <StatCard
          label="Pending"
          value={stats.REQUESTED || 0}
          icon="M12 8v4l3 3"
          accent="#F59E0B"
        />
        <StatCard
          label="In Progress"
          value={(stats.SAMPLE_COLLECTED || 0) + (stats.PROCESSING || 0)}
          icon="M13 10V3L4 14h7v7l9-11h-7z"
          accent="#7C3AED"
        />
        <StatCard
          label="Completed"
          value={(stats.COMPLETED || 0) + (stats.VERIFIED || 0)}
          icon="M5 13l4 4L19 7"
          accent="#10B981"
        />
      </div>

      {/* Recent Requests */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #EEF2F7",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px", borderBottom: "1px solid #EEF2F7" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", margin: 0 }}>
            Recent Lab Requests
          </h3>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
            No recent requests
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #EEF2F7" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#64748B",
                    }}
                  >
                    Request ID
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#64748B",
                    }}
                  >
                    Patient
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#64748B",
                    }}
                  >
                    Tests
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#64748B",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((req) => (
                  <tr key={req.request_id} style={{ borderBottom: "1px solid #EEF2F7" }}>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "13px",
                        color: "#1E293B",
                        fontWeight: 600,
                      }}
                    >
                      #{req.request_id}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                      {req.patient_name || "N/A"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                      {req.tests_count || 0} tests
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}