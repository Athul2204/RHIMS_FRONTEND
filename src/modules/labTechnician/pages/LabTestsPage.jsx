// src/modules/labTechnician/pages/LabTestsPage.jsx
import { useEffect, useState, useCallback } from "react";
import {
  getLabTests,
  createLabTest,
  updateLabTest,
} from "../api/labApi";
 
const AMBER = "#F59E0B";
const GREEN = "#10B981";
 
const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
 
const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  normal_range: "",
  unit: "",
  price: "",
  is_active: true,
};
 
/* ─── Add / Edit Test Modal ────────────────────── */
function TestFormModal({ test, onClose, onSaved }) {
  const isEdit = Boolean(test);
  const [form, setForm] = useState(
    isEdit ? { ...test, price: test.price ?? "" } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
 
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
 
  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Name and Code are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        normal_range: form.normal_range.trim() || null,
        unit: form.unit.trim() || null,
        price: form.price !== "" ? parseFloat(form.price) : 0,
        is_active: form.is_active,
      };
      if (isEdit) {
        await updateLabTest(test.test_id, payload);
      } else {
        await createLabTest(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Error saving test");
    } finally {
      setSaving(false);
    }
  };
 
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "16px" }}>
          {isEdit ? "Edit Lab Test" : "Add New Lab Test"}
        </h3>
 
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Test Name <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g., Blood Glucose"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>
 
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Test Code <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="e.g., GLU"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>
 
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of the test..."
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>
 
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
              Normal Range
            </label>
            <input
              type="text"
              value={form.normal_range}
              onChange={(e) => set("normal_range", e.target.value)}
              placeholder="e.g., 70-100"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1.5px solid #E8EDF4",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
              Unit
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="e.g., mg/dL"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1.5px solid #E8EDF4",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
 
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
            Price (₹)
          </label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1.5px solid #E8EDF4",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>
 
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            id="active"
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="active" style={{ fontSize: "13px", color: "#0F172A", cursor: "pointer" }}>
            Active
          </label>
        </div>
 
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              background: "#FEE2E2",
              color: "#DC2626",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}
 
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              background: "#F8FAFC",
              color: "#64748B",
              border: "1px solid #E8EDF4",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              background: AMBER,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
 
/* ─── Main Page ────────────────────────────────── */
export default function LabTestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
 
  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLabTests();
      // The tests endpoint returns a plain array (not paginated), but
      // handle a paginated { results: [...] } shape too just in case.
      setTests(Array.isArray(data) ? data : (data?.results ?? []));
    } catch (err) {
      setError(err.message || "Failed to load tests");
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => {
    fetchTests();
  }, [fetchTests]);
 
  // The backend returns tests ordered by name (its default), so re-sort
  // here by creation time, newest first, and number rows 1..n from the
  // top — S.No 1 is always the most recently added test.
  const filteredTests = tests
    .filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
      return (b.test_id ?? 0) - (a.test_id ?? 0);
    });
 
  const activeTests = filteredTests.filter((t) => t.is_active).length;
 
  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
            Lab Tests Catalogue
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B" }}>
            Manage available lab tests and their configurations
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedTest(null);
            setShowForm(true);
          }}
          style={{
            padding: "10px 16px",
            background: AMBER,
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Test
        </button>
      </div>
 
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #EEF2F7" }}>
          <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Total Tests</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A" }}>
            {filteredTests.length}
          </p>
        </div>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #EEF2F7" }}>
          <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Active</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: GREEN }}>
            {activeTests}
          </p>
        </div>
      </div>
 
      {/* Search */}
      <div style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1.5px solid #E8EDF4",
            fontSize: "13px",
            boxSizing: "border-box",
          }}
        />
      </div>
 
      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "red" }}>
          {error}
        </div>
      ) : filteredTests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
          No tests found
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #EEF2F7",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #EEF2F7" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B", width: "1%" }}>
                    S.No
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Code
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Name
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Normal Range
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Unit
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Price
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test, idx) => (
                  <tr key={test.test_id} style={{ borderBottom: "1px solid #EEF2F7" }}>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#94A3B8" }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                      {test.code}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B" }}>
                      {test.name}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#64748B" }}>
                      {test.normal_range || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#64748B" }}>
                      {test.unit || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                      ₹{test.price || "0.00"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: test.is_active ? "#D1FAE5" : "#F1F5F9",
                          color: test.is_active ? "#059669" : "#64748B",
                        }}
                      >
                        {test.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => {
                          setSelectedTest(test);
                          setShowForm(true);
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "none",
                          border: "1px solid #E8EDF4",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: AMBER,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {/* Form Modal */}
      {showForm && (
        <TestFormModal
          test={selectedTest}
          onClose={() => setShowForm(false)}
          onSaved={fetchTests}
        />
      )}
    </div>
  );
}