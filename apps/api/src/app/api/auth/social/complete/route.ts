import { auth } from "@superset/auth/server";

import { env } from "@/env";

const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";

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

function getSafeRedirect(value: string | null) {
	if (!value) return env.NEXT_PUBLIC_WEB_URL;

	try {
		const redirectUrl = new URL(value);
		if (redirectUrl.origin === new URL(env.NEXT_PUBLIC_WEB_URL).origin) {
			return redirectUrl.toString();
		}
	} catch {
		return env.NEXT_PUBLIC_WEB_URL;
	}

	return env.NEXT_PUBLIC_WEB_URL;
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	const redirect = getSafeRedirect(
		new URL(request.url).searchParams.get("redirect"),
	);

	if (!session) {
		const signInUrl = new URL("/sign-in", env.NEXT_PUBLIC_WEB_URL);
		const redirectUrl = new URL(redirect);
		signInUrl.searchParams.set(
			"redirect",
			redirectUrl.pathname + redirectUrl.search,
		);
		return Response.redirect(signInUrl);
	}

	const token = getCookieValue(
		request.headers.get("cookie"),
		SESSION_COOKIE_NAME,
	);

	if (!token) {
		return Response.redirect(`${env.NEXT_PUBLIC_WEB_URL}/sign-in`);
	}

	const handoffUrl = new URL(
		"/api/auth/session/complete",
		env.NEXT_PUBLIC_WEB_URL,
	);

	return new Response(
		`<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="robots" content="noindex" />
		<title>Completing sign in...</title>
	</head>
	<body>
		<form method="post" action="${escapeHtml(handoffUrl.toString())}">
			<input type="hidden" name="token" value="${escapeHtml(token)}" />
			<input type="hidden" name="redirect" value="${escapeHtml(redirect)}" />
			<button type="submit">Continue</button>
		</form>
		<script>document.forms[0].submit();</script>
	</body>
</html>`,
		{
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
			},
		},
	);
}
