import { verifyJWT } from "./auth";
import { buildUpstreamUrl } from "./electric";
import type { Env } from "./types";
import { buildWhereClause } from "./where";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Expose-Headers":
		"electric-handle, electric-offset, electric-schema, electric-up-to-date, electric-cursor, electric-has-data, electric-internal-known-error, retry-after",
};

function corsResponse(status: number, body: string): Response {
	const headers = new Headers(CORS_HEADERS);
	if (status >= 400) {
		headers.set("Cache-Control", "no-store");
	}
	return new Response(body, { status, headers });
}

function addCorsHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	if (headers.get("content-encoding")) {
		headers.delete("content-encoding");
		headers.delete("content-length");
	}
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
	headers.set("Vary", "Authorization");
	headers.set("Cache-Control", "no-store");
	if (response.status >= 500) {
		headers.delete("ETag");
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function getRequestSummary(url: URL, tableName: string) {
	return {
		tableName,
		hasCursor: url.searchParams.has("cursor"),
		hasExpiredHandle: url.searchParams.has("expired_handle"),
		hasHandle: url.searchParams.has("handle"),
		hasOffset: url.searchParams.has("offset"),
		live: url.searchParams.get("live") === "true",
	};
}

async function logUpstreamFailure(
	response: Response,
	url: URL,
	tableName: string,
) {
	let bodyPreview = "";
	try {
		bodyPreview = (await response.clone().text()).slice(0, 500);
	} catch {
		bodyPreview = "<unavailable>";
	}

	console.error("[electric-proxy] Electric upstream returned 5xx", {
		status: response.status,
		statusText: response.statusText,
		...getRequestSummary(url, tableName),
		bodyPreview,
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (request.method !== "GET") {
			return corsResponse(405, "Method not allowed");
		}

		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return corsResponse(401, "Missing or invalid Authorization header");
		}

		const token = authHeader.slice(7);
		const auth = await verifyJWT(token, env.AUTH_URL);
		if (!auth) {
			return corsResponse(401, "Invalid or expired token");
		}

		const url = new URL(request.url);

		const tableName = url.searchParams.get("table");
		if (!tableName) {
			return corsResponse(400, "Missing table parameter");
		}

		const organizationId = url.searchParams.get("organizationId");

		if (tableName !== "auth.organizations") {
			if (!organizationId) {
				return corsResponse(400, "Missing organizationId parameter");
			}
			if (!auth.organizationIds.includes(organizationId)) {
				return corsResponse(403, "Not a member of this organization");
			}
		}

		const authorizedOrganizationIds = [...auth.organizationIds].sort();
		const whereClause = buildWhereClause(
			tableName,
			organizationId ?? "",
			authorizedOrganizationIds,
		);
		if (!whereClause) {
			return corsResponse(400, `Unknown table: ${tableName}`);
		}

		const upstreamUrl = buildUpstreamUrl(url, tableName, whereClause, env);
		const upstreamHeaders = new Headers(request.headers);
		upstreamHeaders.delete("Authorization");
		upstreamHeaders.delete("Cookie");

		try {
			const response = await fetch(upstreamUrl.toString(), {
				headers: upstreamHeaders,
			});

			if (response.status >= 500) {
				await logUpstreamFailure(response, url, tableName);
			}

			return addCorsHeaders(response);
		} catch (error) {
			console.error("[electric-proxy] Electric upstream fetch failed", {
				...getRequestSummary(url, tableName),
				error: error instanceof Error ? error.message : String(error),
			});
			return corsResponse(503, "Electric upstream unavailable");
		}
	},
} satisfies ExportedHandler<Env>;
