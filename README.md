# SlimYet / 瘦了么

SlimYet is a local-only iOS weight journal focused on finding encouraging trend highlights automatically.

## What Is Built

- SwiftUI iOS app scaffold in `SlimYet.xcodeproj`
- Manual weight entry with date and optional note
- Local SwiftData storage, backed by SQLite in the app container
- One entry per day behavior: saving the same date updates that day instead of creating noisy duplicates
- Insight engine for highlights such as 7-day low, below 30-day average, weekly average down, personal low, and logging streak
- Score cards for latest weight, 7-day momentum, 30-day low, and consistency
- Custom trend ribbon chart
- Encouraging dashboard header, reward tags, richer score cards, and save celebration toast
- English and Simplified Chinese localization: SlimYet / 瘦了么
- Pure Swift analytics package with tests under `Shared/SlimYetCore`
- Web group competition version under `web/`

## Design Direction

SlimYet should feel like a tiny coach that notices progress without making weight feel heavy. The current pass uses a bright multi-color visual system, compact reward language, highlight tags, and a celebratory save moment. The core interaction is still fast: enter a number, optionally add a note, save, and let the app find the good signals.

## Web Group Version

The `web/` app is a Next.js + Supabase version for fast deployment. It supports email/password auth, Google auth when enabled in Supabase, profile names/avatars, group creation, invite links, private base weights, delta-only leaderboards, bilingual English/Chinese UI, and a self-only real-weight graph.

Privacy model: group dashboards only show each member's weight delta from their private base. The signed-in user can see their own actual weight history and graph.

See `web/README.md` and `web/supabase/schema.sql` for setup.

## Local Storage Design

The app uses SwiftData instead of CSV because the dataset is tiny but query/update semantics matter. SwiftData stores records locally in SQLite, needs no backend, and gives us native migration support later.

`WeightEntry` fields:

- `id`: stable UUID
- `date`: the logged date
- `weightKg`: canonical storage unit
- `note`: optional user note
- `createdAt`: creation timestamp
- `updatedAt`: last edit timestamp

Even daily logging for 10 years is roughly 3,650 rows, so this model will stay fast. CSV export can be added later as an output feature without making CSV the primary store.

## Verify

```sh
swift test
xcodebuild -target SlimYet -project SlimYet.xcodeproj -configuration Debug -sdk iphonesimulator26.5 build
cd web && npm run lint && npm run build
```
