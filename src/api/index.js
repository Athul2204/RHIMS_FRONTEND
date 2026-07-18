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

API.interceptors.request.use((config) => {
  const csrfToken = getCsrfCookie();
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
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