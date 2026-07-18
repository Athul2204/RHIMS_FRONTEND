// src/utils/phoneValidation.js
// Shared validation for Indian mobile numbers used across all
// phone-number input fields in the frontend.
//
// Rule: exactly 10 digits, and the first digit must be 6, 7, 8, or 9
// (valid Indian mobile number prefixes).

export const PHONE_REGEX = /^[6-9]\d{9}$/;

/**
 * Returns true if the given value is a valid 10-digit Indian mobile
 * number starting with 6, 7, 8, or 9. Empty/whitespace-only values are
 * NOT considered valid — check for "required" separately if the field
 * is optional.
 */
export const isValidPhone = (value) => PHONE_REGEX.test((value ?? "").trim());

/**
 * Strips everything but digits and caps the length at 10 — use this in
 * onChange handlers so the field can never even contain non-digit
 * characters or more than 10 digits.
 */
export const sanitizePhoneInput = (value) =>
  (value ?? "").replace(/\D/g, "").slice(0, 10);

export const PHONE_ERROR_MESSAGE =
  "Phone number must be 10 digits and start with 6, 7, 8, or 9.";
