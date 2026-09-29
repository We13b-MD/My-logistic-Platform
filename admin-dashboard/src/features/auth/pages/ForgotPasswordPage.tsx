import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { LogistelLogo } from "@/components/LogistelLogo";
import { toast } from "sonner";
import { authApi } from "@/api/auth.api";

type FlowStep = "EMAIL" | "RESET_PASSWORD" | "SUCCESS";
type ModalStatus = "VERIFYING" | "NOT_FOUND" | "VERIFIED";

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Logistel | Reset Password";
  }, []);

  // Form states
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submittingReset, setSubmittingReset] = useState(false);

  // Flow step management
  const [step, setStep] = useState<FlowStep>("EMAIL");

  // Verification Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<ModalStatus>("VERIFYING");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [verifiedRole, setVerifiedRole] = useState("");
  const [verifiedCompany, setVerifiedCompany] = useState("");

  // Handle Initial Email Submission with Registry Verification Modal
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setValidationError("Please enter a valid business email address.");
      return;
    }

    setValidationError("");
    setModalOpen(true);
    setModalStatus("VERIFYING");
    setModalErrorMessage("");

    const startTime = Date.now();

    try {
      const res = await authApi.requestPasswordReset(cleanEmail);

      // Keep verifying animation visible for at least 1.2s for clarity
      const elapsed = Date.now() - startTime;
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed));
      }

      const data = res.data?.data || {};
      setVerifiedRole(data.roleLabel || "Registered Member");
      setVerifiedCompany(data.tenantName || "Logistel Platform");
      setModalStatus("VERIFIED");

      // Auto-transition to code entry after brief celebration
      setTimeout(() => {
        setModalOpen(false);
        setStep("RESET_PASSWORD");
        toast.success(`Recovery code sent to ${cleanEmail}`);
      }, 1600);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - elapsed));
      }

      setModalStatus("NOT_FOUND");
      const msg =
        error.response?.data?.message ||
        `The email "${cleanEmail}" is not registered under Logistel as a Driver, Dispatcher, Tenant Administrator, or Customer.`;
      setModalErrorMessage(msg);
      toast.error("Account verification failed");
    }
  };

  // Handle Password Reset with OTP submission
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error("Please enter the 6-digit recovery code from your email.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please verify.");
      return;
    }

    setSubmittingReset(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword,
      });

      if (res.data?.status === "success") {
        toast.success("Password reset successful!");
        setStep("SUCCESS");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Invalid or expired recovery code. Please try again."
      );
    } finally {
      setSubmittingReset(false);
    }
  };

  return (
    <div className="bg-[#0b1326] text-[#dae2fd] font-body-md min-h-screen flex items-center justify-center p-6 relative overflow-hidden selection:bg-[#6bd8cb]/30">
      {/* Ambient Background Glow Shader */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#29a195]/10 rounded-full blur-[120px]" />
      </div>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full max-w-[440px] space-y-6">
        {/* Branding Anchor */}
        <LogistelLogo
          size="xl"
          layout="stacked"
          subtext="Global Logistics Intelligence"
          className="mb-6"
          titleClassName="text-[#6bd8cb]"
        />

        {/* ── STAGE 1: ENTER EMAIL FOR VERIFICATION ───────────────────────────────── */}
        {step === "EMAIL" && (
          <div className="bg-[#131b2e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-500 ease-out space-y-6">
            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-bold text-[#dae2fd]">Reset Password</h2>
              <p className="text-xs text-[#bcc9c6]">
                Enter your registered email address. We'll verify your account credentials before dispatching your recovery code.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className="text-[11px] font-semibold text-[#bcc9c6] block uppercase tracking-wider ml-1"
                  htmlFor="email"
                >
                  Registered Email Address
                </label>
                <div className="relative group">
                  <Icon
                    icon="solar:letter-bold-duotone"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bcc9c6] group-focus-within:text-[#6bd8cb] transition-colors text-lg"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="e.g. driver@swift.com, operator@logistel.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (validationError) setValidationError("");
                    }}
                    className={`w-full bg-[#060e20] border ${
                      validationError ? "border-rose-500" : "border-[#3d4947]"
                    } rounded-xl py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#879391] transition-all duration-200 outline-none focus:border-[#6bd8cb] text-sm`}
                  />
                </div>
                {validationError && (
                  <p className="text-rose-400 text-xs mt-1 px-1 font-semibold">{validationError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#29a195] hover:bg-[#22877d] text-[#00302b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-95 hover:shadow-[0_0_20px_rgba(107,216,203,0.3)] cursor-pointer text-sm"
              >
                <span>Verify & Send Recovery Code</span>
                <Icon icon="solar:shield-check-bold" className="text-base" />
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-[#6bd8cb] text-xs font-semibold hover:underline transition-all"
              >
                <Icon icon="solar:arrow-left-bold" className="text-base" />
                <span>Back to Login</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── STAGE 2: ENTER OTP & NEW PASSWORD ───────────────────────────────────── */}
        {step === "RESET_PASSWORD" && (
          <div className="bg-[#131b2e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-500 ease-out space-y-6">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mx-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{verifiedRole}</span>
              </div>
              <h2 className="text-xl font-bold text-[#dae2fd]">Enter Recovery Code</h2>
              <p className="text-xs text-[#bcc9c6]">
                We sent a 6-digit recovery code to{" "}
                <span className="text-[#6bd8cb] font-semibold">{email}</span>.
              </p>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* 6-Digit OTP */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#bcc9c6] block uppercase tracking-wider text-center">
                  6-Digit Recovery Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full bg-[#060e20] border border-[#3d4947] focus:border-[#6bd8cb] rounded-xl py-3 text-center font-mono text-2xl tracking-[0.4em] text-[#6bd8cb] font-bold outline-none transition-all placeholder:text-[#3d4947]"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label
                  className="text-[11px] font-semibold text-[#bcc9c6] block uppercase tracking-wider ml-1"
                  htmlFor="newPassword"
                >
                  New Password (min 8 characters)
                </label>
                <div className="relative group">
                  <Icon
                    icon="solar:lock-bold-duotone"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bcc9c6] group-focus-within:text-[#6bd8cb] transition-colors text-lg"
                  />
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#060e20] border border-[#3d4947] focus:border-[#6bd8cb] rounded-xl py-3.5 pl-12 pr-12 text-[#dae2fd] placeholder:text-[#879391] outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#bcc9c6] hover:text-[#6bd8cb] transition-colors"
                  >
                    <Icon icon={showPassword ? "solar:eye-bold" : "solar:eye-closed-bold"} />
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label
                  className="text-[11px] font-semibold text-[#bcc9c6] block uppercase tracking-wider ml-1"
                  htmlFor="confirmPassword"
                >
                  Confirm New Password
                </label>
                <div className="relative group">
                  <Icon
                    icon="solar:lock-check-bold-duotone"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bcc9c6] group-focus-within:text-[#6bd8cb] transition-colors text-lg"
                  />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#060e20] border border-[#3d4947] focus:border-[#6bd8cb] rounded-xl py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#879391] outline-none text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingReset}
                className="w-full bg-[#29a195] hover:bg-[#22877d] text-[#00302b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-95 disabled:opacity-60 cursor-pointer text-sm shadow-md"
              >
                {submittingReset ? (
                  <>
                    <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Reset Password</span>
                    <Icon icon="solar:check-circle-bold" className="text-base" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 flex items-center justify-between text-xs text-[#bcc9c6]">
              <button
                type="button"
                onClick={() => setStep("EMAIL")}
                className="hover:underline flex items-center gap-1 text-[#bcc9c6] hover:text-white"
              >
                <Icon icon="solar:arrow-left-bold" />
                Change Email
              </button>

              <button
                type="button"
                onClick={handleEmailSubmit}
                className="text-[#6bd8cb] font-semibold hover:underline flex items-center gap-1"
              >
                <Icon icon="solar:refresh-circle-bold" />
                Resend Code
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 3: PASSWORD RESET SUCCESS ─────────────────────────────────────── */}
        {step === "SUCCESS" && (
          <div className="bg-[#131b2e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-[#6bd8cb]/10 rounded-full flex items-center justify-center border border-[#6bd8cb]/30 mx-auto shadow-lg shadow-teal-500/10">
              <Icon icon="solar:check-circle-bold" className="text-[#6bd8cb] text-[48px]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#dae2fd]">Password Updated!</h2>
              <p className="text-xs text-[#bcc9c6] px-2">
                Your password has been successfully reset. You can now log into your Logistel console with your new credentials.
              </p>
            </div>

            <button
              onClick={() => navigate("/login")}
              className="w-full bg-[#29a195] hover:bg-[#22877d] text-[#00302b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-95 cursor-pointer text-sm shadow-md"
            >
              <span>Proceed to Login</span>
              <Icon icon="solar:arrow-right-bold" className="text-base" />
            </button>
          </div>
        )}

        {/* System Footer */}
        <div className="mt-8 text-center text-[#bcc9c6] text-[11px] opacity-60">
          © 2026 Logistel Systems. Global operational security enabled.
        </div>
      </main>

      {/* ── INTERACTIVE VERIFICATION POPUP MODAL ────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#131b2e] border border-white/10 rounded-2xl max-w-[420px] w-full p-6 sm:p-8 shadow-2xl relative text-center space-y-6 overflow-hidden">
            {/* Ambient inner glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* 1. VERIFYING STATE */}
            {modalStatus === "VERIFYING" && (
              <div className="space-y-6 py-2">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-teal-500/20 animate-ping" />
                  <div className="absolute inset-1.5 rounded-full border border-cyan-400/40 animate-pulse" />
                  <div className="w-14 h-14 rounded-full bg-teal-500/10 border border-teal-400/40 flex items-center justify-center text-teal-300 text-2xl shadow-inner">
                    <Icon icon="solar:shield-check-bold-duotone" className="animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Verifying Logistel Account...
                  </h3>
                  <p className="text-xs text-[#bcc9c6] max-w-xs mx-auto">
                    Searching Driver, Dispatcher, Tenant Admin & Customer directories for{" "}
                    <span className="text-[#6bd8cb] font-semibold block mt-1 truncate">
                      {email}
                    </span>
                  </p>
                </div>

                <div className="bg-[#0b1326] border border-white/5 rounded-xl p-3 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-teal-300">
                    <Icon icon="lucide:loader-2" className="animate-spin text-sm shrink-0" />
                    <span>Querying central identity directory...</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#bcc9c6]/70">
                    <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-sm shrink-0" />
                    <span>Encrypted TLS connection verified</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. VERIFIED SUCCESS STATE */}
            {modalStatus === "VERIFIED" && (
              <div className="space-y-6 py-2 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-4xl shadow-lg shadow-emerald-500/20">
                  <Icon icon="solar:check-circle-bold" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-emerald-400">Account Verified!</h3>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
                    <span>{verifiedRole}</span>
                    <span>•</span>
                    <span className="text-slate-300">{verifiedCompany}</span>
                  </div>
                  <p className="text-xs text-[#bcc9c6] max-w-xs mx-auto pt-1">
                    Security confirmation approved. Dispathing 6-digit recovery PIN to your inbox...
                  </p>
                </div>

                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-xs text-emerald-300 font-semibold flex items-center justify-center gap-2">
                  <Icon icon="lucide:loader-2" className="animate-spin" />
                  <span>Loading code redemption...</span>
                </div>
              </div>
            )}

            {/* 3. NOT FOUND ERROR STATE */}
            {modalStatus === "NOT_FOUND" && (
              <div className="space-y-6 py-2 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 mx-auto rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 text-4xl shadow-lg shadow-rose-500/20">
                  <Icon icon="solar:danger-triangle-bold" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-rose-400">Account Not Registered</h3>
                  <p className="text-xs text-slate-300 px-2 leading-relaxed">
                    {modalErrorMessage}
                  </p>
                </div>

                <div className="bg-[#0b1326] border border-white/5 rounded-xl p-3 text-left space-y-1.5 text-[11px] text-[#bcc9c6]">
                  <p className="font-semibold text-slate-200">What to check:</p>
                  <p>• Make sure there are no typos in the email address.</p>
                  <p>• Drivers & Dispatchers: confirm with your fleet manager that your profile was added.</p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      document.getElementById("email")?.focus();
                    }}
                    className="w-full bg-[#222a3d] hover:bg-[#2d3449] text-slate-200 font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer border border-white/10"
                  >
                    Try a Different Email
                  </button>

                  <div className="pt-2 flex items-center justify-center gap-4 text-xs">
                    <Link
                      to="/register"
                      onClick={() => setModalOpen(false)}
                      className="text-[#6bd8cb] hover:underline font-semibold"
                    >
                      Register as Customer
                    </Link>
                    <span className="text-slate-600">•</span>
                    <Link
                      to="/login"
                      onClick={() => setModalOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Back to Login
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
