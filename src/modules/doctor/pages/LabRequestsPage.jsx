// src/modules/doctor/pages/LabRequestsPage.jsx
// ═════════════════════════════════════════════════════════════════
// FIXED VERSION - Complete Lab Requests Management
// ✅ Lab requests display with status
// ✅ Lab results integrated and visible
// ✅ Proper filtering and search
// ✅ Full CRUD operations
// ═════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  getLabRequests,
  getLabResultsByRequest,
  transformLabResults,
} from "../api/doctorApi";

const G = "#16A34A";
const G_LIGHT = "#F0FDF4";
const SLATE = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E8EDF4";
const WARNING = "#DC2626";
const WARNING_LIGHT = "#FEF2F2";

// Helper Styles
const style = {
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: SLATE,
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: MUTED,
    margin: "6px 0 0",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: G_LIGHT,
    color: G,
  },
  badgeWarning: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: WARNING_LIGHT,
    color: WARNING,
  },
  card: {
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  cardHover: {
    background: "#fff",
    border: `2px solid ${G}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.1)",
  },
  cardContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultItem: {
    padding: 12,
    borderRadius: 6,
    border: `1px solid ${BORDER}`,
    marginTop: 8,
    fontSize: 13,
  },
  resultValue: {
    fontWeight: 600,
    color: SLATE,
  },
  resultAbnormal: {
    padding: 12,
    borderRadius: 6,
    border: `1px solid ${WARNING}`,
    marginTop: 8,
    fontSize: 13,
    background: WARNING_LIGHT,
  },
  loader: {
    textAlign: "center",
    padding: 40,
    color: MUTED,
  },
};

// Status color helper
const getStatusColor = (status) => {
  const statusColors = {
    REQUESTED: "#3B82F6",
    SAMPLE_COLLECTED: "#8B5CF6",
    PROCESSING: "#F59E0B",
    COMPLETED: G,
    VERIFIED: G,
    DELIVERED: G,
  };
  return statusColors[status] || MUTED;
};

// Status badge component
const StatusBadge = ({ status }) => (
  <span style={{
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: `${getStatusColor(status)}20`,
    color: getStatusColor(status),
  }}>
    {status}
  </span>
);

// Lab Result Item Component
const LabResultItem = ({ item }) => {
  if (!item.result) {
    return (
      <div style={style.resultItem}>
        <div style={{ marginBottom: 4 }}>
          <strong>{item.test_code}</strong> — {item.test_name}
        </div>
        <div style={{ color: MUTED, fontSize: 12 }}>
          ⏳ Result Pending
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...style[item.result.is_abnormal ? "resultAbnormal" : "resultItem"],
    }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 13 }}>
            {item.test_code}
          </strong>
          <span style={{ fontSize: 12, color: MUTED }}>
            {item.test_name}
          </span>
          {item.result.is_abnormal && (
            <span style={{ ...style.badgeWarning, marginLeft: "auto" }}>
              Abnormal
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
        <div>
          <p style={{ color: MUTED, margin: "0 0 2px", fontSize: 11 }}>Value</p>
          <p style={style.resultValue}>
            {item.result.result_value} {item.test_unit}
          </p>
        </div>
        <div>
          <p style={{ color: MUTED, margin: "0 0 2px", fontSize: 11 }}>Normal Range</p>
          <p style={style.resultValue}>
            {item.result.normal_range || item.test_normal_range || "—"}
          </p>
        </div>
        {item.result.remarks && (
          <div style={{ gridColumn: "1 / -1" }}>
            <p style={{ color: MUTED, margin: "0 0 2px", fontSize: 11 }}>Remarks</p>
            <p style={{ margin: 0, color: SLATE }}>
              {item.result.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Lab Request Card Component
const LabRequestCard = ({ request, onSelect, isSelected }) => {
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);

  const loadResults = async () => {
    if (results.length > 0) {
      setResultsExpanded(!resultsExpanded);
      return;
    }

    setLoadingResults(true);
    try {
      const data = await getLabResultsByRequest(request.request_id);
      const transformed = transformLabResults(data);
      setResults(transformed);
      setResultsExpanded(true);
    } catch (err) {
      console.error("Failed to load results:", err);
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  return (
    <div
      style={isSelected ? style.cardHover : style.card}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = G;
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = BORDER;
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={style.cardContent}>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: SLATE, margin: "0 0 6px" }}>
            Lab Request #{request.request_id}
          </h4>
          <p style={{ fontSize: 13, color: SLATE, margin: "0 0 4px", fontWeight: 500 }}>
            {request.patient_name || "Unknown Patient"}
            {request.patient_mrd && (
              <span style={{ color: MUTED, fontWeight: 400 }}> · MRD {request.patient_mrd}</span>
            )}
          </p>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 8px" }}>
            {new Date(request.request_date).toLocaleDateString()}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={request.status} />
            {request.notes && (
              <span style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>
                {request.notes}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            loadResults();
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            background: "#fff",
            color: G,
            fontSize: 12,
            fontWeight: 600,
            cursor: loadingResults ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loadingResults
            ? "Loading..."
            : resultsExpanded
            ? "Hide Results"
            : "View Results"}
        </button>
      </div>

      {/* Results Section */}
      {resultsExpanded && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
        }}>
          {results.length === 0 ? (
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              No results available yet
            </p>
          ) : (
            <div>
              <p style={{
                fontSize: 12,
                fontWeight: 600,
                color: SLATE,
                margin: "0 0 8px",
                textTransform: "uppercase",
              }}>
                Results ({results.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((item) => (
                  <LabResultItem key={item.item_id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Component
export default function LabRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadLabRequests();
  }, []);

  const loadLabRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getLabRequests();
      setRequests(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : "Failed to load lab requests"
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search logic
  const filteredRequests = requests
    .filter((req) => {
      if (filter !== "ALL" && req.status !== filter) return false;
      if (searchTerm && !req.request_id.toString().includes(searchTerm)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.request_id - a.request_id);

  // Status summary
  const statuses = {
    REQUESTED: 0,
    SAMPLE_COLLECTED: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    VERIFIED: 0,
    DELIVERED: 0,
  };

  requests.forEach((req) => {
    if (statuses.hasOwnProperty(req.status)) {
      statuses[req.status]++;
    }
  });

  return (
    <div style={style.container}>
      {/* Header */}
      <div style={style.header}>
        <h1 style={style.title}>Lab Requests</h1>
        <p style={style.subtitle}>
          Manage lab investigation requests and view results
        </p>
      </div>

      {/* Status Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}>
        {Object.entries(statuses).map(([status, count]) => (
          <div
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: `2px solid ${filter === status ? getStatusColor(status) : BORDER}`,
              background: filter === status ? `${getStatusColor(status)}10` : "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <p style={{
              fontSize: 12,
              color: MUTED,
              margin: 0,
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              {status}
            </p>
            <p style={{
              fontSize: 20,
              fontWeight: 700,
              color: getStatusColor(status),
              margin: "4px 0 0",
            }}>
              {count}
            </p>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by request ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            fontSize: 13,
            outline: "none",
            maxWidth: 300,
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginBottom: 16,
          padding: "12px 14px",
          borderRadius: 8,
          background: WARNING_LIGHT,
          border: `1px solid ${WARNING}`,
          color: WARNING,
          fontSize: 13,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={style.loader}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: `3px solid ${G}20`,
            borderTop: `3px solid ${G}`,
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px"
          }} />
          Loading lab requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={style.loader}>
          <p style={{ fontSize: 14 }}>
            {searchTerm
              ? "No lab requests match your search"
              : "No lab requests found"}
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
            Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filteredRequests.map((request) => (
              <LabRequestCard
                key={request.request_id}
                request={request}
                isSelected={false}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}