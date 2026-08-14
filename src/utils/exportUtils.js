// src/utils/exportUtils.js
//
// Generic, page-agnostic export helpers used by <ExportButtons/> on every
// manager list page (Salary, Attendance, Expenses, Dealers, Support Staff,
// Bills Overview). Each page just supplies its already-fetched rows plus a
// small column config — no page needs its own export logic.
//
// Requires two new frontend deps (not previously in package.json):
//   npm install xlsx jspdf jspdf-autotable
//
// xlsx and jspdf/jspdf-autotable are loaded via dynamic import() inside each
// export function below (not as static imports) so that pages which render
// <ExportButtons/> don't ship ~700kB of PDF/Excel libs in their own chunk —
// the libs are only fetched the moment a user actually clicks Export.

/**
 * @param {Array<object>} rows - raw data rows
 * @param {Array<{header: string, accessor: string|((row:object)=>any)}>} columns
 * @returns {Array<object>} rows shaped as { [header]: value }
 */
function shapeRows(rows, columns) {
  return rows.map((row) => {
    const out = {};
    columns.forEach((col) => {
      const val = typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor];
      out[col.header] = val ?? "";
    });
    return out;
  });
}

/**
 * Builds a human-readable "date-wise" label for the export title/subtitle.
 * Accepts either a single label string or a {from, to} pair.
 */
export function formatDateRangeLabel(range) {
  if (!range) return "";
  if (typeof range === "string") return range;
  const { from, to } = range;
  if (from && to && from !== to) return `${from} to ${to}`;
  return from || to || "";
}

export async function exportToExcel({ rows, columns, filename, sheetName = "Sheet1" }) {
  if (!rows || rows.length === 0) {
    alert("Nothing to export for the selected range.");
    return;
  }
  const XLSX = await import("xlsx");
  const shaped = shapeRows(rows, columns);
  const ws = XLSX.utils.json_to_sheet(shaped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF({ rows, columns, filename, title, dateRange }) {
  if (!rows || rows.length === 0) {
    alert("Nothing to export for the selected range.");
    return;
  }
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title || filename, 14, 15);

  const rangeLabel = formatDateRangeLabel(dateRange);
  let startY = 20;
  if (rangeLabel) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(rangeLabel, 14, 21);
    startY = 26;
  }

  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((col) => {
        const val = typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor];
        return val === null || val === undefined ? "" : String(val);
      })
    ),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}.pdf`);
}