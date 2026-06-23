# Slim Yet? / 瘦了么 Web

Group weight tracking with private baselines and public delta competition.

## Stack

- Next.js App Router
- Supabase Auth
- Supabase Postgres
- Server-side API routes for privacy-safe group dashboards
- English and Simplified Chinese UI

## Privacy Model

Each group member chooses a private base weight and date. Other members only see delta values, ranks, badges, and delta sparklines. A user can still see their own real weight history and graph.

The browser uses Supabase Auth for login. All group and weight data flows through Next.js API routes that validate the Supabase session and query Postgres with the service role key.

## Supabase Setup

1. Create a free Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Enable Email auth in Supabase Auth.
5. Optional: enable Google auth in Supabase Auth Providers.

The SQL uses `slim_*` table names, so it is safe to install into an existing Supabase project that already has another app's tables.

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_APP_URL=https://shou-le-me.vercel.app
```

Set the same variables in Vercel before using the deployed app with real users.

## Local Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run lint
npm run build
```
