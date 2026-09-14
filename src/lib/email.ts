const RESEND_URL = "https://api.resend.com/emails";

// Resend's shared sandbox sender — works without verifying a custom domain, but Resend only
// lets it deliver to the email address the Resend account itself was created with until a
// domain is verified. Set RESEND_FROM_EMAIL (e.g. "Tulip <noreply@yourdomain.com>") once a
// domain is verified in the Resend dashboard so resets can reach any user.
const DEFAULT_FROM = "Tulip <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  console.log("[email] RESEND_API_KEY present?", !!apiKey, "| from:", from, "| to:", to);
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured — cannot send password reset email.");
    return false;
  }

  try {
    console.log("[email] calling Resend API...");
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Reset your Tulip password",
        html: `
          <p>Someone (hopefully you) asked to reset the password on your Tulip account.</p>
          <p><a href="${resetUrl}">Click here to set a new password</a>. This link works once and expires in 30 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `,
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log("[email] Resend responded with status:", res.status);
    if (!res.ok) {
      console.error("Resend API error:", res.status, await res.text().catch(() => ""));
      return false;
    }
    const data = await res.json().catch(() => null);
    console.log("[email] Resend success response:", data);
    return true;
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return false;
  }
}
