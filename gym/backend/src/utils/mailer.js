const nodemailer = require("nodemailer");

let transporter = null;

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").trim() === "true";
  const user = (process.env.SMTP_USER || "").trim();
  // Gmail App Passwords are shown with spaces in UI — strip them
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!host || !user || !pass) {
    console.warn("[mailer] SMTP not fully configured — emails will NOT be sent.");
    console.warn(`[mailer]   SMTP_HOST=${host || "(empty)"}, SMTP_USER=${user || "(empty)"}, SMTP_PASS=${pass ? "(set)" : "(empty)"}`);
    return null;
  }

  return { host, port, secure, auth: { user, pass } };
}

function buildTransporter() {
  const config = getSmtpConfig();
  if (!config) return null;

  const t = nodemailer.createTransport({
    ...config,
    tls: { rejectUnauthorized: false },
  });

  // Verify connection on startup so errors appear in the terminal immediately
  t.verify((err) => {
    if (err) {
      console.error("[mailer] SMTP connection FAILED:", err.message);
    } else {
      console.log("[mailer] SMTP connected — ready to send emails.");
    }
  });

  return t;
}

// Lazy-init once per process
function getTransporter() {
  if (transporter === null) {
    transporter = buildTransporter();
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const instance = getTransporter();
  if (!instance) return false;

  const from = (process.env.MAIL_FROM || process.env.SMTP_USER || "").trim();
  await instance.sendMail({ from, to, subject, text, html });
  console.log(`[mailer] Email sent to ${to} — "${subject}"`);
  return true;
}

async function sendVerificationCodeEmail(to, code) {
  return sendMail({
    to,
    subject: "Your verification code",
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <b>${code}</b></p>`,
  });
}

async function sendResetCodeEmail(to, code) {
  return sendMail({
    to,
    subject: "Your password reset code",
    text: `Your password reset code is: ${code}`,
    html: `<p>Your password reset code is: <b>${code}</b></p>`,
  });
}

module.exports = {
  sendVerificationCodeEmail,
  sendResetCodeEmail,
};
