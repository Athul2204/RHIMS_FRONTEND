// src/pages/admin/SelectBranchPage.jsx
//
// Shown to a group admin exactly once per browser session (gated by
// AuthContext's `branchChosen`, see AdminDashboard.jsx) before they enter
// the dashboard. Lets them either drop straight into a specific branch's
// scoped view, or continue with "All Branches" (the aggregate/group view).
//
// This is a one-time landing choice, not the only way to change branch —
// once inside, the header's BranchSwitcher (components/layout/BranchSwitcher.jsx)
// lets them switch branches (or back to "All Branches") at any time without
// coming back here. Picking here just sets the same `selectedBranch` state
// the switcher controls, so both are the same mechanism.
import { useAuth } from "../../context/AuthContext";

const G = "#16A34A";

const Icon = ({ d, size = 18, extra = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

const BUILDING_D = "M3 21h18 M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14 M9 9h1 M14 9h1 M9 13h1 M14 13h1 M9 17h1 M14 17h1";
const GLOBE_D = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20";
const GLOBE_EXTRA = "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z";
const PHONE_D = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z";
const ARROW_D = "M5 12h14 M12 5l7 7-7 7";
const PIN_D = "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";

export default function SelectBranchPage() {
  const { user, branches, setSelectedBranch } = useAuth();

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username;
  const activeBranches = branches.filter(b => b.is_active !== false);

  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "760px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px", margin: "0 auto 16px",
            background: `${G}15`, border: `1.5px solid ${G}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
            Welcome back{fullName ? `, ${fullName}` : ""}
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
            Choose a branch to work in, or view all branches at once. You can switch anytime from the header.
          </p>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {/* All Branches */}
          <button
            onClick={() => setSelectedBranch(null)}
            style={{
              display: "flex", alignItems: "center", gap: "16px", width: "100%",
              padding: "18px 20px", borderRadius: "14px", border: `1.5px solid ${G}30`,
              background: `${G}08`, cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
              background: `${G}18`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon d={GLOBE_D} extra={GLOBE_EXTRA} size={20} color={G} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>All Branches</div>
              <div style={{ fontSize: "12.5px", color: "#64748B", marginTop: "2px" }}>
                Group-wide view across every branch — recommended for oversight
              </div>
            </div>
            <span style={{ color: G, flexShrink: 0 }}>
              <Icon d={ARROW_D} size={18} />
            </span>
          </button>

          {activeBranches.length === 0 ? (
            <div style={{
              padding: "24px", borderRadius: "14px", border: "1px dashed #E2E8F0",
              textAlign: "center", color: "#94A3B8", fontSize: "13px",
            }}>
              No branches have been added yet. Continue with "All Branches" above, then add one from the Branches page.
            </div>
          ) : (
            activeBranches.map(b => (
              <button
                key={b.branch_id}
                onClick={() => setSelectedBranch(b.branch_id)}
                style={{
                  display: "flex", alignItems: "center", gap: "16px", width: "100%",
                  padding: "18px 20px", borderRadius: "14px", border: "1.5px solid #E8EDF4",
                  background: "#fff", cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${G}50`; e.currentTarget.style.background = "#F8FFFA"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8EDF4"; e.currentTarget.style.background = "#fff"; }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                  background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon d={BUILDING_D} size={20} color={G} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{b.name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#94A3B8", background: "#F1F5F9", padding: "1px 6px", borderRadius: "5px" }}>
                      {b.code}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "14px", marginTop: "4px" }}>
                    {b.address && (
                      <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#94A3B8" }}>
                        <Icon d={PIN_D} size={12} /> {b.address}
                      </span>
                    )}
                    {b.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#94A3B8" }}>
                        <Icon d={PHONE_D} size={12} /> {b.phone}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: "#94A3B8", flexShrink: 0 }}>
                  <Icon d={ARROW_D} size={18} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}