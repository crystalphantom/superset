# Self-Host CI/CD Deployment Plan

Date: 2026-05-12

## Goal

Automate self-host releases while reusing the existing GitHub Actions
pipelines as much as possible. The target release surface is:

- `apps/api` on Vercel
- `apps/web` on Vercel
- `apps/relay` as a Docker deployment on Coolify
- `apps/electric-proxy` as a Cloudflare Worker deployment
- `apps/desktop` as signed GitHub Release artifacts
- `packages/cli` as GitHub Release tarballs

The relay and Electric proxy are part of the release cycle, not optional
afterthoughts. Desktop and CLI builds are not useful for remote hosts unless
they point at the matching API, web, relay, and Electric URLs.

## Divergence Constraints

From `plans/self-host-divergence-notes.md`, only carry deployment-safe changes:

- Keep the Vercel monorepo build support for `apps/api` and `apps/web`.
- Keep the Linear initial-sync extraction and manual trigger flow after review.
- Keep local/test Stripe call skipping only as an explicit self-host/dev mode.
- Keep host-service active organization initialization if latest upstream still
  needs it.
- Keep registered-host/free-tier relay access behavior if self-host billing is
  intentionally disabled.
- Keep relay Dockerfile healthcheck support.

Do not carry these as-is into production CI:

- Paywall/plan bypasses and debug logging.
- CORS that reflects arbitrary origins with credentials.
- Global Better Auth origin/CSRF disablement.
- Cross-domain session handoff that posts raw session tokens.

CI/CD should encode the safer design: fixed deployment URLs, trusted origins,
shared cookie domain where possible, and release builds that fail if required
self-host URLs are missing.

## Existing Pipeline Inventory

Current workflows already cover most of the needed release mechanics:

- `.github/workflows/ci.yml`: lint, tests, typecheck, desktop build, CLI build.
- `.github/workflows/deploy-preview.yml`: Neon preview branch, Vercel preview
  deploys for API/web/marketing/admin/docs, and PR aliases.
- `.github/workflows/cleanup-preview.yml`: deletes Neon preview branches.
- `.github/workflows/deploy-production.yml`: production DB migrations and
  Vercel production deploys for API/web/marketing/admin.
- `.github/workflows/build-cli.yml`: reusable CLI build matrix.
- `.github/workflows/release-cli.yml`: tag-driven `cli-v*` GitHub release plus
  rolling `cli-latest`.
- `.github/workflows/build-desktop.yml`: reusable desktop build matrix.
- `.github/workflows/release-desktop.yml`: tag-driven `desktop-v*` draft
  GitHub release.
- `.github/workflows/release-desktop-canary.yml`: scheduled/manual canary.

Do not add new pipelines first. Update these existing workflows and only split
out a reusable helper workflow if duplication becomes unmaintainable.

## Validation Outcome

The core self-host deployment surface is complete for the intended product
workflow:

- API
- Web app
- Relay
- Electric proxy
- Desktop app
- CLI package
- Database migrations

No additional deployment is required for the core self-host release beyond the
landing/marketing site, which is intentionally out of scope.

Optional repo surfaces that are not part of the core self-host release:

- `apps/marketing`: landing page. Excluded.
- `apps/admin`: admin dashboard. Existing workflows deploy it, but the
  self-host release can gate or skip it unless admin workflows are needed.
- `apps/docs`: documentation site. Existing workflows deploy it, but it is not
  required for the desktop/API/relay/CLI workflow.
- `apps/mobile`: Expo app. No release/deployment workflow is currently part of
  this plan.
- `apps/streams`: placeholder package with no runnable deployment script. The
  app currently relies on `DURABLE_STREAMS_URL`/`DURABLE_STREAMS_SECRET` as an
  external service contract instead of a repo-owned deployment.
- Homebrew tap bump: `bump-homebrew.yml` publishes CLI install metadata to
  `superset-sh/homebrew-tap`. If the self-host fork distributes CLI through a
  private tap, update or disable this workflow.

Production `deploy-production.yml` already contains a `deploy-electric-proxy`
job. The required change is to verify its Cloudflare secrets/env contract and
include it in release sequencing and smoke checks, not to create a second
Electric deployment pipeline.

## Release Model

Use one promoted commit as the source of truth.

1. PR runs `ci.yml` and, when relevant, `deploy-preview.yml`.
2. Merge to the self-host release branch, preferably `main` in the private fork
   or a dedicated `self-host/main` if upstream sync remains active.
3. `deploy-production.yml` runs database migrations, deploys API/web, deploys
   Electric, deploys or triggers relay, and runs smoke checks.
4. After API/web/relay/Electric are live, cut release tags from the same
   commit:
   - `cli-vX.Y.Z` for CLI.
   - `desktop-vX.Y.Z` for desktop.
5. Existing CLI and desktop release workflows build artifacts with the same
   production URLs that were just deployed.

Keep CLI and desktop release as tag-driven workflows. This preserves the
existing release/update mechanisms and avoids coupling long macOS/Linux release
builds directly to every web/API deploy.

## Required Workflow Changes

### `ci.yml`

Keep the current jobs. Add one lightweight env-contract job before build jobs:

- Validate the repository has all required production/preview secret names.
- Validate URL-shaped variables are syntactically valid.
- Validate desktop/CLI release URL variables are present:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_WEB_URL`
  - `NEXT_PUBLIC_ELECTRIC_URL`
  - `RELAY_URL`
  - `SUPERSET_API_URL`
  - `SUPERSET_WEB_URL`

Do not print secret values. The job should only print missing variable names.

### `deploy-preview.yml`

Reuse the current preview workflow.

Changes:

- Keep Neon branch creation and cleanup.
- Keep API and web preview deploys.
- Stop making marketing/admin/docs required for the self-host path. Gate those
  jobs behind repository variables such as `DEPLOY_MARKETING_PREVIEWS`,
  `DEPLOY_ADMIN_PREVIEWS`, and `DEPLOY_DOCS_PREVIEWS`, defaulting to disabled
  for the self-host fork.
- Add `NEXT_PUBLIC_ELECTRIC_URL` and preview `RELAY_URL` to API/web env where
  code expects them.
- For OAuth preview URLs, use allowlisted preview aliases rather than relaxed
  CORS/CSRF.

### `deploy-production.yml`

Reuse this workflow as the production deployment pipeline.

Changes:

- Keep `deploy-database` first, using `DATABASE_URL_UNPOOLED` for migrations.
- Keep `deploy-api` and `deploy-web`.
- Gate marketing/admin/docs jobs, or remove them from the self-host fork if they
  are not part of the release surface.
- Keep and verify the existing `deploy-electric-proxy` job using the
  `apps/electric-proxy` package and `wrangler deploy`.
- Keep relay deployment lightweight. Because the relay changes less often, do
  not build a full image-push pipeline unless Coolify's Git deploy is
  unreliable. Trigger the existing Coolify app by CLI or deploy hook when relay
  code or relay env changes.
- Add a post-deploy smoke job that checks:
  - API health/auth endpoint responds on `NEXT_PUBLIC_API_URL`.
  - Web responds on `NEXT_PUBLIC_WEB_URL`.
  - Relay `/health` responds on `RELAY_URL`.
  - Electric proxy responds on `NEXT_PUBLIC_ELECTRIC_URL`.

### `apps/relay` Coolify Release

Relay must be released from the same commit as API/web/desktop/CLI URL changes.

Preferred reuse path:

- Keep the existing `apps/relay/Dockerfile`.
- Let Coolify build from the Git repository when the release branch is updated,
  or trigger a Coolify deploy from the local/CI Coolify CLI.
- If Coolify cannot reliably build from the monorepo, add a production workflow
  step that builds the Docker image with context at repo root and Dockerfile
  `apps/relay/Dockerfile`, pushes it to GHCR, then calls the Coolify webhook to
  pull the new image.

Current observed Coolify relay app:

- Resource name: `superset-relay`
- Resource type: application
- Dockerfile: `/apps/relay/Dockerfile`
- Exposed port: `8080`
- Health path: `/health`
- Public URL: `RELAY_URL`

Manual relay deploy from this Mac:

```bash
coolify deploy name superset-relay --context hevo
```

Use `--force` if Coolify does not detect a new commit:

```bash
coolify deploy name superset-relay --context hevo --force
```

If the self-host release branch changes, update the app branch before
deploying:

```bash
coolify app update <relay-app-uuid> --context hevo --git-branch <release-branch>
coolify deploy name superset-relay --context hevo
```

Optional CI automation is small if needed later:

- Add a production secret containing a Coolify API token.
- Install or download the Coolify CLI in `deploy-production.yml`.
- Run `coolify deploy name superset-relay --context <context>`.
- Poll deployment status or validate `RELAY_URL/health`.

Until relay changes frequently, keeping this as a manual release step plus
automated smoke check is acceptable.

Required relay production env:

- `RELAY_PORT`
- `RELAY_PUBLIC_URL`
- `NEXT_PUBLIC_API_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `FLY_REGION` or a stable self-host region label such as `coolify`
- `FLY_MACHINE_ID` or a stable instance id such as `relay-1`
- Optional `RELAY_SENTRY_DSN`

Relay release validation:

- `curl "$RELAY_URL/health"` returns success.
- API can verify relay-issued host URLs against the same `NEXT_PUBLIC_API_URL`.
- Desktop can resolve a remote host URL using the released `RELAY_URL`.

### `apps/electric-proxy` Cloudflare Worker Release

Electric proxy must also be released before desktop artifacts are published,
because the desktop app bakes `NEXT_PUBLIC_ELECTRIC_URL` at build time.

Preferred reuse path:

- Use the existing `apps/electric-proxy` package and `wrangler.jsonc`.
- Keep the existing `deploy-electric-proxy` job in `deploy-production.yml`.
- The job should install dependencies, run `bun --cwd apps/electric-proxy
  typecheck`, set Cloudflare Worker secrets if needed, and run `bun --cwd
  apps/electric-proxy deploy`.

Required Cloudflare production env/secrets:

- `AUTH_URL`, set to the production API URL.
- Optional, depending on the final Electric backend:
  - `ELECTRIC_SHAPE_URL`
  - `ELECTRIC_SECRET`
  - `ELECTRIC_SOURCE_ID`
  - `ELECTRIC_SOURCE_SECRET`

Electric release validation:

- Worker route responds at `NEXT_PUBLIC_ELECTRIC_URL`.
- Desktop collection requests can reach `${NEXT_PUBLIC_ELECTRIC_URL}/v1/shape`.
- Auth calls from the Worker target the released API URL, not upstream Superset.

### `release-cli.yml` and `build-cli.yml`

Reuse both workflows.

Changes:

- In `build-cli.yml`, source all release URLs from one consistent place:
  - `RELAY_URL` from secrets or vars.
  - `SUPERSET_API_URL` from vars/secrets and equal to `NEXT_PUBLIC_API_URL`.
  - `SUPERSET_WEB_URL` from vars/secrets and equal to `NEXT_PUBLIC_WEB_URL`.
- Add a pre-build assertion that fails if any of those still point to
  `superset.sh` production defaults.
- Keep the smoke tests already present.
- Keep the rolling `cli-latest` release because the updater path depends on it.

### `release-desktop.yml` and `build-desktop.yml`

Reuse both workflows.

Changes:

- Ensure every desktop build receives:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_WEB_URL`
  - `NEXT_PUBLIC_MARKETING_URL`
  - `NEXT_PUBLIC_DOCS_URL`
  - `NEXT_PUBLIC_ELECTRIC_URL`
  - `RELAY_URL`
  - `SUPERSET_API_URL`
  - `SUPERSET_WEB_URL`
- Add a pre-build assertion that blocks release if desktop defaults would bake
  in `https://api.superset.sh`, `https://app.superset.sh`,
  `https://relay.superset.sh`, or the upstream Electric proxy URL.
- Keep signing/notarization secrets isolated to the production GitHub
  environment.
- Keep the release as draft until the smoke checks and manual install test pass.

## Environment Variable Contract

The local `.env` currently contains the needed categories for Neon, Vercel
URLs, Google OAuth, Linear, Upstash/KV, QStash, Stripe, PostHog, GitHub, and
relay. Do not copy values into documentation or workflow logs.

### GitHub Actions Repository Variables

Use variables for non-secret deployment coordinates:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_DOCS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_ELECTRIC_URL`
- `NEXT_PUBLIC_COOKIE_DOMAIN`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- `SUPERSET_API_URL`
- `SUPERSET_WEB_URL`
- `RELAY_URL` if the relay URL is not considered sensitive
- `NEON_PROJECT_ID`
- Optional deployment gates:
  - `DEPLOY_MARKETING`
  - `DEPLOY_ADMIN`
  - `DEPLOY_DOCS`

### GitHub Actions Secrets

Use secrets for credentials:

- Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_API_PROJECT_ID`,
  `VERCEL_WEB_PROJECT_ID`.
- Neon: `NEON_API_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
- Upstash/KV: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_URL`.
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Linear: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`,
  `LINEAR_WEBHOOK_SECRET`.
- Better Auth/session: `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_COOKIE_DOMAIN`.
- QStash: `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`.
- Encryption/storage: `SECRETS_ENCRYPTION_KEY`, `BLOB_READ_WRITE_TOKEN`.
- Optional services currently required by env validation unless relaxed:
  `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_KEY`,
  `NEXT_PUBLIC_POSTHOG_HOST`, `RESEND_API_KEY`, Stripe keys, Slack keys,
  GitHub App keys, `ANTHROPIC_API_KEY`, Durable Streams, Sentry.
- Desktop signing: `MAC_CERTIFICATE`, `MAC_CERTIFICATE_PASSWORD`, `APPLE_ID`,
  `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`.
- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, plus Worker
  secrets for Electric if required.
- Relay deploy hook or registry credentials, depending on the chosen relay host.

### App-Specific Runtime Needs

API:

- Requires database, auth, OAuth providers, Linear, QStash, KV, Stripe, Slack,
  GitHub App, Durable Streams, relay URL, and optional Sentry/Tavily/PostHog.
- Current `apps/api/src/env.ts` is strict. Either provide all values in CI or
  explicitly make unused integrations optional behind feature flags.

Web:

- Requires database, auth, KV, Stripe, Resend, Anthropic, PostHog, public API/web
  URLs, marketing/docs URLs, and optional Sentry.

Relay:

- Requires `NEXT_PUBLIC_API_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
  `RELAY_PUBLIC_URL`, and `RELAY_PORT`.

Electric proxy:

- Requires `AUTH_URL`.
- May require `ELECTRIC_SHAPE_URL`, `ELECTRIC_SECRET`,
  `ELECTRIC_SOURCE_ID`, and `ELECTRIC_SOURCE_SECRET` depending on the final
  Electric backend configuration.

CLI:

- Build-time release URL contract is `RELAY_URL`, `SUPERSET_API_URL`, and
  `SUPERSET_WEB_URL`.

Desktop:

- Build-time URL contract is `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`,
  `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_DOCS_URL`,
  `NEXT_PUBLIC_ELECTRIC_URL`, `RELAY_URL`, plus optional analytics/Sentry.

## Hardcoded Default Cleanup

Before enabling automated releases, remove or guard hardcoded upstream defaults
from release builds:

- `apps/desktop/src/main/env.main.ts`
- `apps/desktop/src/renderer/env.renderer.ts`
- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/vite/helpers.ts`
- `apps/desktop/electron-builder.ts`
- `apps/desktop/electron-builder.canary.ts`

For release builds, missing URLs should fail the build instead of falling back
to upstream Superset services.

For Electron updater config, decide whether releases stay in the upstream GitHub
repository or move to a private fork. If private, update `publish.owner` and
`publish.repo` in both Electron builder configs.

## Secret Bootstrap Automation

Use a local, one-shot bootstrap script rather than a CI workflow that reads
cloud provider credentials and rewrites GitHub secrets.

Recommended script behavior:

- Read local `.env`.
- Validate required keys exist.
- Run `gh secret set` and `gh variable set` for the selected GitHub
  environment.
- Never echo values.
- Optionally verify Neon and Upstash connectivity with provider CLIs.

Do not run migrations from this bootstrap script. Production migrations remain
owned by `deploy-production.yml`.

## Deployment Sequencing

Production release:

1. `ci.yml` passes.
2. `deploy-production.yml` runs:
   - database migrations
   - API deploy
   - web deploy
   - relay Docker deploy on Coolify, or a Coolify deploy-hook call
   - Electric proxy deploy on Cloudflare Workers
   - smoke checks
3. Create `cli-vX.Y.Z` tag from the deployed commit.
4. `release-cli.yml` builds and publishes `cli-vX.Y.Z` and `cli-latest`.
5. Create `desktop-vX.Y.Z` tag from the same commit.
6. `release-desktop.yml` builds signed artifacts and opens a draft release.
7. Manually install the draft desktop artifact once, verify login and remote host
   flow, then publish the release.

## Validation Checklist

Before the first automated self-host release:

- GitHub environment `production` has all required secrets and variables.
- Vercel API and web projects point at the correct monorepo apps.
- Google OAuth redirect URLs include API auth callback URLs.
- Linear OAuth redirect and webhook URLs point at the self-host API domain.
- Better Auth trusted origins are exact allowlists, not wildcard reflection.
- `NEXT_PUBLIC_COOKIE_DOMAIN` matches the shared parent domain if using sibling
  subdomains.
- Neon production branch is intentional and documented.
- Upstash/KV credentials are production credentials, not local placeholders.
- Desktop and CLI release builds fail if self-host URLs are missing.
- Relay Docker deployment is tied to the same production commit as API/web.
- Electric Worker deployment is tied to the same production commit as API/web.
- Smoke checks cover API, web, relay, Electric, CLI login, and desktop login.

## Implementation Order

1. Finalize safe divergence re-application on a fresh branch from latest
   upstream.
2. Add the env-contract validation script/job.
3. Harden API/web auth and CORS around explicit trusted origins.
4. Update production workflow to gate optional apps and deploy supporting
   services, including relay and Electric.
5. Update CLI/desktop build workflows to enforce self-host URL inputs.
6. Add local secret bootstrap script.
7. Run preview deployment and smoke test.
8. Run production deployment.
9. Cut CLI and desktop tags from the deployed commit.
