import { boolean, defineConfig, string } from "@superset/cli-framework";

const VERSION = "0.2.16";
const DEFAULT_RELAY_URL = "https://superset-relay.hevo.dev";
const DEFAULT_SUPERSET_API_URL = "https://superset-mvp-api.vercel.app";
const DEFAULT_SUPERSET_WEB_URL = "https://superset-mvp-web.vercel.app";

export default defineConfig({
	name: "superset",
	version: VERSION,
	commandsDir: "./src/commands",
	outfile: "./dist/superset",
	define: {
		"process.env.RELAY_URL": JSON.stringify(
			process.env.RELAY_URL ?? DEFAULT_RELAY_URL,
		),
		"process.env.SUPERSET_API_URL": JSON.stringify(
			process.env.SUPERSET_API_URL ?? DEFAULT_SUPERSET_API_URL,
		),
		"process.env.SUPERSET_WEB_URL": JSON.stringify(
			process.env.SUPERSET_WEB_URL ?? DEFAULT_SUPERSET_WEB_URL,
		),
		"process.env.SUPERSET_OAUTH_CLIENT_ID": JSON.stringify(
			process.env.SUPERSET_OAUTH_CLIENT_ID ?? "superset-cli",
		),
		"process.env.SUPERSET_VERSION": JSON.stringify(VERSION),
	},
	globals: {
		json: boolean().desc("Output as JSON (auto-on under CI/agent envs)"),
		quiet: boolean().desc("Output IDs only"),
		apiKey: string()
			.env("SUPERSET_API_KEY")
			.desc("Use a Superset API key (sk_live_…) instead of OAuth login"),
	},
});
