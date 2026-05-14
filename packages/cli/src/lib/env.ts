/**
 * Build-time constants baked into the CLI binary via `Bun.build({ define })`
 * (see `cli.config.ts`). In dev mode, falls back to actual process.env so
 * local dev can override these.
 */

export const env = {
	RELAY_URL: process.env.RELAY_URL || "https://superset-relay.hevo.dev",
	SUPERSET_API_URL:
		process.env.SUPERSET_API_URL || "https://superset-mvp-api.vercel.app",
	SUPERSET_WEB_URL:
		process.env.SUPERSET_WEB_URL || "https://superset-mvp-web.vercel.app",
	VERSION: process.env.SUPERSET_VERSION || "0.0.0-dev",
};
