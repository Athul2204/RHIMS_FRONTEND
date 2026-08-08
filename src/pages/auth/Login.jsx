// src/pages/auth/Login.jsx

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import rhimsLogo from "../../assets/RHIMS LOGO.png";

const EyeOpen = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function Login() {
  const { login } = useAuth();

  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Username is case- and whitespace-insensitive (mirrors the backend
    // check in CustomTokenObtainPairSerializer.validate) — trim here so the
    // user never gets a confusing "invalid credentials" just because
    // autocomplete/autocapitalize left a stray leading/trailing space.
    // This is UX only, not the security boundary: the backend re-trims and
    // re-normalizes the username itself regardless of what a client sends.
    const normalizedUsername = form.username.trim();

    if (!normalizedUsername || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      await login({ ...form, username: normalizedUsername });
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : err?.message || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // FIX: the old `min-w-[1440px]` here was the actual cause of the
    // "not responsive" problem — it forced a hard floor on the viewport
    // width, so every screen under 1440px (i.e. every phone and most
    // tablets/laptops) just got horizontally squeezed/scrolled. Dropped
    // entirely; layout now adapts via the lg: breakpoint below instead.
    <div className="min-h-screen w-full flex bg-white">
      {/* LEFT SIDE — hero panel, hidden below lg so mobile/tablet get a
          clean single-column form instead of a squeezed sidebar */}
      <div className="hidden lg:flex lg:flex-1 xl:flex-[1.4] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1800&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-sky-800/40 to-slate-900/80" />
        <div className="absolute top-10 left-10 w-72 h-72 xl:w-[450px] xl:h-[450px] bg-cyan-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 xl:w-[500px] xl:h-[500px] bg-blue-300/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-center h-full w-full px-10 xl:px-16 2xl:px-20 py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-5 xl:gap-6 mb-8 xl:mb-10">
              <div className="w-20 h-20 xl:w-32 xl:h-32 rounded-3xl xl:rounded-[32px] bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl shrink-0">
                <img
                  src={rhimsLogo}
                  alt="RHIMS Logo"
                  className="w-14 h-14 xl:w-24 xl:h-24 object-contain"
                />
              </div>

              <div>
                <h1 className="text-4xl xl:text-6xl 2xl:text-7xl font-extrabold tracking-[0.14em] xl:tracking-[0.18em] text-white">
                  RHIMS
                </h1>
                <p className="text-cyan-100 mt-2 xl:mt-4 uppercase tracking-[0.3em] text-xs xl:text-sm">
                  Healthcare EMR Platform
                </p>
              </div>
            </div>

            <p className="text-white/90 text-lg xl:text-2xl leading-8 xl:leading-[52px] font-light max-w-2xl">
              Empowering Healthcare, One Click at a Time.
              <br />
              Your Health, Your Records, Your Control.
            </p>

            <div className="mt-8 xl:mt-14 max-w-xl backdrop-blur-md bg-white/10 border border-white/15 rounded-3xl xl:rounded-[32px] p-5 xl:p-7">
              <div className="flex items-start gap-4 xl:gap-5">
                <div className="w-12 h-12 xl:w-16 xl:h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white text-xl xl:text-2xl shrink-0">
                  +
                </div>
                <div>
                  <h3 className="text-white text-base xl:text-xl font-semibold">
                    Secure Healthcare Management
                  </h3>
                  <p className="text-white/70 text-sm mt-2 xl:mt-3 leading-6 xl:leading-7">
                    Smart EMR system designed for hospitals, clinics,
                    laboratories and healthcare professionals with secure
                    patient data management and intelligent workflow
                    handling.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — the actual login form. This is the only panel shown
          on phones/tablets, so it's the priority: comfortable padding at
          every width, no fixed pixel widths, safe-area aware. */}
      <div className="flex-1 flex items-center justify-center bg-white relative px-5 sm:px-8 md:px-12 py-10 sm:py-12">
        <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 lg:w-[450px] lg:h-[450px] bg-cyan-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="relative z-10 w-full max-w-md sm:max-w-lg">
          {/* Mobile/tablet logo — shown up to lg since the hero panel is hidden there */}
          <div className="lg:hidden flex flex-col items-center mb-8 sm:mb-10">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shadow-lg">
              <img
                src={rhimsLogo}
                alt="RHIMS Logo"
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
              />
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-[0.16em] text-slate-800">
              RHIMS
            </h1>
            <p className="text-cyan-700 text-xs uppercase tracking-[0.28em] mt-2">
              Healthcare EMR Platform
            </p>
          </div>

          {/* Desktop top logo — small mark above the form, only on lg+
              where the hero panel already carries the full branding */}
          <div className="hidden lg:flex justify-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-xl flex items-center justify-center">
              <img
                src={rhimsLogo}
                alt="RHIMS Logo"
                className="w-12 h-12 object-contain"
              />
            </div>
          </div>

          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-800">
              Login
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3">
              Welcome back! Please login to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-600 mb-2.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="Enter your username"
                className="w-full h-14 sm:h-16 rounded-full border border-slate-200 bg-slate-50 px-6 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-600"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="Enter your password"
                  className="w-full h-14 sm:h-16 rounded-full border border-slate-200 bg-slate-50 px-6 pr-14 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-5 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff /> : <EyeOpen />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-14 sm:h-16 rounded-full font-semibold text-white text-base transition-all duration-200 ${
                loading
                  ? "bg-cyan-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 active:scale-[0.99]"
              }`}
            >
              {loading ? "Signing In..." : "Login"}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-slate-400">
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              className="w-full h-14 sm:h-16 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              Continue with Google
            </button>
          </form>

          <div className="mt-10 sm:mt-12 text-center">
            <p className="text-sm text-slate-400">
              RHIMS © {new Date().getFullYear()}
            </p>
            <p className="text-xs text-slate-300 mt-2">
              Secure Healthcare Management Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}