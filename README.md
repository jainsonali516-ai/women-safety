# Tulip — AI Safety & Journey Planner for Delhi NCR

A safety-first journey planner for female commuters across Delhi, Noida, Gurugram, Ghaziabad, and Faridabad. Built on Next.js (App Router) + Supabase.

## What's implemented

**Working with zero extra setup** (beyond your Supabase project):
- Dark "purple night sky" / light theme toggle with an animated floating-stars-and-tulip-petals background
- Phone-number auth (Indian mobile numbers only) via Supabase's phone OTP flow
- Trusted/emergency contacts (add, call via `tel:`, delete)
- "Share My Location" → builds a Google Maps link from the browser's GPS and (once Twilio is configured) SMS's it to every trusted contact
- Location-reminder "alarms" — scheduled prompts that always ask for explicit consent before anything is read or sent
- SOS quick-dial buttons (1091 / 112 / 100 / 102 / 108)
- Journey planner UI with Metro / DTC bus / Auto / Uber / Ola options, sortable by Balanced / Safest / Fastest / Cheapest
- Real street-light density safety signal via the free OpenStreetMap Overpass API (no key needed)
- Uber & Ola deep links (native app URI + web fallback) pre-filled with pickup/drop-off coordinates
- Tulip Bot: rule-based peak-hour commute forecasting, with an optional Claude-powered natural-language layer
- Security: strict input validation (zod) on every route, CSP/HSTS/X-Frame-Options headers, all third-party API calls proxied server-side so keys never reach the browser

**Wired up but inert until you add credentials:**
| Feature | Needs |
|---|---|
| Real SMS delivery for "Share My Location" | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Phone OTP actually sending SMS | Enable **Phone** auth + a Twilio SMS provider in Supabase → Authentication → Providers |
| Address search, live-traffic directions, foot-traffic safety signal | `GOOGLE_PLACES_API_KEY` (enable Geocoding API, Directions API, Places API on it) |
| Natural-language Tulip Bot replies | `ANTHROPIC_API_KEY` (falls back to rule-based replies without it) |

**Not implemented — Google Earth Engine night-light scoring.** Real Earth Engine access requires a Google Cloud service account approved for Earth Engine, which is a manual multi-day process on Google's side and can't be wired up in this session. The safety score currently uses OSM street-light density + Google Places foot-traffic as a documented stand-in (see `src/lib/scoring.ts`). Swap in Earth Engine later without changing the API shape.

**Not implemented — real Delhi Metro/DTC per-station routing.** Delhi Metro/DTC don't publish a public real-time GTFS routing feed, so Metro/bus legs are distance-based time estimates (see the comment in `src/app/api/routes/plan/route.ts`), not real station-by-station itineraries.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in what you have (Supabase is required; the rest are optional and each feature degrades gracefully without its key).
3. Run `supabase/schema.sql` then `supabase/schema_tulip.sql` in your Supabase project's SQL Editor, in that order.
4. `npm run dev`

## API routes

Auth: `/api/auth/phone/send-otp`, `/api/auth/phone/verify-otp`, `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`
Safety: `/api/contacts`, `/api/contacts/:id`, `/api/location/share`, `/api/reminders`, `/api/reminders/:id`, `/api/sos*`, `/api/incidents*`
Journey: `/api/geocode`, `/api/directions`, `/api/routes/plan`, `/api/bot`
`/api/health`
