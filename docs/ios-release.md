# Slim Yet? iOS 1.0

## Scope

Native SwiftUI app for iOS 17 and later. This is not a web view. It shares the existing Supabase account and the production Next.js API at `https://shou-le-me.vercel.app`.

Four native tabs: My Journey, Groups, Top5, Settings. Weight entry is a sheet with a large decimal field, an explicit unit, same-day replacement confirmation, and a persistent save receipt. The group screen never renders absolute weights. Baseline editing is an explicit action scoped to the displayed group and requires confirmation.

Includes combined Swift Charts, single-point rendering, weekly/monthly lows, date ranges, best-delta bars, activity pagination, multiple reactions and names, profiles/photos, private history, group creation/invites/requests/approval, Chinese/English, export, account deletion, reporting, and device-local blocking. The original SwiftData files/store are preserved but are not automatically uploaded or linked to a cloud account.

## Architecture

- `SlimYet/Native/Domain`: Codable API contracts and pure calendar/chart logic. Group DTOs have no absolute or baseline weight field.
- `Services/CloudAPI`: HTTPS bearer-token API client. Uses ephemeral URLSession; private API data is only cached in memory.
- `Services/AppStore`: main-actor observable account state, request-generation isolation, cross-group refresh, and save receipts.
- Supabase Swift 2.55.2 handles sessions, Keychain storage, PKCE, refresh, email/password, and email links.
- `UI`: SwiftUI List/Form/NavigationStack, Charts, PhotosPicker, system share/export, accessibility labels and system text styles.
- `PreviewData` is compiled only in DEBUG, activated with `--preview-data`, visibly marked, and never writes to production.

## Authentication

Production `/api/mobile/config` returns only the public URL/key and provider availability. Never embed a Supabase service key, Google secret, or Apple private key in the app.

The default release uses **email/password and email links**. Existing Google users can enter the same email and choose “Email me a sign-in link” to access their existing account without creating another profile. Test this with an actual existing account before distribution.

Email confirmation, password recovery, and optional OAuth return through:

`https://shou-le-me.vercel.app/mobile/auth`

The server redirects the PKCE code to `com.haopeng.slimyet://auth/callback`. This HTTPS return URL must be allowed in Supabase Authentication > URL Configuration. The project's existing production `/**` entry covers it; an explicit production URL is preferred. Do not use localhost. Email templates must use the provided confirmation URL, not a hard-coded Site URL. Open email links on the same device that initiated them.

Third-party buttons intentionally remain hidden unless `IOS_SOCIAL_LOGIN_READY=true` **and** Apple is enabled in Supabase. Do not enable that flag yet: Apple's token revocation/account deletion integration and Apple-compliant button review still need to be completed and exercised with the owner's Apple Developer credentials. The delete endpoint currently refuses Apple-linked accounts and directs them to support; this is not an acceptable basis for enabling Apple login in the release. Google login on the website is unchanged. An email-only release avoids introducing an untested Apple login flow.

## App Store Prerequisites

Not submitted, signed, or approved. The following are release gates, not optional polish:

1. Accept the Xcode license locally. In Terminal: `sudo xcodebuild -license`. The owner must review and accept it.
2. Enroll/use a paid Apple Developer account. Add it in Xcode Settings > Accounts. Select the signing Team for `SlimYet`, register `com.haopeng.slimyet`, and create the matching App Store Connect app. No valid signing identity was present on this machine during implementation.
3. Set `APPLE_TEAM_ID` in Vercel to enable the hosted AASA document. Enable Associated Domains on the App ID; the entitlement is already present. Verify a real-device invite opens the correct group. Manual invite-link/code entry works without Universal Links.
4. Decide whether the first release is email-only or includes Google/Apple. Keep `IOS_SOCIAL_LOGIN_READY` unset for email-only. See the authentication section before enabling social login.
5. Set `SUPPORT_EMAIL` to the owner's chosen **public support address**. Review the factual privacy/terms pages and add the operator's legal identity/contact details where applicable. The owner's private dashboard email was not automatically published as the support contact.
6. Establish a staffed moderation process before public distribution. In-app reports/support requests go into the private `slim-safety-reports` Supabase Storage bucket; no public read policy is created. Each reporter/subject/day has one upserted report. Review these routinely, respond to the profile's email, remove abusive content, and restrict abusive accounts. Device-local blocking is provided; account-wide blocking and proactive image/content filtering need a production moderation plan.
7. Fill App Store privacy disclosures: linked health data (manual weight), name, email, user ID, photos, user content, and customer support. No tracking, ads, location, HealthKit, or third-party analytics are used. Validate the final archive's aggregated privacy report, including SDK manifests.
8. Provide App Review a dedicated email/password demo account with safe sample data in a private group. Do not share a personal account or service key. Release builds cannot activate preview fixtures.
9. Complete the test matrix below on real devices. Export screenshots from the actual build. Do not submit debug-preview screenshots as real account data.

Apple references: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (1.2, 4.8, 5.1.1); [account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/); [privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files).

## Build And Verify

```sh
swift test
xcodebuild test -project SlimYet.xcodeproj -scheme SlimYet \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -resultBundlePath build/iOS-Tests.xcresult CODE_SIGNING_ALLOWED=NO
xcodebuild build -project SlimYet.xcodeproj -scheme SlimYet \
  -configuration Release -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
```

The GitHub workflow selects an available iPhone automatically, runs core tests and native UI tests, compiles Release, and retains the xcresult with screenshots for seven days. The UI tests only use synthetic fixtures and never write a real user's data.

For a signed archive, use Xcode Product > Archive after selecting the Team, then validate and distribute through Organizer. Increment the build number on each App Store Connect upload. Do not bypass signing or manually fabricate an IPA.

## Acceptance Matrix

- Email registration/confirmation, existing Google-account email link, login, relaunch/session refresh, password reset, cancellation and expired links.
- Save in kg and lb; decimal comma; same-date replacement; backdated entry; invalid/empty numbers; no duplicate submission while saving.
- Two accounts in two groups with different baselines: one write changes all relevant deltas and no peer can read real weights.
- Daily curve with one point; 0/-0.3/0 rebound; ISO week at year boundary; month rollover; range filtering; all-time-best marker.
- Confirmation receipt only closes manually; reduced-motion setting suppresses particle effects; group receipt contains only deltas.
- Create/invite/join; pending request; owner approval/decline; members-only group navigation from Top5.
- Multiple reactions per account; actor names; ten-item feed and load-more; avatar picker/zoom; report/block.
- Delete a disposable non-Apple account after fresh sign-in, including old avatar objects and owned-group consequences. Verify another user's own personal logs survive. Do not test deletion on the owner's account.
- Slow/offline/error responses, background/foreground, sign-out during a request, and account switching.
- Small and large iPhone, landscape-independent portrait layout, Chinese/English, dark mode, VoiceOver, and large Dynamic Type.

## Backend Additions

All additions are separate routes; existing group and weight endpoints and database tables remain unchanged.

- `GET /api/mobile/config`: safe public bootstrap; no server key.
- `GET /mobile/auth`: fixed native redirect, no open redirect, no-store/no-referrer.
- `DELETE /api/me/account`: authenticated, explicit confirmation, fresh sign-in required; removes avatars then cascades the account.
- `POST /api/me/reports`: authenticated support/report intake, membership-checked for member reports; private Storage only.
- `/privacy`, `/terms`, `/support`: bilingual standalone pages.
- `/.well-known/apple-app-site-association`: only advertises the App ID after a valid Team ID is configured.
