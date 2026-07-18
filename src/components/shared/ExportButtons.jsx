// src/components/shared/ExportButtons.jsx
//
// Drop-in "Download PDF / Excel" button pair for any manager list page.
// Usage:
//   <ExportButtons
//     rows={filteredRows}
//     columns={[{ header: "Name", accessor: "full_name" }, ...]}
//     filename="expenses_2026-06-30_to_2026-07-12"
//     title="Expenses Report"
//     dateRange={{ from: start, to: end }}
//   />

import { exportToExcel, exportToPDF } from "../../utils/exportUtils";

const btnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "7px 14px", borderRadius: "8px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#374151", fontWeight: 600, fontSize: "12px",
  cursor: "pointer", whiteSpace: "nowrap",
};

export default function ExportButtons({ rows, columns, filename, title, dateRange, disabled }) {
  const isDisabled = disabled || !rows || rows.length === 0;

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <button
        type="button"
        style={{ ...btnStyle, opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? "not-allowed" : "pointer" }}
        disabled={isDisabled}
        onClick={() => exportToPDF({ rows, columns, filename, title, dateRange })}
        title="Download as PDF"
      >
        📄 PDF
      </button>
      <button
        type="button"
        style={{ ...btnStyle, opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? "not-allowed" : "pointer" }}
        disabled={isDisabled}
        onClick={() => exportToExcel({ rows, columns, filename, sheetName: title || "Sheet1" })}
        title="Download as Excel"
      >
        📊 Excel
      </button>
    </div>
  );
}