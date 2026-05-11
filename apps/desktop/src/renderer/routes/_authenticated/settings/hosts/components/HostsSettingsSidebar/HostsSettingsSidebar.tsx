import { cn } from "@superset/ui/utils";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { env } from "renderer/env.renderer";
import { authClient } from "renderer/lib/auth-client";
import { useAccessibleHosts } from "renderer/routes/_authenticated/hooks/useAccessibleHosts";
import { MOCK_ORG_ID } from "shared/constants";
import {
	type SettingsListGroup,
	SettingsListSidebar,
	settingsListItemClass,
} from "../../../components/SettingsListSidebar";

interface HostRow {
	id: string;
	name: string;
	machineId: string;
	isOnline: boolean;
}

interface HostsSettingsSidebarProps {
	selectedHostId: string | null;
}

export function HostsSettingsSidebar({
	selectedHostId,
}: HostsSettingsSidebarProps) {
	const { data: session } = authClient.useSession();

	const activeOrganizationId = env.SKIP_ENV_VALIDATION
		? MOCK_ORG_ID
		: (session?.session?.activeOrganizationId ?? null);

	const hosts = useAccessibleHosts(activeOrganizationId);

	const listGroups = useMemo<Array<SettingsListGroup<HostRow>>>(() => {
		const sorted = [...hosts].sort((a, b) => a.name.localeCompare(b.name));
		return [
			{
				id: "online",
				title: "Online",
				rows: sorted.filter((h) => h.isOnline),
			},
			{
				id: "offline",
				title: "Offline",
				rows: sorted.filter((h) => !h.isOnline),
			},
		];
	}, [hosts]);

	return (
		<SettingsListSidebar
			searchPlaceholder="Filter hosts..."
			searchAriaLabel="Filter hosts"
			groups={listGroups}
			filterRow={(row, q) => row.name.toLowerCase().includes(q.toLowerCase())}
			getRowKey={(row) => row.id}
			emptyLabel="No hosts yet."
			noMatchLabel={(q) => `No hosts match "${q}".`}
			renderRow={(row) => (
				<Link
					to="/settings/hosts/$hostId"
					params={{ hostId: row.id }}
					className={settingsListItemClass(row.id === selectedHostId, "gap-2")}
				>
					<span
						className={cn(
							"h-1.5 w-1.5 rounded-full shrink-0",
							row.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
						)}
					/>
					<span className="truncate flex-1">{row.name}</span>
				</Link>
			)}
		/>
	);
}
