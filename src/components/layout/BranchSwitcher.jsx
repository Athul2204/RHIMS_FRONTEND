// src/components/layout/BranchSwitcher.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

const Icon = ({ d, size = 14, extra = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

const BUILDING_D = "M3 21h18 M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14 M9 9h1 M14 9h1 M9 13h1 M14 13h1 M9 17h1 M14 17h1";
const CHEV_D = "M6 9l6 6 6-6";

/**
 * Branch switcher shown in the dashboard header — for group admins
 * (accounts with is_group_admin=True, detected via utils/branchDetection.js
 * since /auth/me/ doesn't carry this yet) and for managers granted access
 * to more than one branch (administration.models.ManagerBranchAccess).
 * Every other case — branch-scoped admins, single-branch managers, and
 * every non-admin/non-manager role — gets a read-only "own branch" badge
 * instead, or nothing at all if there's no branch to show yet: the backend
 * hard-scopes them to one branch on every request regardless of what the
 * frontend sends, so an interactive switcher for them would be pure
 * decoration.
 *
 * Selecting a branch here sets AuthContext.selectedBranch (admin) or
 * AuthContext.managerActiveBranch (manager). Admin list pages read
 * selectedBranch straight out of context (via useBranchScope) as a
 * dependency of their own fetch effects, so they re-fetch the moment it
 * changes.
 *
 * Managers are different: src/api/index.js's request interceptor stamps
 * the active branch onto every /manager/* call automatically from a
 * plain module-level variable, outside React's reactivity — which is
 * enough for pages the manager *navigates to* after switching, but not
 * for whatever's already mounted on screen. None of the manager pages
 * list managerActiveBranch as a fetch dependency (that was the point —
 * ~10 pages didn't need touching), so without the reload below, switching
 * branches while sitting on e.g. the Finance Dashboard silently keeps
 * showing the old branch's numbers until the user navigates away and
 * back. Forcing a full reload here — same URL, so the manager stays on
 * whatever page they were on — is the simplest way to guarantee every
 * card, table, and chart on the page reflects the newly selected branch,
 * without adding a managerActiveBranch dependency to every page's fetch
 * logic individually.
 */
export default function BranchSwitcher() {
  const {
    user, isGroupAdmin, branches, selectedBranch, setSelectedBranch, ownBranch,
    managerBranches, managerActiveBranch, setManagerBranch,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (user?.role !== "admin" && user?.role !== "manager") return null;

  // ─── MANAGER ───────────────────────────────────────────────────
  if (user?.role === "manager") {
    // Only one accessible branch (just their home branch, the common
    // case) — a badge, not a switcher. Nothing to render until the
    // branch list has loaded at least once.
    if (managerBranches.length <= 1) {
      const only = managerBranches[0];
      if (!only) return null;
      return (
        <div
          title="Your account is scoped to this branch"
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "6px 12px", borderRadius: "9px",
            background: "#F8FAFC", border: "1px solid #E8EDF4",
            fontSize: "12.5px", fontWeight: 600, color: "#475569", flexShrink: 0,
          }}
        >
          <Icon d={BUILDING_D} size={13} />
          {only.name}
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8" }}>({only.code})</span>
        </div>
      );
    }

    const currentManagerBranch = managerBranches.find((b) => b.branch_id === managerActiveBranch);

    return (
      <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "7px 12px", borderRadius: "9px",
            background: "#F0FDF4", border: "1px solid #BBF7D0",
            fontSize: "12.5px", fontWeight: 600, color: "#15803D",
            cursor: "pointer",
          }}
        >
          <Icon d={BUILDING_D} size={13} />
          {currentManagerBranch ? `${currentManagerBranch.name} (${currentManagerBranch.code})` : "Select branch"}
          <Icon d={CHEV_D} size={12} />
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: "220px",
            background: "#fff", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            border: "1px solid #E8EDF4", zIndex: 200, overflow: "hidden", maxHeight: "320px", overflowY: "auto",
          }}>
            {/* No "All Branches" option for a manager — just their specific granted branches. */}
            {managerBranches.map((b) => (
              <button
                key={b.branch_id}
                onClick={() => {
                  setOpen(false);
                  if (b.branch_id === managerActiveBranch) return; // already on this branch — nothing to refresh
                  setManagerBranch(b.branch_id);
                  // Full reload (not just a state update) so every already-mounted
                  // page re-fetches from scratch under the new branch — see the
                  // component docstring above for why this is necessary for managers.
                  window.location.reload();
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  padding: "10px 14px", background: managerActiveBranch === b.branch_id ? "#F0FDF4" : "transparent",
                  border: "none", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                  fontSize: "13px", fontWeight: managerActiveBranch === b.branch_id ? 700 : 500,
                  color: managerActiveBranch === b.branch_id ? "#15803D" : "#334155", textAlign: "left",
                }}
              >
                <span>{b.name} <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8" }}>({b.code})</span></span>
                {managerActiveBranch === b.branch_id && <Icon d="M20 6 9 17l-5-5" size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── ADMIN ─────────────────────────────────────────────────────
  // Branch-scoped admin — show a small read-only badge with
  // their own branch, not an interactive switcher. Nothing to render if we
  // don't even know their branch yet (branchContextLoading, or the
  // detection fallback came back empty).
  if (!isGroupAdmin) {
    if (!ownBranch) return null;
    return (
      <div
        title="Your account is scoped to this branch"
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "6px 12px", borderRadius: "9px",
          background: "#F8FAFC", border: "1px solid #E8EDF4",
          fontSize: "12.5px", fontWeight: 600, color: "#475569", flexShrink: 0,
        }}
      >
        <Icon d={BUILDING_D} size={13} />
        {ownBranch.name}
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8" }}>({ownBranch.code})</span>
      </div>
    );
  }

  const current = branches.find((b) => b.branch_id === selectedBranch);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "7px 12px", borderRadius: "9px",
          background: "#F0FDF4", border: "1px solid #BBF7D0",
          fontSize: "12.5px", fontWeight: 600, color: "#15803D",
          cursor: "pointer",
        }}
      >
        <Icon d={BUILDING_D} size={13} />
        {current ? `${current.name} (${current.code})` : "All Branches"}
        <Icon d={CHEV_D} size={12} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: "220px",
          background: "#fff", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          border: "1px solid #E8EDF4", zIndex: 200, overflow: "hidden", maxHeight: "320px", overflowY: "auto",
        }}>
          <button
            onClick={() => { setSelectedBranch(null); setOpen(false); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
              padding: "10px 14px", background: !selectedBranch ? "#F0FDF4" : "transparent",
              border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer",
              fontSize: "13px", fontWeight: !selectedBranch ? 700 : 500,
              color: !selectedBranch ? "#15803D" : "#334155", textAlign: "left",
            }}
          >
            All Branches
            {!selectedBranch && <Icon d="M20 6 9 17l-5-5" size={13} />}
          </button>
          {branches.map((b) => (
            <button
              key={b.branch_id}
              onClick={() => { setSelectedBranch(b.branch_id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                padding: "10px 14px", background: selectedBranch === b.branch_id ? "#F0FDF4" : "transparent",
                border: "none", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                fontSize: "13px", fontWeight: selectedBranch === b.branch_id ? 700 : 500,
                color: selectedBranch === b.branch_id ? "#15803D" : "#334155", textAlign: "left",
              }}
            >
              <span>{b.name} <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8" }}>({b.code})</span></span>
              {selectedBranch === b.branch_id && <Icon d="M20 6 9 17l-5-5" size={13} />}
            </button>
          ))}
          {branches.length === 0 && (
            <div style={{ padding: "14px", fontSize: "12px", color: "#94A3B8" }}>No branches yet.</div>
          )}
        </div>
      )}
    </div>
  );
}