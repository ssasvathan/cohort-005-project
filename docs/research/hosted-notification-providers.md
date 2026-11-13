# Hosted notification providers for Cadence

Research for [issue #2](https://github.com/ssasvathan/cohort-005-project/issues/2), part of map [#1 In-app Notifications](https://github.com/ssasvathan/cohort-005-project/issues/1). Researched 2026-11-12 against the vendors' own docs, pricing pages and GitHub repos. Pricing changes often, so re-check before signing up.

**Question:** How do Knock, Novu, MagicBell, Courier and SuprSend compare on Cadence's must-haves? These are a free/dev tier, React feed components plus a headless API that fit React Router v7 SSR, real-time delivery and server-signed per-user auth. Self-hosting/OSS is a nice-to-have. The research also covers how each supports offline local dev and tests.

This document doesn't make the choice. A separate grilling ticket does.

## Summary table

| | Knock | Novu | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| **Free tier** | 10k messages/mo, unlimited envs and feed retention, no hard cap (sales contacts you) [K1] | 10k workflow runs/mo, **5 workflows max**, 2 envs, 3 team members, 24h activity retention [N1] | **1k deliveries/mo**, 1 project [M1] | 10k sends/mo (one send = one recipient, any channels) [C1] | 10k notifications/mo, in-app feed carries SuprSend branding, 30-day logs [S1] |
| **First paid tier** | $250/mo [K1] | $30/mo Pro [N1] | $249/mo [M1] | $0.005/send pay-as-you-go [C1] | $100/mo [S1] |
| **React prebuilt components** | `@knocklabs/react`: `NotificationFeedPopover`, `NotificationFeed`, `NotificationIconButton` [K2] | `@novu/react` `<Inbox />` (Bell, Notifications, Preferences) [N2] | `@magicbell/react` `Inbox`, `FloatingInbox` [M2] | `@trycourier/courier-react` `<CourierInbox />` [C2] | `@suprsend/react` drop-in `<Inbox />` [S2] |
| **Headless** | React hooks + feeds REST API [K2][K3] | Hooks in `@novu/react`, framework-agnostic `@novu/js` [N2] | Separate `@magicbell/react-headless` package; main React page shows no hooks [M2][M5] | `courier-js` inbox client: `getMessages`, `read`, `readAll`, socket listeners [C4] | `SuprSendFeedProvider`, `useFeedData`, `useFeedClient` [S3] |
| **SSR guidance** | Next.js quickstart: client component; `enabled={false}` to wait for a token [K4] | Next.js quickstart: `'use client'` [N3] | None found | Explicit: safe to import on server, stub under Node, no `ssr:false` needed [C3] | None found |
| **Real-time** | Websocket, documented [K3] | "Real-time", websocket service (`ws`) in self-host stack [N2][N5] | Claimed; transport not documented on the pages read | WebSocket, documented [C4] | Feed socket (`socketHost`, reachability status) [S3] |
| **Per-user auth** | RS256 JWT signed locally with signing key. **Off by default** ("enhanced security mode") [K5] | HMAC-SHA256(secretKey, subscriberId). Optional, enabled in provider settings [N4] | HS256 user JWT signed with project secret. Required by current React SDK [M3][M4] | Backend calls `POST /auth/issue-token` (**network round-trip**). Scoped JWT; never expires unless `expires_in` is set [C5] | ES256 JWT signed with signing key. "Enhanced security mode" opt-in, `refreshUserToken` callback [S4] |
| **OSS / self-host** | MIT SDK only; SaaS only | **MIT core + enterprise-licensed parts. Docker Compose self-host** (Mongo, Redis, api, worker, ws, dashboard) [N5][N6] | SDK under a **proprietary** license; SaaS only [M5] | MIT SDK only; SaaS only [C6] | MIT SDKs. Self-host is Enterprise-only (Helm) [S1][S5] |
| **Offline local dev/tests** | No emulator. Dev environment + test runner need network [K6] | **Only one with a real local backend** (Docker Compose; Inbox takes `backendUrl`/`socketUrl`) [N5] | No emulator found | No emulator found | No emulator found |

## Findings by criterion

### Free/dev tier

- **Knock:** $0. Covers 10,000 messages a month, where "a message is one delivery to one user on one channel". Also includes unlimited environments, unlimited feed retention, multi-tenancy and 30-day logs. Usage over the limit isn't hard-capped; Knock contacts you about billing instead. Branding can't be removed. Starter is $250/mo. [K1]
- **Novu:** $0. Covers 10,000 workflow runs a month, **up to 5 workflows**, 2 environments (Dev/Prod), 3 team members and 24h activity-feed retention, with no overage. Pro is $30/mo with $1.20 per extra 1k runs, and Team is $250/mo. [N1] The 5-workflow cap matters if each Notification kind in the catalogue becomes its own workflow.
- **MagicBell:** The "Builder" plan is $0 for **1,000 deliveries a month**, with each channel reached counting as a delivery, and 1 project. Startup is $249/mo. [M1] This is the smallest free tier.
- **Courier:** The Developer plan covers 10,000 sends a month. One send is one template to one recipient regardless of channels. Business is $0.005 per send on every send, including the first 10k. [C1] The pricing page doesn't say whether Inbox has its own limit.
- **SuprSend:** $0 for 10,000 notifications a month, unlimited team members, and the in-app feed with SuprSend branding. Essentials is $100/mo for 50k. [S1]

### React components, headless API, and React Router v7 SSR

None of the five vendors documents React Router v7 or Remix specifically. Their nearest guidance is for the Next.js App Router. Every feed SDK runs in the browser: it opens a socket and holds client state. In RR7 that means rendering the bell as a client-only island and passing the signed token from a loader. Any SDK that touches `window` at import time would need a `ClientOnly` or lazy-import wrapper. Only Courier explicitly documents server-import safety. [C3]

- **Knock:** `@knocklabs/react` ships prebuilt feed and bell components plus "a complete set of React hooks" for your own UI. [K2] There's also a feeds REST API (counts for unread/read/seen, filtering, archive). [K3] The Next.js quickstart treats the feed as a client component. `KnockProvider` has an `enabled` prop "to gate the provider on a complete identity, e.g. an enhanced-security user token that isn't ready on first render". [K4]
- **Novu:** `@novu/react` `<Inbox />` supports React 18/19. Headless hooks come from `@novu/react` and `@novu/js`. [N2] The Next.js quickstart starts its `<Inbox />` examples with `'use client'`. [N3]
- **MagicBell:** `@magicbell/react` has `Inbox` and `FloatingInbox`, plus `Provider` taking a `token` (User JWT). [M2] The headless SDK is a separate package, `@magicbell/react-headless`, in the `magicbell-js` monorepo. [M5] The older `@magicbell/magicbell-react` took `apiKey` + `userEmail` with optional HMAC `userKey`; the current package needs a JWT.
- **Courier:** `@trycourier/courier-react` v9 (React 18+) provides `<CourierInbox />`, `useCourier()`, and `courier.shared.signIn({ userId, jwt })`. [C2] The `courier-js` client is a full headless inbox API: `getMessages`, `getUnreadMessageCount`, `read`/`unread`/`archive`, `readAll`, and a socket with event listeners. [C4] The Next.js guide explains the inbox is a custom element whose base class "resolves to a stub under Node". It says importing on the server is safe and "Adding `ssr: false` costs you the prerender and buys nothing". In dev, StrictMode double-invokes effects and a second `signIn` signs the first user out, so the guide uses a ref guard. [C3]
- **SuprSend:** `@suprsend/react` has a drop-in inbox and a headless mode (`SuprSendFeedProvider`, `useFeedClient`, `useFeedData`, `useFeed`). [S2][S3] The older `@suprsend/react-inbox` is end-of-support. [S2]

### Real-time delivery

- **Knock:** "Clients connect to the in-app real-time service... receives notifications over a websocket." [K3]
- **Novu:** Docs say interactions are "synchronized with the Novu backend in real-time". [N2] The self-host stack includes a dedicated `ws` service, and the Inbox takes a `socketUrl`. [N5]
- **MagicBell:** Markets itself as "the real-time notification inbox". The pages read don't name a transport. **Unverified.**
- **Courier:** "connect the inbox WebSocket and refetch counts when message events arrive". The socket signals changes but doesn't push counts. [C4]
- **SuprSend:** The feed has a socket (`socketHost`) and a `reachability` status that combines "browser is online, the feed socket is live, and the feed API is reachable". When degraded, "new notifications may get delayed or missed". [S3]

### Server-signed per-user auth

All five can stop one user reading another's feed. For **Knock, Novu and SuprSend this is opt-in**: you must switch it on, or the public key alone can act as any user.

- **Knock:** "Without enhanced security mode, a request with your public key can act as any user." With it on, the backend signs an **RS256** JWT (`sub` = user id, plus `iat`/`exp`) using `KNOCK_SIGNING_KEY`. Signing is **local, with no network call**. The Node SDK's `signUserToken` defaults to a 1h expiry, and there's an `onUserTokenExpiring` refresh callback. Grants can narrow access further. [K5]
- **Novu:** `subscriberHash = HMAC-SHA256(secretKey, subscriberId)`, lowercase hex, computed server-side. Once HMAC is enabled in the In-App provider settings, a missing hash means "the Inbox will not load". [N4] **Local, no network.** The hash never expires, because it's static per subscriber.
- **MagicBell:** The User JWT is **HS256**, signed with the project Secret Key, and carries `user_external_id` and/or `user_email` plus `api_key`. [M4] The current React SDK requires the token. [M2] Signing is local. The docs' examples use a one-year expiry. [M4]
- **Courier:** The backend calls **`POST /auth/issue-token`** with the workspace API key and scopes such as `user_id:<id> inbox:read:messages inbox:write:events`. Omitting `expires_in` "mints a token that never expires". The SDKs don't auto-refresh. [C5] **Every token mint needs a network round-trip to Courier.** That matters for offline dev and for a loader that runs on each page render.
- **SuprSend:** With enhanced security mode on, an **ES256** JWT is signed locally with a dashboard-generated signing key. The payload is `entity_type: "subscriber"`, `entity_id`, `exp`, `iat` and an optional `scope.tenant_id`. `identify(...)` takes a `refreshUserToken` callback. [S4]

### Self-hosting / OSS

- **Novu** is the only real option. Its core is MIT-licensed, the `enterprise` folder is commercially licensed, and the repo ships LICENSE-MIT, LICENSE-ENTERPRISE and EE-PACKAGES-LICENSE. [N6] Self-host runs on Docker Compose via a setup script with MongoDB, Redis, api, worker, ws and dashboard. [N5] Self-hosted Novu lacks "some features exclusive to Novu's cloud", including some **Inbox features**, SSO, RBAC and social login. [N7] The exact list of missing Inbox features is on a comparison page I didn't read. **Unverified.**
- **SuprSend:** Self-host (Kubernetes/Helm) exists only on Enterprise. [S1][S5] Its SDKs are MIT.
- **Knock, Courier:** SaaS only. Their client SDKs are MIT (`knocklabs/javascript`, `trycourier/courier-web`). [C6]
- **MagicBell:** SaaS only. The `magicbell-js` SDK repo uses a **proprietary license agreement**, not an OSS license. [M5]

### Offline local dev and tests (no network, no key)

**No vendor ships an offline emulator or mock server for its in-app feed.** In every hosted-only option, Cadence would need its own fake to meet the map's "works offline like `.outbox/`" requirement. The provider SDK shape decides how easy that is:

- **Novu** is the only provider you can run fully on localhost. Docker Compose plus `<Inbox backendUrl socketUrl>` gives a real feed with no internet once the images are pulled. [N5] It's heavy for `npm run test`, which would need Mongo, Redis and four services, and it still needs keys generated by the setup script. Tests would more realistically stub it anyway.
- **Knock, Courier, SuprSend** each have a headless client or hooks layer, and a Cadence-side fake can mimic that: a local feed table plus a fake provider for the bell. For Knock and SuprSend, server-side signing is local (RS256/ES256), so even the auth path runs offline with a dummy key. Courier's token mint is a network call, so the whole auth path must be faked. [C5]
- **Knock** offers a dev environment, a built-in test runner, a CLI for pulling and pushing workflows, and a "sandbox" for its test email channel. All of these assume network access. [K6]
- **DevUI user switching:** every SDK is keyed by a user id plus a token. Switching users means re-signing and remounting the provider. Courier's guide warns that a second `signIn` signs the first user out. [C3] Knock's `enabled` prop helps gate the provider while the token loads. [K4]

## Trade-offs

1. **Novu: OSS and local backend vs. free-tier limits.** Novu is the only option that can run offline for real (Docker) and the only meaningful OSS. Its Pro tier ($30) is by far the cheapest. Against that, the free tier caps you at 5 workflows and 24h activity retention, and self-host drops some Inbox features. Its HMAC auth is static, so a leaked hash never expires.
2. **Knock: strongest docs and auth model vs. price cliff.** Knock signs tokens locally with short expiries and has explicit refresh. It has a documented websocket, hooks plus a REST feed API, and unlimited environments and feed retention on free. The next tier, though, is $250/mo, and enhanced security is off by default, so you must remember to turn it on.
3. **Courier: best SSR story vs. network-bound auth.** Courier is the only vendor that documents server-import safety. Its headless `courier-js` is complete, and pay-as-you-go is cheap at low volume. However, every user token needs an API call to Courier, which makes offline dev harder and adds latency to loaders. Tokens also never expire by default.
4. **SuprSend: solid auth, thin docs.** SuprSend has ES256 local signing with a refresh callback, headless hooks, a mid-priced paid tier ($100) and branding on free. Its docs say nothing about SSR, and self-host is Enterprise-only.
5. **MagicBell: weakest fit on the must-haves.** Its free tier is tiny (1k deliveries), the next tier is $249, the SDK license is proprietary, and the real-time transport and headless docs were the thinnest of the five.

**Recommendation (non-binding, for the grilling ticket):** Shortlist **Knock** and **Novu**. Knock gives the best documented auth, real-time and headless story on a generous free tier. Novu is the pick if OSS or self-hosting and a real local backend count for much. Either way, plan a Cadence-side fake feed for tests and offline dev. The hosted-only vendors offer no emulator, and even with Novu you wouldn't want Docker in `npm run test`.

## Not verified / gaps

- **MagicBell:** real-time transport; whether the current `@magicbell/react` ships hooks (the headless package exists, but its current API wasn't read); `docs.magicbell.com` failed DNS, so the `magicbell.com/docs` pages were used instead.
- **Novu:** the exact Inbox features missing from self-host (comparison page not read); how strictly the 5-workflow free cap applies.
- **Courier:** whether Inbox messages have a separate limit on the free plan.
- **SuprSend:** SSR/Next.js behaviour of `@suprsend/react`; the real-time transport beyond "feed socket".
- **None of the vendors** documents React Router v7 or Remix. SSR import safety was taken from Next.js guides and hasn't been tested in Cadence.
- The issue mentions an existing `app/lib/mailer.server.ts` with a `.outbox/` fallback. It's **not present on `main`** at the time of writing, so the comparison to that pattern is conceptual.

## Sources

- [K1] Knock pricing: https://knock.app/pricing
- [K2] Knock React overview: https://docs.knock.app/in-app-ui/react/overview
- [K3] Knock feeds overview: https://docs.knock.app/in-app-ui/feeds/overview
- [K4] Knock `KnockFeedProvider` / Next.js quickstart: https://docs.knock.app/in-app-ui/react/sdk/components/knock-feed-provider, https://docs.knock.app/llms-full.txt
- [K5] Knock security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [K6] Knock CLI and test channel: https://docs.knock.app/developer-tools/knock-cli, https://docs.knock.app/integrations/email/knock-test
- [N1] Novu pricing: https://novu.co/pricing
- [N2] Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
- [N3] Novu Next.js quickstart: https://docs.novu.co/platform/quickstart/nextjs
- [N4] Novu Inbox production prep (HMAC): https://docs.novu.co/platform/inbox/prepare-for-production
- [N5] Novu deploy with Docker: https://docs.novu.co/community/self-hosting-novu/deploy-with-docker
- [N6] Novu repo / licenses: https://github.com/novuhq/novu
- [N7] Novu self-hosting overview: https://docs.novu.co/community/self-hosting-novu/overview
- [M1] MagicBell pricing: https://www.magicbell.com/pricing
- [M2] MagicBell React components: https://magicbell.com/docs/libraries/react
- [M3] MagicBell API authentication: https://www.magicbell.com/docs/api-authentication
- [M4] MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
- [M5] MagicBell JS SDK repo and LICENSE: https://github.com/magicbell/magicbell-js
- [C1] Courier pricing: https://www.courier.com/pricing
- [C2] Courier Inbox overview: https://www.courier.com/docs/platform/inbox/inbox-overview
- [C3] Courier Next.js inbox guide: https://www.courier.com/docs/guides/add-an-inbox-to-nextjs
- [C4] Courier JS SDK: https://www.courier.com/docs/sdk-libraries/courier-js-web
- [C5] Courier Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
- [C6] Courier web SDK repo (MIT): https://github.com/trycourier/courier-web
- [S1] SuprSend pricing: https://www.suprsend.com/pricing
- [S2] SuprSend React inbox: https://docs.suprsend.com/docs/inbox-react
- [S3] SuprSend React headless feed / drop-in feed: https://docs.suprsend.com/docs/react-sdk-headless-feed, https://docs.suprsend.com/docs/react-in-app-feed
- [S4] SuprSend client authentication: https://docs.suprsend.com/docs/client-authentication
- [S5] SuprSend self-host: https://www.suprsend.com/self-host
- SDK licenses checked via the GitHub API (`gh api repos/<repo> --jq .license.spdx_id`): knocklabs/javascript MIT, trycourier/courier-web MIT, suprsend/suprsend-react-sdk MIT, suprsend/suprsend-web-sdk MIT, magicbell/magicbell-js NOASSERTION (LICENSE is a proprietary agreement), novuhq/novu NOASSERTION (MIT + enterprise license files).
