# Tulip — AI Safety & Journey Planner for Delhi NCR

A safety-first journey planner for female commuters across Delhi, Noida, Gurugram, Ghaziabad, and Faridabad. Built on Next.js (App Router) + Supabase.

## What's implemented

**Working with zero extra setup** (beyond your Supabase project):
- Dual theme: "Galactic" dark mode (neon-pink star-tulips, purple night sky) and "Garden" light mode (blooming pastel tulips), toggle in the sticky glass nav bar
- Email + password auth (via Supabase Auth)
- Trusted/emergency contacts (add, call via `tel:`, delete)
- "Share My Location" → generates a Google Maps link from the browser's GPS. If Twilio is configured, it's SMS'd automatically to every trusted contact; if not, the UI offers zero-cost fallbacks instead — native `sms:` links and WhatsApp (`wa.me`) share buttons per contact, plus copy/open-in-Maps
- Live Journey Tracking — starts an SOS alert and pings your location periodically via `watchPosition`; if the connection drops, pings are cached in `localStorage` and flushed automatically on the browser's `online` event, with an "Offline Mode — Route Cached Locally" banner while disconnected
- Manual landmark fallback — if geolocation is denied or times out (10s), both "Share My Location" and the tracker offer a text field ("enter your current landmark / Metro station") resolved via the free geocoder instead of GPS
- Location-reminder "alarms" — scheduled prompts that always ask for explicit consent before anything is read or sent
- SOS quick-dial buttons (1091 / 112 / 100 / 102 / 108) plus a one-tap SOS button in the nav bar
- Journey planner UI with Metro / DTC bus / Auto / Uber / Ola options, sortable by Balanced / Safest / Fastest / Cheapest. Two-wheeler rides are excluded by design — there's no bike-taxi option anywhere in the codebase
- Address search (OpenStreetMap Nominatim), real road-distance/duration routing (OSRM), and both safety signals (street-light density + shop/amenity foot-traffic density, both via the OSM Overpass API) — all free, no API keys or billing account required
- Metro fares follow DMRC's real distance slabs (₹10–₹60); DTC/Cluster buses are free for women (Pink Pass)
- Uber & Ola deep links (native app URI + web fallback) pre-filled with pickup/drop-off coordinates
- Tulip Bot: rule-based peak-hour commute forecasting, now also as a floating collapsible widget on every page, with an optional Claude-powered natural-language layer and optional rally/road-closure warnings
- Security: strict input validation (zod, including a stricter Indian-mobile regex) on every route, CSP/HSTS/X-Frame-Options headers, all third-party API calls proxied server-side so keys never reach the browser

**Wired up but inert until you add credentials:**
| Feature | Needs |
|---|---|
| Automatic SMS delivery for "Share My Location" (instead of the manual SMS/WhatsApp fallback) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Natural-language Tulip Bot replies | `ANTHROPIC_API_KEY` (falls back to rule-based replies without it) |
| Rally/protest/road-closure warnings in Tulip Bot | `NEWS_API_KEY` (skipped without it — no warning shown, not a fabricated one) |

**Not implemented — Google Earth Engine night-light scoring.** Real Earth Engine access requires a Google Cloud service account approved for Earth Engine, which is a manual multi-day process on Google's side and can't be wired up in this session. The safety score currently uses OSM street-light + shop/amenity density as a documented stand-in (see `src/lib/scoring.ts`). Swap in Earth Engine later without changing the API shape.

**Not implemented — live traffic congestion.** The free OSRM routing server used for real distance/duration doesn't expose live congestion data, so the rush-hour score is a time-of-day heuristic (`computeHeuristicRushScore` in `src/lib/scoring.ts`), not a live delay ratio. A paid traffic API (Google Directions with `traffic_model`, or Mapbox) would replace this with real congestion data.

**Rate limits to know about:** Nominatim and the public OSRM demo server are shared, rate-limited community services meant for light/demo use, not production traffic. Fine for development and low-volume use; a production deployment should move to a paid or self-hosted instance of each (or a Google Maps Platform key, which requires a billing account but has a large free monthly credit) to avoid being rate-limited or blocked.

**Not implemented — real Delhi Metro/DTC per-station routing.** Delhi Metro/DTC don't publish a public real-time GTFS routing feed, so Metro/bus legs are distance-based time estimates (see the comment in `src/app/api/routes/plan/route.ts`), not real station-by-station itineraries.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in what you have (Supabase is required; the rest are optional and each feature degrades gracefully without its key).
3. Run `supabase/schema.sql` then `supabase/schema_tulip.sql` in your Supabase project's SQL Editor, in that order.
4. `npm run dev`

## API routes

Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`
Safety: `/api/contacts`, `/api/contacts/:id`, `/api/location/share`, `/api/reminders`, `/api/reminders/:id`, `/api/sos*`, `/api/incidents*`
Journey: `/api/geocode`, `/api/directions`, `/api/routes/plan`, `/api/bot`
`/api/health`
