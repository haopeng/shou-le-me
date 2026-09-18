# SlimYet / 瘦了么

SlimYet is a private weight journal and friendly group progress app, with a native SwiftUI iOS client and a Next.js web client sharing the same Supabase backend.

## Native iOS 1.0

The active app now opens `SlimYet/Native/UI/NativeRootView.swift`: My Journey, Groups, Top5, and Settings. It uses native Charts, photo selection, share sheets, and weight-entry sheets rather than embedding the website. The legacy local-only screens and SwiftData store are preserved but are not uploaded automatically.

See [the iOS release guide](docs/ios-release.md) for authentication, signing, privacy, moderation, App Store prerequisites, and verification. App Store submission still requires the owner's Apple Developer configuration and release acceptance testing.

## Original Local Prototype

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

The `web/` app is a Next.js + Supabase version for fast deployment. It supports email/password auth, Google auth when enabled in Supabase, profile names/avatars, group creation, invite links, private base weights, per-member delta trend plots, automatic member highlights, delta-only leaderboards, group activity feeds with reactions, bilingual English/Chinese UI, and a self-only real-weight graph.

Privacy model: each person has one private weight history, but each group membership can use a different base date/weight. Group dashboards and feeds only show each member's delta from that group's private base. The signed-in user can see their own actual weight history and graph.

See `web/README.md` and `web/supabase/schema.sql` for setup.

## Legacy Local Storage Design

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
