import { auth } from "@superset/auth/server";
import { NextResponse } from "next/server";

import { env } from "@/env";

const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSafeRedirect(value: FormDataEntryValue | null) {
	if (typeof value !== "string") return env.NEXT_PUBLIC_WEB_URL;

	try {
		const redirectUrl = new URL(value);
		if (redirectUrl.origin === new URL(env.NEXT_PUBLIC_WEB_URL).origin) {
			return redirectUrl;
		}
	} catch {
		return new URL(env.NEXT_PUBLIC_WEB_URL);
	}

	return new URL(env.NEXT_PUBLIC_WEB_URL);
}

export async function POST(request: Request) {
	const formData = await request.formData();
	const token = formData.get("token");
	const redirect = getSafeRedirect(formData.get("redirect"));

	if (typeof token !== "string" || !token || token.includes(";")) {
		return NextResponse.redirect(new URL("/sign-in", env.NEXT_PUBLIC_WEB_URL));
	}

	const session = await auth.api.getSession({
		headers: new Headers({
			cookie: `${SESSION_COOKIE_NAME}=${token}`,
		}),
	});

	if (!session) {
		const signInUrl = new URL("/sign-in", env.NEXT_PUBLIC_WEB_URL);
		signInUrl.searchParams.set("error", "session_handoff_failed");
		return NextResponse.redirect(signInUrl);
	}

	const response = NextResponse.redirect(redirect, { status: 303 });
	response.headers.append(
		"Set-Cookie",
		`${SESSION_COOKIE_NAME}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
	);

	return response;
}
