import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { useState } from "react";
import { HiCheckCircle } from "react-icons/hi2";
import { useLinearConnection } from "renderer/hooks/useLinearConnection";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";

export function TasksEmptyState() {
	const { data: session } = authClient.useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;
	const { isConnected: isLinearConnected } = useLinearConnection();
	const [isSyncing, setIsSyncing] = useState(false);

	const handleSyncLinear = async () => {
		if (!activeOrganizationId) {
			toast.error("No active organization selected.");
			return;
		}

		setIsSyncing(true);
		try {
			const result = await apiTrpcClient.integration.linear.triggerSync.mutate({
				organizationId: activeOrganizationId,
			});
			if (result.imported !== undefined) {
				toast.success(
					`Linear sync finished. Imported ${result.imported} issues.`,
				);
			} else {
				toast.success("Linear sync started. Issues will appear shortly.");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to sync Linear issues.",
			);
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div className="flex-1 flex items-center justify-center">
			<div className="flex flex-col items-center gap-3 text-muted-foreground">
				<HiCheckCircle className="h-8 w-8" />
				<span className="text-sm">No tasks found</span>
				{isLinearConnected ? (
					<Button
						size="sm"
						variant="outline"
						onClick={handleSyncLinear}
						disabled={isSyncing}
					>
						{isSyncing ? "Syncing..." : "Sync Linear issues"}
					</Button>
				) : null}
			</div>
		</div>
	);
}
