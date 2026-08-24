import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth.api";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { Icon } from "@iconify/react";

export function LoginPage() {

  const navigate = useNavigate();
  const { login } = useAuth();
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Set document title for SEO & screen reader orientation
  useEffect(() => {
    document.title = "Logistel | Secure Login";
  }, []);

  // Form input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Interaction & presentation states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  // Official Google OAuth 2.0 Popup Handler
  const triggerGoogleOAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setGeneralError("");
      try {
        // Fetch User Profile from Google API using access_token
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const googleUser = await userInfoRes.json();

        if (googleUser?.email) {
          const response = await authApi.googleLogin({
            email: googleUser.email,
            googleId: googleUser.sub,
            name: googleUser.name,
            avatarUrl: googleUser.picture,
            requestedRole: "CUSTOMER",
          });

          if (response.data?.status === "success" && response.data?.data) {
            const { user, token, isNewUser } = response.data.data;
            toast.success(
              isNewUser
                ? `Welcome ${googleUser.name || ""}! Account created via Google.`
                : `Welcome back ${googleUser.name || googleUser.email}!`
            );
            login(user, token);
            navigate("/");
          } else {
            toast.error(response.data?.message || "Google authentication failed.");
          }
        } else {
          toast.error("Failed to retrieve Google profile email.");
        }
      } catch (err: any) {
        console.error("Google user info fetch error:", err);
        toast.error("Google authentication failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error("Google OAuth Popup Error:", errorResponse);
      toast.error("Google Sign-In popup closed or cancelled.");
    },
  });

  const handleGoogleLogin = () => {
    triggerGoogleOAuth();
  };

  const [emailError, setEmailError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError("");
    setEmailError("");

    // 1. Client-Side Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    } else if (!emailRegex.test(email)) {
      setEmailError("Invalid email address.");
      return;
    }

    // 2. Client-Side Password Validation
    if (!password) {
      setGeneralError("Password is required.");
      return;
    }

    setIsLoading(true);

    try {
      // 3. Trigger Authentication Service
      const response = await authApi.login(email, password);
      const { data } = response;

      if (data?.status === "success" && data?.data) {
        toast.success("Successfully logged in!");
        const { user, token } = data.data;

        // Save session credentials in Context
        login(user, token);

        // Redirect to homepage router selector
        navigate("/");
      } else {
        setGeneralError(data?.message || "Invalid credentials. Please try again.");
      }
    } catch (error: any) {
      console.error("Login submission error details:", error);
      const resData = error.response?.data;

      if (resData?.message) {
        const msg = resData.message.toLowerCase();

        // 4. Secure Database Masking (Do not leak system driver details)
        if (
          msg.includes("prisma") ||
          msg.includes("database") ||
          msg.includes("connect") ||
          msg.includes("pooler") ||
          msg.includes("econnrefused")
        ) {
          setGeneralError("Authentication service is temporarily offline due to database issues. Please try again later.");
        } else {
          setGeneralError(resData.message);
        }
      } else {
        setGeneralError("Failed to connect to the authentication server. Please check your network and try again.");
      }
      toast.error("Login failed.");

      // Auto focus error notification box for screen readers
      setTimeout(() => errorAlertRef.current?.focus(), 50);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative bg-[#080d1a] text-slate-100 py-12">
      {/* Background Decorative Element */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>

      {/* Login Container */}
      <main className="relative z-10 w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-[#29a195] rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[32px]">hub</span>
          </div>
          <h1 className="font-display text-2xl text-slate-100 font-bold tracking-tight">Logistel</h1>
          <p className="text-xs text-slate-400 mt-1">
            Global Freight Intelligence Engine
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-6 md:p-8 border border-slate-800">

          {/* General Error alert (role="alert" for dynamic voice announcements) */}
          {generalError && (
            <div
              ref={errorAlertRef}
              tabIndex={-1}
              className="flex items-center gap-2.5 text-rose-300 bg-rose-500/10 p-3 mb-4 rounded-xl border border-rose-500/30 text-xs focus:outline-none"
              role="alert"
              aria-live="assertive"
            >
              <Icon icon="solar:danger-triangle-bold" className="text-rose-400 text-lg flex-shrink-0" />
              <p className="font-semibold">{generalError}</p>
            </div>
          )}

          {/* Quick Demo Login Preset Badges */}

          <div className="mb-5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">

            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block">
              ⚡ Demo Quick Fill Credentials:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("superadmin@platform.com");
                  setPassword("password123");
                  setGeneralError("");
                  setEmailError("");
                }}
                className="px-2.5 py-1 rounded-md bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-xs font-semibold transition-colors"
              >
                👑 Platform Super Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@swift.com");
                  setPassword("password123");
                  setGeneralError("");
                  setEmailError("");
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
              >
                🏢 Tenant Owner
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("driver1@swift.com");
                  setPassword("password123");
                  setGeneralError("");
                  setEmailError("");
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
              >
                🏍️ Driver
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("customer@swift.com");
                  setPassword("password123");
                  setGeneralError("");
                  setEmailError("");
                }}
                className="px-2.5 py-1 rounded-md bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 text-xs font-semibold transition-colors"
              >
                🛍️ Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("dispatcher@swift.com");
                  setPassword("password123");
                  setGeneralError("");
                  setEmailError("");
                }}
                className="px-2.5 py-1 rounded-md bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 text-xs font-semibold transition-colors"
              >
                🎧 Dispatcher
              </button>
            </div>
          </div>



          <form className="space-y-4" onSubmit={handleSubmit} noValidate>


            {/* Email Field with Validation Error */}
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="email">
                WORK EMAIL
              </label>
              <div className="relative">
                <input
                  className={`w-full bg-surface-container-lowest border text-on-surface rounded-lg px-4 py-3 font-body-md focus:ring-1 transition-all outline-none ${emailError
                      ? "border-error/50 focus:ring-error focus:border-error"
                      : "border-outline-variant focus:ring-primary focus:border-primary"
                    }`}
                  id="email"
                  placeholder="name@company.com"
                  required
                  aria-required="true"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => {
                    if (emailError) setEmailError("");
                  }}
                />
                {emailError && (
                  <Icon icon="solar:danger-circle-bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-400 text-lg" />
                )}
              </div>
              {emailError && (
                <p className="font-code-sm text-code-sm text-error flex items-center gap-1 mt-1 ml-1" id="email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="password">
                  PASSWORD
                </label>
                <Link className="font-label-md text-label-md text-primary hover:underline transition-all focus:outline-none focus:underline" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg pl-4 pr-12 py-3 font-body-md focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                  id="password"
                  placeholder="••••••••"
                  required
                  aria-required="true"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => {
                    if (generalError) setGeneralError("");
                  }}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon icon={showPassword ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} className="text-lg" />
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            {isLoading ? (
              <button
                className="w-full bg-teal-500/80 text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                disabled
                aria-busy="true"
                type="submit"
              >
                <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                <span>Signing In...</span>
              </button>
            ) : (
              <button
                className="w-full bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                type="submit"
              >
                <span>Sign In to Platform</span>
                <Icon icon="lucide:arrow-right" className="text-base" />
              </button>
            )}
          </form>

          {/* Divider */}
          <div className="relative my-6 flex items-center" aria-hidden="true">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="mx-4 font-label-md text-label-md text-outline">or</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {/* Reserved Space for Google Auth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-[54px] border border-outline-variant/50 rounded-lg flex items-center justify-center group hover:border-primary/60 transition-colors bg-white/5 hover:bg-white/10 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight cursor-pointer"
          >
            <div className="flex items-center gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
              </div>
              <span className="font-body-md text-on-surface font-semibold">Continue with Google</span>
            </div>
          </button>

        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <p className="font-body-md text-on-surface-variant">
            Need specialized access?
            <Link className="text-primary font-semibold hover:underline ml-1 focus:outline-none focus:underline" to="/onboard">
              Register your logistics company
            </Link>
          </p>
          <div className="flex justify-center gap-4 mt-6 opacity-40">
            <Link className="font-label-md text-label-md hover:text-on-surface transition-colors" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="font-label-md text-label-md hover:text-on-surface transition-colors" to="/terms">
              Terms of Service
            </Link>
            <Link className="font-label-md text-label-md hover:text-on-surface transition-colors" to="/status">
              System Status
            </Link>
          </div>
        </div>
      </main>

      {/* Floating Background Details */}
      <div className="fixed bottom-10 left-10 hidden xl:block animate-pulse">
        <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-full border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]"></div>
          <span className="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-widest">
            Network Operational
          </span>
        </div>
      </div>
    </div>
  );
}
