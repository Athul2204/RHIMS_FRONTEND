// src/modules/labTechnician/pages/LabPanelsPage.jsx
//
// Manage test panels (TestGroups) — e.g. "Liver Function Test" (LFT) =
// SGOT + SGPT + Bilirubin + ALP billed once as a single unit instead of
// once per sub-test. Mirrors the CRUD pattern used by LabTestsPage.jsx.
//
// A panel itself only carries name/code/price/description/is_active.
// Which individual LabTest rows belong to it is controlled by that test's
// own `group` field (LabTest.group FK) — assigning/unassigning a test to a
// panel here just PATCHes that test's `group`.

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getLabTests,
  updateLabTest,
  getTestGroups,
  createTestGroup,
  updateTestGroup,
  deleteTestGroup,
} from "../api/labApi";

const AMBER = "#F59E0B";
const GREEN = "#10B981";
const RED = "#EF4444";
const GRAY = {
  50: "#F8FAFC", 100: "#F1F5F9", 200: "#E8EDF4", 400: "#94A3B8",
  500: "#64748B", 700: "#334155", 900: "#0F172A",
};

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  chevron: "M6 9l6 6 6-6",
  x: "M18 6 6 18 M6 6l12 12",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
};

const FIELD_LABEL = { display: "block", fontSize: "12px", fontWeight: 600, color: GRAY[500], marginBottom: "6px" };
const FIELD_INPUT = { width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1.5px solid ${GRAY[200]}`, fontSize: "13px", boxSizing: "border-box" };

const EMPTY_FORM = { name: "", code: "", description: "", price: "", is_active: true };

/* ─── Add / Edit Panel Modal ─────────────────────────────────── */
function PanelFormModal({ group, onClose, onSaved }) {
  const isEdit = Boolean(group);
  const [form, setForm] = useState(
    isEdit ? { ...EMPTY_FORM, ...group, price: group.price ?? "" } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Name and Code are required.");
      return;
    }
    if (form.price === "" || Number.isNaN(parseFloat(form.price))) {
      setError("A panel price is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        is_active: form.is_active,
      };
      if (isEdit) {
        await updateTestGroup(group.group_id, payload);
      } else {
        await createTestGroup(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error saving panel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", padding: "24px", maxWidth: "480px", width: "100%" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: GRAY[900], marginBottom: "16px" }}>
          {isEdit ? "Edit Panel" : "Add New Panel"}
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <label style={FIELD_LABEL}>Panel Name <span style={{ color: RED }}>*</span></label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g., Liver Function Test" style={FIELD_INPUT} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={FIELD_LABEL}>Panel Code <span style={{ color: RED }}>*</span></label>
          <input type="text" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g., LFT" style={FIELD_INPUT} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={FIELD_LABEL}>Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Brief description of the panel…" style={{ ...FIELD_INPUT, minHeight: "60px", fontFamily: "inherit" }} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={FIELD_LABEL}>Panel Price (₹) <span style={{ color: RED }}>*</span></label>
          <input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" step="0.01" min="0" style={FIELD_INPUT} />
          <p style={{ fontSize: "11px", color: GRAY[400], margin: "6px 0 0" }}>
            The patient is billed this ONE price for the whole panel, regardless of how many sub-tests it contains.
          </p>
        </div>

        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} id="panel-active" />
          <label htmlFor="panel-active" style={{ fontSize: "13px", color: GRAY[700] }}>Active (visible in test pickers)</label>
        </div>

        {error && (
          <div style={{ marginBottom: "16px", padding: "10px 12px", background: "#FEF2F2", color: "#B91C1C", borderRadius: "8px", fontSize: "12.5px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "#fff", border: `1.5px solid ${GRAY[200]}`, borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: GRAY[700], cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 20px", background: AMBER, color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Panel"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Assign Tests panel (expandable row content) ────────────── */
function AssignTestsPanel({ group, allTests, busyTestId, onToggleTest }) {
  return (
    <div style={{ padding: "12px 16px 16px", background: GRAY[50], borderTop: `1px solid ${GRAY[100]}` }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: GRAY[400], textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>
        Assign lab tests to this panel
      </p>
      {allTests.length === 0 ? (
        <p style={{ fontSize: "12.5px", color: GRAY[400] }}>No lab tests in the catalogue yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "4px 12px" }}>
          {allTests.map((t) => {
            const inThisGroup = t.group === group.group_id;
            const inOtherGroup = t.group != null && t.group !== group.group_id;
            return (
              <label key={t.test_id} style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px", borderRadius: "6px",
                cursor: inOtherGroup ? "not-allowed" : "pointer",
                opacity: inOtherGroup ? 0.55 : 1,
              }}
                title={inOtherGroup ? `Currently in "${t.group_name}" — remove it there first` : undefined}
              >
                <input
                  type="checkbox"
                  checked={inThisGroup}
                  disabled={inOtherGroup || busyTestId === t.test_id}
                  onChange={() => onToggleTest(t, !inThisGroup, group.group_id)}
                  style={{ accentColor: AMBER, cursor: inOtherGroup ? "not-allowed" : "pointer" }}
                />
                <span style={{ fontSize: "12.5px", color: GRAY[700] }}>
                  {t.name} <span style={{ color: GRAY[400] }}>({t.code})</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function LabPanelsPage() {
  const [groups, setGroups] = useState([]);
  const [allTests, setAllTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [busyTestId, setBusyTestId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [groupsData, testsData] = await Promise.all([
        getTestGroups({ show_inactive: "true" }),
        getLabTests({ show_inactive: "true" }),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : groupsData?.results ?? []);
      setAllTests(Array.isArray(testsData) ? testsData : testsData?.results ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load panels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = q ? groups.filter((g) => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)) : groups;
    // The backend returns panels ordered by name (its default) — re-sort
    // here by creation time, newest first, so S.No 1 is the most recent.
    return base.slice().sort((a, b) => {
      if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
      return (b.group_id ?? 0) - (a.group_id ?? 0);
    });
  }, [groups, searchTerm]);

  const testsByGroup = useMemo(() => {
    const map = new Map();
    for (const t of allTests) {
      if (t.group == null) continue;
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group).push(t);
    }
    return map;
  }, [allTests]);

  const handleToggleTest = async (test, assign, groupId) => {
    setBusyTestId(test.test_id);
    try {
      await updateLabTest(test.test_id, { group: assign ? groupId : null });
      await fetchAll();
    } catch (err) {
      showToast(err.message || "Failed to update test assignment", false);
    } finally {
      setBusyTestId(null);
    }
  };

  const handleDelete = async (group) => {
    if (!window.confirm(`Delete panel "${group.name}"? Its sub-tests will become standalone tests again — past bills are unaffected.`)) return;
    setDeletingId(group.group_id);
    try {
      await deleteTestGroup(group.group_id);
      showToast("Panel deleted");
      if (expandedGroupId === group.group_id) setExpandedGroupId(null);
      await fetchAll();
    } catch (err) {
      showToast(err.message || "Failed to delete panel", false);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "11px 18px", borderRadius: 10,
          fontSize: 13, fontWeight: 600, background: toast.ok ? "#F0FDF4" : "#FEF2F2",
          color: toast.ok ? "#166534" : "#B91C1C", border: `1px solid ${toast.ok ? "#BBF7D0" : "#FECACA"}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, color: GRAY[900], marginBottom: "8px" }}>Test Panels</h1>
          <p style={{ fontSize: "14px", color: GRAY[500] }}>
            Group tests (e.g. LFT, KFT, Lipid Profile) billed once for the whole panel instead of per sub-test.
          </p>
        </div>
        <button
          onClick={() => { setSelectedGroup(null); setShowForm(true); }}
          style={{ padding: "10px 16px", background: AMBER, color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
        >
          + Add Panel
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: `1px solid ${GRAY[100]}` }}>
          <p style={{ fontSize: "12px", color: GRAY[500], marginBottom: "4px" }}>Total Panels</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: GRAY[900] }}>{filteredGroups.length}</p>
        </div>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: `1px solid ${GRAY[100]}` }}>
          <p style={{ fontSize: "12px", color: GRAY[500], marginBottom: "4px" }}>Active</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: GREEN }}>{filteredGroups.filter((g) => g.is_active).length}</p>
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search panels by name or code…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={FIELD_INPUT}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: GRAY[500] }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: RED }}>{error}</div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: GRAY[400] }}>
          No panels found. Click "+ Add Panel" to create one (e.g. Liver Function Test = SGOT + SGPT + Bilirubin + ALP).
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", border: `1px solid ${GRAY[100]}`, overflow: "hidden" }}>
          {filteredGroups.map((g, i) => {
            const isExpanded = expandedGroupId === g.group_id;
            const subTests = testsByGroup.get(g.group_id) || [];
            return (
              <div key={g.group_id} style={{ borderTop: i > 0 ? `1px solid ${GRAY[100]}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: GRAY[400], minWidth: "18px", textAlign: "right" }}>
                    {i + 1}
                  </span>
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : g.group_id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                  >
                    <Ico d={ICONS.chevron} size={16} color={GRAY[400]} />
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: GRAY[900] }}>{g.name}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: GRAY[500], background: GRAY[100], padding: "2px 8px", borderRadius: "20px" }}>{g.code}</span>
                      {!g.is_active && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: GRAY[500], background: GRAY[100], padding: "2px 8px", borderRadius: "20px" }}>Inactive</span>
                      )}
                    </div>
                    {g.description && <p style={{ fontSize: "12px", color: GRAY[500], margin: "3px 0 0" }}>{g.description}</p>}
                    <p style={{ fontSize: "11.5px", color: GRAY[400], margin: "3px 0 0" }}>{subTests.length} test{subTests.length === 1 ? "" : "s"} assigned</p>
                  </div>

                  <span style={{ fontSize: "15px", fontWeight: 700, color: GRAY[900], whiteSpace: "nowrap" }}>
                    ₹{parseFloat(g.price || 0).toFixed(2)}
                  </span>

                  <button
                    onClick={() => { setSelectedGroup(g); setShowForm(true); }}
                    style={{ padding: "6px 12px", background: "none", border: `1px solid ${GRAY[200]}`, borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: AMBER, cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    disabled={deletingId === g.group_id}
                    style={{ padding: "6px 10px", background: "none", border: `1px solid ${GRAY[200]}`, borderRadius: "6px", cursor: deletingId === g.group_id ? "not-allowed" : "pointer" }}
                    title="Delete panel"
                  >
                    <Ico d={ICONS.trash} size={13} color={RED} />
                  </button>
                </div>

                {isExpanded && (
                  <AssignTestsPanel
                    group={g}
                    allTests={allTests}
                    busyTestId={busyTestId}
                    onToggleTest={handleToggleTest}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <PanelFormModal
          group={selectedGroup}
          onClose={() => setShowForm(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}