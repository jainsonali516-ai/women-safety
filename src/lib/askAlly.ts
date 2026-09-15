// The handoff between a route card's "Ask Ally" trigger and the floating ChatbotWidget is a
// same-tab browser CustomEvent — not React context, not a store, not anything persisted. The two
// components aren't in a parent/child relationship (they're siblings under the journey page), and
// this keeps the coupling to "one event name" instead of lifting state up through JourneyHome.
// Only ever carries a plain, human-readable query string built from place labels the user already
// typed/selected — never raw coordinates, and nothing here touches localStorage or a network call.
export const ASK_ALLY_EVENT = "herlane:ask-ally";

export function dispatchAskAlly(text: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_ALLY_EVENT, { detail: text }));
}

export function buildAskAllyQuery(origin: string | undefined, destination: string | undefined, modeLabel: string): string {
  const from = origin?.trim() || "my starting point";
  const to = destination?.trim() || "my destination";
  return `Can you tell me the exact metro lines, interchanges, or bus numbers for my journey from ${from} to ${to} via ${modeLabel}?`;
}
