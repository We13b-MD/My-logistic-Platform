import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { LogistelLogo } from "@/components/LogistelLogo";
import { toast } from "sonner";
import { authApi } from "@/api/auth.api";

export function ForgotPasswordPage() {
  useEffect(() => {
    document.title = "Logistel | Reset Password";
  }, []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setValidationError("Please enter a valid business email address.");
      return;
    }
    setValidationError("");
    setLoading(true);

    try {
      await authApi.requestPasswordReset(email);
      toast.success(`Reset link sent to ${email}`);
      setSubmitted(true);
    } catch (error: any) {
      toast.info(`Recovery instructions dispatched to ${email}`);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setSubmitted(false);
    setLoading(false);
    toast.success("Ready to resend recovery link.");
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
        <LogistelLogo size="xl" layout="stacked" subtext="Global Logistics Intelligence" className="mb-6" titleClassName="text-[#6bd8cb]" />

        {/* Glassmorphic Form Card */}
        <div className="bg-[#131b2e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-500 ease-out">
          {!submitted ? (
            <div className="space-y-6" id="formSection">
              <div className="space-y-1.5 text-center">
                <h2 className="text-xl font-bold text-[#dae2fd]">Reset Password</h2>
                <p className="text-xs text-[#bcc9c6]">
                  Enter your email address and we'll send you a link to reset your account access.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" id="resetForm">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#bcc9c6] block uppercase tracking-wider ml-1" htmlFor="email">
                    Email Address
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
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationError) setValidationError("");
                      }}
                      className={`w-full bg-[#060e20] border ${validationError ? "border-rose-500" : "border-[#3d4947]"
                        } rounded-xl py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#879391] transition-all duration-200 outline-none focus:border-[#6bd8cb] text-sm`}
                    />
                  </div>
                  {validationError && (
                    <p className="text-rose-400 text-xs mt-1 px-1 font-semibold">
                      {validationError}
                    </p>
                  )}
                </div>

                <button
                  id="submitBtn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#29a195] hover:bg-[#22877d] text-[#00302b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-95 hover:shadow-[0_0_20px_rgba(107,216,203,0.3)] disabled:opacity-60 cursor-pointer text-sm"
                >
                  {loading ? (
                    <>
                      <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <Icon icon="solar:arrow-right-bold" className="text-base" />
                    </>
                  )}
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
          ) : (
            /* Success State */
            <div className="flex flex-col items-center text-center py-2 space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-[#6bd8cb]/10 rounded-full flex items-center justify-center border border-[#6bd8cb]/30 shadow-lg shadow-teal-500/10">
                <Icon icon="solar:check-circle-bold" className="text-[#6bd8cb] text-[48px]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-[#dae2fd]">Check your inbox</h2>
                <p className="text-xs text-[#bcc9c6] px-2">
                  We've sent a recovery link to{" "}
                  <span className="text-[#dae2fd] font-semibold select-all">{email}</span>.
                </p>
              </div>
              <div className="w-full pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleResend}
                  className="w-full bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer border border-white/5"
                >
                  Resend Email
                </button>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-[#6bd8cb] text-xs font-semibold hover:underline w-full py-1"
                >
                  <Icon icon="solar:arrow-left-bold" className="text-base" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* System Footer */}
        <div className="mt-8 text-center text-[#bcc9c6] text-[11px] opacity-60">
          © 2026 Logistel Systems. Global operational security enabled.
        </div>
      </main>
    </div>
  );
}

