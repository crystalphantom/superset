# Self-Host Divergence Notes

Date captured: 2026-05-12

This document records the local changes that diverge from upstream `main` so we can preserve the intent even if the code cannot be pushed as-is. Use this as the re-apply checklist when creating a clean branch from the latest upstream code.

## Current Git Context

- Local branch: `feat/bypass-paywall`
- Local HEAD: `0ee383050`
- Fetched upstream main: `upstream/main` at `11afdf8d6`
- Merge base with upstream: `d988f24bc`
- Branch relation to upstream at capture time: 5 commits ahead, 28 commits behind
- Current worktree also has uncommitted deployment/auth/desktop changes on top of HEAD.

## Recommended Strategy

Do not merge the full branch blindly into latest upstream. The branch contains useful self-hosting work, but it also contains temporary paywall bypasses and auth/CORS shortcuts that are not production-safe.

Preferred approach:

1. Create a fresh branch from latest `upstream/main`.
2. Re-apply only the items marked "keep" below.
3. Re-design or skip the items marked "do not carry as-is".
4. Run `bun run lint:fix`, `bun run lint`, and targeted build/type checks before pushing.

## Divergent Commits

### `c86e213b9` - `temp: bypass-paywall`

Primary intent: unblock local/self-host testing where Stripe/subscription state was not available or not reliable.

Changes:

- Desktop paywall and plan resolution:
  - Changed `useCurrentPlan` and paywall logic so gated features are effectively available.
  - Added debug logging around plan/session values.
  - Updated paywall UI behavior.
- Stripe/local organization creation:
  - Added `isLocalStripeKey` in `packages/auth/src/server.ts`.
  - Skips Stripe customer creation when the Stripe secret looks local.
  - Still seeds default task statuses after organization creation.
- Linear integration:
  - Extracted Linear initial sync into `apps/api/src/app/api/integrations/linear/jobs/initial-sync/sync.ts`.
  - Added `triggerSync` tRPC mutation for Linear.
  - Development calls the sync endpoint directly; production publishes the sync request through QStash.
  - Added richer Linear connection fields in the tRPC response.
- Desktop task UI:
  - Added cloud task fallback behavior and empty-state components.
  - Adjusted board/table task views to use fallback data paths.
- Dependency/config:
  - Added `lodash.chunk` usage for batched Linear task upserts.

Carry-forward guidance:

- Keep, with review: Linear sync extraction and manual trigger flow.
- Keep, with review: skipping Stripe calls for explicitly local/test Stripe keys.
- Do not carry as-is: forced enterprise/free gating bypass and debug logging. Replace with a deliberate self-host license or config flag if needed.

Key files:

- `apps/desktop/src/renderer/hooks/useCurrentPlan.ts`
- `apps/desktop/src/renderer/components/Paywall/usePaywall.ts`
- `packages/auth/src/server.ts`
- `apps/api/src/app/api/integrations/linear/jobs/initial-sync/sync.ts`
- `packages/trpc/src/router/integration/linear/linear.ts`

### `bbf6d5938` - `Merge branch 'main' into feat/bypass-paywall`

Primary intent: sync this branch with upstream `main` at that point in time.

Changes:

- This is a large merge commit from upstream and should not be treated as one of our feature changes.
- It brings many upstream desktop, CLI, database, host-service, docs, and marketing updates into the branch.

Carry-forward guidance:

- Do not cherry-pick this merge commit.
- Instead, start from the latest upstream `main` and apply our actual custom changes on top.

### `87f113def` - dependency cleanup and active org host-service initialization

Primary intent: fix local build/runtime issues after the branch merge.

Changes:

- Added `.infisical.json`.
- Adjusted Electron/Vite config to alias singleton dependencies from `apps/desktop/node_modules` instead of root `node_modules`.
- Updated dependency lock metadata for React Query related packages.
- Updated `LocalHostServiceProvider` so host-service initialization includes the active organization context.

Carry-forward guidance:

- Keep, if still needed after pulling latest upstream.
- Re-test carefully because upstream may have changed dependency layout and host-service startup since this commit.

Key files:

- `.infisical.json`
- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/src/renderer/routes/_authenticated/providers/LocalHostServiceProvider/LocalHostServiceProvider.tsx`
- `package.json`
- `bun.lock`

### `09cd43cba` - allow registered hosts on free tier

Primary intent: allow remote/registered host access even when the org is on the free tier.

Changes:

- Modified relay access checks in `apps/relay/src/access.ts`.
- The intent appears to be: if a host is registered/known, do not block it only because billing tier is free.

Carry-forward guidance:

- Keep for self-host MVP if free-tier billing should not block registered host access.
- Review access semantics against latest upstream before re-applying.

Key file:

- `apps/relay/src/access.ts`

### `0ee383050` - include curl for relay healthchecks

Primary intent: make Docker/container health checks work in environments that call `curl`.

Changes:

- Adds `curl` to the relay Docker image.

Carry-forward guidance:

- Keep if Coolify/Fly/Azure health checks require `curl` inside the container.
- If latest upstream uses a different base image or health check mechanism, adapt the package install accordingly.

Key file:

- `apps/relay/Dockerfile`

## Current Uncommitted Changes

These are changes present in the worktree at capture time but not committed.

### Self-host deployment plan and Vercel build support

Intent: document and support an MVP deployment where API/web are on Vercel, relay is a Docker container, database is Neon, KV is Upstash, and Electric proxy is on Cloudflare Workers.

Changes:

- Added `plans/mvp-self-host-deployment.md`.
- Added `.vercel` ignores at root and app level.
- Added `apps/api/vercel.json` and `apps/web/vercel.json`.
- Added `outputFileTracingRoot` and Turbopack `root` to API/web Next config so app builds work from monorepo context.

Carry-forward guidance:

- Keep. This is directly related to self-hosting and deployment reproducibility.
- Re-check against upstream Next/Vercel config before applying because upstream may already have monorepo deploy support.

Key files:

- `plans/mvp-self-host-deployment.md`
- `apps/api/next.config.ts`
- `apps/web/next.config.ts`
- `apps/api/vercel.json`
- `apps/web/vercel.json`

### Split-domain social auth/session handoff

Intent: make social login work when API and web are on separate hostnames that do not share the Better Auth cookie naturally.

Changes:

- Added API social connect endpoint:
  - `apps/api/src/app/api/auth/social/connect/route.ts`
- Added API social completion endpoint that renders an auto-submitting form:
  - `apps/api/src/app/api/auth/social/complete/route.ts`
- Added web session completion endpoint:
  - `apps/web/src/app/api/auth/session/complete/route.ts`
- Changed the web sign-in page to send users through the API social connect route.
- Made `/api/auth/session` public in web proxy.

Security/backward compatibility notes:

- Do not carry as-is.
- This posts a raw Better Auth session token across origins and lets a public endpoint set the web session cookie.
- It is not required if deployment uses sibling subdomains and `NEXT_PUBLIC_COOKIE_DOMAIN=.yourdomain.com`.
- If split-domain handoff is truly needed, replace this with a one-time signed code bound to OAuth state/origin, then exchange it server-side.

Key files:

- `apps/api/src/app/api/auth/social/connect/route.ts`
- `apps/api/src/app/api/auth/social/complete/route.ts`
- `apps/web/src/app/api/auth/session/complete/route.ts`
- `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/src/proxy.ts`

### CORS and Better Auth checks relaxed

Intent: unblock browser requests while API, web, desktop dev server, previews, and relay are split across origins.

Changes:

- API proxy now reflects any incoming `Origin` while setting `Access-Control-Allow-Credentials: true`.
- Added `X-Requested-With` to allowed CORS headers.
- Better Auth origin and CSRF checks are disabled globally.

Security/backward compatibility notes:

- Do not carry as-is.
- This widens cross-origin authenticated access and removes global auth endpoint protections.
- Prefer the original allow-list based CORS behavior and Better Auth `trustedOrigins`.
- If new self-host domains are needed, add them to env/trusted-origin config instead of reflecting every origin.

Key files:

- `apps/api/src/proxy.ts`
- `packages/auth/src/server.ts`

### OAuth consent proxy route

Intent: make CLI/OAuth consent work from the web domain while Better Auth runs on the API domain.

Changes:

- Added `apps/web/src/app/api/oauth/consent/route.ts`.
- Consent form now posts to the web API route instead of calling `authClient.oauth2.consent` directly.
- The route sets active organization before forwarding consent to Better Auth.
- Consent page now loads organizations directly from DB membership rows instead of tRPC.

Carry-forward guidance:

- Keep only if OAuth consent is broken after moving to self-host domains.
- Review with the final auth-domain design. If API/web share cookies correctly, the original client flow may be preferable.

Key files:

- `apps/web/src/app/api/oauth/consent/route.ts`
- `apps/web/src/app/oauth/consent/components/ConsentForm/ConsentForm.tsx`
- `apps/web/src/app/oauth/consent/page.tsx`

### Desktop accessible-host fallback

Intent: make host lists work even when Electric synced collections are stale or incomplete.

Changes:

- Added shared `useAccessibleHosts` hook.
- Combines Electric local collection data with cloud API host listing.
- Uses this hook in host settings and workspace device picker.

Carry-forward guidance:

- Keep, with review.
- This is useful for self-hosting because Electric proxy setup may be fragile during MVP.
- Confirm latest upstream host list APIs still match the hook.

Key files:

- `apps/desktop/src/renderer/routes/_authenticated/hooks/useAccessibleHosts/useAccessibleHosts.ts`
- `apps/desktop/src/renderer/routes/_authenticated/hooks/useAccessibleHosts/index.ts`
- `apps/desktop/src/renderer/routes/_authenticated/settings/hosts/page.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/settings/hosts/components/HostsSettingsSidebar/HostsSettingsSidebar.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/DevicePicker/hooks/useWorkspaceHostOptions/useWorkspaceHostOptions.ts`

### Relay online/offline status update from host service

Intent: keep cloud host status in sync with the relay tunnel connection lifecycle.

Changes:

- `TunnelClient` accepts an optional `onStatusChange` callback.
- Marks host online on relay socket open.
- Marks host offline on socket close.
- Logs relay socket close code/reason.
- `connectRelay` wires status updates through API `host.setOnline`.

Carry-forward guidance:

- Keep, with review against upstream relay hardening work.
- Be careful with the host id format; the current change passes `buildHostRoutingKey(...)` to `host.setOnline`, which may or may not match the latest API contract.

Key files:

- `packages/host-service/src/tunnel/connect.ts`
- `packages/host-service/src/tunnel/tunnel-client.ts`

### CLI OAuth client id override

Intent: allow self-hosted CLI builds to use a custom OAuth client id.

Changes:

- Added `SUPERSET_OAUTH_CLIENT_ID` replacement in CLI build config.
- CLI auth reads `process.env.SUPERSET_OAUTH_CLIENT_ID` and falls back to `superset-cli`.

Carry-forward guidance:

- Keep. This is a small, clean self-host customization.

Key files:

- `packages/cli/cli.config.ts`
- `packages/cli/src/lib/auth.ts`

### Desktop dependency alias and paywall debug changes

Intent: fix dependency duplication and debug paywall/session behavior during self-host testing.

Changes:

- Electron/Vite aliases now point at desktop app `node_modules`.
- Paywall hook logs current session and plan values.

Carry-forward guidance:

- Keep dependency alias only if still needed.
- Do not keep paywall debug logs in production.

Key files:

- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/src/renderer/components/Paywall/usePaywall.ts`

## Pull/Merge Risk Against Latest Upstream

At capture time, a direct merge from latest upstream is not clean.

Known overlapping files between local changes and upstream changes:

- `apps/web/next.config.ts`
- `apps/web/src/proxy.ts`
- `bun.lock`
- `packages/auth/src/server.ts`
- `packages/cli/cli.config.ts`
- `packages/host-service/src/tunnel/tunnel-client.ts`

Known merge-conflict areas from committed branch state:

- `apps/api/src/app/api/integrations/linear/callback/route.ts`
- `apps/desktop/src/renderer/providers/AuthProvider/AuthProvider.tsx`
- `bun.lock`
- `packages/auth/src/server.ts`

Practical implication:

- A fresh branch from upstream plus selective re-application is lower risk than merging this branch forward.
- Treat `bun.lock` as regenerate/resolve-last.
- Resolve auth changes manually, not by accepting either side wholesale.

## Re-Apply Checklist

Keep or re-apply:

- Vercel/monorepo deployment config for `apps/api` and `apps/web`.
- MVP self-host deployment notes.
- Relay Docker `curl` healthcheck support, if still needed.
- Relay free-tier registered host access, if self-host billing should not gate hosts.
- CLI OAuth client id override.
- Desktop accessible-host fallback, if Electric remains unreliable during MVP.
- Relay online/offline status callback, after checking host id contract.
- Linear sync extraction/manual trigger, after reconciling with latest upstream integration code.
- Local Stripe skip for explicitly local/test keys, if still needed.

Do not re-apply as-is:

- Forced enterprise/paywall bypass.
- Broad CORS origin reflection with credentials.
- Global Better Auth `disableOriginCheck` and `disableCSRFCheck`.
- Raw session-token POST handoff from API domain to web domain.
- Paywall/session debug logging.

Needs redesign if still required:

- Cross-domain social auth handoff: use shared cookie domain where possible. If not possible, use a one-time signed exchange code bound to OAuth state/origin.
- OAuth consent proxy: only keep if required by the final auth domain model.
- Host status updates: ensure API expects machine id vs routing key before keeping the callback.




- `SUPERSET_API_URL=https://superset-mvp-api.vercel.app`
- `SUPERSET_WEB_URL=https://superset-mvp-web.vercel.app`
- `RELAY_URL=https://superset-relay.hevo.dev`
- `SUPERSET_OAUTH_CLIENT_ID=AfVhBqSjQUOCqMiVynIhrvgYXsFRHiKE`




- `NEXT_PUBLIC_API_URL=https://superset-mvp-api.vercel.app`
- `NEXT_PUBLIC_WEB_URL=https://superset-mvp-web.vercel.app`
- `RELAY_URL=https://superset-relay.hevo.dev`