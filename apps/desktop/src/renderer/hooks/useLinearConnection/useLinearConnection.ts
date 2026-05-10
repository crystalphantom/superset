import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";

export function useLinearConnection() {
	const { data: session } = authClient.useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;
	const collections = useCollections();

	const { data: integrationConnections } = useLiveQuery(
		(q) =>
			q
				.from({ integrationConnections: collections.integrationConnections })
				.select(({ integrationConnections }) => ({
					...integrationConnections,
				})),
		[collections],
	);
	const electricConnection = integrationConnections?.find(
		(connection) => connection.provider === "linear",
	);

	const query = useQuery({
		queryKey: ["linear-connection", activeOrganizationId],
		queryFn: () => {
			if (!activeOrganizationId) return null;
			return apiTrpcClient.integration.linear.getConnection.query({
				organizationId: activeOrganizationId,
			});
		},
		enabled: !!activeOrganizationId && !electricConnection,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		staleTime: 0,
	});

	const apiConnection = query.data;
	const connection = electricConnection ?? apiConnection ?? null;

	return {
		connection,
		isConnected: !!connection,
		isLoading: !electricConnection && query.isLoading,
	};
}
