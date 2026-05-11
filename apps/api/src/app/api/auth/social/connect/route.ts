import { auth } from "@superset/auth/server";
import { NextResponse } from "next/server";

import { env } from "@/env";

function isAllowedCallbackUrl(value: string): boolean {
	try {
		const callbackUrl = new URL(value);
		return callbackUrl.origin === new URL(env.NEXT_PUBLIC_WEB_URL).origin;
	} catch {
		return false;
	}
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const provider = url.searchParams.get("provider");
	const finalCallbackURL =
		url.searchParams.get("callbackURL") ?? env.NEXT_PUBLIC_WEB_URL;

	if (provider !== "google" && provider !== "github") {
		return new Response("Invalid provider", { status: 400 });
	}

	if (!isAllowedCallbackUrl(finalCallbackURL)) {
		return new Response("Invalid callbackURL", { status: 400 });
	}

	const callbackURL = new URL(
		"/api/auth/social/complete",
		env.NEXT_PUBLIC_API_URL,
	);
	callbackURL.searchParams.set("redirect", finalCallbackURL);

	const result = await auth.api.signInSocial({
		body: {
			provider,
			callbackURL: callbackURL.toString(),
		},
		asResponse: true,
	});

	const cookies = result.headers.getSetCookie();
	const body = (await result.json()) as { url?: string };

	if (!body.url) {
		return new Response(`Failed to initiate OAuth: ${JSON.stringify(body)}`, {
			status: 500,
		});
	}

	const response = NextResponse.redirect(body.url);
	for (const cookie of cookies) {
		response.headers.append("set-cookie", cookie);
	}

	return response;
}
