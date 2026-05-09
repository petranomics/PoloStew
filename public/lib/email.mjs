/**
 * Resend email helpers for PoloStew transactional mail.
 *
 * Env:
 *  - RESEND_API_KEY  (required in prod; missing = no-op success in dev)
 *  - RESEND_FROM     (defaults to "PoloStew <hello@polostew.com>")
 *
 * Usage:
 *   import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email.mjs';
 *   await sendVerificationEmail(email, firstName, verifyUrl);
 *   await sendPasswordResetEmail(email, firstName, resetUrl);
 *
 * Both helpers return { ok: true, id?, devMode? } on success and never throw —
 * email failures should not break user flows. They log on error.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'PoloStew <hello@polostew.com>';

const COLORS = {
  cream: '#faf6f0',
  noir: '#2c2418',
  burnt: '#c75d3a',
  argent: '#e8e0d4',
  charbon: '#3d3226',
  muted: '#6b6258'
};

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapEmail({ heading, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const safeUrl = escapeHtml(ctaUrl);
  const safeLabel = escapeHtml(ctaLabel);
  const safeHeading = escapeHtml(heading);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeHeading}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;color:${COLORS.noir};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.cream};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${COLORS.argent};">
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;background:${COLORS.charbon};">
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;letter-spacing:0.35em;color:${COLORS.cream};font-weight:600;">POLOSTEW</div>
              <div style="font-size:11px;letter-spacing:0.2em;color:${COLORS.argent};margin-top:6px;text-transform:uppercase;">Curated Vintage</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px 40px;">
              <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:600;color:${COLORS.noir};margin:0 0 20px 0;line-height:1.3;">${safeHeading}</h1>
              <div style="font-size:15px;line-height:1.7;color:${COLORS.charbon};">
                ${bodyHtml}
              </div>
              <div style="text-align:center;margin:36px 0 16px 0;">
                <a href="${safeUrl}" style="display:inline-block;background:${COLORS.burnt};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-size:13px;">${safeLabel}</a>
              </div>
              <p style="font-size:13px;line-height:1.6;color:${COLORS.muted};margin:24px 0 0 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${safeUrl}" style="color:${COLORS.burnt};word-break:break-all;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px 40px;border-top:1px solid ${COLORS.argent};background:${COLORS.cream};">
              <p style="font-size:12px;line-height:1.6;color:${COLORS.muted};margin:0;text-align:center;">
                ${footerNote || 'Hand-picked vintage from Austin, TX.'}<br>
                <a href="https://polostew.com" style="color:${COLORS.burnt};text-decoration:none;">polostew.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send. (to=%s subject=%s)', to, subject);
    return { ok: true, devMode: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html, text })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[email] Resend send failed', res.status, errBody);
      return { ok: false, error: `resend_${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] Resend network error:', err && err.message);
    return { ok: false, error: 'network_error' };
  }
}

export async function sendVerificationEmail(to, name, verifyUrl) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = wrapEmail({
    heading: 'Verify your email',
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">Welcome to PoloStew. We're glad to have you with us.</p>
      <p style="margin:0 0 16px 0;">To finish setting up your account and start saving favorites, please confirm your email address using the button below.</p>
      <p style="margin:0 0 16px 0;color:${COLORS.muted};font-size:13px;">This link expires in 24 hours.</p>
    `,
    ctaLabel: 'Verify Email',
    ctaUrl: verifyUrl,
    footerNote: 'If you didn\'t create a PoloStew account, you can safely ignore this email.'
  });

  const text = `${greeting.replace(/<[^>]+>/g, '')}\n\nWelcome to PoloStew. To verify your email, visit:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this email.\n\n— PoloStew`;

  return sendViaResend({
    to,
    subject: 'Verify your PoloStew email',
    html,
    text
  });
}

export async function sendPasswordResetEmail(to, name, resetUrl) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = wrapEmail({
    heading: 'Reset your password',
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">We received a request to reset the password for your PoloStew account.</p>
      <p style="margin:0 0 16px 0;">Click the button below to choose a new one. This link is good for one hour.</p>
      <p style="margin:0 0 16px 0;color:${COLORS.muted};font-size:13px;">If you didn't ask for a reset, just ignore this email — your password will stay the same.</p>
    `,
    ctaLabel: 'Reset Password',
    ctaUrl: resetUrl,
    footerNote: 'For your security, this link expires in 1 hour and can only be used once.'
  });

  const text = `${greeting.replace(/<[^>]+>/g, '')}\n\nWe received a request to reset your PoloStew password. Open this link to set a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request a reset, ignore this email.\n\n— PoloStew`;

  return sendViaResend({
    to,
    subject: 'Reset your PoloStew password',
    html,
    text
  });
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail
};
