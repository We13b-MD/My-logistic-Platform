import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { tenantApi } from "@/api/tenant.api";
import { toast } from "sonner";
import { Industry } from "@/types";
import { Icon } from "@iconify/react";

export function TenantOnboardPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Ref to focus the general error alert for screen readers
  const errorAlertRef = useRef<HTMLDivElement>(null);

  // Set document title for SEO & screen reader orientation
  useEffect(() => {
    document.title = "Logistel | Company Onboarding";
  }, []);

  // Form field states
  const [formData, setFormData] = useState({
    company_name: "",
    subdomain: "",
    admin_email: "",
    password: "",
    confirm_password: "",
  });
  const [industry, setIndustry] = useState<Industry | "">("");
  
  // Error handling states
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Ambient backgrounds parallax movement (handles mouse move)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const blobs = document.querySelectorAll<HTMLElement>(".ambient-blob");
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      if (blobs[0]) blobs[0].style.transform = `translate(${x * 30}px, ${y * 30}px)`;
      if (blobs[1]) blobs[1].style.transform = `translate(${-(x * 30)}px, ${-(y * 30)}px)`;
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    // Clear errors when the user edits a field
    if (fieldErrors[id]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setGeneralError("");

    if (id === "subdomain") {
      // Clean subdomain (lowercase alphanumeric and hyphens only)
      const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev) => ({ ...prev, [id]: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const validatePasswordStrength = (pass: string) => {
    // Requirements: min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError("");
    setFieldErrors({});

    const errors: Record<string, string> = {};

    // Local validation
    if (!formData.company_name.trim()) {
      errors.company_name = "Company name is required.";
    }
    if (!formData.subdomain.trim()) {
      errors.subdomain = "Subdomain is required.";
    }
    if (!industry) {
      errors.industry = "Please select your industry.";
    }
    if (!formData.admin_email.trim()) {
      errors.admin_email = "Admin email is required.";
    }
    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
      errors.password = "Passwords do not match.";
    } else if (!validatePasswordStrength(formData.password)) {
      errors.password =
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("Registration failed. Please correct the invalid fields below.");
      // Focus on error message block for accessibility screen announcement
      setTimeout(() => errorAlertRef.current?.focus(), 50);
      return;
    }

    setIsLoading(true);

    try {
      const response = await tenantApi.onboard({
        companyName: formData.company_name,
        subdomain: formData.subdomain,
        industry: industry as Industry,
        adminEmail: formData.admin_email,
        adminPassword: formData.password,
      });

      const { data } = response;

      if (data?.status === "success" && data?.data) {
        toast.success("Logistics company successfully onboarded!");
        const { admin, token } = data.data;
        login(admin, token);
        navigate("/");
      } else {
        setGeneralError(data?.message || "Tenant onboarding failed. Please check inputs.");
        setTimeout(() => errorAlertRef.current?.focus(), 50);
      }
    } catch (error: any) {
      console.error("Onboarding error details:", error);
      const resData = error.response?.data;
      
      if (resData?.errors && Array.isArray(resData.errors)) {
        // Validation messages from backend
        const errorsMap: Record<string, string> = {};
        resData.errors.forEach((err: any) => {
          // Map backend field names (camelCase) to HTML ids (snake_case/direct matching)
          const fieldKey = err.field === "companyName" ? "company_name" 
                         : err.field === "adminEmail" ? "admin_email"
                         : err.field === "adminPassword" ? "password"
                         : err.field;
          errorsMap[fieldKey] = err.message;
        });
        setFieldErrors(errorsMap);
        setGeneralError("Registration failed. Please review input validations.");
      } else if (resData?.message) {
        const msg = resData.message.toLowerCase();
        // Mask database driver connection or network timeout errors
        if (
          msg.includes("prisma") ||
          msg.includes("database") ||
          msg.includes("connect") ||
          msg.includes("pooler") ||
          msg.includes("econnrefused")
        ) {
          setGeneralError("Registration is temporarily unavailable due to a database connection issue. Please try again later.");
        } else {
          setGeneralError(resData.message);
        }
      } else {
        setGeneralError("Failed to connect to the onboarding server. Please check your connection and try again.");
      }
      toast.error("Registration failed. Please check validation rules.");
      setTimeout(() => errorAlertRef.current?.focus(), 50);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative bg-[#080d1a] text-slate-100 py-12 selection:bg-teal-500 selection:text-slate-950">
      {/* Main Content Canvas */}
      <main className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-12 px-4 py-8 items-center z-10">
        {/* Branding Section (Visible on Desktop) */}
        <div className="hidden lg:flex flex-col space-y-6 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#29a195] rounded-2xl flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-slate-950 text-[28px]">hub</span>
            </div>
            <h1 className="font-display text-2xl text-slate-100 font-bold tracking-tight">Logistel</h1>
          </div>
          <div className="space-y-4">
            <h2 className="font-display text-3xl text-slate-100 font-bold leading-tight">Master your global supply chain.</h2>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Join the next generation of logistics owners. Scale your operations with precision tracking, automated dispatching, and real-time fleet analytics.
            </p>
          </div>
          {/* Feature Micro-Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-2 border border-slate-800">
              <Icon icon="solar:rocket-bold-duotone" className="text-teal-400 text-2xl" />
              <span className="text-xs font-bold text-slate-200">Rapid Onboarding</span>
              <span className="text-[11px] text-slate-400">Launch your hub in under 2 minutes</span>
            </div>
            <div className="glass-panel p-4 rounded-xl flex flex-col gap-2 border border-slate-800">
              <Icon icon="solar:shield-check-bold-duotone" className="text-cyan-400 text-2xl" />
              <span className="text-xs font-bold text-slate-200">Enterprise Security</span>
              <span className="text-[11px] text-slate-400">Multi-tenant data isolation</span>
            </div>
          </div>
        </div>

        {/* Registration Form Container */}
        <div className="flex flex-col w-full max-w-md mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
              <Icon icon="solar:shipping-truck-bold-duotone" className="text-slate-950 text-2xl" />
            </div>
            <span className="font-display text-xl text-slate-100 font-bold">Logistel</span>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-2xl shadow-xl space-y-5 border border-slate-800">
            <div className="space-y-1">
              <h3 className="font-display text-xl text-slate-100 font-bold">Register Company</h3>
              <p className="text-xs text-slate-400">Set up your logistics hub in minutes.</p>
            </div>

            {/* General Error alert at the top of form */}
            {generalError && (
              <div
                ref={errorAlertRef}
                tabIndex={-1}
                className="flex items-center gap-2.5 text-rose-300 bg-rose-500/10 p-3 rounded-xl border border-rose-500/30 text-xs focus:outline-none"
                role="alert"
                aria-live="assertive"
              >
                <Icon icon="solar:danger-triangle-bold" className="text-rose-400 text-lg flex-shrink-0" />
                <p className="font-semibold">{generalError}</p>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Form Grid - Compact 2-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="company_name">
                    COMPANY NAME
                  </label>
                  <input
                    className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-2 outline-none transition-all text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                      fieldErrors.company_name ? "border-error" : "border-outline-variant"
                    }`}
                    id="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder="e.g. Apex Freight Solutions"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.company_name}
                    aria-describedby={fieldErrors.company_name ? "company_name-error" : undefined}
                    autoComplete="organization"
                    type="text"
                  />
                  {fieldErrors.company_name && (
                    <span className="text-xs text-error block mt-1" id="company_name-error" role="alert">
                      {fieldErrors.company_name}
                    </span>
                  )}
                </div>

                {/* Subdomain */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="subdomain">
                    SUBDOMAIN
                  </label>
                  <div className="relative flex items-center">
                    <input
                      className={`w-full bg-surface-container-lowest border rounded-lg pl-4 pr-32 py-2 outline-none transition-all text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                        fieldErrors.subdomain ? "border-error" : "border-outline-variant"
                      }`}
                      id="subdomain"
                      value={formData.subdomain}
                      onChange={handleChange}
                      placeholder="apex-freight"
                      required
                      aria-required="true"
                      aria-invalid={!!fieldErrors.subdomain}
                      aria-describedby={fieldErrors.subdomain ? "subdomain-error" : undefined}
                      autoComplete="off"
                      type="text"
                    />
                    <span className="absolute right-4 text-on-surface-variant font-label-md border-l border-outline-variant pl-4">
                      .logistel.io
                    </span>
                  </div>
                  {fieldErrors.subdomain && (
                    <span className="text-xs text-error block mt-1" id="subdomain-error" role="alert">
                      {fieldErrors.subdomain}
                    </span>
                  )}
                </div>

                {/* Industry */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="industry">
                    INDUSTRY
                  </label>
                  <div className="relative">
                    <select
                      className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-2 outline-none transition-all text-on-surface appearance-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                        fieldErrors.industry ? "border-error" : "border-outline-variant"
                      }`}
                      id="industry"
                      value={industry}
                      onChange={(e) => {
                        setIndustry(e.target.value as Industry);
                        if (fieldErrors.industry) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.industry;
                            return next;
                          });
                        }
                      }}
                      required
                      aria-required="true"
                      aria-invalid={!!fieldErrors.industry}
                      aria-describedby={fieldErrors.industry ? "industry-error" : undefined}
                    >
                      <option value="" disabled>Select Industry</option>
                      <option value="TRANSPORT">Transport & Haulage</option>
                      <option value="FOOD">Food & Beverage</option>
                      <option value="HEALTH">Healthcare & Medical</option>
                      <option value="OTHERS">Retail & E-commerce</option>
                      <option value="OTHERS">Other</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        expand_more
                      </span>
                    </div>
                  </div>
                  {fieldErrors.industry && (
                    <span className="text-xs text-error block mt-1" id="industry-error" role="alert">
                      {fieldErrors.industry}
                    </span>
                  )}
                </div>

                {/* Admin Email */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="admin_email">
                    ADMIN EMAIL
                  </label>
                  <input
                    className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-2 outline-none transition-all text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                      fieldErrors.admin_email ? "border-error" : "border-outline-variant"
                    }`}
                    id="admin_email"
                    value={formData.admin_email}
                    onChange={handleChange}
                    placeholder="admin@company.com"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.admin_email}
                    aria-describedby={fieldErrors.admin_email ? "admin_email-error" : undefined}
                    autoComplete="email"
                    type="email"
                  />
                  {fieldErrors.admin_email && (
                    <span className="text-xs text-error block mt-1" id="admin_email-error" role="alert">
                      {fieldErrors.admin_email}
                    </span>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="password">
                    PASSWORD
                  </label>
                  <input
                    className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-2 outline-none transition-all text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                      fieldErrors.password ? "border-error" : "border-outline-variant"
                    }`}
                    id="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    autoComplete="new-password"
                    type="password"
                  />
                  {fieldErrors.password && (
                    <span className="text-xs text-error block mt-1" id="password-error" role="alert">
                      {fieldErrors.password}
                    </span>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="confirm_password">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-2 outline-none transition-all text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-midnight ${
                      fieldErrors.confirm_password ? "border-error" : "border-outline-variant"
                    }`}
                    id="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.confirm_password}
                    aria-describedby={fieldErrors.confirm_password ? "confirm_password-error" : undefined}
                    autoComplete="new-password"
                    type="password"
                  />
                  {fieldErrors.confirm_password && (
                    <span className="text-xs text-error block mt-1" id="confirm_password-error" role="alert">
                      {fieldErrors.confirm_password}
                    </span>
                  )}
                </div>
              </div>

              {/* Submit button with loader */}
              {isLoading ? (
                <button
                  className="w-full bg-teal-500/80 text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                  disabled
                  aria-busy="true"
                  type="submit"
                >
                  <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                  <span>Provisioning Company Hub...</span>
                </button>
              ) : (
                <button
                  className="w-full bg-teal-400 hover:bg-teal-300 text-slate-950 font-extrabold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                  type="submit"
                >
                  <span>Register Logistics Company</span>
                  <Icon icon="lucide:arrow-right" className="text-base text-slate-950" />
                </button>
              )}
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 py-1" aria-hidden="true">
              <div className="h-px bg-slate-800 flex-1"></div>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">OR</span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </div>

            {/* Social Auth */}
            <button className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer">
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"></path>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="text-center pt-1">
              <p className="text-xs text-slate-400">
                Already registered?{" "}
                <Link className="text-teal-400 hover:underline font-bold transition-all" to="/login">
                  Sign In
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-4 flex justify-between items-center text-slate-500 px-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:lock-bold" className="text-slate-400 text-xs" />
              <span className="text-[10px] uppercase tracking-widest font-bold">SSL Secure</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:verified-check-bold" className="text-slate-400 text-xs" />
              <span className="text-[10px] uppercase tracking-widest font-bold">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:cloud-bold" className="text-slate-400 text-xs" />
              <span className="text-[10px] uppercase tracking-widest font-bold">High Availability</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto py-6 text-slate-500 text-[10px] uppercase tracking-widest font-mono z-10">
        © 2026 Logistel Systems. All rights reserved.
      </footer>
    </div>
  );
}
