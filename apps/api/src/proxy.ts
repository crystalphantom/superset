import { type NextRequest, NextResponse } from "next/server";

function getCorsHeaders(origin: string | null) {
	return {
		// MVP self-host rollout: reflect any browser/Electron origin while the
		// API, web app, desktop dev server, and relay are split across domains.
		// With credentials enabled, "*" is invalid, so reflect the request origin.
		"Access-Control-Allow-Origin": origin ?? "",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, x-trpc-source, trpc-accept, Producer-Id, Producer-Epoch, Producer-Seq, Stream-Closed, X-Requested-With",
		"Access-Control-Expose-Headers": [
			// Durable stream headers
			"Stream-Next-Offset",
			"Stream-Cursor",
			"Stream-Up-To-Date",
			"Stream-Closed",
			"Stream-Total-Size",
			"Stream-Write-Units",
			"Producer-Epoch",
			"Producer-Expected-Seq",
			"Producer-Received-Seq",
			"ETag",
		].join(", "),
		"Access-Control-Allow-Credentials": "true",
	};
}

export default function proxy(req: NextRequest) {
	const origin = req.headers.get("origin");
	const corsHeaders = getCorsHeaders(origin);

	// Handle preflight
	if (req.method === "OPTIONS") {
		return new NextResponse(null, { status: 204, headers: corsHeaders });
	}

	// Add CORS headers to all responses
	const response = NextResponse.next();
	for (const [key, value] of Object.entries(corsHeaders)) {
		response.headers.set(key, value);
	}
	return response;
}

export const config = {
	matcher: [
		"/((?!_next|ingest|monitoring|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
