import { apiKeyClient } from "@better-auth/api-key/client";
import { stripeClient } from "@better-auth/stripe/client";
import type { auth } from "@superset/auth/server";
import {
	customSessionClient,
	jwtClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "renderer/env.renderer";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
	authToken = token;
}

export function getAuthToken(): string | null {
	return authToken;
}

let jwt: string | null = null;
let jwtRefreshPromise: Promise<string | null> | null = null;

const JWT_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function setJwt(token: string | null) {
	jwt = token;
}

export function getJwt(): string | null {
	return jwt;
}

function getJwtExpiresAt(token: string): number | null {
	const [, payload] = token.split(".");
	if (!payload) return null;

	try {
		const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(
			normalized.length + ((4 - (normalized.length % 4)) % 4),
			"=",
		);
		const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
		return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
	} catch {
		return null;
	}
}

function isJwtFresh(token: string): boolean {
	const expiresAt = getJwtExpiresAt(token);
	if (!expiresAt) return false;
	return Date.now() < expiresAt - JWT_REFRESH_BUFFER_MS;
}

export async function refreshJwt(reason: string): Promise<string | null> {
	if (jwtRefreshPromise) return jwtRefreshPromise;

	jwtRefreshPromise = authClient
		.token()
		.then((res) => {
			const token = res.data?.token ?? null;
			if (token) setJwt(token);
			return token;
		})
		.catch((err) => {
			console.warn(`[auth] JWT refresh failed ${reason}`, err);
			return null;
		})
		.finally(() => {
			jwtRefreshPromise = null;
		});

	return jwtRefreshPromise;
}

export async function getFreshJwt(reason: string): Promise<string | null> {
	const current = getJwt();
	if (current && isJwtFresh(current)) return current;
	return refreshJwt(reason);
}

/**
 * Better Auth client for Electron desktop app.
 *
 * Bearer authentication configured via onRequest hook.
 * Server has bearer() plugin enabled to accept bearer tokens.
 */
export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_API_URL,
	plugins: [
		organizationClient({
			teams: { enabled: true },
			schema: {
				team: {
					additionalFields: {
						slug: { type: "string", input: true, required: true },
					},
				},
			},
		}),
		customSessionClient<typeof auth>(),
		stripeClient({ subscription: true }),
		apiKeyClient(),
		jwtClient(),
	],
	fetchOptions: {
		credentials: "include",
		onRequest: async (context) => {
			const token = getAuthToken();
			if (token) {
				context.headers.set("Authorization", `Bearer ${token}`);
			}
		},
		onResponse: async (context) => {
			const token = context.response.headers.get("set-auth-jwt");
			if (token) {
				setJwt(token);
			}
		},
	},
});
