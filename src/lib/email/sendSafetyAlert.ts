import { createTransport } from "@/lib/email";
import { emailSubject, safetyAlertEmailHtml, type AlertContext } from "@/lib/safetyAlertMessages";

export interface SendSafetyAlertParams extends AlertContext {
  recipient: string;
}

export type SendSafetyAlertResult = { ok: true } | { ok: false; error: string };

/**
 * The Gmail-SMTP half of the safety-alert pipeline. Server-only by convention (like the rest of
 * this app's Gmail/Supabase-service-role code — see lib/email.ts, lib/supabase/admin.ts): never
 * import this into a client component, since it would either fail (no `nodemailer` in the
 * browser) or, worse, require exposing GMAIL_APP_PASSWORD to client code.
 * Reuses the exact same Gmail transporter as the existing password-reset email
 * (lib/email.ts's createTransport, GMAIL_USER/GMAIL_APP_PASSWORD) rather than a second SMTP
 * setup, per the "don't duplicate existing architecture" requirement. Returns a plain
 * ok/error result — never throws, never leaks the raw SMTP error to a caller that might surface
 * it to a user.
 */
export async function sendSafetyAlert(params: SendSafetyAlertParams): Promise<SendSafetyAlertResult> {
  const transport = createTransport();
  const from = process.env.GMAIL_USER;
  if (!transport || !from) {
    return { ok: false, error: "Email not configured" };
  }

  try {
    await transport.sendMail({
      from: `HerLane Safety Alerts <${from}>`,
      to: params.recipient,
      subject: emailSubject(params.riskLevel),
      html: safetyAlertEmailHtml(params),
    });
    return { ok: true };
  } catch (err) {
    // Never surface the raw SMTP error (could contain account/config details) — log safely
    // server-side only, with no credentials in the log line.
    console.error("[safety-alert] Gmail send failed:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "send_failed" };
  }
}
