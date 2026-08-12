import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth.api";
import { tenantApi } from "@/api/tenant.api";
import { toast } from "sonner";

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Set document title for SEO & screen reader orientation
  useEffect(() => {
    document.title = "Logistel | Create Account";
  }, []);

  // Form input states
  const [subdomain, setSubdomain] = useState("");
  const [role, setRole] = useState<"DRIVER" | "CUSTOMER">("DRIVER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Subdomain validation states
  const [resolvedTenant, setResolvedTenant] = useState<{ id: string; companyName: string } | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainError, setSubdomainError] = useState("");

  // Form interaction & validation states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Debounced subdomain check handler
  useEffect(() => {
    if (!subdomain.trim()) {
      setResolvedTenant(null);
      setSubdomainError("");
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setCheckingSubdomain(true);
      setSubdomainError("");
      setResolvedTenant(null);

      try {
        const res = await tenantApi.getBySubdomain(subdomain.trim());
        if (res.data?.status === "success" && res.data?.data) {
          setResolvedTenant({
            id: res.data.data.id,
            companyName: res.data.data.companyName,
          });
        }
      } catch (error: any) {
        console.warn("Subdomain lookup error:", error);
        setSubdomainError("Logistics company subdomain not found.");
      } finally {
        setCheckingSubdomain(false);
      }
    }, 600); // 600ms debounce buffer

    return () => clearTimeout(delayDebounce);
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError("");
    setFieldErrors({});

    const newErrors: Record<string, string> = {};

    // 1. Subdomain Check
    if (!subdomain.trim()) {
      newErrors.subdomain = "Company subdomain is required.";
    } else if (!resolvedTenant) {
      newErrors.subdomain = "Please enter a valid, registered company subdomain.";
    }

    // 2. Email Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Invalid email format.";
    }

    // 3. Password Check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "Password must include uppercase, lowercase, numbers, and special characters.";
    }

    // 4. Confirm Password Check
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      toast.error("Registration failed. Please check form validation errors.");
      return;
    }

    setIsLoading(true);

    try {
      // 5. Submit Registration Payload
      const response = await authApi.register({
        email: email.trim(),
        password,
        role,
        tenantId: resolvedTenant!.id,
      });

      const { data } = response;
      if (data?.status === "success" && data?.data) {
        toast.success(`Successfully registered as ${role}!`);
        const { user: registeredUser, token } = data.data;
        
        // Log in immediately & redirect
        login(registeredUser, token);
        navigate("/");
      } else {
        setGeneralError(data?.message || "Registration failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Registration error details:", error);
      const resData = error.response?.data;

      if (resData?.errors && Array.isArray(resData.errors)) {
        const errorsMap: Record<string, string> = {};
        resData.errors.forEach((err: any) => {
          errorsMap[err.field] = err.message;
        });
        setFieldErrors(errorsMap);
      } else if (resData?.message) {
        const msg = resData.message.toLowerCase();
        if (
          msg.includes("prisma") ||
          msg.includes("database") ||
          msg.includes("connect") ||
          msg.includes("pooler") ||
          msg.includes("econnrefused")
        ) {
          setGeneralError("Registration service is temporarily offline due to database issues. Please try again later.");
        } else {
          setGeneralError(resData.message);
        }
      } else {
        setGeneralError("Failed to connect to the registration server. Please check your network connection.");
      }
      toast.error("Registration failed.");
      setTimeout(() => errorAlertRef.current?.focus(), 50);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to filter unsafe subdomain chars
  const handleSubdomainChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSubdomain(clean);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-gutter relative overflow-x-hidden selection:bg-primary selection:text-on-primary py-12"
      style={{
        backgroundColor: "#0b1326",
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.15) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(3, 181, 211, 0.1) 0px, transparent 50%)
        `,
      }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(107,216,203,0.3)]">
            <span className="material-symbols-outlined text-on-primary text-[32px]">hub</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Logistel</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Create your Driver or Customer Profile
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-panel rounded-xl p-6 md:p-8">
          
          {/* General alert */}
          {generalError && (
            <div
              ref={errorAlertRef}
              tabIndex={-1}
              className="flex items-center gap-2 text-error bg-error-container/20 p-3 mb-4 rounded-lg border border-error/30 focus:outline-none"
              role="alert"
              aria-live="assertive"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                error
              </span>
              <p className="font-code-sm text-code-sm font-semibold">{generalError}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            
            {/* 1. Subdomain Input with Dynamic lookup feedback */}
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="subdomain">
                COMPANY SUBDOMAIN
              </label>
              <div className="relative">
                <input
                  className={`w-full bg-surface-container-lowest border text-on-surface rounded-lg px-4 py-3 font-body-md focus:ring-1 transition-all outline-none ${
                    fieldErrors.subdomain
                      ? "border-error/50 focus:ring-error focus:border-error"
                      : "border-outline-variant focus:ring-primary focus:border-primary"
                  }`}
                  id="subdomain"
                  placeholder="e.g. swift"
                  required
                  aria-required="true"
                  aria-invalid={!!fieldErrors.subdomain}
                  aria-describedby={fieldErrors.subdomain ? "subdomain-error" : undefined}
                  type="text"
                  value={subdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  onFocus={() => {
                    setFieldErrors((prev) => ({ ...prev, subdomain: "" }));
                  }}
                />
                
                {/* Searching Loader inside input */}
                {checkingSubdomain && (
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin text-[20px]">
                    progress_activity
                  </span>
                )}

                {/* Subdomain validation badge checks */}
                {!checkingSubdomain && resolvedTenant && (
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-[20px]">
                    check_circle
                  </span>
                )}
              </div>

              {/* Subdomain Verification Badges */}
              {!checkingSubdomain && resolvedTenant && (
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mt-1 ml-1 flex items-center gap-1">
                  Connected to {resolvedTenant.companyName}
                </p>
              )}
              {!checkingSubdomain && subdomainError && (
                <p className="text-[10px] text-error font-bold uppercase tracking-wider mt-1 ml-1">
                  {subdomainError}
                </p>
              )}
              {fieldErrors.subdomain && (
                <p className="font-code-sm text-code-sm text-error block mt-1 ml-1" id="subdomain-error" role="alert">
                  {fieldErrors.subdomain}
                </p>
              )}
            </div>

            {/* 2. Role Selector Cards */}
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1">
                SELECT PROFILE TYPE
              </label>
              <div className="grid grid-cols-2 gap-4">
                
                {/* Driver Card */}
                <button
                  type="button"
                  onClick={() => setRole("DRIVER")}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
                    role === "DRIVER"
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-[0_0_15px_rgba(107,216,203,0.15)]"
                      : "bg-surface-container-lowest border-outline-variant hover:border-white/20 text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">local_shipping</span>
                  <div>
                    <span className="block font-semibold text-[13px] tracking-tight">Driver</span>
                    <span className="block text-[9px] opacity-75 leading-tight mt-0.5">Fulfill cargo routes</span>
                  </div>
                </button>

                {/* Customer Card */}
                <button
                  type="button"
                  onClick={() => setRole("CUSTOMER")}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
                    role === "CUSTOMER"
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-[0_0_15px_rgba(107,216,203,0.15)]"
                      : "bg-surface-container-lowest border-outline-variant hover:border-white/20 text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">shopping_bag</span>
                  <div>
                    <span className="block font-semibold text-[13px] tracking-tight">Customer</span>
                    <span className="block text-[9px] opacity-75 leading-tight mt-0.5">Order deliveries</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Email Input */}
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="email">
                EMAIL ADDRESS
              </label>
              <input
                className={`w-full bg-surface-container-lowest border text-on-surface rounded-lg px-4 py-3 font-body-md focus:ring-1 transition-all outline-none ${
                  fieldErrors.email
                    ? "border-error/50 focus:ring-error focus:border-error"
                    : "border-outline-variant focus:ring-primary focus:border-primary"
                }`}
                id="email"
                placeholder="name@company.com"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => {
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
              />
              {fieldErrors.email && (
                <p className="font-code-sm text-code-sm text-error block mt-1 ml-1" id="email-error" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* 4. Password Input */}
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="password">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  className={`w-full bg-surface-container-lowest border text-on-surface rounded-lg pl-4 pr-12 py-3 font-body-md focus:ring-1 transition-all outline-none ${
                    fieldErrors.password
                      ? "border-error/50 focus:ring-error focus:border-error"
                      : "border-outline-variant focus:ring-primary focus:border-primary"
                  }`}
                  id="password"
                  placeholder="Min 8 chars, uppercase, digit, special symbol"
                  required
                  aria-required="true"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => {
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }}
                />
                <button
                  className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] hover:text-on-surface transition-colors"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="font-code-sm text-code-sm text-error block mt-1 ml-1" id="password-error" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* 5. Confirm Password Input */}
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface-variant block ml-1" htmlFor="confirmPassword">
                CONFIRM PASSWORD
              </label>
              <input
                className={`w-full bg-surface-container-lowest border text-on-surface rounded-lg px-4 py-3 font-body-md focus:ring-1 transition-all outline-none ${
                  fieldErrors.confirmPassword
                    ? "border-error/50 focus:ring-error focus:border-error"
                    : "border-outline-variant focus:ring-primary focus:border-primary"
                }`}
                id="confirmPassword"
                placeholder="Re-enter password"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined}
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
              />
              {fieldErrors.confirmPassword && (
                <p className="font-code-sm text-code-sm text-error block mt-1 ml-1" id="confirm-error" role="alert">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            {isLoading ? (
              <button
                className="w-full bg-[#0D9488] text-white font-headline-md text-[16px] py-3.5 rounded-lg flex items-center justify-center gap-3 transition-all opacity-80 pointer-events-none"
                disabled
                aria-busy="true"
                type="submit"
              >
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating Account...</span>
              </button>
            ) : (
              <button
                className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md text-[16px] py-3.5 rounded-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] glow-cyan shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight"
                type="submit"
              >
                Create Account
              </button>
            )}
          </form>
        </div>

        {/* Footer Link to Login */}
        <div className="mt-6 text-center">
          <p className="font-body-md text-on-surface-variant">
            Already have an account? 
            <Link className="text-primary font-semibold hover:underline ml-1 focus:outline-none focus:underline" to="/login">
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
