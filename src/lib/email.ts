import nodemailer from "nodemailer";

// Gmail SMTP delivery — requires GMAIL_USER (the sending address) and GMAIL_APP_PASSWORD
// (a 16-character App Password from https://myaccount.google.com/apppasswords, not the
// account's regular login password; App Passwords need 2-Step Verification enabled).
function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendPasswordResetOtpEmail(to: string, code: string): Promise<boolean> {
  const transport = createTransport();
  const user = process.env.GMAIL_USER;
  console.log("[email] Gmail SMTP configured?", !!transport, "| from:", user, "| to:", to);
  if (!transport || !user) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD are not configured — cannot send password reset email.");
    return false;
  }

  try {
    console.log("[email] sending otp via Gmail SMTP...");
    const info = await transport.sendMail({
      from: `HerLane <${user}>`,
      to,
      subject: "Your HerLane password reset code",
      html: `
        <p>Someone (hopefully you) asked to reset the password on your HerLane account.</p>
        <p style="font-size:1.75rem; font-weight:700; letter-spacing:0.3em;">${code}</p>
        <p>Enter this 6-digit code on the reset page to set a new password. It expires in 10 minutes and can only be used once.</p>
        <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
      `,
    });
    console.log("[email] Gmail SMTP accepted message:", info.messageId);
    return true;
  } catch (err) {
    console.error("Failed to send password reset OTP email:", err);
    return false;
  }
}
