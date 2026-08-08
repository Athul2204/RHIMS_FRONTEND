// src/api/index.js
// ═════════════════════════════════════════════════════════════════════════════
//
// Base client for the RHIMS API, configured for cross-domain deployment
// (frontend on rhimshealth.com, backend on rhims.pythonanywhere.com).
//
// ✅ CSRF:
//    - Extracts csrftoken cookie and sends it as X-CSRFToken on every request.
//    - Bootstraps the cookie on load if it isn't present yet (see
//      ensureCsrfCookie below) — needed because on a fresh cross-domain
//      session there's no csrftoken cookie until the browser has hit the
//      backend at least once.
//
// ✅ AUTHENTICATION:
//    - JWT delivered via httpOnly cookies (CookieJWTAuthentication).
//    - On a 401 from a protected endpoint, attempts a silent refresh via
//      /auth/refresh/ once before giving up and redirecting to login —
//      previously any 401 immediately booted the user, even if their
//      access token had just expired and a valid refresh cookie existed.
//
// ═════════════════════════════════════════════════════════════════════════════

import axios from "axios";

// Configurable per environment via .env (VITE_API_BASE_URL). Falls back to
// localhost for local dev so nothing breaks if the var isn't set yet.
//
// normalizeBaseUrl() guards against the #1 misconfiguration we've hit:
// someone sets VITE_API_BASE_URL=http://localhost:8000 (host only, no
// /api) or with a trailing slash, and every request silently 404s because
// Django's routes all live under /api/... (see rhimsbackend/urls.py).
// This makes the base URL resilient to both mistakes instead of relying on
// the .env value being formatted exactly right.
function normalizeBaseUrl(raw) {
  const fallback = "http://localhost:8000/api";
  let url = (raw || fallback).trim();

  // Strip any trailing slash(es) first so we don't end up with "//api".
  url = url.replace(/\/+$/, "");

  // If the configured URL doesn't already end in /api, append it.
  if (!/\/api$/.test(url)) {
    url = `${url}/api`;
  }

  return url;
}

const resolvedBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

// Surfaced once at startup so a misconfigured env var is obvious in the
// console instead of manifesting as a wall of silent 404s later.
if (import.meta.env.DEV) {
  console.info(`[API] Using base URL: ${resolvedBaseUrl}`);
}

const API = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true, // required for httpOnly cookies cross-domain
  headers: {
    "Content-Type": "application/json",
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// CSRF TOKEN HANDLING
// ═════════════════════════════════════════════════════════════════════════════

function getCsrfCookie() {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1];
}

// On a fresh cross-domain session there's no csrftoken cookie yet, so the
// first POST (usually login) would fail CSRF validation before the browser
// ever received one. Call this once at app startup (see comment below) to
// hit a safe GET endpoint first, letting Django set the cookie.
//
// Point this at any lightweight GET view your backend exposes — /auth/me/
// is a reasonable choice since you likely already have it for boot-time
// auth checks. Adjust the path if your endpoint differs.
export async function ensureCsrfCookie() {
  if (!getCsrfCookie()) {
    try {
      await API.get("/auth/me/");
    } catch {
      // Expected to fail with 401 for unauthenticated visitors — that's
      // fine, we only care that Django had a chance to set the cookie.
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVICE ID
// ═════════════════════════════════════════════════════════════════════════════
//
// Backend expects a stable, client-generated device identifier on every
// request via X-Device-Id (see authentication/views.py and
// administration/audit.py:get_current_device_id — used for "new device"
// login flagging and the UserDevice/audit trail; truncated to 64 chars
// server-side). Generated once per browser and persisted in localStorage
// (not sessionStorage) so it stays the same across tabs and future
// sessions — the whole point is recognizing "have we seen this device
// before", which a session-scoped id can't do.
const DEVICE_ID_STORAGE_KEY = "rhims_device_id";

function getOrCreateDeviceId() {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) {
      deviceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    // localStorage unavailable (private browsing lockdown, etc.) — fall
    // back to an in-memory id for the lifetime of this page load rather
    // than sending no device id at all.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const deviceId = getOrCreateDeviceId();

// ═════════════════════════════════════════════════════════════════════════════
// MANAGER ACTIVE-BRANCH INJECTION
// ═════════════════════════════════════════════════════════════════════════════
//
// A Manager account can have access to more than one branch (see
// administration.models.ManagerBranchAccess). The backend resolves which
// branch a request is scoped to from a `branch` query param — see
// authentication/utils.py:resolve_manager_active_branch, which checks
// query_params.get("branch") unconditionally regardless of HTTP method, so
// appending it to every manager request's query string (rather than the
// body) works uniformly for GET/POST/PATCH/DELETE alike.
//
// Rather than editing every one of managerApi.js's ~50 call sites to pass
// `{ branch: ... }`, AuthContext calls setManagerActiveBranchId() whenever
// the manager picks a branch in BranchSwitcher.jsx, and this interceptor
// stamps it onto every branch-scoped manager request automatically. Kept
// as a plain module-level variable (not React state) since axios
// interceptors run outside the component tree.
//
// Most manager endpoints live under /manager/*, but a few — e.g. Procedures
// (administration/views.py's ProcedureListView/ProcedureDetailView, reused
// as-is by managerApi.js rather than duplicated under /manager/) — live
// under a different app's prefix while still being branch-scoped for a
// manager caller. A plain `startsWith("/manager/")` check silently skipped
// these: the branch param never went out, so switching branches had no
// effect on them regardless of what BranchSwitcher.jsx showed as selected.
// List every such prefix explicitly here rather than broadly matching
// "/administration/" (which also serves branch-agnostic and admin-only
// endpoints where stamping a stray ?branch= could be misleading), so
// adding the next shared endpoint is a one-line addition, not silent.
const MANAGER_BRANCH_SCOPED_PREFIXES = [
  "/manager/",
  "/administration/procedures/",
];

let managerActiveBranchId = null;

export function setManagerActiveBranchId(id) {
  managerActiveBranchId = id ?? null;
}

API.interceptors.request.use((config) => {
  const csrfToken = getCsrfCookie();
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
  }

  config.headers["X-Device-Id"] = deviceId;

  if (
    managerActiveBranchId != null &&
    config.url &&
    MANAGER_BRANCH_SCOPED_PREFIXES.some((prefix) => config.url.startsWith(prefix)) &&
    !/^\/manager\/branches\/?($|\?)/.test(config.url) &&
    config.params?.branch === undefined
  ) {
    config.params = { ...config.params, branch: managerActiveBranchId };
  }

  return config;
});

// ═════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING + SILENT TOKEN REFRESH
// ═════════════════════════════════════════════════════════════════════════════
//
// On a 401 from a protected endpoint, try refreshing the access token once
// via the httpOnly refresh cookie before giving up. Only redirects to login
// if the refresh itself also fails (i.e. the refresh token is genuinely
// expired/invalid), instead of booting the user on every access-token
// expiry, which happens far more often than a full session expiry.
//
let isRefreshing = false;
let pendingRequests = [];

function resolvePending(error) {
  pendingRequests.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      resolve(API(config));
    }
  });
  pendingRequests = [];
}

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (!response || response.status !== 401) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      config?.url?.includes("/auth/login") ||
      config?.url?.includes("/auth/refresh") ||
      config?.url?.includes("/auth/me");

    // Don't attempt refresh loops on the auth endpoints themselves.
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Only retry each request once.
    if (config._retried) {
      sessionStorage.removeItem("rhims_user");
      window.location.href = "/";
      return Promise.reject(error);
    }
    config._retried = true;

    if (isRefreshing) {
      // Another request already triggered a refresh — queue this one
      // until it resolves instead of firing a duplicate refresh call.
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject, config });
      });
    }

    isRefreshing = true;
    try {
      await API.post("/auth/refresh/");
      isRefreshing = false;
      resolvePending(null);
      return API(config);
    } catch (refreshError) {
      isRefreshing = false;
      resolvePending(refreshError);
      sessionStorage.removeItem("rhims_user");
      window.location.href = "/";
      return Promise.reject(refreshError);
    }
  }
);

export default API;