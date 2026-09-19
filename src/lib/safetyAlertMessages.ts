// Shared, isomorphic (client + server) message-building for the safety-alert pipeline — kept in
// one place so the email body, the WhatsApp share text, and the API response always agree on
// wording instead of three independent copies drifting apart.
import type { JourneyRiskLevel } from "@/lib/journeyRisk";

export interface AlertContext {
  userName: string;
  originLabel: string;
  destinationLabel: string;
  journeyRiskIndex: number;
  riskLevel: JourneyRiskLevel;
  reasons: string[];
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  lastKnownLocationAt: string | null; // ISO string — kept as a string across the client/server boundary
  expectedArrivalAt: string; // ISO string
  demoMode: boolean;
}

export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function recommendedAction(riskLevel: JourneyRiskLevel): string {
  if (riskLevel === "CRITICAL") return "Please try to reach this person immediately and consider contacting local authorities if you cannot.";
  if (riskLevel === "CONCERN") return "Please try calling or messaging this person to confirm they're okay.";
  return "No immediate action needed — HerLane is continuing to monitor this journey.";
}

export function emailSubject(riskLevel: JourneyRiskLevel): string {
  return riskLevel === "CRITICAL" ? "HERLANE Critical Safety Alert" : "HERLANE Safety Alert — Journey Check Required";
}

/** Plain-text WhatsApp share message — used both by the client's `wa.me` opener and included in
 * the server's API response so a live client can open the exact same text. */
export function whatsappEscalationMessage(ctx: AlertContext): string {
  const mapsLine =
    ctx.lastKnownLatitude !== null && ctx.lastKnownLongitude !== null
      ? ` Last known location: ${googleMapsLink(ctx.lastKnownLatitude, ctx.lastKnownLongitude)}`
      : "";
  return (
    `HERLANE Safety Alert: ${ctx.userName}'s journey from ${ctx.originLabel} to ${ctx.destinationLabel} needs a check — ` +
    `${ctx.reasons.join("; ")}.${mapsLine}${ctx.demoMode ? " (DEMO MODE)" : ""}`
  );
}

export function safetyAlertEmailHtml(ctx: AlertContext): string {
  const hasLocation = ctx.lastKnownLatitude !== null && ctx.lastKnownLongitude !== null;
  const mapsUrl = hasLocation ? googleMapsLink(ctx.lastKnownLatitude!, ctx.lastKnownLongitude!) : null;
  const recordedAt = ctx.lastKnownLocationAt ? new Date(ctx.lastKnownLocationAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "unavailable";
  const expectedArrival = new Date(ctx.expectedArrivalAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;">
      ${ctx.demoMode ? `<p style="background:#fff3cd;color:#7a5c00;padding:0.6rem 0.9rem;border-radius:6px;font-weight:600;">⚠️ DEMO MODE — This is a simulated HERLANE journey for hackathon demonstration.</p>` : ""}
      <h2 style="color:#C2185B;margin-bottom:0.2rem;">HERLANE Safety Alert</h2>
      <p><strong>User:</strong> ${escapeHtml(ctx.userName)}</p>
      <p><strong>Journey:</strong> ${escapeHtml(ctx.originLabel)} → ${escapeHtml(ctx.destinationLabel)}</p>
      <p><strong>Risk Level:</strong> ${ctx.riskLevel}</p>
      <p><strong>Journey Risk Index:</strong> ${ctx.journeyRiskIndex}</p>
      <p><strong>Expected Arrival:</strong> ${expectedArrival}</p>
      <p><strong>Current Status:</strong> ${ctx.riskLevel === "CRITICAL" ? "No confirmation received — escalated" : "Check-in overdue"}</p>

      <p style="margin-top:1rem;"><strong>Why HERLANE generated this alert:</strong></p>
      <ul>${ctx.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>

      <div style="background:#f7f7f9;border-radius:8px;padding:0.9rem 1.1rem;margin-top:1rem;">
        <p style="margin:0 0 0.3rem;font-weight:700;">Last Known Location</p>
        ${
          hasLocation
            ? `<p style="margin:0;">Latitude: ${ctx.lastKnownLatitude}</p>
               <p style="margin:0;">Longitude: ${ctx.lastKnownLongitude}</p>
               <p style="margin:0 0 0.5rem;">Recorded At: ${recordedAt}</p>
               <p style="margin:0;"><a href="${mapsUrl}" target="_blank" rel="noreferrer">View on Map</a></p>`
            : `<p style="margin:0;">No location has been synchronized for this journey yet.</p>`
        }
        <p style="margin-top:0.6rem;font-size:0.8rem;color:#666;">This is the user's last successfully synchronized location. It may not represent their current location.</p>
      </div>

      <p style="margin-top:1rem;"><strong>Recommended Action:</strong><br/>${recommendedAction(ctx.riskLevel)}</p>

      <p style="margin-top:1.5rem;font-size:0.75rem;color:#999;">This is an automated HERLANE safety notification.</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
