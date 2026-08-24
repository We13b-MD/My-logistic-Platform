import { mailTransporter, isMailConfigured } from "../config/mail";

export type EmailType = "VERIFICATION" | "DELIVERY_HANDOFF" | "PASSWORD_RESET";

/**
 * Sends a branded OTP confirmation or notification email to a user/recipient.
 * @param to Email address of recipient
 * @param otpCode 6-digit verification pin / OTP
 * @param type Type of OTP email
 */
export async function sendOtpEmail(
  to: string,
  otpCode: string,
  type: EmailType = "VERIFICATION"
): Promise<boolean> {
  const from = process.env.SMTP_FROM || `"Logistel Operations" <noreply@logistel.com>`;

  let subject = "Your Verification Code";
  let title = "Verification Required";
  let message = "Please use the 6-digit confirmation code below to verify your account:";

  if (type === "DELIVERY_HANDOFF") {
    subject = "📦 Your Delivery Confirmation Pin";
    title = "Package Delivery Confirmation";
    message = "Your courier is nearby! Please provide the 6-digit confirmation pin below to the driver to complete handoff:";
  } else if (type === "PASSWORD_RESET") {
    subject = "🔑 Reset Your Password";
    title = "Password Reset Request";
    message = "Use the 6-digit security pin below to reset your password:";
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
          .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #edf2f7; }
          .title { font-size: 20px; font-weight: 700; color: #1a202c; margin-top: 15px; }
          .message { font-size: 14px; color: #4a5568; line-height: 1.6; margin-top: 15px; }
          .otp-container { text-align: center; margin: 25px 0; background: #f7fafc; padding: 18px; border-radius: 8px; border: 1px dashed #cbd5e0; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2b6cb0; font-family: monospace; }
          .footer { font-size: 12px; color: #a0aec0; text-align: center; margin-top: 25px; border-top: 1px solid #edf2f7; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>🚀 Logistel Platform</h2>
            <div class="title">${title}</div>
          </div>
          <div class="message">${message}</div>
          <div class="otp-container">
            <span class="otp-code">${otpCode}</span>
          </div>
          <div class="message">This code expires in <strong>10 minutes</strong>. Do not share this pin with anyone.</div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Logistel B2B Technologies. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. If SMTP is configured, send real email via transporter
  if (isMailConfigured && mailTransporter) {
    try {
      await mailTransporter.sendMail({
        from,
        to,
        subject,
        html: htmlTemplate,
      });
      console.log(`✉️ Email successfully sent to ${to} (${type})`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to send email via SMTP to ${to}:`, error?.message || error);
    }
  }

  // 2. Fallback for development mode when SMTP keys are absent
  console.log("\n==================================================");
  console.log(`✉️ [DEV EMAIL OTP] To: ${to}`);
  console.log(`📌 Subject: ${subject}`);
  console.log(`🔑 OTP Code: ${otpCode}`);
  console.log("==================================================\n");

  return true;
}
