# MVP Environment Contract

Created: 2026-05-13

This is the tracked, redacted MVP environment contract for this self-hosted deployment. Raw local values belong in `plans/local/self-host-env-inventory.md`, which is gitignored. Do not add raw secrets, database credentials, private keys, or provider tokens to this tracked file.

## Canonical URLs

Every deployed service, build artifact, OAuth callback, webhook, Slack link, and email link should use these same URLs.

| Purpose | Variables | Value |
| --- | --- | --- |
| Web app | `NEXT_PUBLIC_WEB_URL`, `SUPERSET_WEB_URL` | `https://superset-mvp-web.vercel.app` |
| API app | `NEXT_PUBLIC_API_URL`, `SUPERSET_API_URL`, Electric `AUTH_URL` | `https://superset-mvp-api.vercel.app` |
| Relay | `RELAY_URL`, `RELAY_PUBLIC_URL` | `https://superset-relay.hevo.dev` |
| Electric proxy | `NEXT_PUBLIC_ELECTRIC_URL` | `https://electric-proxy.entbuddy12.workers.dev` |
| Admin | `NEXT_PUBLIC_ADMIN_URL` | `https://superset-mvp-web.vercel.app` |
| Marketing | `NEXT_PUBLIC_MARKETING_URL` | `https://superset-mvp-web.vercel.app` |
| Docs | `NEXT_PUBLIC_DOCS_URL` | `https://superset-mvp-web.vercel.app` |
| Desktop callback | `NEXT_PUBLIC_DESKTOP_URL` | `https://superset-mvp-web.vercel.app` |
| Cookie domain | `NEXT_PUBLIC_COOKIE_DOMAIN` | `superset-mvp-api.vercel.app` |

## One `.env` For MVP

Use this as the MVP source of truth across Vercel, Cloudflare, Coolify, CLI builds, desktop builds, and future GitHub Actions secrets/variables.

```dotenv
ANTHROPIC_API_KEY='<anthropic-api-key>'
BETTER_AUTH_SECRET='<better-auth-secret>'
BLOB_READ_WRITE_TOKEN='<blob-read-write-token>'

DATABASE_URL='<neon-pooled-database-url>'
DATABASE_URL_UNPOOLED='<neon-unpooled-database-url>'
NEON_API_KEY='<neon-api-key>'
NEON_ORG_ID='<neon-org-id>'
NEON_PROJECT_ID='<neon-project-id>'

NEXT_PUBLIC_API_URL='https://superset-mvp-api.vercel.app'
NEXT_PUBLIC_WEB_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_ADMIN_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_MARKETING_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_DOCS_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_DESKTOP_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_COOKIE_DOMAIN='superset-mvp-api.vercel.app'

SUPERSET_API_URL='https://superset-mvp-api.vercel.app'
SUPERSET_WEB_URL='https://superset-mvp-web.vercel.app'
SUPERSET_OAUTH_CLIENT_ID='<superset-oauth-client-id>'

NEXT_PUBLIC_ELECTRIC_URL='https://electric-proxy.entbuddy12.workers.dev'
RELAY_URL='https://superset-relay.hevo.dev'
RELAY_PUBLIC_URL='https://superset-relay.hevo.dev'

DURABLE_STREAMS_URL='https://superset-mvp-api.vercel.app'
DURABLE_STREAMS_SECRET='<durable-streams-secret>'

GOOGLE_CLIENT_ID='<google-client-id>'
GOOGLE_CLIENT_SECRET='<google-client-secret>'
GH_CLIENT_ID='<github-oauth-client-id>'
GH_CLIENT_SECRET='<github-oauth-client-secret>'
GH_APP_ID='<github-app-id>'
GH_APP_PRIVATE_KEY='<github-app-private-key>'
GH_WEBHOOK_SECRET='<github-webhook-secret>'

LINEAR_CLIENT_ID='<linear-client-id>'
LINEAR_CLIENT_SECRET='<linear-client-secret>'
LINEAR_WEBHOOK_SECRET='<linear-webhook-secret>'

SLACK_CLIENT_ID='<slack-client-id>'
SLACK_CLIENT_SECRET='<slack-client-secret>'
SLACK_SIGNING_SECRET='<slack-signing-secret>'
SLACK_BILLING_WEBHOOK_URL='<slack-billing-webhook-url>'

KV_REST_API_URL='<upstash-kv-rest-api-url>'
KV_REST_API_TOKEN='<upstash-kv-rest-api-token>'
KV_URL='<upstash-kv-url>'

QSTASH_TOKEN='<qstash-token>'
QSTASH_URL='https://qstash.upstash.io'
QSTASH_CURRENT_SIGNING_KEY='<qstash-current-signing-key>'
QSTASH_NEXT_SIGNING_KEY='<qstash-next-signing-key>'

RESEND_API_KEY='<resend-api-key>'
SECRETS_ENCRYPTION_KEY='<secrets-encryption-key>'

STRIPE_SECRET_KEY='<stripe-secret-key>'
STRIPE_WEBHOOK_SECRET='<stripe-webhook-secret>'
STRIPE_PRO_MONTHLY_PRICE_ID='<stripe-pro-monthly-price-id>'
STRIPE_PRO_YEARLY_PRICE_ID='<stripe-pro-yearly-price-id>'
STRIPE_ENTERPRISE_YEARLY_PRICE_ID='<stripe-enterprise-yearly-price-id>'

NEXT_PUBLIC_POSTHOG_KEY='<posthog-public-key>'
NEXT_PUBLIC_POSTHOG_HOST='https://us.i.posthog.com'
POSTHOG_API_KEY='<posthog-api-key>'
POSTHOG_PROJECT_ID='<posthog-project-id>'

NEXT_PUBLIC_SENTRY_ENVIRONMENT='production'
```

## Deploy Targets

### Vercel Web

App: `apps/web`

Required: the canonical URLs, Neon database URLs, Better Auth, Resend, KV, Stripe, Slack billing, Anthropic, PostHog, optional Sentry.

Build command:

```bash
bun run --cwd apps/web --env-file=../../.vercel/.env.production.local build
```

For MVP, `.vercel/.env.production.local` should be regenerated from the single `.env` contract above, not maintained as a second source of truth.

### Vercel API

App: `apps/api`

Required: the canonical URLs, Neon database URLs, OAuth/app credentials, Linear, Slack, GitHub App, QStash, KV, Durable Streams, Blob, Resend, Stripe, Secrets Encryption, Anthropic, PostHog, optional Sentry/Tavily.

Build command:

```bash
bun run --cwd apps/api --env-file=../../.vercel/.env.production.local build
```

### Cloudflare Electric Proxy

App: `apps/electric-proxy`

Worker public URL:

```dotenv
NEXT_PUBLIC_ELECTRIC_URL='https://electric-proxy.entbuddy12.workers.dev'
```

Worker secrets:

```dotenv
AUTH_URL='https://superset-mvp-api.vercel.app'
ELECTRIC_SHAPE_URL='<set from Electric service>'
ELECTRIC_SECRET='<set from Electric service>'
ELECTRIC_SOURCE_ID='<optional if using source credentials>'
ELECTRIC_SOURCE_SECRET='<optional if using source credentials>'
```

Deploy commands:

```bash
bun run --cwd apps/electric-proxy typecheck
bun run --cwd apps/electric-proxy deploy
```

Wrangler note: use the repo script above. It now calls `bunx wrangler`, which works with the repo-local Wrangler `4.78.0` and avoids the broken global Wrangler path that requires Node `>=22`.

### Relay on Coolify

App: `apps/relay`

Docker build context: repo root

Dockerfile:

```text
apps/relay/Dockerfile
```

Runtime environment:

```dotenv
NEXT_PUBLIC_API_URL='https://superset-mvp-api.vercel.app'
KV_REST_API_URL='https://upstash.local'
KV_REST_API_TOKEN='<upstash-kv-rest-api-token>'
RELAY_PORT='8080'
RELAY_PUBLIC_URL='https://superset-relay.hevo.dev'
FLY_REGION='coolify'
FLY_MACHINE_ID='coolify-primary'
```

Health check:

```text
/health
```

### CLI Build

Package: `packages/cli`

These values are baked into the CLI binary and must be present before building:

```dotenv
RELAY_URL='https://superset-relay.hevo.dev'
SUPERSET_API_URL='https://superset-mvp-api.vercel.app'
SUPERSET_WEB_URL='https://superset-mvp-web.vercel.app'
SUPERSET_OAUTH_CLIENT_ID='<superset-oauth-client-id>'
```

Build:

```bash
bun run --cwd packages/cli build:dist --target=darwin-arm64
```

### Desktop Build

App: `apps/desktop`

These values are baked into Electron/Vite and must be present before building:

```dotenv
NEXT_PUBLIC_API_URL='https://superset-mvp-api.vercel.app'
NEXT_PUBLIC_WEB_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_MARKETING_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_DOCS_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_ELECTRIC_URL='https://electric-proxy.entbuddy12.workers.dev'
RELAY_URL='https://superset-relay.hevo.dev'
SUPERSET_API_URL='https://superset-mvp-api.vercel.app'
SUPERSET_WEB_URL='https://superset-mvp-web.vercel.app'
NEXT_PUBLIC_POSTHOG_KEY='phc_local_dev'
NEXT_PUBLIC_POSTHOG_HOST='https://us.i.posthog.com'
```

Build:

```bash
bun run --cwd apps/desktop compile:app
bun run --cwd apps/desktop package -- --publish never --config electron-builder.ts
```

## Known Code Risks

These are the remaining places likely to route MVP users to upstream Superset if env values are missing or templates are not updated.

| Area | Risk |
| --- | --- |
| `packages/cli/cli.config.ts`, `packages/cli/src/lib/env.ts` | Fallbacks point to `api.superset.sh`, `app.superset.sh`, `relay.superset.sh` |
| `apps/desktop/src/main/env.main.ts`, `apps/desktop/src/renderer/env.renderer.ts`, `apps/desktop/electron.vite.config.ts`, `apps/desktop/vite/helpers.ts` | Fallbacks point to upstream Superset and an old Electric Worker |
| `apps/api/src/app/api/integrations/slack/manifest.json` | Slack manifest URLs point to `api.superset.sh` |
| Slack event handlers under `apps/api/src/app/api/integrations/slack/events/` | Slack links can point to `app.superset.sh` |
| Email templates under `packages/email/src/emails/` | Email links can point to `app.superset.sh` |
| `apps/relay/src/env.ts` | `RELAY_PUBLIC_URL` defaults to `https://relay.superset.sh`; set it explicitly |

## Final MVP Checks

Before deploying or building:

1. `SUPERSET_API_URL` equals `NEXT_PUBLIC_API_URL`.
2. `SUPERSET_WEB_URL` equals `NEXT_PUBLIC_WEB_URL`.
3. Electric Worker `AUTH_URL` equals `NEXT_PUBLIC_API_URL`.
4. `RELAY_PUBLIC_URL` equals `RELAY_URL`.
5. Vercel env contains `NEXT_PUBLIC_ELECTRIC_URL`.
6. CLI and desktop builds are run with the canonical URL variables loaded.
7. Slack manifest and email defaults are updated before enabling those flows.
