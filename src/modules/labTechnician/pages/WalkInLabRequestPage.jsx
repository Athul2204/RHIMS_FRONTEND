// src/modules/labTechnician/pages/WalkInLabRequestPage.jsx
//
// Walk-in lab test workflow — mirrors the pharmacist "Walk-in Bill" model
// (pharmacist/pages/WalkInBillPage.jsx): a patient who walks directly into
// the lab for a test has no doctor consultation and no MRD registration.
//
// STEP ORDER: details → review → payment → success
//   "details"  — walk-in patient info + test picker (no backend calls yet)
//   "review"   — on submit: createWalkInLabRequest() creates the LabRequest
//                + items + an unpaid LabBill in one call, then shows the bill
//   "payment"  — collect payment via payLabBill() (mirrors LabBillsPage)
//   "success"  — confirmation, with a "New Walk-in" reset

import { useState, useEffect, useMemo } from "react";
import { getLabTests, getTestGroups, createWalkInLabRequest, payLabBill } from "../api/labApi";
import { isValidPhone, PHONE_ERROR_MESSAGE } from "../../../utils/phoneValidation";
import { groupLabRequestItems, subTestIdsCoveredByGroups } from "../../../utils/labItemGrouping";

const AMBER = "#F59E0B";
const COLORS = {
  primary: AMBER,
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  gray: {
    50: "#F9FAFB", 100: "#F3F4F6", 200: "#E5E7EB", 300: "#D1D5DB",
    400: "#9CA3AF", 500: "#6B7280", 600: "#4B5563", 700: "#374151",
    800: "#1F2937", 900: "#111827",
  },
};

const INP = {
  padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB",
  fontSize: 13, color: "#1E293B", outline: "none", background: "#fff",
  width: "100%", boxSizing: "border-box",
};

const LBL = {
  fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase",
  letterSpacing: "0.5px", display: "block", marginBottom: 6,
};

const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "INSURANCE"];

const Ico = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  x: "M18 6 6 18 M6 6l12 12",
  plus: "M12 5v14 M5 12h14",
  check: "M20 6 9 17l-5-5",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  flask: "M9 3h6 M10 3v6l-6 10a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-10V3",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  arrowLeft: "M19 12H5 M12 19l-7-7 7-7",
  print: "M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
};

function Toast({ msg, ok }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "11px 18px",
      borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: ok ? "#F0FDF4" : "#FEF2F2", color: ok ? "#166534" : "#B91C1C",
      border: `1px solid ${ok ? "#BBF7D0" : "#FECACA"}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    }}>
      {msg}
    </div>
  );
}

function StepDot({ label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
        background: done ? COLORS.success : active ? AMBER : COLORS.gray[200],
        color: done || active ? "#fff" : COLORS.gray[500],
      }}>
        {done ? <Ico d={ICONS.check} size={13} color="#fff" /> : "•"}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: active ? COLORS.gray[900] : COLORS.gray[500] }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Test Picker (fetched catalogue, checkbox-select) ───
   Supports panels (TestGroups, e.g. LFT/KFT/LIPID) as single selectable
   units billed once, alongside individual standalone tests. Selecting a
   panel greys out its sub-tests in the individual list to avoid confusing
   double billing on the picker itself. */
function TestPicker({ allTests, allGroups, selectedTests, selectedGroups, onAdd, onRemove, onToggleGroup }) {
  const [query, setQuery] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const selectedIds = useMemo(() => new Set(selectedTests.map((t) => t.test_id)), [selectedTests]);
  const selectedGroupIds = useMemo(() => new Set(selectedGroups.map((g) => g.group_id)), [selectedGroups]);
  const coveredTestIds = useMemo(() => subTestIdsCoveredByGroups(selectedGroups), [selectedGroups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTests;
    return allTests.filter(
      (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  }, [allTests, query]);

  const testsTotal = selectedTests.reduce((s, t) => s + parseFloat(t.price || 0), 0);
  const groupsTotal = selectedGroups.reduce((s, g) => s + parseFloat(g.price || 0), 0);
  const total = testsTotal + groupsTotal;
  const selectedCount = selectedTests.length + selectedGroups.length;

  return (
    <div>
      {allGroups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={LBL}>Panels (billed once for the whole group)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allGroups.map((g) => {
              const checked = selectedGroupIds.has(g.group_id);
              const isExpanded = expandedGroupId === g.group_id;
              return (
                <div
                  key={g.group_id}
                  style={{
                    border: checked ? `2px solid ${AMBER}` : `1.5px solid ${COLORS.gray[200]}`,
                    background: checked ? "#FFFBEB" : "#fff",
                    borderRadius: 10, padding: "8px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleGroup(g)}
                        style={{ width: 16, height: 16, accentColor: AMBER, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: checked ? "#B45309" : COLORS.gray[900] }}>
                        {g.name} {g.code && <span style={{ fontWeight: 500, color: COLORS.gray[500] }}>({g.code})</span>}
                      </span>
                    </label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray[700] }}>
                      ₹{parseFloat(g.price || 0).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId(isExpanded ? null : g.group_id)}
                      style={{ background: "none", border: "none", cursor: "pointer",
                        fontSize: 11, color: COLORS.gray[500], fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                      {isExpanded ? "Hide tests" : `${(g.sub_tests || []).length} tests ▾`}
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.gray[100]}`, marginLeft: 26 }}>
                      {(g.sub_tests || []).map((st) => (
                        <div key={st.test_id} style={{ fontSize: 12, color: COLORS.gray[500], padding: "2px 0" }}>
                          • {st.name}{st.code && ` (${st.code})`}
                          {st.normal_range && <span> — Ref: {st.normal_range}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <label style={LBL}>Individual Tests</label>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
          <Ico d={ICONS.search} size={15} color={COLORS.gray[400]} />
        </div>
        <input
          style={{ ...INP, paddingLeft: 36 }}
          placeholder="Filter tests by name or code (e.g. CBC, LFT)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{
        border: `1.5px solid ${COLORS.gray[200]}`, borderRadius: 10,
        maxHeight: 280, overflowY: "auto", background: "#fff", marginBottom: 12,
      }}>
        {allTests.length === 0 ? (
          <div style={{ padding: 18, fontSize: 12.5, color: COLORS.gray[400], textAlign: "center" }}>
            No active tests found in the catalogue.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 18, fontSize: 12.5, color: COLORS.gray[400], textAlign: "center" }}>
            No tests match "{query}".
          </div>
        ) : (
          filtered.map((t) => {
            const checked = selectedIds.has(t.test_id);
            // Already covered by a selected panel above — block picking it
            // individually to avoid confusing double billing on the picker.
            const covered = coveredTestIds.has(t.test_id);
            return (
              <label
                key={t.test_id}
                title={covered ? `Included in the "${t.group_name}" panel selected above` : undefined}
                style={{
                  padding: "10px 12px", display: "flex", justifyContent: "space-between",
                  alignItems: "center", cursor: covered ? "not-allowed" : "pointer",
                  borderBottom: `1px solid ${COLORS.gray[100]}`,
                  background: covered ? COLORS.gray[50] : (checked ? "#FFFBEB" : "#fff"),
                  opacity: covered ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={covered}
                    onChange={() => !covered && (checked ? onRemove(t.test_id) : onAdd(t))}
                    style={{ width: 16, height: 16, accentColor: AMBER, cursor: covered ? "not-allowed" : "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: covered ? COLORS.gray[400] : COLORS.gray[900] }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.gray[500] }}>
                      {t.code}{t.unit ? ` · ${t.unit}` : ""}
                      {t.group_name && <span> · {t.group_name}</span>}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: covered ? COLORS.gray[400] : COLORS.gray[700] }}>
                  ₹{parseFloat(t.price || 0).toFixed(2)}
                </span>
              </label>
            );
          })
        )}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 12px", borderRadius: 10, background: COLORS.gray[50],
        border: `1px solid ${COLORS.gray[200]}`,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.gray[700] }}>
          {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray[900] }}>₹{total.toFixed(2)}</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function WalkInLabRequestPage() {
  const [step, setStep] = useState("details"); // details | review | payment | success
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ msg: "", ok: true });

  const [allTests, setAllTests] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [testsLoading, setTestsLoading] = useState(true);

  const [form, setForm] = useState({ name: "", phone: "", gender: "", age: "", notes: "" });
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]); // TestGroup objects

  const [createdRequest, setCreatedRequest] = useState(null);
  const [createdBill, setCreatedBill] = useState(null);

  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        setTestsLoading(true);
        const [testsData, groupsData] = await Promise.all([
          getLabTests(),
          getTestGroups().catch(() => []), // panels are optional — don't block the picker if this fails
        ]);
        setAllTests(Array.isArray(testsData) ? testsData : testsData.results || []);
        setAllGroups(Array.isArray(groupsData) ? groupsData : groupsData?.results || []);
      } catch (e) {
        showToast("Failed to load lab test catalogue: " + String(e.message ?? e), false);
      } finally {
        setTestsLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addTest = (t) => setSelectedTests((prev) => [...prev, t]);
  const removeTest = (testId) => setSelectedTests((prev) => prev.filter((t) => t.test_id !== testId));

  const toggleGroup = (g) => setSelectedGroups((prev) => {
    const already = prev.some((s) => s.group_id === g.group_id);
    if (already) return prev.filter((s) => s.group_id !== g.group_id);
    // Selecting a panel covers its sub-tests — drop any that were
    // individually selected to avoid a duplicate (lab_request, test) row.
    const subIds = new Set((g.sub_tests || []).map((st) => st.test_id));
    setSelectedTests((pt) => pt.filter((t) => !subIds.has(t.test_id)));
    return [...prev, g];
  });

  const resetAll = () => {
    setForm({ name: "", phone: "", gender: "", age: "", notes: "" });
    setSelectedTests([]);
    setSelectedGroups([]);
    setCreatedRequest(null);
    setCreatedBill(null);
    setPaidAmount("");
    setPaymentMethod("CASH");
    setPaymentNotes("");
    setStep("details");
  };

  const handleCreateRequest = async () => {
    if (!form.name.trim()) {
      showToast("Please enter the patient's name", false);
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      showToast(PHONE_ERROR_MESSAGE, false);
      return;
    }
    if (selectedTests.length === 0 && selectedGroups.length === 0) {
      showToast("Please add at least one test or panel", false);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        walkin_name: form.name.trim(),
        test_ids: selectedTests.map((t) => t.test_id),
        group_ids: selectedGroups.map((g) => g.group_id),
      };
      if (form.phone.trim()) payload.walkin_phone = form.phone.trim();
      if (form.gender) payload.walkin_gender = form.gender;
      if (form.age) payload.walkin_age = parseInt(form.age, 10);
      if (form.notes.trim()) payload.notes = form.notes.trim();

      let result;
      try {
        result = await createWalkInLabRequest(payload);
      } catch (e) {
        // 409 = an active (unpaid) walk-in request already exists for this
        // patient today — resume it instead of creating a duplicate.
        if (e.status === 409 && e.existing_request_id) {
          showToast(`Resuming existing request #${e.existing_request_id}`, true);
          setCreatedRequest(e.request || null);
          setCreatedBill(e.bill || null);
          setPaidAmount(e.bill ? String(e.bill.total_amount) : "");
          setStep("review");
          return;
        }
        throw e;
      }

      setCreatedRequest(result.request);
      setCreatedBill(result.bill);
      setPaidAmount(result.bill ? String(result.bill.total_amount) : "");
      showToast("Walk-in lab request created.", true);
      setStep("review");
    } catch (e) {
      showToast("Failed to create request: " + String(e.message ?? e), false);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async () => {
    if (!createdBill) return;
    const billId = createdBill.bill_id ?? createdBill.id;
    const total = parseFloat(createdBill.total_amount ?? 0);
    if (parseFloat(paidAmount || 0) < total) {
      showToast(`Full payment of ₹${total.toFixed(2)} is required before sample collection.`, false);
      return;
    }
    setBusy(true);
    try {
      const result = await payLabBill(billId, {
        payment_method: paymentMethod,
        paid_amount: parseFloat(paidAmount),
        notes: paymentNotes.trim() || undefined,
      });
      showToast("Payment collected. Walk-in lab request is ready for sample collection.", true);
      setCreatedBill((b) => ({ ...b, payment_status: "PAID", paid_amount: paidAmount }));
      setStep("success");
      void result;
    } catch (e) {
      showToast("Payment failed: " + String(e.message ?? e), false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <Toast msg={toast.msg} ok={toast.ok} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: COLORS.gray[900], marginBottom: 4 }}>
          Walk-in Lab Test
        </h1>
        <p style={{ fontSize: 13.5, color: COLORS.gray[500] }}>
          For patients who come directly to the lab — no doctor consultation or MRD registration required.
        </p>
      </div>

      {/* Stepper */}
      <div style={{
        display: "flex", gap: 24, marginBottom: 24, padding: "14px 18px",
        background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12,
      }}>
        <StepDot label="Patient & Tests" active={step === "details"} done={step !== "details"} />
        <StepDot label="Review Bill" active={step === "review"} done={step === "success"} />
        <StepDot label="Payment" active={step === "review" || step === "payment"} done={step === "success"} />
        <StepDot label="Done" active={step === "success"} done={false} />
      </div>

      {step === "details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Ico d={ICONS.user} size={16} color={AMBER} />
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray[900] }}>Walk-in Patient Details</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={LBL}>Full Name *</label>
                <input style={INP} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Patient name" />
              </div>
              <div>
                <label style={LBL}>Phone (optional)</label>
                <input style={INP} value={form.phone} inputMode="numeric" onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Starts with 6-9, 10 digits" />
              </div>
              <div>
                <label style={LBL}>Gender (optional)</label>
                <select style={INP} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={LBL}>Age (optional)</label>
                <input style={INP} type="number" min="0" value={form.age} onChange={(e) => set("age", e.target.value)} placeholder="Age in years" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LBL}>Notes (optional)</label>
                <textarea style={{ ...INP, minHeight: 60, fontFamily: "inherit" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any clinical notes for the lab…" />
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Ico d={ICONS.flask} size={16} color={AMBER} />
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray[900] }}>Select Tests</span>
            </div>
            {testsLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.gray[400], fontSize: 13 }}>Loading test catalogue…</div>
            ) : (
              <TestPicker
                allTests={allTests}
                allGroups={allGroups}
                selectedTests={selectedTests}
                selectedGroups={selectedGroups}
                onAdd={addTest}
                onRemove={removeTest}
                onToggleGroup={toggleGroup}
              />
            )}
          </div>

          <button
            onClick={handleCreateRequest}
            disabled={busy}
            style={{
              padding: "13px 20px", background: AMBER, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {busy ? "Creating…" : "Create Walk-in Lab Request"}
          </button>
        </div>
      )}

      {step === "review" && createdRequest && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.gray[900] }}>
                  {createdRequest.patient_name || createdRequest.walkin_name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.gray[500] }}>
                  Walk-in · Request #{createdRequest.request_id}
                  {createdRequest.walkin_phone ? ` · ${createdRequest.walkin_phone}` : ""}
                </div>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "#FEF3C7", color: "#D97706",
              }}>
                {createdRequest.status}
              </span>
            </div>

            <div style={{ borderTop: `1px solid ${COLORS.gray[100]}`, paddingTop: 12 }}>
              {groupLabRequestItems(createdRequest.items || []).map((row) => row.type === "group" ? (
                <div key={`g-${row.groupId}`} style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: COLORS.gray[900] }}>{row.groupName}</span>
                    {row.groupPrice != null && (
                      <span style={{ fontWeight: 700, color: COLORS.gray[700] }}>₹{row.groupPrice.toFixed(2)}</span>
                    )}
                  </div>
                  <div style={{ marginLeft: 12, marginTop: 2 }}>
                    {row.items.map((it) => (
                      <div key={it.item_id} style={{ fontSize: 12, color: COLORS.gray[500], padding: "2px 0" }}>
                        • {it.test_name} {it.test_code && `(${it.test_code})`}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={row.item.item_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                  <span style={{ color: COLORS.gray[700] }}>{row.item.test_name} <span style={{ color: COLORS.gray[400] }}>({row.item.test_code})</span></span>
                  {row.item.test_price != null && (
                    <span style={{ color: COLORS.gray[700] }}>₹{parseFloat(row.item.test_price).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>

            {createdBill && (
              <div style={{
                marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.gray[100]}`,
              }}>
                {createdBill.bill_number && (
                  <div style={{ fontSize: 12, color: COLORS.gray[500], marginBottom: 4 }}>
                    Bill {createdBill.bill_number}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray[700] }}>Total Amount</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.gray[900] }}>
                    ₹{parseFloat(createdBill.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {createdBill && createdBill.payment_status === "PAID" ? (
            <div style={{ padding: 16, borderRadius: 10, background: "#F0FDF4", color: "#166534", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              This bill is already fully paid. Sample collection can proceed.
            </div>
          ) : (
            <button
              onClick={() => setStep("payment")}
              style={{
                padding: "13px 20px", background: AMBER, color: "#fff", border: "none",
                borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Proceed to Payment
            </button>
          )}
        </div>
      )}

      {step === "payment" && createdBill && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12, padding: 20 }}>
            <div style={{ background: COLORS.gray[50], padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.gray[500], marginBottom: 4 }}>Total Amount</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.gray[900] }}>
                ₹{parseFloat(createdBill.total_amount || 0).toFixed(2)}
              </div>
            </div>

            <label style={LBL}>Payment Amount *</label>
            <input
              type="number" min="0" step="0.01" style={{ ...INP, marginBottom: 14 }}
              value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
            />

            <label style={LBL}>Payment Method</label>
            <select style={{ ...INP, marginBottom: 14 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={LBL}>Notes (optional)</label>
            <textarea style={{ ...INP, minHeight: 50, fontFamily: "inherit" }} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep("review")}
              style={{
                flex: 1, padding: 12, background: "#fff", color: COLORS.gray[600],
                border: `1.5px solid ${COLORS.gray[200]}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Ico d={ICONS.arrowLeft} size={14} /> Back
            </button>
            <button
              onClick={handlePay}
              disabled={busy}
              style={{
                flex: 2, padding: 12, background: COLORS.success, color: "#fff", border: "none",
                borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Processing…" : "Collect Payment"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div style={{
          background: "#fff", border: `1px solid ${COLORS.gray[200]}`, borderRadius: 12,
          padding: 36, textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "#F0FDF4",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Ico d={ICONS.check} size={26} color={COLORS.success} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.gray[900], marginBottom: 6 }}>
            Walk-in lab request created &amp; paid
          </div>
          <div style={{ fontSize: 13, color: COLORS.gray[500], marginBottom: 24 }}>
            Request #{createdRequest?.request_id} for {createdRequest?.patient_name || createdRequest?.walkin_name} is
            ready for sample collection.
          </div>
          <button
            onClick={resetAll}
            style={{
              padding: "12px 24px", background: AMBER, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            + New Walk-in Test
          </button>
        </div>
      )}
    </div>
  );
}