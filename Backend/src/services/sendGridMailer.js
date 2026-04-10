const nodemailer = require("nodemailer");

const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL || "").trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME || "DisasterWatch").trim();

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM_EMAIL) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function isSendGridConfigured() {
  // Keep function name to avoid touching controller imports.
  return Boolean(transporter);
}

function escapeHtml(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildBlurredImageUrl(imageUrl) {
  const raw = String(imageUrl || "").trim();
  if (!raw) return "";
  // Email clients may strip CSS filters, so prefer Cloudinary URL transformation.
  if (raw.includes("/res.cloudinary.com/") && raw.includes("/upload/")) {
    return raw.replace("/upload/", "/upload/e_blur:1000/");
  }
  return raw;
}

/**
 * Shared HTML shell (gradient header + white card + footer) used by transactional emails.
 */
function buildDisasterWatchEmailShell({ headerSubtitle, bodyInnerHtml }) {
  const safeSubtitle = escapeHtml(headerSubtitle);
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f8fafc; font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff; border-radius:10px; overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(90deg,#0ea5e9,#0284c7); padding:20px; text-align:center; color:white;">
                <h1 style="margin:0;">DisasterWatch</h1>
                <p style="margin:5px 0 0;">${safeSubtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:25px; color:#333;">
                ${bodyInnerHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#f1f5f9; padding:15px; text-align:center; font-size:12px; color:#666;">
                © 2026 DisasterWatch — Stay informed, stay prepared.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPossibleMatchHtml({ name, matchScore, location, date, image, link }) {
  const safeName = escapeHtml(name || "there");
  const safeScore = escapeHtml(matchScore);
  const safeLocation = escapeHtml(location);
  const safeDate = escapeHtml(formatDate(date));
  const safeImage = escapeHtml(buildBlurredImageUrl(image));
  const safeLink = escapeHtml(link);
  const imageBlock = safeImage
    ? `
            <div style="text-align:center; margin:20px 0;">
              <img src="${safeImage}" alt="Found Person" width="250" style="border-radius:10px; filter: blur(8px);" />
              <p style="font-size:12px; color:#888;">Image blurred for privacy</p>
            </div>`
    : "";

  const bodyInnerHtml = `
                <h2 style="margin-top:0;">Hello ${safeName},</h2>
                <p>We have identified a <strong>possible match</strong> for your missing person report.</p>
                <p style="font-size:18px;"><strong>Match Score:</strong> <span style="color:#0ea5e9;">${safeScore}%</span></p>
                <p><strong>Location Found:</strong> ${safeLocation}</p>
                <p><strong>Date Found:</strong> ${safeDate}</p>
                ${imageBlock}
                <div style="text-align:center; margin:30px 0;">
                  <a href="${safeLink}" style="background:#0ea5e9; color:white; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold;">
                    View Full Details
                  </a>
                </div>
                <p style="font-size:14px; color:#666;">Please verify carefully before taking any action.</p>`;

  return buildDisasterWatchEmailShell({
    headerSubtitle: "Possible Match Found",
    bodyInnerHtml,
  });
}

function buildPasswordResetOtpHtml({ name, otp }) {
  const safeName = escapeHtml(name || "there");
  const safeOtp = escapeHtml(String(otp || "").trim());
  const bodyInnerHtml = `
                <h2 style="margin-top:0;">Hello ${safeName},</h2>
                <p>We received a request to reset your DisasterWatch account password.</p>
                <p style="font-size:14px; color:#666;">Use this verification code (valid for 15 minutes):</p>
                <div style="text-align:center; margin:24px 0;">
                  <span style="display:inline-block; letter-spacing:8px; font-size:28px; font-weight:bold; color:#0ea5e9; font-family:ui-monospace,Consolas,monospace;">
                    ${safeOtp}
                  </span>
                </div>
                <p style="font-size:14px; color:#666;">If you did not request this, you can ignore this email.</p>`;

  return buildDisasterWatchEmailShell({
    headerSubtitle: "Password reset code",
    bodyInnerHtml,
  });
}

async function sendPossibleMatchEmail({ to, name, matchScore, location, date, image, link }) {
  if (!isSendGridConfigured()) return { skipped: true };
  const recipient = String(to || "").trim();
  if (!recipient) return { skipped: true };

  const from = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`;
  const html = buildPossibleMatchHtml({ name, matchScore, location, date, image, link });

  try {
    await transporter.sendMail({
      from,
      to: recipient,
      subject: "DisasterWatch - Possible Match Found",
      html,
    });
  } catch (err) {
    const e = new Error(err?.message || "SMTP send failed");
    e.raw = err;
    throw e;
  }
  return { skipped: false };
}

async function sendPasswordResetOtpEmail({ to, name, otp }) {
  if (!isSendGridConfigured()) return { skipped: true };
  const recipient = String(to || "").trim();
  if (!recipient) return { skipped: true };

  const from = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`;
  const html = buildPasswordResetOtpHtml({ name, otp });

  try {
    await transporter.sendMail({
      from,
      to: recipient,
      subject: "DisasterWatch - Password reset code",
      html,
    });
  } catch (err) {
    const e = new Error(err?.message || "SMTP send failed");
    e.raw = err;
    throw e;
  }
  return { skipped: false };
}

module.exports = {
  isSendGridConfigured,
  sendPossibleMatchEmail,
  sendPasswordResetOtpEmail,
};
