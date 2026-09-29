export type EmailType = "VERIFICATION" | "DELIVERY_HANDOFF" | "PASSWORD_RESET";

/**
 * Sends a branded OTP email via Brevo's HTTP REST API (port 443 HTTPS).
 * This replaces the Nodemailer SMTP transport which is blocked on Render's free tier.
 *
 * Required env var: BREVO_API_KEY (from Brevo Dashboard → Settings → API Keys)
 * Optional env var: SMTP_FROM (sender display name + email)
 *
 * @param to Email address of recipient
 * @param otpCode 6-digit verification pin / OTP
 * @param type Type of OTP email
 */
export async function sendOtpEmail(
  to: string,
  otpCode: string,
  type: EmailType = "VERIFICATION"
): Promise<boolean> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const smtpFrom = process.env.SMTP_FROM || `"Logistel Technologies" <idundunmd13@gmail.com>`;

  // Parse "Display Name <email@example.com>" format
  const fromMatch = smtpFrom.match(/^(.*?)\s*<([^>]+)>$/);
  const senderName = fromMatch ? fromMatch[1].replace(/^"|"$/g, "").trim() : "Logistel Platform";
  const senderEmail = fromMatch ? fromMatch[2].trim() : "idundunmd13@gmail.com";

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

  const htmlContent = `
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

  // 1. Send via Brevo HTTP API (works on all cloud providers including Render free tier)
  if (brevoApiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        console.error(`❌ Brevo HTTP API error (${response.status}):`, data);
        throw new Error(`Brevo API error: ${data?.message || JSON.stringify(data)}`);
      }

      console.log(`✉️ Email successfully sent to ${to} (${type}) via Brevo API. MessageId: ${data?.messageId}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to send email via Brevo HTTP API to ${to}:`, error?.message || error);
      throw new Error(`Email delivery failed: ${error?.message || error}`);
    }
  }

  // 2. Fallback for development mode when BREVO_API_KEY is absent
  console.log("\n==================================================");
  console.log(`✉️ [DEV EMAIL OTP] To: ${to}`);
  console.log(`📌 Subject: ${subject}`);
  console.log(`🔑 OTP Code: ${otpCode}`);
  console.log("==================================================\n");

  return true;
}
