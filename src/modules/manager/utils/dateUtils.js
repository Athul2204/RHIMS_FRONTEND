// src/modules/manager/utils/dateUtils.js
//
// yyyy-mm-dd, using LOCAL time (day/month/year as the browser's clock sees
// them) — never use `date.toISOString().split("T")[0]` for "today's date"
// anywhere in this app. toISOString() converts to UTC first, so during the
// hours where the local calendar day differs from the UTC calendar day
// (e.g. before ~5:30am in IST, or a much larger window in other timezones)
// it silently returns the WRONG day. That's what caused attendance marked
// "today" to sometimes get stored under yesterday's (or tomorrow's) date,
// making it fall outside the Daily/Weekly ranges shown on the Salary page.
export const toISODate = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};