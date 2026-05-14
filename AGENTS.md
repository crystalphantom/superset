# Superset Monorepo Guide

You're running inside a Superset workspace — an isolated git-worktree copy of this repo. "Workspace" in any user message refers to this, not VS Code/editor workspaces.

## Question Tool

When you need to ask the user ANY question — including simple yes/no, confirmations, and clarifications — ALWAYS use the `ask_user` tool. Never ask questions in plain text. The Superset UI renders `ask_user` calls as an interactive overlay with clickable option buttons; plain-text questions will not be surfaced to the user in the same way.

Guidelines for agents and developers working in this repository.

## Project Context

This workspace started as the open-source Superset project from the
`superset.sh` team, but it is being adapted for the owner's own use cases.
Expect significant product, deployment, and workflow changes that may diverge
from upstream.

The primary customization goal is remote-host management. The owner runs
multiple remote VMs and is using the current Superset desktop app as the
control surface for managing those hosts, remote workspaces, terminal/file/git
access, and agent execution. Treat this as a major product direction when
making architectural or UX decisions.

## Git Remotes And Branch Context

This workspace uses two GitHub remotes:

- `origin` points to the original upstream project:
  `https://github.com/superset-sh/superset.git`
- `cp` points to the owner's fork/repository:
  `git@cp:crystalphantom/superset.git`

Run CI/CD, releases, and GitHub Actions from the owner's GitHub repository, not
from the upstream project. The package download instructions in
`docs/download-packages.md` currently use releases from
`crystalphantom/superset`.

Desktop auto-updates and desktop release tooling should use
`crystalphantom/superset` release assets. The local release helper defaults to
the `cp` git remote and the owner repo; do not push desktop release tags to the
upstream `origin` remote unless explicitly asked.

Always check the active branch before making or summarizing changes. At the
time this context was added, the active branch was `feat/bypass-paywall`; do
not assume that remains true in later sessions.

Preferred branch model:

- `main` should remain the upstream/original source-of-truth branch.
- `dev` should be treated as the owner's primary product branch for active
  customization, CI, deployments, and release tags.
- Cut owner CLI/desktop release tags from `dev` unless explicitly instructed
  otherwise.
- Do not retarget CI/CD back to upstream `main` without confirming the intended
  branch model.

## Deployment Context

Follow the original Superset deployment configuration unless the task
explicitly changes it. The current MVP/self-host deployment context is
documented in `plans/mvp-self-host-deployment.md`:

- `apps/web` deploys to Vercel.
- `apps/api` deploys to Vercel.
- `apps/relay` is prepared and deployed as a Docker image.
- `apps/electric-proxy` deploys to Cloudflare Workers via Wrangler.
- Postgres runs on Neon.
- Upstash Redis is used for the MVP Redis/KV needs.
- Custom CLI and desktop builds should point at the owner's deployed MVP URLs.

Keep the remote-host workflow central when evaluating deployment changes: the
critical path is remote VMs connecting through the relay, desktop discovering
those hosts, and users opening/managing remote workspaces from desktop.

Operational references:

- Current self-host divergence tracker:
  `plans/self-host-divergence-notes.md`
- Self-host CI/CD deployment plan:
  `plans/self-host-cicd-deployment-plan.md`
- Remote host access and operations notes:
  `docs/remote-hosts.md`

Use the installed provider CLIs to discover, debug, and manage remote
deployments when possible. Prefer CLI/API inspection over guessing from code or
stale docs:

- `gh` for owner-repo GitHub Actions, releases, PRs, issues, and repo
  variables/secrets metadata.
- `vercel` for `apps/web` and `apps/api` project linkage, env inspection,
  deployments, domains, and logs.
- `neon` for Neon projects, branches, connection strings, and database
  diagnostics. Never touch production data or run migrations unless explicitly
  asked and confirmed.
- `wrangler` for Cloudflare Workers, especially `apps/electric-proxy` deploys,
  logs, secrets, routes, and environment inspection.
- Cloudflare account tooling/API may also be used for DNS, Worker routes, and
  account-level checks when Wrangler does not expose the needed detail.
- `coolify` for relay deployment management, especially the `superset-relay`
  Docker app, deploy status, logs, branch selection, and forced redeploys.
- `docker` for local relay image builds, container health checks, and image
  debugging.
- `ssh` for remote VM/host inspection when host-level state matters.

For remote hosts, start from read-only diagnostics (`status`, `logs`, `env`
shape, process lists, health checks) before changing services. Be explicit in
summaries about which provider/project/branch/host was inspected or changed.

## Structure

Bun + Turbo monorepo with:
- **Apps**:
  - `apps/web` - Main web application (app.superset.sh)
  - `apps/marketing` - Marketing site (superset.sh)
  - `apps/admin` - Admin dashboard
  - `apps/api` - API backend
  - `apps/desktop` - Electron desktop application
  - `apps/docs` - Documentation site
  - `apps/mobile` - React Native mobile app (Expo)
- **Packages**:
  - `packages/ui` - Shared UI components (shadcn/ui + TailwindCSS v4).
    - Add components: `npx shadcn@latest add <component>` (run in `packages/ui/`)
  - `packages/db` - Drizzle ORM database schema
  - `packages/auth` - Authentication
  - `packages/trpc` - Shared tRPC definitions
  - `packages/shared` - Shared utilities
  - `packages/mcp` - MCP integration
  - `packages/desktop-mcp` - Desktop MCP server
  - `packages/local-db` - Local SQLite database
  - `packages/durable-session` - Durable session management
  - `packages/email` - Email templates/sending
  - `packages/scripts` - CLI tooling
- **Tooling**:
  - `tooling/typescript` - Shared TypeScript configs

## Tech Stack

- **Package Manager**: Bun (no npm/yarn/pnpm)
- **Build System**: Turborepo
- **Database**: Drizzle ORM + Neon PostgreSQL
- **UI**: React + TailwindCSS v4 + shadcn/ui
- **Code Quality**: Biome (formatting + linting at root)
- **Next.js**: Version 16 - NEVER create `middleware.ts`. Next.js 16 renamed middleware to `proxy.ts`. Always use `proxy.ts` for request interception.

## Common Commands

```bash
# Development
bun dev                    # Start all dev servers
bun test                   # Run tests
bun build                  # Build all packages

# Code Quality
bun run lint               # Check for lint issues (no changes)
bun run lint:fix           # Fix auto-fixable lint issues
bun run format             # Format code only
bun run format:check       # Check formatting only (CI)
bun run typecheck          # Type check all packages

# Maintenance
bun run clean              # Clean root node_modules
bun run clean:workspaces   # Clean all workspace node_modules
```

## Code Quality

**Biome runs at root level** (not per-package) for speed:
- `biome check --write --unsafe` = format + lint + organize imports + fix all auto-fixable issues
- `biome check` = check only (no changes)
- `biome format` = format only
- Use `bun run lint:fix` to fix all issues automatically

## Agent Rules
1. **Type safety** - avoid `any` unless necessary
2. **Prefer `gh` CLI** - when performing git operations (PRs, issues, checkout, etc.), prefer the GitHub CLI (`gh`) over raw `git` commands where possible
3. **Shared command source** - keep command definitions in `.agents/commands/` only. `.claude/commands` and `.cursor/commands` should be symlinks to `../.agents/commands`. (`packages/chat` discovers slash commands from `.claude/commands`.)
4. **Workspace MCP config** - keep shared MCP servers in `.mcp.json`; `.cursor/mcp.json` should link to `../.mcp.json`. Codex uses `.codex/config.toml` (run with `CODEX_HOME=.codex codex ...`). OpenCode uses `opencode.json` and should mirror the same MCP set using OpenCode's `remote`/`local` schema.
5. **Mastra dependencies** - use the published upstream `mastracode` and `@mastra/*` packages. Do not add fork tarball overrides or custom patch steps unless explicitly requested.
6. **Plan & doc placement** - implementation plans go in `plans/` (cross-cutting) or `apps/<app>/plans/` (app-scoped); shipped plans move to `plans/done/`. Architecture/reference docs go in `<app>/docs/`. Never drop `*_PLAN.md` at an app root or inside `src/`.
7. **Always fix lint warnings before pushing** - CI fails on Biome warnings, not just errors (the lint script treats warnings as errors). Run `bun run lint:fix` after edits and verify `bun run lint` exits 0 before `git push`. Never push code that produces lint output, even auto-fixable formatting.


---

## Project Structure

All projects in this repo should be structured like this:

```
app/
├── page.tsx
├── dashboard/
│   ├── page.tsx
│   ├── components/
│   │   └── MetricsChart/
│   │       ├── MetricsChart.tsx
│   │       ├── MetricsChart.test.tsx      # Tests co-located
│   │       ├── index.ts
│   │       └── constants.ts
│   ├── hooks/                             # Hooks used only in dashboard
│   │   └── useMetrics/
│   │       ├── useMetrics.ts
│   │       ├── useMetrics.test.ts
│   │       └── index.ts
│   ├── utils/                             # Utils used only in dashboard
│   │   └── formatData/
│   │       ├── formatData.ts
│   │       ├── formatData.test.ts
│   │       └── index.ts
│   ├── stores/                            # Stores used only in dashboard
│   │   └── dashboardStore/
│   │       ├── dashboardStore.ts
│   │       └── index.ts
│   └── providers/                         # Providers for dashboard context
│       └── DashboardProvider/
│           ├── DashboardProvider.tsx
│           └── index.ts
└── components/
    ├── Sidebar/
    │   ├── Sidebar.tsx
    │   ├── Sidebar.test.tsx               # Tests co-located
    │   ├── index.ts
    │   ├── components/                    # Used 2+ times IN Sidebar
    │   │   └── SidebarButton/             # Shared by SidebarNav + SidebarFooter
    │   │       ├── SidebarButton.tsx
    │   │       ├── SidebarButton.test.tsx
    │   │       └── index.ts
    │   ├── SidebarNav/
    │   │   ├── SidebarNav.tsx
    │   │   └── index.ts
    │   └── SidebarFooter/
    │       ├── SidebarFooter.tsx
    │       └── index.ts
    └── HeroSection/
        ├── HeroSection.tsx
        ├── HeroSection.test.tsx           # Tests co-located
        ├── index.ts
        └── components/                    # Used ONLY by HeroSection
            └── HeroCanvas/
                ├── HeroCanvas.tsx
                ├── HeroCanvas.test.tsx
                ├── HeroCanvas.stories.tsx
                ├── index.ts
                └── config.ts

components/                                # Used in 2+ pages (last resort)
└── Header/
```

1. **One folder per component**: `ComponentName/ComponentName.tsx` + `index.ts` for barrel export
2. **Co-locate by usage**: If used once, nest under parent's `components/`. If used 2+ times, promote to **highest shared parent's** `components/` (or `components/` as last resort)
3. **One component per file**: No multi-component files
4. **Co-locate dependencies**: Utils, hooks, constants, config, tests, stories live next to the file using them

### Exception: shadcn/ui Components

The `src/components/ui/` and `src/components/ai-elements` directories contain shadcn/ui components. These use **kebab-case single files** (e.g., `button.tsx`, `base-node.tsx`) instead of the folder structure above. This is intentional—shadcn CLI expects this format for updates via `bunx shadcn@latest add`.

## Database Rules

** IMPORTANT ** - Never touch the production database unless explicitly asked to. Even then, confirm with the user first.

- Schema in `packages/db/src/`
- Use Drizzle ORM for all database operations

## DB migrations
- Always spin up a new neon branch to create migrations. Update our root .env files to point at the neon branch locally.
- Use drizzle to manage the migration. You can see the schema at packages/db/src/schema. Never run a migration yourself.
- Create migrations by changing drizzle schema then running `bunx drizzle-kit generate --name="<sample_name_snake_case>"`
- `NEON_ORG_ID` and `NEON_PROJECT_ID` env vars are set in .env
- list_projects tool requires org_id passed in
- **NEVER manually edit files in `packages/db/drizzle/`** - this includes `.sql` migration files, `meta/_journal.json`, and snapshot files. These are auto-generated by Drizzle. If you need to create a migration, only modify the schema files in `packages/db/src/schema/` and ask the user to run `drizzle-kit generate`.



Refer : [Self-host-env](../plans/local/self-host-env-inventory.md)
