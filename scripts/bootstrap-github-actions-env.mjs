#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = new Map();
let apply = false;

for (let index = 2; index < process.argv.length; index += 1) {
	const arg = process.argv[index];
	if (arg === "--apply") {
		apply = true;
		continue;
	}
	if (arg.startsWith("--")) {
		const value = process.argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new Error(`Missing value for ${arg}`);
		}
		args.set(arg.slice(2), value);
		index += 1;
	}
}

const repo = args.get("repo") ?? "crystalphantom/superset";
const envFile = args.get("env-file") ?? ".env";

function parseEnvFile(path) {
	if (!existsSync(path)) return new Map();

	const parsed = new Map();
	for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const equalsIndex = line.indexOf("=");
		if (equalsIndex === -1) continue;

		const key = line.slice(0, equalsIndex).trim();
		let value = line.slice(equalsIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		parsed.set(key, value);
	}

	return parsed;
}

function readVercelProject(path) {
	if (!existsSync(path)) return {};
	return JSON.parse(readFileSync(path, "utf8"));
}

const values = parseEnvFile(envFile);
const apiVercelProject = readVercelProject("apps/api/.vercel/project.json");
const webVercelProject = readVercelProject("apps/web/.vercel/project.json");

function setDefault(key, value) {
	if (!values.has(key) && value) values.set(key, value);
}

setDefault("VERCEL_ORG_ID", apiVercelProject.orgId ?? webVercelProject.orgId);
setDefault("VERCEL_API_PROJECT_ID", apiVercelProject.projectId);
setDefault("VERCEL_WEB_PROJECT_ID", webVercelProject.projectId);
setDefault("DEPLOY_MARKETING", "false");
setDefault("DEPLOY_ADMIN", "false");
setDefault("DEPLOY_DOCS", "false");
setDefault("DEPLOY_MARKETING_PREVIEWS", "false");
setDefault("DEPLOY_ADMIN_PREVIEWS", "false");
setDefault("DEPLOY_DOCS_PREVIEWS", "false");

const variableNames = [
	"NEXT_PUBLIC_API_URL",
	"NEXT_PUBLIC_WEB_URL",
	"NEXT_PUBLIC_MARKETING_URL",
	"NEXT_PUBLIC_DOCS_URL",
	"NEXT_PUBLIC_ADMIN_URL",
	"NEXT_PUBLIC_ELECTRIC_URL",
	"NEXT_PUBLIC_COOKIE_DOMAIN",
	"NEXT_PUBLIC_SENTRY_ENVIRONMENT",
	"SUPERSET_API_URL",
	"SUPERSET_WEB_URL",
	"RELAY_URL",
	"NEON_PROJECT_ID",
	"DEPLOY_MARKETING",
	"DEPLOY_ADMIN",
	"DEPLOY_DOCS",
	"DEPLOY_MARKETING_PREVIEWS",
	"DEPLOY_ADMIN_PREVIEWS",
	"DEPLOY_DOCS_PREVIEWS",
];

const secretNames = [
	"VERCEL_TOKEN",
	"VERCEL_ORG_ID",
	"VERCEL_API_PROJECT_ID",
	"VERCEL_WEB_PROJECT_ID",
	"VERCEL_MARKETING_PROJECT_ID",
	"VERCEL_ADMIN_PROJECT_ID",
	"VERCEL_DOCS_PROJECT_ID",
	"NEON_API_KEY",
	"DATABASE_URL",
	"DATABASE_URL_UNPOOLED",
	"KV_REST_API_URL",
	"KV_REST_API_TOKEN",
	"KV_URL",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"GH_CLIENT_ID",
	"GH_CLIENT_SECRET",
	"LINEAR_CLIENT_ID",
	"LINEAR_CLIENT_SECRET",
	"LINEAR_WEBHOOK_SECRET",
	"SLACK_CLIENT_ID",
	"SLACK_CLIENT_SECRET",
	"SLACK_SIGNING_SECRET",
	"BETTER_AUTH_SECRET",
	"NEXT_PUBLIC_COOKIE_DOMAIN",
	"QSTASH_TOKEN",
	"QSTASH_URL",
	"QSTASH_CURRENT_SIGNING_KEY",
	"QSTASH_NEXT_SIGNING_KEY",
	"SECRETS_ENCRYPTION_KEY",
	"BLOB_READ_WRITE_TOKEN",
	"POSTHOG_API_KEY",
	"POSTHOG_PROJECT_ID",
	"NEXT_PUBLIC_POSTHOG_KEY",
	"NEXT_PUBLIC_POSTHOG_HOST",
	"RESEND_API_KEY",
	"STRIPE_SECRET_KEY",
	"STRIPE_WEBHOOK_SECRET",
	"STRIPE_PRO_MONTHLY_PRICE_ID",
	"STRIPE_PRO_YEARLY_PRICE_ID",
	"STRIPE_ENTERPRISE_YEARLY_PRICE_ID",
	"SLACK_BILLING_WEBHOOK_URL",
	"ANTHROPIC_API_KEY",
	"GH_APP_ID",
	"GH_APP_PRIVATE_KEY",
	"GH_WEBHOOK_SECRET",
	"DURABLE_STREAMS_URL",
	"DURABLE_STREAMS_SECRET",
	"SENTRY_AUTH_TOKEN",
	"NEXT_PUBLIC_SENTRY_DSN_API",
	"NEXT_PUBLIC_SENTRY_DSN_WEB",
	"NEXT_PUBLIC_SENTRY_DSN_MARKETING",
	"NEXT_PUBLIC_SENTRY_DSN_ADMIN",
	"NEXT_PUBLIC_SENTRY_DSN_DOCS",
	"SENTRY_DSN_DESKTOP",
	"TAVILY_API_KEY",
	"CLOUDFLARE_API_TOKEN",
	"CLOUDFLARE_ACCOUNT_ID",
	"ELECTRIC_SHAPE_URL",
	"ELECTRIC_SECRET",
	"ELECTRIC_SOURCE_ID",
	"ELECTRIC_SOURCE_SECRET",
	"MAC_CERTIFICATE",
	"MAC_CERTIFICATE_PASSWORD",
	"APPLE_ID",
	"APPLE_ID_PASSWORD",
	"APPLE_TEAM_ID",
];

function runGh(kind, name, value) {
	const command =
		kind === "variable"
			? ["variable", "set", name, "--repo", repo, "--body", value]
			: ["secret", "set", name, "--repo", repo];

	const result = spawnSync("gh", command, {
		input: kind === "secret" ? value : undefined,
		stdio: kind === "secret" ? ["pipe", "inherit", "inherit"] : "inherit",
		encoding: "utf8",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function processNames(kind, names) {
	const missing = [];

	for (const name of names) {
		const value = values.get(name);
		if (!value) {
			missing.push(name);
			continue;
		}

		if (apply) {
			runGh(kind, name, value);
		}
	}

	console.log(
		`${apply ? "Updated" : "Would update"} ${names.length - missing.length} ${kind}s in ${repo}`,
	);
	if (missing.length) {
		console.log(`Missing ${kind}s: ${missing.join(", ")}`);
	}
}

processNames("variable", variableNames);
processNames("secret", secretNames);

if (!apply) {
	console.log("Dry run only. Re-run with --apply to write to GitHub.");
}
