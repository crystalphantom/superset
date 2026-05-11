import { useMemo } from "react";
import { env } from "renderer/env.renderer";
import { authClient } from "renderer/lib/auth-client";
import { useAccessibleHosts } from "renderer/routes/_authenticated/hooks/useAccessibleHosts";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import { MOCK_ORG_ID } from "shared/constants";

export interface WorkspaceHostOption {
	id: string;
	name: string;
	isOnline: boolean;
}

interface UseWorkspaceHostOptionsResult {
	currentDeviceName: string | null;
	/** machineId of the current device (the one running this desktop app). */
	localHostId: string | null;
	activeHostUrl: string | null;
	otherHosts: WorkspaceHostOption[];
}

export function useWorkspaceHostOptions(): UseWorkspaceHostOptionsResult {
	const { data: session } = authClient.useSession();
	const { machineId, activeHostUrl } = useLocalHostService();

	const activeOrganizationId = env.SKIP_ENV_VALIDATION
		? MOCK_ORG_ID
		: (session?.session?.activeOrganizationId ?? null);
	const accessibleHosts = useAccessibleHosts(activeOrganizationId);

	const localHost = useMemo(
		() => accessibleHosts.find((host) => host.machineId === machineId) ?? null,
		[accessibleHosts, machineId],
	);

	const otherHosts = useMemo(
		() =>
			accessibleHosts
				.filter((host) => host.machineId !== machineId)
				.map((host) => ({
					id: host.machineId,
					name: host.name,
					isOnline: host.isOnline ?? false,
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[accessibleHosts, machineId],
	);

	// Always surface the local device, even if its v2Hosts row hasn't synced
	// via Electric — the picker is useless without "this device" present.
	return {
		currentDeviceName: localHost?.name ?? (machineId ? "This device" : null),
		localHostId: localHost?.machineId ?? machineId,
		activeHostUrl,
		otherHosts,
	};
}
