import { auth } from "@superset/auth/server";
import { NextResponse } from "next/server";

import { env } from "@/env";

const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";

interface ConsentRequestBody {
	accept?: boolean;
	organizationId?: string;
	scope?: string;
	oauth_query?: string;
}

function getCookieValue(cookieHeader: string | null, name: string) {
	if (!cookieHeader) return null;

	for (const part of cookieHeader.split(";")) {
		const [rawName, ...valueParts] = part.trim().split("=");
		if (rawName === name) {
			return valueParts.join("=");
		}
	}

	return null;
}

function jsonError(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function getAuthHeaders(sessionToken: string) {
	return new Headers({
		cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
		origin: env.NEXT_PUBLIC_WEB_URL,
		referer: `${env.NEXT_PUBLIC_WEB_URL}/oauth/consent`,
	});
}

export async function POST(request: Request) {
	try {
		const body = (await request
			.json()
			.catch(() => null)) as ConsentRequestBody | null;

		if (!body || typeof body.accept !== "boolean") {
			return jsonError("Invalid consent request");
		}

		const sessionToken = getCookieValue(
			request.headers.get("cookie"),
			SESSION_COOKIE_NAME,
		);

		if (!sessionToken) {
			return jsonError("Unauthorized", 401);
		}

		const authHeaders = getAuthHeaders(sessionToken);

		const session = await auth.api.getSession({ headers: authHeaders });
		if (!session) {
			return jsonError("Unauthorized", 401);
		}

		if (body.accept) {
			if (!body.organizationId) {
				return jsonError("organizationId is required");
			}

			const setActiveResponse = await auth.api.setActiveOrganization({
				headers: authHeaders,
				body: {
					organizationId: body.organizationId,
				},
				asResponse: true,
			});

			if (!setActiveResponse.ok) {
				const error = (await setActiveResponse.json().catch(() => null)) as {
					message?: string;
				} | null;

				return jsonError(
					error?.message ?? "Failed to set active organization",
					setActiveResponse.status,
				);
			}
		}

		const consentResponse = await auth.handler(
			new Request(
				new URL("/api/auth/oauth2/consent", env.NEXT_PUBLIC_API_URL),
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
						Origin: env.NEXT_PUBLIC_WEB_URL,
						Referer: `${env.NEXT_PUBLIC_WEB_URL}/oauth/consent`,
					},
					body: JSON.stringify({
						accept: body.accept,
						scope: body.accept ? body.scope : undefined,
						oauth_query: body.oauth_query,
					}),
				},
			),
		);

		const consent = (await consentResponse.json().catch(() => null)) as {
			url?: string;
			message?: string;
			error?: string;
			error_description?: string;
		} | null;

		if (!consentResponse.ok) {
			return jsonError(
				consent?.message ??
					consent?.error_description ??
					consent?.error ??
					"Failed to process consent",
				consentResponse.status,
			);
		}

		return NextResponse.json(consent);
	} catch (error) {
		console.error("[oauth/consent] Failed to process consent", error);
		return jsonError("Failed to process consent", 500);
	}
}
