import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { TulipLogo } from "@/components/TulipLogo";
import { FaqAccordion, type FaqCategory } from "@/components/FaqAccordion";
import { Shield, MapPinned, Users, Bot, Lock } from "lucide-react";

// Every answer here is checked against what this app actually does — no mention of services
// this app doesn't use (Mapbox, TomTom, Google Places, Earth Engine), no claimed features that
// don't exist (a curated events calendar), and no invented limits (there's no cap on contacts).
const FAQ: FaqCategory[] = [
  {
    title: "Trust & Data Privacy",
    items: [
      {
        q: "Is my live location shared with anyone?",
        a: "Only if you choose to share it. Live Journey Tracking generates a private link (/track/[id]) that only someone with that exact link can open — it's never public, never indexed, and never shared with third parties or advertisers.",
      },
      {
        q: "Does the app sell or share my location data?",
        a: "No. Tulip doesn't sell, monetize, or share your location data with advertisers or any third party.",
      },
      {
        q: "Is my location history kept after a trip ends?",
        a: "Location pings from an SOS/tracking session are stored under your account so you have a record if something goes wrong, and are tied to that alert. You control who ever sees them — nothing is shared unless you generate and send a tracking link yourself.",
      },
    ],
  },
  {
    title: "Understanding the Safety Score",
    items: [
      {
        q: "How is the safety score calculated?",
        a: "From live, measurable OpenStreetMap signals: mapped street-light density and nearby foot-traffic/commercial density, weighted more toward lighting after dark and more toward foot traffic during the day. Metro and app-tracked cabs get a bonus for being staffed/monitored; bus and auto get a penalty for having no staffed platform or single verified driver. It is never based on crime statistics or a neighborhood's reputation.",
      },
      {
        q: "Does a lower score mean an area is dangerous?",
        a: "No — it means the live signals Tulip can find (mapped lighting, nearby shops/foot traffic) are weaker there, which isn't the same as confirmed danger. OpenStreetMap's lighting data is known to be incomplete in India, so \"nothing mapped\" is treated as inconclusive, not as proof a street is unlit.",
      },
      {
        q: "Why might the score feel different from a place I know personally?",
        a: "The score reflects what's mapped on OpenStreetMap, not lived experience — a genuinely safe, well-lit street can still score lower if it's simply under-mapped.",
      },
      {
        q: "Does the score account for a future trip's exact date and time?",
        a: "Not yet — the score always reflects real conditions as of when you run the search, not a forecast for a scheduled future date. We'd rather say that plainly than pretend to predict conditions we can't yet measure.",
      },
    ],
  },
  {
    title: "Trusted Contacts & Emergency Features",
    items: [
      {
        q: "What happens when I press an SOS quick-dial button?",
        a: "It opens your phone's own dialer with a real cellular voice call already queued to that number (Women Helpline 1091, Police 112/100, etc.) — a standard phone call, not something routed through the app.",
      },
      {
        q: "How many trusted contacts can I add?",
        a: "As many as you'd like — there's no limit.",
      },
      {
        q: "Does an SOS call need internet to work?",
        a: "No. It's a native tel: link, which places a normal cellular voice call — no data connection required.",
      },
    ],
  },
  {
    title: "Offline Mode, Low Battery & SMS Check-In",
    items: [
      {
        q: "What happens when my battery drops to 5% or I lose connection?",
        a: "Tulip switches to Low Power/Offline Mode: the map and background animation unmount, continuous location polling drops to one low-accuracy fix every 5 minutes, and the app shows turn-by-turn directions and nearby help points from a local cache saved the last time you were online.",
      },
      {
        q: "How does \"Check In Now\" work without internet?",
        a: "It opens your phone's native SMS app, pre-filled with your last known location, a timestamp, and a status note addressed to your trusted contact — sent over the ordinary cellular SMS network, using zero mobile data.",
      },
      {
        q: "Does the app keep tracking me in the background while offline?",
        a: "No — continuous background polling stops specifically in low-power mode, to preserve your remaining battery.",
      },
    ],
  },
  {
    title: "Comparisons & Coverage",
    items: [
      {
        q: "How is this different from sharing my location on WhatsApp or Google Maps?",
        a: "Those apps share a location pin and nothing else. Tulip actively scores each route and mode by lighting, foot traffic, and how monitored that mode is, keeps working with a fallback plan if you lose signal or battery, and can check in over plain SMS with zero mobile data.",
      },
      {
        q: "What areas have active coverage?",
        a: "Delhi, Noida, Gurugram, Ghaziabad, and Faridabad, using free OpenStreetMap-based data. Coverage quality follows how thoroughly each specific area happens to be mapped on OpenStreetMap, which varies street to street.",
      },
      {
        q: "Does Tulip have real per-station Delhi Metro or DTC bus routing?",
        a: "Not yet — neither DMRC nor DTC publishes a public live-routing feed, so Metro/bus legs are realistic distance-based time estimates, not real station-by-station directions. Route cards say this plainly and link to the official DMRC/DTC app for exact line, platform, and interchange details.",
      },
    ],
  },
  {
    title: "Rally, Protest & Road-Closure Awareness",
    items: [
      {
        q: "Does Tulip warn me about protests, rallies, or road closures?",
        a: "Optionally. Tulip Bot can check recent news for rallies, protests, or road closures reported near Delhi NCR around your travel date, and will suggest Metro if one's found, to avoid surface-route disruption. It's a live news search, not a curated events calendar, and it's simply skipped — never faked — if that's not configured.",
      },
    ],
  },
];

const CREDITS = [
  { name: "Sonali Jain", role: "Developer / Core Contributor" },
  { name: "Vanshika Verma", role: "Developer / Core Contributor" },
  { name: "Sana Jawed", role: "Developer / Core Contributor" },
  { name: "Saanika Mishra", role: "Developer / Core Contributor" },
];

export default async function AboutPage() {
  const user = await getSessionUser();

  return (
    <>
      {user && <AppHeader />}
      <main style={{ flex: 1, padding: "3rem 1.5rem", maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", textAlign: "center" }}>
          <TulipLogo size={48} />
          <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 800 }}>About Tulip</h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "1.05rem", lineHeight: 1.6, maxWidth: 560 }}>
            Tulip is a safety-first journey planner built for female commuters across Delhi, Noida,
            Gurugram, Ghaziabad, and Faridabad — helping you get where you&apos;re going with a route
            that&apos;s not just fast, but genuinely safer.
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          <AboutCard icon={<MapPinned size={20} />} title="Safety-Scored Routing" desc="Routes across Metro, DTC buses, autos, and cabs are ranked using real street-light density and foot-traffic signals, not guesswork." />
          <AboutCard icon={<Shield size={20} />} title="Built for Emergencies" desc="One-tap SOS dialing, instant location sharing, and live journey tracking that keeps working even if your connection drops." />
          <AboutCard icon={<Users size={20} />} title="Your Trusted Circle" desc="Keep a list of emergency contacts you can reach — or who can reach you — in one tap." />
          <AboutCard icon={<Bot size={20} />} title="Tulip Bot" desc="Ask about an upcoming trip and get a safety-aware forecast for the best time and mode to travel." />
        </section>

        <section className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={18} /> Built on free, transparent data
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", lineHeight: 1.6 }}>
            Tulip&apos;s routing and safety signals run on OpenStreetMap-based services (Photon, OSRM,
            Overpass) — no paid API keys or billing accounts required to use the core app. Where a
            feature depends on an optional service (like SMS delivery or Tulip Bot&apos;s natural-language
            replies), it&apos;s clearly labeled and degrades gracefully rather than pretending to work
            when it can&apos;t.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "1rem" }}>Frequently Asked Questions</h2>
          <FaqAccordion categories={FAQ} />
        </section>

        <section className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Credits &amp; Development Team</h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.9rem" }}>
            {CREDITS.map((c) => (
              <li key={c.name} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: "var(--foreground-muted)" }}>{c.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function AboutCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "0.65rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
          color: "white",
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}
