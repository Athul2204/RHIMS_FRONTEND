// src/utils/branchDetection.js
//
// ⚠️ Known backend gap (see build spec §1): /auth/login/ and /auth/me/
// do not yet return `branch` or `is_group_admin` on the user object, even
// though both now exist and matter for every admin-role account. Until
// the backend adds them directly (flagged as the preferred long-term fix
// in the open questions, spec §3), this module is the fallback: it
// infers group-admin status by *behavior* — what GET /branches/ actually
// hands back to this particular logged-in user — rather than trusting a
// field that isn't there.
//
// Only ever called for role === "admin" (see AuthContext.loadBranchContext).
// Every other role is hard branch-scoped server-side regardless of what
// this returns, so this module is never invoked for them.
import API from "../api";

/**
 * detectBranchContext()
 *
 * Calls GET /api/administration/branches/ as the logged-in admin and
 * decides group-admin vs. branch-scoped-admin from the shape of the
 * response:
 *
 *  - 2+ branches returned  → definitely a group admin. A branch-scoped
 *    admin's account is hard-limited server-side to their own branch, so
 *    seeing more than one branch is only possible for a group admin.
 *  - exactly 1 branch      → ambiguous in principle (could be a group
 *    admin at a single-branch hospital), but functionally identical to a
 *    branch-scoped admin either way: there is nothing to switch between.
 *    Treated as branch-scoped so no switcher renders for a no-op choice.
 *  - 0 branches / request fails (403/404/network) → branch-scoped admin
 *    whose account isn't permitted to list branches at all, or a
 *    genuinely empty result. Treated as branch-scoped with no known
 *    branch; BranchSwitcher / HospitalSettingsPage degrade gracefully
 *    when `branches` is empty.
 *
 * Returns { isGroupAdmin: boolean, branches: Branch[] }.
 * Never throws — callers can await it unconditionally.
 */
export async function detectBranchContext() {
  try {
    const res = await API.get("/administration/branches/");
    const data = res.data;

    // DRF list endpoints here may or may not be paginated depending on
    // the view's pagination_class — handle both a bare array and the
    // {count, next, previous, results} envelope rather than assuming.
    const list = Array.isArray(data) ? data : (data?.results ?? []);

    if (list.length > 1) {
      return { isGroupAdmin: true, branches: list };
    }
    if (list.length === 1) {
      // Single branch visible — no meaningful switch to offer either way.
      return { isGroupAdmin: false, branches: list };
    }
    return { isGroupAdmin: false, branches: [] };
  } catch {
    // 403/404 (account can't manage branches) or any network hiccup —
    // fail safe into "branch-scoped, no branch info available" rather
    // than ever accidentally granting group-admin-looking UI.
    return { isGroupAdmin: false, branches: [] };
  }
}