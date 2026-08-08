// src/utils/formErrors.js
//
// Every admin-module form (Staff, Doctors, Guest Doctors, Common Staff,
// Procedures, Branches, Settings...) hits the same DRF error shape:
//   { errors: { field: ["msg"], nested: { field: ["msg"] } } }
// or occasionally the bare serializer.errors dict without the "errors"
// wrapper. This was previously reimplemented per-page (see the old
// frontend's StaffPage/DoctorsPage/GuestDoctorsPage) — pulled out once
// here so every page shares one implementation and one set of edge cases.
export function flattenFormError(err, fallback = "Something went wrong.") {
  const backendErrors = err?.response?.data?.errors || err?.response?.data;

  if (backendErrors && typeof backendErrors === "object") {
    const flat = [];
    const extract = (obj, prefix = "") => {
      Object.entries(obj).forEach(([key, val]) => {
        const label = prefix ? `${prefix} \u203a ${key}` : key;
        if (Array.isArray(val)) {
          flat.push(`${label}: ${val.join(" ")}`);
        } else if (typeof val === "object" && val !== null) {
          extract(val, label);
        } else {
          flat.push(`${label}: ${val}`);
        }
      });
    };
    extract(backendErrors);
    if (flat.length) return flat.join(" | ");
  }

  if (typeof err === "string") return err;
  if (err?.message) return err.message;
  return fallback;
}