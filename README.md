# Tulip — AI Safety & Journey Planner for Delhi NCR

A safety-first journey planner for female commuters across Delhi, Noida, Gurugram, Ghaziabad, and Faridabad. Built on Next.js (App Router) + Supabase.

## What's implemented

**Working with zero extra setup** (beyond your Supabase project):
- Dual theme: "Galactic" dark mode (neon-pink star-tulips, purple night sky) and "Garden" light mode (blooming pastel tulips), toggle in the sticky glass nav bar
- Custom email + password auth: passwords are hashed with bcrypt (never stored in plain text) and sessions are a signed JWT in an `httpOnly` cookie, valid for 1 week — after that, the user has to log in again. User records live in Supabase Postgres (`public.users`), accessed only via the service-role key; the browser never talks to Supabase directly for auth
- Trusted/emergency contacts (add, call via `tel:`, delete)
- "Share My Location" → generates a Google Maps link from the browser's GPS. If Twilio is configured, it's SMS'd automatically to every trusted contact; if not, the UI offers zero-cost fallbacks instead — native `sms:` links and WhatsApp (`wa.me`) share buttons per contact, plus copy/open-in-Maps
- Live Journey Tracking — starts an SOS alert and pings your location periodically via `watchPosition`; if the connection drops, pings are cached in `localStorage` and flushed automatically on the browser's `online` event, with an "Offline Mode — Route Cached Locally" banner while disconnected
- Manual landmark fallback — if geolocation is denied or times out (10s), both "Share My Location" and the tracker offer a text field ("enter your current landmark / Metro station") resolved via the free geocoder instead of GPS
- Location-reminder "alarms" — scheduled prompts that always ask for explicit consent before anything is read or sent
- SOS quick-dial buttons (1091 / 112 / 100 / 102 / 108) plus a one-tap SOS button in the nav bar
- Journey planner with a spacious hero search (GPS-detect or type an origin, destination, travel date, transit-mode filter pills, and a Pink Saheli concession toggle), sortable by AI Balanced / Safest / Fastest / Cheapest. Two-wheeler rides are excluded by design — there's no bike-taxi option anywhere in the codebase
- **4-tier risk badges** instead of a raw safety number: HIGH RISK / Mid-High Risk / Moderately Safe / Safe to Go, each route card showing an expandable **"Why this route?"** drawer with plain-language safety, cost, and speed explanations built from the same live signals used to score it (`src/lib/riskTier.ts`)
- Safety Map: a free Leaflet + OpenStreetMap dark map (no Mapbox, no token, no billing account) showing your route, a toggleable night-corridor heatmap, color-coded footfall markers (seeded with known Delhi NCR corridors as a stand-in for a live feed — see the note in `src/components/SafetyMapContainer.tsx`), and **nearby-amenity dots** — public washrooms (pink), hospitals (purple), police stations (blue) within 1 km of the route, sized larger the closer they are to it, with a popup on click showing name/type/distance (live Overpass data) — plus a "recenter to my GPS" control
- Address search (OpenStreetMap Nominatim, forward + reverse), real road-distance/duration routing (OSRM), and both safety signals (street-light density + shop/amenity foot-traffic density, both via the OSM Overpass API) — all free, no API keys or billing account required
- Metro fares follow DMRC's real distance slabs (₹10–₹60); DTC/Cluster bus fares follow the concession toggle — ₹0 with Pink Saheli active, or a standard ₹5–₹25 distance fare with it off; E-Rickshaw feeder fare (₹10–₹20 flat) shows up for short (≤3 km) trips
- Uber & Ola deep links (native app URI + web fallback) pre-filled with pickup/drop-off coordinates
- Tulip Bot: rule-based peak-hour commute forecasting, now also as a floating collapsible widget on every page, with an optional Claude-powered natural-language layer and optional rally/road-closure warnings
- Security: strict input validation (zod, including a stricter Indian-mobile regex) on every route, CSP/HSTS/X-Frame-Options headers, all third-party API calls proxied server-side so keys never reach the browser
- **Safety Zone Breakdown**: splits the route into 3 stretches (start/middle/end) and scores each with the same live street-light + foot-traffic signals as the overall score, shown as neon-coded (emerald/amber/pink) cards with an honest description and real risk factors/safety features — never fabricated details like "CCTV nearby" that can't actually be verified. Lazy-loaded on demand (`/api/routes/zones`, separate from the main search) since scoring 3 stretches means several sequential free-tier Overpass calls that can take 20-40s — keeping it out of the main search response keeps route results themselves fast
- Metro/Bus cards are upfront that **exact line, platform, and interchange details aren't available** — Delhi Metro/DTC don't publish a public real-time feed for this, so the app links to the official DMRC/DTC app instead of guessing (a wrong "board towards X" instruction in a safety app is worse than no instruction)
- **Low Power / Offline Mode**: activates automatically when the browser goes offline, or the battery drops to ≤5% and isn't charging (the Battery Status API is deprecated/restricted in most desktop browsers — the app feature-detects it and just skips that trigger where it's unavailable, with the manual toggle in Safety Tools as the reliable fallback for testing or unsupported browsers). While active: the animated background and chatbot widget unmount, live journey tracking switches from continuous `watchPosition` to a single low-accuracy fix every 5 minutes, and the Journey page swaps its map/search UI for a lightweight offline view built entirely from an IndexedDB cache (`src/lib/offlineDb.ts`) written the last time a route was searched online — turn-by-turn text directions (real OSRM steps), nearby hospitals/police/metro stations (live Overpass data, fetched once per search), `tel:` buttons for trusted contacts and emergency numbers, and a **Check In Now** button that opens the device's native SMS app (`sms:` URI) pre-filled with the cached location — no `fetch`/`XHR` involved, so it works purely over the cellular voice/SMS network with zero data. A service worker (`public/sw.js`) caches static build assets cache-first for faster reloads; API calls always go to the network live rather than serving stale cached data.

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

**Mock data — the safety map's heatmap/footfall markers.** `SafetyMapContainer` seeds its heatmap and corridor markers from a small hardcoded list of well-known Delhi NCR locations, not a live feed — the route scoring itself (safety/rush scores shown on route cards) uses the real, live OSM signals described above. Swapping the map's mock points for a live source is a drop-in change in that one file.

**Deliberately not using Mapbox.** An earlier version of this map used Mapbox GL JS, but Mapbox's signup asked for a payment card, so the map was rebuilt on Leaflet + free OpenStreetMap tiles instead (with a CSS filter faking the dark look, after CARTO's free anonymous dark tiles also started requiring a key) — no key, no card, no billing account for anyone running this project.

**Low Power / Offline Mode was adapted from a Mapbox/TomTom/Google Earth Engine-based spec to this app's actual stack** (Leaflet, no TomTom, no Earth Engine, free OSM services) — anything in that spec tied to those specific services doesn't apply here. The nearby-help-points lookup uses the free Overpass API and can occasionally time out (504) under load on their shared public server, same as the other Overpass-based signals in this app; the offline view just shows no help points that time, rather than fabricating any.

**4-tier risk badges and route amenity dots were also adapted from a Google Maps/Mapbox/Places/Earth-Engine-based spec** — the multi-source "safety evaluation" described there uses services this app doesn't have; the 4-tier classification instead buckets the same live OSM street-light/foot-traffic score already computed for every route. While building the amenity dots, hitting the free Overpass API with 3 amenity-type queries in parallel reliably broke the third one — their public instance enforces a small concurrent-request limit per client. Fixed by querying sequentially (`src/lib/helpPoints.ts`); worth remembering for any future Overpass call added to this app.

**Not implemented — full multi-stop route planner.** A separate spec asked for reorderable intermediate stops (start → stop 1 → stop 2 → destination) with a single chained route. That's a genuinely large addition (multi-waypoint OSRM routing, a stop-reordering UI, rewriting the safety/fare scoring to work leg-by-leg) that wasn't built in this pass — flagged rather than silently skipped. The existing single origin→destination planner, autocomplete, and amenity-dot map all work today.

**Not implemented — real Google/Mapbox route alternatives (multiple road variants per mode).** OSRM's public server does support an `alternatives=true` param for a few different driving-route options, but per-mode alternative routing (e.g. a second Metro interchange option) isn't wired up — each mode currently returns one representative route.

## Pages

- `/` — home: a welcome hub with quick links to Journey, Safety Tools, Contacts, and Tulip Bot
- `/journey` — the Journey search hero, safety map, and route results (redirects to `/auth` if signed out)
- `/safety` — Safety Tools: SOS quick-dial, Share My Location, Live Journey Tracking
- `/contacts` — trusted contacts and location-reminder alarms
- `/bot` — full-page Tulip Bot (also available as a floating widget on every page)
- `/auth` — sign up / log in

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in what you have. `JWT_SECRET` and the Supabase values are required; generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`. Everything else is optional and each feature degrades gracefully without its key.
3. Run, in this order, in your Supabase project's SQL Editor: `supabase/schema.sql`, `supabase/schema_tulip.sql`, `supabase/schema_users.sql`, `supabase/schema_migrate_to_custom_auth.sql`.
4. `npm run dev`

### Auth model

Signup and login are handled entirely by this app, not Supabase Auth — `public.users` stores `email`, a bcrypt `password_hash`, `full_name`, and `phone`; every other table's `user_id` foreign key points at it. Row Level Security on these tables has no policies (nothing but the service-role key can touch them), so authorization is enforced in each API route by explicitly filtering on the session's user id — see `src/lib/auth.ts` (bcrypt hashing, JWT sign/verify, cookie helpers) and `src/lib/api.ts` (`requireUser()`, used at the top of every protected route).

## API routes

Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`
Safety: `/api/contacts`, `/api/contacts/:id`, `/api/location/share`, `/api/reminders`, `/api/reminders/:id`, `/api/sos*`, `/api/incidents*`
Journey: `/api/geocode`, `/api/directions`, `/api/routes/plan`, `/api/bot`
`/api/health`
