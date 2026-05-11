import { and, eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";

export interface AccessibleHost {
	id: string;
	name: string;
	machineId: string;
	isOnline: boolean;
	organizationId: string;
}

export function useAccessibleHosts(
	organizationId: string | null | undefined,
): AccessibleHost[] {
	const collections = useCollections();
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id ?? null;

	const { data: electricHosts = [] } = useLiveQuery(
		(q) =>
			q
				.from({ userHosts: collections.v2UsersHosts })
				.innerJoin({ hosts: collections.v2Hosts }, ({ userHosts, hosts }) =>
					eq(userHosts.hostId, hosts.machineId),
				)
				.where(({ userHosts, hosts }) =>
					and(
						eq(userHosts.organizationId, organizationId ?? ""),
						eq(userHosts.userId, currentUserId ?? ""),
						eq(hosts.organizationId, organizationId ?? ""),
					),
				)
				.select(({ hosts }) => ({
					id: hosts.machineId,
					name: hosts.name,
					machineId: hosts.machineId,
					isOnline: hosts.isOnline,
					organizationId: hosts.organizationId,
				})),
		[collections, currentUserId, organizationId],
	);

	const cloudHostsQuery = useQuery({
		queryKey: ["accessible-hosts", organizationId, currentUserId],
		enabled: !!organizationId && !!currentUserId,
		retry: 1,
		queryFn: async () => {
			if (!organizationId) return [];
			const rows = await apiTrpcClient.host.list.query({ organizationId });
			return rows.map((row) => ({
				id: row.id,
				name: row.name,
				machineId: row.id,
				isOnline: row.online,
				organizationId: row.organizationId,
			}));
		},
	});

	return useMemo(() => {
		const hostsById = new Map<string, AccessibleHost>();
		for (const host of electricHosts) {
			hostsById.set(host.id, host);
		}
		for (const host of cloudHostsQuery.data ?? []) {
			hostsById.set(host.id, host);
		}
		return [...hostsById.values()];
	}, [cloudHostsQuery.data, electricHosts]);
}
