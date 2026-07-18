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

const AuthContext = createContext(null);

// FIX 3: Role key updated from "lab_technician" → "labtechnician" to match
// the backend's normalized form (permissions.py strips both spaces AND
// underscores: .replace(" ","").replace("_","")). The serializer and MeView
// now also emit "labtechnician" after the backend fix, so all three layers
// (login response, /me response, permission checks) agree on the same string.
export const ROLE_ROUTES = {
  admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
  pharmacist: "/pharmacy",
  labtechnician: "/lab",
  manager: "/manager",
};

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
  // completes. ProtectedRoute blocks on this so it never flashes a redirect.
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState(null);

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

        setUser(userData);
        sessionStorage.setItem("rhims_user", JSON.stringify(userData));

        const route = ROLE_ROUTES[userData.role] || "/";
        navigate(route);

        return userData;
      } catch (err) {
        // Prefer the backend's actual message when it sent one — this is
        // what carries e.g. the axes lockout detail ("Too many failed
        // login attempts... try again in N minutes") on a 403, which is
        // meaningfully different from plain invalid credentials on a 401.
        // Falling back to err.message for anything else would instead show
        // a generic axios string like "Request failed with status code 403".
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
    [navigate]
  );

  // ─── LOGOUT ─────────────────────────────
  const logout = useCallback(async () => {
    setAuthLoading(true);

    try {
      await logoutUser();
    } catch (e) {
      console.error("Logout API failed:", e);
    }

    setUser(null);
    sessionStorage.removeItem("rhims_user");
    navigate("/");

    setAuthLoading(false);
  }, [navigate]);

  // ─── FETCH USER (SESSION RESTORE) ──────
  const fetchUser = useCallback(async () => {
    try {
      const userData = await getMeUser();

      if (!userData) throw new Error("No user");

      setUser(userData);
      sessionStorage.setItem("rhims_user", JSON.stringify(userData));

      return userData;
    } catch (err) {
      setUser(null);
      sessionStorage.removeItem("rhims_user");
      throw err;
    }
  }, []);

  // ─── BOOTSTRAP AUTH ON APP LOAD ────────
  // FIX 4 (partial): On every boot we always hit /auth/me/ to validate that
  // the server-side cookie is still good, even when sessionStorage has cached
  // user data. This prevents a stale session from being treated as authenticated
  // after cookie expiry. If /me/ returns 401, the axios interceptor (api/index.js)
  // clears sessionStorage and the user lands on /login.
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
    }),
    [user, error, login, logout, fetchUser, clearError, authLoading, bootLoading]
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