# Women Safety — Backend

A Next.js + Supabase backend for a women's safety platform: SOS alerts, emergency contacts, live location tracking, and community incident reporting.

## Stack

- **Next.js (App Router)** — API routes under `src/app/api/*`
- **Supabase** — Postgres database, Auth, and Row Level Security

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and keys (Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
3. Run the schema in your Supabase project's SQL Editor: paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates all tables, Row Level Security policies, and a `nearby_incidents` helper function.
4. Start the dev server:
   ```
   npm run dev
   ```

## API

| Endpoint | Description |
|---|---|
| `POST /api/auth/signup` | Create an account (`email`, `password`, `full_name`, `phone`) |
| `POST /api/auth/login` | Sign in (`email`, `password`) |
| `POST /api/auth/logout` | Sign out |
| `GET /api/contacts` | List the current user's emergency contacts |
| `POST /api/contacts` | Add an emergency contact (`name`, `phone`, `relationship`) |
| `PATCH /api/contacts/:id` | Update a contact |
| `DELETE /api/contacts/:id` | Remove a contact |
| `POST /api/sos` | Trigger an SOS alert (`latitude`, `longitude`, `message`) — returns the alert and the contacts to notify |
| `GET /api/sos` | List the current user's SOS alerts |
| `GET /api/sos/active` | Get the current user's active alert, if any |
| `GET /api/sos/:id` | Get one alert with its location history |
| `PATCH /api/sos/:id` | Resolve or cancel an alert (`status`: `resolved` \| `cancelled`) |
| `POST /api/sos/:id/location` | Add a live location ping during an active alert |
| `GET /api/sos/:id/location` | Get the location history for an alert |
| `GET /api/incidents` | List public incidents, or pass `?lat=&lng=&radius_km=` for nearby ones |
| `POST /api/incidents` | Report an incident (`title`, `latitude`, `longitude`, `description`, `category`, `is_public`) |
| `GET /api/incidents/:id` | Get one incident |
| `PATCH /api/incidents/:id` | Update an incident you own |
| `DELETE /api/incidents/:id` | Delete an incident you own |
| `GET /api/health` | Health check |

Authenticated routes rely on the Supabase session cookie set by `/api/auth/login`.

## Notes

- SOS alert creation returns the user's emergency contacts under `notified_contacts` — hook an SMS/push provider (e.g. Twilio) into `src/app/api/sos/route.ts` to actually notify them.
- All tables use Row Level Security: users can only read/write their own data, except public incidents which anyone can read.
