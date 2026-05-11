# MVP Self-Hosted Deployment Plan

## Goal

Validate whether Superset fits the intended remote-host workflow before
investing in a fully private, scalable, or heavily refactored deployment.

This MVP prioritizes the fastest working setup using free-tier managed
services where possible. It intentionally avoids load, high availability,
multi-region relay routing, and replacing every third-party dependency.

## MVP Architecture

Use the existing deployment assumptions in the repo as much as possible:

- `apps/api` on Vercel
- `apps/web` on Vercel
- `apps/relay` as a single Docker container on Coolify or Fly
- Postgres on Neon
- Redis REST on Upstash
- `apps/electric-proxy` on Cloudflare Workers
- Custom-built CLI and desktop app pointing at the MVP URLs

Suggested domains:

```text
app.yourdomain.com       -> apps/web
api.yourdomain.com       -> apps/api
relay.yourdomain.com     -> apps/relay
electric.yourdomain.com  -> apps/electric-proxy
```

Optional apps for MVP:

- `apps/admin`: skip unless you need admin workflows immediately.
- `apps/marketing`: skip.
- `apps/docs`: skip.

## External Services

Use free tiers where possible:

- Neon: production Postgres database
- Vercel: API and web apps
- Upstash Redis: KV/Redis REST for API rate limits and relay directory
- Cloudflare Workers: Electric proxy
- Coolify on Azure VM: relay container, if you prefer to keep relay on your
  own server

This is not fully isolated, but it avoids Superset Cloud and proves whether
the product model works for your use case.

## Deployment Steps

### 1. Create Domains

Create DNS records for:

```text
app.yourdomain.com
api.yourdomain.com
relay.yourdomain.com
electric.yourdomain.com
```

Let Vercel manage TLS for `app` and `api`.
Let Coolify or Fly manage TLS for `relay`.
Let Cloudflare manage TLS for `electric`.

### 2. Create Neon Database

Create a Neon project and collect:

```bash
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
```

Run migrations from the repo:

```bash
DATABASE_URL_UNPOOLED="postgres://..." \
DATABASE_URL="postgres://..." \
bun --cwd packages/db drizzle-kit migrate
```

### 3. Create Upstash Redis

Create an Upstash Redis database and collect:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_URL=...
```

For the MVP, use the same Upstash instance for API KV usage and relay tunnel
directory usage.

### 4. Deploy API To Vercel

Create a Vercel project for `apps/api`.

Use build settings equivalent to:

```bash
bun install --frozen-lockfile
bun --cwd apps/api build
```

Set the Vercel root/package to `apps/api` if using Vercel's monorepo
settings.

Important environment variables:

```bash
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WEB_URL=https://app.yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://app.yourdomain.com
NEXT_PUBLIC_DESKTOP_URL=https://app.yourdomain.com
NEXT_PUBLIC_COOKIE_DOMAIN=.yourdomain.com
RELAY_URL=https://relay.yourdomain.com

BETTER_AUTH_SECRET=generate-a-long-random-secret
SECRETS_ENCRYPTION_KEY=generate-a-long-random-secret

KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_URL=...
```

The current `apps/api/src/env.ts` validates many integrations. For MVP, either
provide placeholder/free-tier values for unused services or temporarily relax
validation for features you are not testing.

Keep OAuth simple for MVP:

- Configure GitHub OAuth if you want GitHub repo/PR workflows.
- Configure Google OAuth only if you need Google sign-in.

### 5. Deploy Web To Vercel

Create a Vercel project for `apps/web`.

Important environment variables:

```bash
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WEB_URL=https://app.yourdomain.com
NEXT_PUBLIC_MARKETING_URL=https://app.yourdomain.com
NEXT_PUBLIC_DOCS_URL=https://app.yourdomain.com
BETTER_AUTH_SECRET=same-value-as-api

KV_REST_API_URL=...
KV_REST_API_TOKEN=...
RESEND_API_KEY=placeholder-or-real
STRIPE_SECRET_KEY=placeholder-or-real
STRIPE_WEBHOOK_SECRET=placeholder-or-real
```

As with the API, relax validation or provide placeholders for features outside
the MVP.

### 6. Deploy Relay

Use one relay instance only for MVP.

Coolify option:

```text
Build type: Dockerfile
Dockerfile: apps/relay/Dockerfile
Build context: repo root
Port: 8080
Health check: /health
Domain: https://relay.yourdomain.com
```

Relay environment:

```bash
RELAY_PORT=8080
RELAY_PUBLIC_URL=https://relay.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
FLY_REGION=coolify
FLY_MACHINE_ID=relay-1
```

Do not scale the relay to multiple replicas during MVP. Many remote hosts can
connect to a single relay instance.

Validate:

```bash
curl https://relay.yourdomain.com/health
```

Expected:

```json
{"ok":true,"region":"coolify"}
```

### 7. Deploy Electric Proxy

Deploy `apps/electric-proxy` to Cloudflare Workers.

Set Worker environment variables based on `apps/electric-proxy/src/types.ts`
and the current worker code. The important values are:

```bash
AUTH_URL=https://api.yourdomain.com
DATABASE_URL=...
```

Expose it at:

```text
https://electric.yourdomain.com
```

This powers the desktop app's live synced collections. Skipping it may make the
desktop UI incomplete even if API calls work.

### 8. Build CLI For Remote Hosts

Build the CLI with MVP URLs baked in:

```bash
RELAY_URL=https://relay.yourdomain.com \
SUPERSET_API_URL=https://api.yourdomain.com \
SUPERSET_WEB_URL=https://app.yourdomain.com \
bun --cwd packages/cli run build:dist --target=linux-x64
```

Install the generated CLI bundle on each remote host.

On each remote host:

```bash
superset auth login
superset start --daemon
superset status
```

### 9. Build Desktop App

Build desktop with the MVP URLs:

```bash
RELAY_URL=https://relay.yourdomain.com \
NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
NEXT_PUBLIC_WEB_URL=https://app.yourdomain.com \
NEXT_PUBLIC_ELECTRIC_URL=https://electric.yourdomain.com \
bun --cwd apps/desktop run build
```

Use this desktop build to sign in, list hosts, and open remote workspaces.

### 10. Validate MVP Workflow

Validate only the core use case:

1. Sign in through your self-hosted web/API.
2. Start one remote host with the custom CLI.
3. Confirm it appears in host list.
4. Create or import a project.
5. Create a workspace on the remote host.
6. Open it from desktop.
7. Test terminal access, file tree, git status, and agent execution.

Useful commands:

```bash
superset hosts list
superset projects list
superset workspaces list --host <host-id>
superset workspaces create --host <host-id> --project <project-id> --name mvp-test --branch mvp-test
```

## MVP Success Criteria

The MVP is useful if:

- A remote host can connect through your relay.
- Desktop can discover that host.
- Workspaces can be created and opened remotely.
- Terminal and file operations work reliably enough for real tasks.
- Agent CLI execution works on the remote host.
- The security model feels acceptable after reviewing what data leaves your
  infrastructure and which managed services are still involved.

## Defer Until After Validation

Do not spend time on these yet:

- Multi-replica relay
- Self-hosted Redis replacement for Upstash REST
- Replacing Vercel Blob, QStash, Durable Streams, Stripe, PostHog, or Sentry
- Azure Container Apps or AKS production hardening
- Full CI/CD rewrite
- Marketing/docs/admin deployment
- High availability and disaster recovery
- Performance tuning

## If MVP Passes

Next phase options:

1. Move relay to a more controlled Azure deployment.
2. Replace Upstash REST with normal Redis support.
3. Remove or make optional unused SaaS integrations.
4. Add Dockerfiles for `apps/api` and `apps/web`.
5. Build a single self-host deployment bundle with compose or Kubernetes.
6. Add private CI/CD for API, web, relay, CLI, and desktop builds.
