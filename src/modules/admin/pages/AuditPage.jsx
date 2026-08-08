// src/modules/admin/pages/AuditPage.jsx
import { useEffect, useState, useCallback } from "react";
import { getAuditLogs } from "../api/adminApi";
import useBranchScope from "../hooks/useBranchScope";

const G = "#16A34A";

const Ico = ({ path, size = 16, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  search:  "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  filter:  "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10 M9 12l2 2 4-4",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  chevL:   "M15 18l-6-6 6-6",
  chevR:   "M9 18l6-6-6-6",
  export:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  clock:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
};

const ACTION_STYLES = {
  CREATE:     { bg: "#DCFCE7", color: "#15803D", dot: "#16A34A" },
  UPDATE:     { bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
  DELETE:     { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444" },
  LOGIN:      { bg: "#F0FDF4", color: "#16A34A", dot: "#22C55E" },
  LOGOUT:     { bg: "#F1F5F9", color: "#64748B", dot: "#94A3B8" },
  DEACTIVATE: { bg: "#FEF3C7", color: "#D97706", dot: "#F59E0B" },
  REACTIVATE: { bg: "#DCFCE7", color: "#15803D", dot: "#16A34A" },
  VIEW:       { bg: "#EDE9FE", color: "#6D28D9", dot: "#8B5CF6" },
  EXPORT:     { bg: "#E0F2FE", color: "#0369A1", dot: "#0EA5E9" },
};

const ActionBadge = ({ action }) => {
  const s = ACTION_STYLES[action] ?? { bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "20px", fontSize: "11px",
      fontWeight: 600, background: s.bg, color: s.color,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {action}
    </span>
  );
};

const Skeleton = ({ h = 14, w = "100%", radius = 6 }) => (
  <div style={{ height: h, width: w, borderRadius: radius, background: "#E8EEF5", animation: "shimmer 1.4s infinite" }} />
);

const PAGE_SIZE = 20;
const ALL_ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "DEACTIVATE", "REACTIVATE", "VIEW", "EXPORT"];
const ALL_MODULES = ["", "authentication", "staff", "patients", "appointments", "pharmacy", "lab", "billing", "administration"];

// Pulls the DRF `?page=` number back out of whatever URL was actually
// fetched (the base path has none → page 1; a next/previous URL always
// carries its own). Reading it off the fetched URL itself — rather than
// trusting a separately-tracked "current page" variable — means the row
// numbering below can never drift out of sync with what's on screen.
const parsePageFromUrl = (url) => {
  try {
    const u = new URL(url, window.location.origin);
    const n = parseInt(u.searchParams.get("page"), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
};

export default function AuditPage() {
  const { isGroupAdmin, listParams } = useBranchScope();
  const [logs, setLogs]         = useState([]);
  const [count, setCount]       = useState(0);
  const [nextUrl, setNextUrl]   = useState(null);
  const [prevUrl, setPrevUrl]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  // Which page is currently on screen, so the "#" column can show a real
  // running serial number instead of the raw AuditLog primary key (which
  // jumps around once you're filtered/branch-scoped/paginated, since it's
  // a global id shared with every other branch's and module's log rows —
  // that's what was showing up as "random" numbers).
  const [page, setPage]         = useState(1);

  /* filters */
  const [search, setSearch]     = useState("");
  const [action, setAction]     = useState("");
  const [module, setModule]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [currentUrl, setCurrentUrl] = useState("/administration/audit/");

  const load = useCallback((url) => {
    setLoading(true);
    setError("");
    // Build query params on base url
    let target = url;
    if (url === "/administration/audit/") {
      const p = new URLSearchParams();
      if (search)   p.set("search", search);
      if (action)   p.set("action", action);
      if (module)   p.set("module", module);
      if (dateFrom) p.set("timestamp_after", dateFrom);
      if (dateTo)   p.set("timestamp_before", dateTo + "T23:59:59");
      if (listParams.branch) p.set("branch", listParams.branch);
      // Explicit page_size so it always matches PAGE_SIZE, which is what
      // the "#" column below uses to compute each row's offset — without
      // this the backend defaults to its own page size (10), and rows
      // after page 1 would be numbered assuming 20-per-page while only 10
      // actually came back.
      p.set("page_size", String(PAGE_SIZE));
      const qs = p.toString();
      target = qs ? `${url}?${qs}` : url;
    }
    getAuditLogs(target)
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.results ?? []);
        setLogs(rows);
        setCount(data?.count ?? rows.length);
        setNextUrl(data?.next ?? null);
        setPrevUrl(data?.previous ?? null);
        setPage(parsePageFromUrl(target));
      })
      .catch(() => setError("Failed to load audit logs. Please try again."))
      .finally(() => setLoading(false));
  }, [search, action, module, dateFrom, dateTo, listParams]);

  useEffect(() => {
    load("/administration/audit/");
  }, [load]);

  const applyFilters = () => {
    setCurrentUrl("/administration/audit/");
    load("/administration/audit/");
  };

  const resetFilters = () => {
    setSearch(""); setAction(""); setModule(""); setDateFrom(""); setDateTo("");
    setCurrentUrl("/administration/audit/");
    const p = new URLSearchParams();
    if (listParams.branch) p.set("branch", listParams.branch);
    p.set("page_size", String(PAGE_SIZE));
    const target = `/administration/audit/?${p.toString()}`;
    getAuditLogs(target)
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.results ?? []);
        setLogs(rows); setCount(data?.count ?? rows.length);
        setNextUrl(data?.next ?? null); setPrevUrl(data?.previous ?? null);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const inp = {
    padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0",
    fontSize: "13px", color: "#1E293B", outline: "none", background: "#fff",
    boxSizing: "border-box",
  };

  const totalPages = Math.ceil(count / PAGE_SIZE);

  /* Export CSV */
  const exportCSV = () => {
    if (!logs.length) return;
    const header = [
      "Log ID", "User",
      ...(isGroupAdmin ? ["Branch"] : []),
      "Module", "Action", "Description", "IP Address", "Timestamp",
    ];
    const rows = logs.map(l => [
      l.log_id ?? l.id ?? "",
      l.username ?? "",
      ...(isGroupAdmin ? [l.branch_name ? `${l.branch_name} (${l.branch_code})` : ""] : []),
      l.module ?? "",
      l.action ?? "",
      `"${(l.description ?? "").replace(/"/g, '""')}"`,
      l.ip_address ?? "",
      l.timestamp ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_logs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ico path={ICONS.shield} color="#EF4444" size={18} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A" }}>Audit Logs</h1>
          </div>
          <p style={{ fontSize: "14px", color: "#94A3B8", marginLeft: "48px" }}>
            System activity trail — {loading ? "…" : count.toLocaleString()} events recorded
          </p>
        </div>
        <button
          onClick={exportCSV}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            background: "#fff", color: "#475569", borderRadius: "10px",
            padding: "9px 16px", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", border: "1px solid #E2E8F0",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
        >
          <Ico path={ICONS.export} size={14} />
          Export CSV
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ background: "#fff", borderRadius: "14px", padding: "18px 20px", border: "1px solid #EEF2F7", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <Ico path={ICONS.filter} size={14} color="#64748B" />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>Filters</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "10px", alignItems: "end" }} className="audit-filter-grid">
          {/* Search */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>Search</label>
            <div style={{ position: "relative" }}>
              <Ico path={ICONS.search} size={14} color="#94A3B8" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="User, description…"
                onKeyDown={e => e.key === "Enter" && applyFilters()}
                style={{ ...inp, paddingLeft: "34px", width: "100%" }}
              />
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <Ico path={ICONS.search} size={14} color="#94A3B8" />
              </span>
            </div>
          </div>

          {/* Action */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>Action</label>
            <select value={action} onChange={e => setAction(e.target.value)} style={{ ...inp, width: "100%" }}>
              {ALL_ACTIONS.map(a => <option key={a} value={a}>{a || "All Actions"}</option>)}
            </select>
          </div>

          {/* Module */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>Module</label>
            <select value={module} onChange={e => setModule(e.target.value)} style={{ ...inp, width: "100%" }}>
              {ALL_MODULES.map(m => <option key={m} value={m}>{m || "All Modules"}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width: "100%" }} />
          </div>

          {/* Date To */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, width: "100%" }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
          <button onClick={resetFilters} style={{
            padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
            border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer",
          }}>Reset</button>
          <button onClick={applyFilters} style={{
            padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
            border: "none", background: G, color: "#fff", cursor: "pointer",
            boxShadow: `0 2px 6px ${G}30`,
          }}>Apply Filters</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #EEF2F7", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F1F5F9", background: "#FAFBFD" }}>
                {[
                  "#", "User",
                  ...(isGroupAdmin ? ["Branch"] : []),
                  "Module", "Action", "Description", "IP Address", "Timestamp",
                ].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    {(isGroupAdmin ? [40, 130, 90, 100, 90, 220, 100, 110] : [40, 130, 100, 90, 220, 100, 110]).map((w, j) => (
                      <td key={j} style={{ padding: "13px 16px" }}><Skeleton h={12} w={`${w}px`} /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={isGroupAdmin ? 8 : 7} style={{ padding: "60px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Ico path={ICONS.shield} size={22} color="#CBD5E1" />
                      </div>
                      <p style={{ color: "#94A3B8", fontSize: "14px", fontWeight: 500 }}>No audit logs found</p>
                      <p style={{ color: "#CBD5E1", fontSize: "13px" }}>Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => {
                  const serial = count - ((page - 1) * PAGE_SIZE + i);
                  return (
                  <tr
                    key={log.log_id ?? log.id ?? i}
                    style={{ borderBottom: "1px solid #F8FAFC", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FAFBFD"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* # */}
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#CBD5E1", fontFamily: "monospace" }}>
                      {log.serial_number ?? serial}
                    </td>
                    {/* User */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                          background: `${G}12`, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 700, color: G,
                        }}>
                          {(log.username ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1E293B", whiteSpace: "nowrap" }}>{log.username ?? "system"}</div>
                          {log.user_role && <div style={{ fontSize: "11px", color: "#94A3B8" }}>{log.user_role}</div>}
                        </div>
                      </div>
                    </td>
                    {/* Branch (group admin only — backend already includes branch_name/branch_code) */}
                    {isGroupAdmin && (
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#475569", whiteSpace: "nowrap" }}>
                        {log.branch_name ? `${log.branch_name} (${log.branch_code})` : "—"}
                      </td>
                    )}
                    {/* Module */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 500, color: "#475569",
                        background: "#F1F5F9", padding: "2px 8px", borderRadius: "6px",
                        textTransform: "capitalize",
                      }}>
                        {log.module ?? "—"}
                      </span>
                    </td>
                    {/* Action */}
                    <td style={{ padding: "12px 16px" }}>
                      <ActionBadge action={log.action} />
                    </td>
                    {/* Description */}
                    <td style={{ padding: "12px 16px", maxWidth: "300px" }}>
                      <div style={{ fontSize: "13px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.description ?? "—"}
                      </div>
                    </td>
                    {/* IP */}
                    <td style={{ padding: "12px 16px", fontSize: "12px", color: "#94A3B8", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {log.ip_address ?? "—"}
                    </td>
                    {/* Time */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {log.timestamp ? (
                        <div>
                          <div style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
                            {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                            {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && (prevUrl || nextUrl) && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderTop: "1px solid #F1F5F9",
            background: "#FAFBFD", flexWrap: "wrap", gap: "8px",
          }}>
            <span style={{ fontSize: "13px", color: "#94A3B8" }}>
              Showing <strong style={{ color: "#475569" }}>{logs.length}</strong> of <strong style={{ color: "#475569" }}>{count}</strong> entries
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                disabled={!prevUrl}
                onClick={() => { setCurrentUrl(prevUrl); load(prevUrl); }}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                  border: "1px solid #E2E8F0", cursor: prevUrl ? "pointer" : "not-allowed",
                  background: prevUrl ? "#fff" : "#F8FAFC", color: prevUrl ? "#475569" : "#CBD5E1",
                  transition: "all 0.15s",
                }}
              >
                <Ico path={ICONS.chevL} size={14} /> Previous
              </button>
              <button
                disabled={!nextUrl}
                onClick={() => { setCurrentUrl(nextUrl); load(nextUrl); }}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
                  border: "1px solid #E2E8F0", cursor: nextUrl ? "pointer" : "not-allowed",
                  background: nextUrl ? "#fff" : "#F8FAFC", color: nextUrl ? "#475569" : "#CBD5E1",
                  transition: "all 0.15s",
                }}
              >
                Next <Ico path={ICONS.chevR} size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.5} }
        @media (max-width: 900px) {
          .audit-filter-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .audit-filter-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}