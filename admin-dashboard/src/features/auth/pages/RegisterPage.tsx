import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth.api";
import { tenantApi } from "@/api/tenant.api";
import { toast } from "sonner";
import { Icon } from "@iconify/react";

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
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative bg-[#080d1a] text-slate-100 py-12">
      {/* Main Container */}
      <main className="relative z-10 w-full max-w-[480px]">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-[#29a195] rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[32px]">hub</span>
          </div>
          <h1 className="font-display text-2xl text-slate-100 font-bold tracking-tight">Logistel</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create your Driver or Customer Profile
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-panel rounded-2xl p-6 md:p-8 border border-slate-800">
          
          {/* General alert */}
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

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            
            {/* 1. Subdomain Input with Dynamic lookup feedback */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block ml-1" htmlFor="subdomain">
                COMPANY SUBDOMAIN
              </label>
              <div className="relative">
                <input
                  className={`w-full bg-slate-900 border text-slate-100 rounded-xl pl-4 pr-10 py-3 text-sm focus:border-teal-400 transition-colors outline-none placeholder:text-slate-500 ${
                    fieldErrors.subdomain
                      ? "border-rose-500/80"
                      : "border-slate-700/80"
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
                  <Icon icon="lucide:loader-2" className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 animate-spin text-lg" />
                )}

                {/* Subdomain validation badge checks */}
                {!checkingSubdomain && resolvedTenant && (
                  <Icon icon="solar:check-circle-bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-lg" />
                )}
              </div>

              {/* Subdomain Verification Badges */}
              {!checkingSubdomain && resolvedTenant && (
                <p className="text-[11px] text-emerald-400 font-semibold mt-1 ml-1 flex items-center gap-1">
                  <span>Connected to {resolvedTenant.companyName}</span>
                </p>
              )}
              {!checkingSubdomain && subdomainError && (
                <p className="text-xs text-rose-400 font-semibold mt-1 ml-1">
                  {subdomainError}
                </p>
              )}
              {fieldErrors.subdomain && (
                <p className="text-xs text-rose-400 block mt-1 ml-1" id="subdomain-error" role="alert">
                  {fieldErrors.subdomain}
                </p>
              )}
            </div>

            {/* 2. Role Selector Cards */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
                SELECT PROFILE TYPE
              </label>
              <div className="grid grid-cols-2 gap-3">
                
                {/* Driver Card */}
                <button
                  type="button"
                  onClick={() => setRole("DRIVER")}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer ${
                    role === "DRIVER"
                      ? "bg-teal-500/10 border-teal-500/50 text-teal-300 font-bold"
                      : "bg-slate-900 border-slate-700/80 hover:border-slate-600 text-slate-400"
                  }`}
                >
                  <Icon icon="solar:delivery-bold-duotone" className="text-2xl text-teal-400" />
                  <div>
                    <span className="block font-semibold text-xs tracking-tight">Driver</span>
                    <span className="block text-[10px] opacity-75 leading-tight mt-0.5">Fulfill cargo routes</span>
                  </div>
                </button>

                {/* Customer Card */}
                <button
                  type="button"
                  onClick={() => setRole("CUSTOMER")}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer ${
                    role === "CUSTOMER"
                      ? "bg-teal-500/10 border-teal-500/50 text-teal-300 font-bold"
                      : "bg-slate-900 border-slate-700/80 hover:border-slate-600 text-slate-400"
                  }`}
                >
                  <Icon icon="solar:box-bold-duotone" className="text-2xl text-teal-400" />
                  <div>
                    <span className="block font-semibold text-xs tracking-tight">Customer</span>
                    <span className="block text-[10px] opacity-75 leading-tight mt-0.5">Order deliveries</span>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon icon={showPassword ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} className="text-lg" />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-rose-400 block mt-1 ml-1" id="password-error" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* 5. Confirm Password Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block ml-1" htmlFor="confirmPassword">
                CONFIRM PASSWORD
              </label>
              <input
                className={`w-full bg-slate-900 border text-slate-100 rounded-xl px-4 py-3 text-sm focus:border-teal-400 transition-colors outline-none placeholder:text-slate-500 ${
                  fieldErrors.confirmPassword
                    ? "border-rose-500/80"
                    : "border-slate-700/80"
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
                <p className="text-xs text-rose-400 block mt-1 ml-1" id="confirm-error" role="alert">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            {isLoading ? (
              <button
                className="w-full bg-teal-500/80 text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                disabled
                aria-busy="true"
                type="submit"
              >
                <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                <span>Creating Account...</span>
              </button>
            ) : (
              <button
                className="w-full bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                type="submit"
              >
                <span>Create Account</span>
                <Icon icon="lucide:arrow-right" className="text-base" />
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
