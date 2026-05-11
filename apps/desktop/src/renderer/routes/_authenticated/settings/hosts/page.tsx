import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { env } from "renderer/env.renderer";
import { authClient } from "renderer/lib/auth-client";
import { useAccessibleHosts } from "renderer/routes/_authenticated/hooks/useAccessibleHosts";
import { MOCK_ORG_ID } from "shared/constants";

export const Route = createFileRoute("/_authenticated/settings/hosts/")({
	component: HostsIndexPage,
});

function HostsIndexPage() {
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();

	const activeOrganizationId = env.SKIP_ENV_VALIDATION
		? MOCK_ORG_ID
		: (session?.session?.activeOrganizationId ?? null);

	const hosts = useAccessibleHosts(activeOrganizationId);

	const firstHostId = useMemo(() => {
		const sorted = [...hosts].sort((a, b) => a.name.localeCompare(b.name));
		const online = sorted.find((h) => h.isOnline);
		return (online ?? sorted[0])?.id ?? null;
	}, [hosts]);

	useEffect(() => {
		if (firstHostId) {
			navigate({
				to: "/settings/hosts/$hostId",
				params: { hostId: firstHostId },
				replace: true,
			});
		}
	}, [firstHostId, navigate]);

	if (hosts.length === 0) {
		return (
			<div className="flex items-center justify-center h-full p-6 text-sm text-muted-foreground">
				No hosts yet.
			</div>
		);
	}

	return null;
}
