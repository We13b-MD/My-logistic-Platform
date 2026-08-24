import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

export const isMailConfigured = Boolean(smtpUser && smtpPass);

export const mailTransporter = isMailConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

if (isMailConfigured) {
  console.log(`📧 SMTP Email Transporter configured successfully (${smtpHost}).`);
} else {
  console.log("ℹ️ SMTP credentials missing in .env. OTP codes will log to console in development mode.");
}
