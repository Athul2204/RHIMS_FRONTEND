// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, logoutUser, getMeUser } from "../api/authApi";
import { detectBranchContext } from "../utils/branchDetection";
import { getBranchList } from "../modules/admin/api/adminApi";
import { getManagerBranches } from "../modules/manager/api/managerApi";
import { setManagerActiveBranchId } from "../api";

const AuthContext = createContext(null);

// Role key strings match the backend's normalize_role() output
// (authentication/utils.py strips both spaces AND underscores).
export const ROLE_ROUTES = {
  admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
  pharmacist: "/pharmacy",
  labtechnician: "/lab",
  manager: "/manager",
};

// sessionStorage key for the last-selected branch in the group-admin
// switcher, namespaced per logged-in user id so switching accounts in the
// same browser tab doesn't leak one admin's branch selection to another.
//
// Stores a JSON blob `{ chosen: true, branch: <id> | null }` rather than
// just the branch id, because `null` is a legitimate, deliberate choice
// ("All Branches") and needs to stay distinguishable from "hasn't picked
// anything yet" — which is what forces SelectBranchPage to show. A bare
// missing/null value can't carry that distinction on its own.
const branchStorageKey = (userId) => `rhims_selected_branch_${userId}`;

// Manager's own branch selection — separate key from the admin one above.
// Unlike the admin switcher, "unset" here always means "fall back to home
// branch" (there's no "All Branches" concept for a manager), so this only
// ever stores a plain branch id, no chosen/null distinction needed.
const managerBranchStorageKey = (userId) => `rhims_manager_branch_${userId}`;

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  // ─── STATE ─────────────────────────────
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("rhims_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(false);
  // bootLoading starts true and is set false once the initial /me check
  // (and, for admins, the branch-context probe) completes. ProtectedRoute
  // blocks on this so it never flashes a redirect or a missing switcher.
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── BRANCH CONTEXT (admin role only) ──────────────────────────────
  // FIX: /auth/login/ and /auth/me/ now both return is_group_admin +
  // branch_* directly on the user object (see authentication/serializers.py
  // + views.py) — that's the trusted source of truth. The branch-count
  // guess in utils/branchDetection.js is kept only as a fallback for the
  // (now theoretical) case of a stale backend that hasn't deployed the
  // fields yet, so isGroupAdmin is never silently wrong on a single-branch
  // install again. Every non-admin role never touches any of this: the
  // backend hard-scopes them to one branch regardless.
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [branches, setBranches] = useState([]); // group admin: all branches. branch admin: just their own (0 or 1).
  const [branchContextLoading, setBranchContextLoading] = useState(false);
  // null = hasn't chosen yet (forces SelectBranchPage for a group admin
  // with branches to pick from) OR explicitly chose "All Branches" once
  // branchChosen is true. A number = a specific branch_id.
  const [selectedBranch, setSelectedBranchState] = useState(null);
  // Whether the group admin has made an explicit branch choice (a specific
  // branch, or deliberately "All Branches") this session/browser. Separate
  // from selectedBranch itself because "All Branches" is also represented
  // as null and must not be confused with "hasn't chosen anything yet".
  const [branchChosen, setBranchChosen] = useState(false);

  // ─── BRANCH CONTEXT (manager role only) ────────────────────────────
  // A Manager account can be granted access to more than one branch (see
  // administration.models.ManagerBranchAccess) — unlike admin, there's no
  // "All Branches" option, just their specific granted branches.
  const [managerBranches, setManagerBranches] = useState([]);
  const [managerActiveBranch, setManagerActiveBranchState] = useState(null);
  const [managerBranchesLoading, setManagerBranchesLoading] = useState(false);

  const setManagerBranch = useCallback(
    (branchId) => {
      setManagerActiveBranchState(branchId);
      setManagerActiveBranchId(branchId);
      if (user?.id) {
        try {
          sessionStorage.setItem(managerBranchStorageKey(user.id), String(branchId));
        } catch {
          // sessionStorage unavailable — in-memory state still works this session.
        }
      }
    },
    [user?.id]
  );

  // Runs for a Manager account only — fetches their accessible branches and
  // restores whatever they last picked in this browser, defaulting to the
  // backend's reported active branch (their home branch) otherwise.
  const loadManagerBranchContext = useCallback(async (userData) => {
    if (userData?.role !== "manager") {
      setManagerBranches([]);
      setManagerActiveBranchState(null);
      setManagerActiveBranchId(null);
      return;
    }

    setManagerBranchesLoading(true);
    try {
      const data = await getManagerBranches();
      const branchList = data?.branches ?? [];
      setManagerBranches(branchList);

      let chosen = data?.active_branch_id ?? null;
      try {
        const stored = sessionStorage.getItem(managerBranchStorageKey(userData.id));
        const storedId = stored ? Number(stored) : null;
        if (storedId && branchList.some((b) => b.branch_id === storedId)) {
          chosen = storedId;
        }
      } catch {
        // ignore — fall back to the backend-reported active branch
      }

      setManagerActiveBranchState(chosen);
      setManagerActiveBranchId(chosen);
    } catch {
      setManagerBranches([]);
      setManagerActiveBranchState(null);
      setManagerActiveBranchId(null);
    } finally {
      setManagerBranchesLoading(false);
    }
  }, []);

  const setSelectedBranch = useCallback(
    (branchId) => {
      setSelectedBranchState(branchId);
      setBranchChosen(true);
      if (user?.id) {
        try {
          sessionStorage.setItem(
            branchStorageKey(user.id),
            JSON.stringify({ chosen: true, branch: branchId ?? null })
          );
        } catch {
          // sessionStorage unavailable (private browsing etc.) — the
          // in-memory state above still works for this session.
        }
      }
    },
    [user?.id]
  );

  // Runs the branch-detection probe for an admin user and populates
  // context state. No-op (and resets to safe defaults) for every other
  // role, since they're always single-branch server-side.
  const loadBranchContext = useCallback(async (userData) => {
    if (userData?.role !== "admin") {
      setIsGroupAdmin(false);
      setBranches([]);
      setSelectedBranchState(null);
      setBranchChosen(false);
      return;
    }

    setBranchContextLoading(true);
    try {
      let groupAdmin;
      let branchList;

      if (typeof userData?.is_group_admin === "boolean") {
        // Trusted path: the backend told us directly.
        groupAdmin = userData.is_group_admin;
        try {
          const data = await getBranchList();
          branchList = Array.isArray(data) ? data : (data?.results ?? []);
        } catch {
          branchList = [];
        }
      } else {
        // Fallback for a stale backend response missing the field.
        const detected = await detectBranchContext(userData);
        groupAdmin = detected.isGroupAdmin;
        branchList = detected.branches;
      }

      setIsGroupAdmin(groupAdmin);
      setBranches(branchList);

      if (groupAdmin) {
        // Restore whatever this admin last explicitly chose in this
        // browser (a specific branch, or deliberate "All Branches"), if
        // anything — SelectBranchPage forces a choice otherwise. See the
        // branchStorageKey docstring for why this is a JSON blob rather
        // than a bare id.
        try {
          const raw = sessionStorage.getItem(branchStorageKey(userData.id));
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.chosen) {
            setSelectedBranchState(parsed.branch ?? null);
            setBranchChosen(true);
          } else {
            setSelectedBranchState(null);
            setBranchChosen(false);
          }
        } catch {
          setSelectedBranchState(null);
          setBranchChosen(false);
        }
      } else {
        // Branch-scoped admin — no switcher, nothing to select.
        setSelectedBranchState(null);
        setBranchChosen(true);
      }
    } finally {
      setBranchContextLoading(false);
    }
  }, []);

  // ─── LOGIN ─────────────────────────────
  const login = useCallback(
    async (credentials) => {
      setAuthLoading(true);
      setError(null);

      try {
        const data = await loginUser(credentials);
        const userData = data?.user || data;

        if (!userData?.id) {
          throw new Error("Invalid server response");
        }

        // On fresh login, clear any previous branch choice for this user so
        // Group Admins are always presented with SelectBranchPage on fresh logins
        if (userData?.id) {
          try {
            sessionStorage.removeItem(branchStorageKey(userData.id));
          } catch {
            // ignore
          }
        }

        setUser(userData);
        sessionStorage.setItem("rhims_user", JSON.stringify(userData));

        await loadBranchContext(userData);
        await loadManagerBranchContext(userData);

        const route = ROLE_ROUTES[userData.role] || "/";
        navigate(route);

        return userData;
      } catch (err) {
        // Prefer the backend's actual message when it sent one — this is
        // what carries e.g. the axes lockout detail on a 403, which is
        // meaningfully different from plain invalid credentials on a 401.
        let message = "Login failed";

        if (err?.response?.data?.error) message = err.response.data.error;
        else if (err?.response?.status === 401) message = "Invalid credentials";
        else if (typeof err === "string") message = err;
        else if (err?.message) message = err.message;

        setError(message);
        throw new Error(message);
      } finally {
        setAuthLoading(false);
      }
    },
    [navigate, loadBranchContext, loadManagerBranchContext]
  );

  // ─── LOGOUT ─────────────────────────────
  const logout = useCallback(async () => {
    setAuthLoading(true);

    try {
      await logoutUser();
    } catch (e) {
      console.error("Logout API failed:", e);
    }

    // Clear stored branch selection on logout so next login is treated as a fresh session
    try {
      if (user?.id) {
        sessionStorage.removeItem(branchStorageKey(user.id));
        sessionStorage.removeItem(managerBranchStorageKey(user.id));
      }
      Object.keys(sessionStorage).forEach((key) => {
        if (
          key.startsWith("rhims_selected_branch_") ||
          key.startsWith("rhims_manager_branch_")
        ) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }

    setUser(null);
    sessionStorage.removeItem("rhims_user");
    setIsGroupAdmin(false);
    setBranches([]);
    setSelectedBranchState(null);
    setBranchChosen(false);
    setManagerBranches([]);
    setManagerActiveBranchState(null);
    setManagerActiveBranchId(null);
    navigate("/");

    setAuthLoading(false);
  }, [user?.id, navigate]);

  // ─── FETCH USER (SESSION RESTORE) ──────
  const fetchUser = useCallback(async () => {
    try {
      const userData = await getMeUser();

      if (!userData) throw new Error("No user");

      setUser(userData);
      sessionStorage.setItem("rhims_user", JSON.stringify(userData));
      await loadBranchContext(userData);
      await loadManagerBranchContext(userData);

      return userData;
    } catch (err) {
      setUser(null);
      sessionStorage.removeItem("rhims_user");
      setIsGroupAdmin(false);
      setBranches([]);
      setSelectedBranchState(null);
      setBranchChosen(false);
      setManagerBranches([]);
      setManagerActiveBranchState(null);
      setManagerActiveBranchId(null);
      throw err;
    }
  }, [loadBranchContext, loadManagerBranchContext]);

  // ─── BOOTSTRAP AUTH ON APP LOAD ────────
  // Always hit /auth/me/ to validate the server-side cookie is still good,
  // even when sessionStorage has cached user data — prevents a stale
  // session from being treated as authenticated after cookie expiry.
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await fetchUser();
      } catch {
        // silent fail — user simply isn't authenticated
      } finally {
        if (mounted) setBootLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchUser]);

  // ─── CLEAR ERROR ───────────────────────
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ─── REFRESH BRANCHES (after creating/editing one in Branch Mgmt) ─────
  const refreshBranches = useCallback(async () => {
    if (user?.role === "admin") {
      await loadBranchContext(user);
    }
  }, [user, loadBranchContext]);

  // ─── MEMOIZED CONTEXT VALUE ────────────
  const value = useMemo(
    () => ({
      user,
      error,
      login,
      logout,
      fetchUser,
      clearError,
      isAuthenticated: !!user,
      authLoading,
      bootLoading,
      // Branch context — meaningful only when user.role === "admin".
      isGroupAdmin,
      branches,
      branchContextLoading,
      selectedBranch,
      setSelectedBranch,
      branchChosen,
      refreshBranches,
      // Branch context — meaningful only when user.role === "manager".
      managerBranches,
      managerActiveBranch,
      setManagerBranch,
      managerBranchesLoading,
      // Convenience: the branch-scoped admin's own single branch, or null
      // for a group admin (who isn't tied to one) / non-admin roles.
      // Prefer the trusted branch_id/branch_code/branch_name straight off
      // the user object (now always present for admin accounts — see
      // authentication/serializers.py + views.py); fall back to the
      // detected branches list for older backends or non-admin roles.
      ownBranch: !isGroupAdmin
        ? (user?.role === "admin" && user?.branch_id
            ? { branch_id: user.branch_id, code: user.branch_code, name: user.branch_name }
            : (branches.length === 1 ? branches[0] : null))
        : null,
    }),
    [
      user, error, login, logout, fetchUser, clearError, authLoading, bootLoading,
      isGroupAdmin, branches, branchContextLoading, selectedBranch, setSelectedBranch,
      branchChosen, refreshBranches,
      managerBranches, managerActiveBranch, setManagerBranch, managerBranchesLoading,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};