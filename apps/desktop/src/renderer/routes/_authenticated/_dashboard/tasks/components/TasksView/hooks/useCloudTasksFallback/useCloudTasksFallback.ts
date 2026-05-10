import type {
	SelectTask,
	SelectTaskStatus,
	SelectUser,
} from "@superset/db/schema";
import { useQuery } from "@tanstack/react-query";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";

export type CloudTaskWithStatus = SelectTask & {
	status: SelectTaskStatus;
	assignee: SelectUser | null;
};

function toCloudTaskWithStatus(
	row: Awaited<ReturnType<typeof apiTrpcClient.task.list.query>>[number],
): CloudTaskWithStatus | null {
	if (!row.status) return null;

	return {
		...row.task,
		status: row.status,
		assignee: row.assignee
			? ({
					id: row.assignee.id,
					name: row.assignee.name,
					image: row.assignee.image,
				} as SelectUser)
			: null,
	};
}

export function useCloudTasksFallback(enabled: boolean) {
	const { data: session } = authClient.useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;

	return useQuery({
		queryKey: ["cloud-tasks-fallback", activeOrganizationId],
		queryFn: async () => {
			const rows = await apiTrpcClient.task.list.query({ limit: 500 });
			const tasks = rows
				.map(toCloudTaskWithStatus)
				.filter((task): task is CloudTaskWithStatus => task !== null);
			const statuses = new Map<string, SelectTaskStatus>();
			for (const task of tasks) {
				statuses.set(task.status.id, task.status);
			}
			return {
				tasks,
				statuses: [...statuses.values()],
			};
		},
		enabled: enabled && !!activeOrganizationId,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		staleTime: 5_000,
	});
}
