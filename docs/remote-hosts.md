# Remote Hosts And Deployment Operations

This file records remote-host access details and the operational CLIs expected
to be available for debugging and managing the self-host Superset deployment.

## Known Remote Hosts

### Remote Agent CI

- SSH target: `agent@remote-agent-ci`
- Connect:

```bash
ssh agent@remote-agent-ci
```

Use this host for remote-agent/remote-VM workflow inspection when debugging the
desktop remote-host management path.

## Deployment CLIs

Use provider CLIs to inspect real deployment state before assuming behavior
from local code.

```bash
gh --version
vercel --version
neon --version
wrangler --version
coolify --version
docker --version
```

Expected tools:

- `gh`: GitHub Actions, releases, PRs, repo variables, and workflow runs in the
  owner's GitHub repository.
- `vercel`: `apps/web` and `apps/api` deployments, logs, env, domains, and
  project linkage.
- `neon`: database projects, branches, connection info, and branch diagnostics.
- `wrangler`: Cloudflare Worker deployment and logs for `apps/electric-proxy`.
- Cloudflare tooling/API: DNS, account-level routing, and Worker route checks
  when Wrangler is not enough.
- `coolify`: relay Docker app deployment, logs, branch selection, and forced
  redeploys.
- `docker`: local relay image build and health-check debugging.
- `ssh`: host-level inspection on remote VMs.

## Safety Rules

- Do not touch production data unless explicitly asked and confirmed.
- Do not run database migrations directly unless the user explicitly asks.
- Prefer read-only checks first: status, logs, environment variable names,
  health endpoints, process lists, and deployment history.
- Record the exact provider, project, branch, and host touched when making
  deployment changes.

## Useful Starting Points

GitHub Actions:

```bash
gh run list --repo crystalphantom/superset --limit 20
gh release list --repo crystalphantom/superset --limit 20
```

Relay health:

```bash
curl "$RELAY_URL/health"
```

Coolify relay deploy:

```bash
coolify deploy name superset-relay --context hevo
```

Forced Coolify relay deploy:

```bash
coolify deploy name superset-relay --context hevo --force
```

Cloudflare Worker logs:

```bash
wrangler tail
```

Vercel deployment inspection:

```bash
vercel project ls
vercel env ls
vercel logs
```

Neon branch inspection:

```bash
neon branches list
```



Refer : [Self-host-env](../plans/local/self-host-env-inventory.md)
