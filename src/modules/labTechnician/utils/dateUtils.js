// src/modules/labTechnician/utils/dateUtils.js
//
// yyyy-mm-dd using LOCAL date components. Never use `date.toISOString()`
// for "today's date" — it converts to UTC first, which can silently roll
// the date back/forward a day depending on the user's timezone offset
// (e.g. early-morning IST). getFullYear/getMonth/getDate keeps it
// anchored to what the user actually sees on their clock.
// (Mirrors manager/utils/dateUtils.js — kept as a separate copy so the
// lab module has no cross-module import.)
export const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isValidISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// Quick date-range presets, mirroring manager/pages/BillsPage.jsx so the
// Lab Bills page behaves identically to the Manager's Bills page.
// Each returns { start, end } as YYYY-MM-DD strings.
export const PRESET_RANGES = {
  today: () => {
    const t = new Date();
    return { start: toISODate(t), end: toISODate(t) };
  },
  week: () => {
    const t = new Date();
    const day = t.getDay(); // 0 = Sun ... 6 = Sat
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(t);
    monday.setDate(t.getDate() - diffToMonday);
    return { start: toISODate(monday), end: toISODate(t) };
  },
  month: () => {
    const t = new Date();
    const first = new Date(t.getFullYear(), t.getMonth(), 1);
    return { start: toISODate(first), end: toISODate(t) };
  },
  year: () => {
    const t = new Date();
    const first = new Date(t.getFullYear(), 0, 1);
    return { start: toISODate(first), end: toISODate(t) };
  },
};
