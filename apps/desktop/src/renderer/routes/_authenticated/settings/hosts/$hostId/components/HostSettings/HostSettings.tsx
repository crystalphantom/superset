import { toast } from "@superset/ui/sonner";
import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { authClient } from "renderer/lib/auth-client";
import { useAccessibleHosts } from "renderer/routes/_authenticated/hooks/useAccessibleHosts";
import {
	type PersistableTransaction,
	useOptimisticCollectionActions,
} from "renderer/routes/_authenticated/hooks/useOptimisticCollectionActions";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { CandidateRow } from "./components/AddMemberDropdown";
import { AddMemberDropdown } from "./components/AddMemberDropdown";
import { HostHeader } from "./components/HostHeader";
import type { MemberRowData } from "./components/MembersTable";
import { MembersTable } from "./components/MembersTable";

function notifyOnPersist(
	tx: PersistableTransaction | null,
	successMessage: string,
) {
	tx?.isPersisted.promise.then(
		() => toast.success(successMessage),
		() => {},
	);
}

interface HostSettingsProps {
	hostId: string;
}

export function HostSettings({ hostId }: HostSettingsProps) {
	const collections = useCollections();
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id ?? null;
	const activeOrganizationId = session?.session?.activeOrganizationId ?? null;
	const actions = useOptimisticCollectionActions();
	const accessibleHosts = useAccessibleHosts(activeOrganizationId);

	const { data: hostRows = [] } = useLiveQuery(
		(q) =>
			q
				.from({ hosts: collections.v2Hosts })
				.where(({ hosts }) => eq(hosts.machineId, hostId))
				.select(({ hosts }) => ({ ...hosts })),
		[collections, hostId],
	);
	const syncedHost = hostRows[0];
	const fallbackHost = accessibleHosts.find((row) => row.id === hostId);
	const host = syncedHost ?? fallbackHost;

	const cloudMembersQuery = useQuery({
		queryKey: ["v2-host-members", activeOrganizationId, hostId],
		enabled: !!activeOrganizationId && !!hostId,
		retry: 1,
		queryFn: () => apiTrpcClient.v2Host.members.query({ hostId }),
	});

	const { data: hostUserRows = [] } = useLiveQuery(
		(q) =>
			q
				.from({ uh: collections.v2UsersHosts })
				.where(({ uh }) => eq(uh.hostId, hostId))
				.select(({ uh }) => ({ ...uh })),
		[collections, hostId],
	);

	const { data: orgUsers = [] } = useLiveQuery(
		(q) =>
			q.from({ users: collections.users }).select(({ users }) => ({
				id: users.id,
				name: users.name,
				email: users.email,
			})),
		[collections],
	);

	const { data: orgMembers = [] } = useLiveQuery(
		(q) =>
			q
				.from({ m: collections.members })
				.where(({ m }) =>
					eq(m.organizationId, syncedHost?.organizationId ?? ""),
				)
				.select(({ m }) => ({ userId: m.userId })),
		[collections, syncedHost?.organizationId],
	);

	const userMap = useMemo(() => {
		const map = new Map<string, { name: string; email: string }>();
		for (const u of orgUsers) {
			map.set(u.id, { name: u.name, email: u.email });
		}
		return map;
	}, [orgUsers]);

	const members: MemberRowData[] = useMemo(() => {
		const cloudMembersById = new Map(
			(cloudMembersQuery.data?.members ?? []).map((member) => [
				member.userId,
				member,
			]),
		);

		if (hostUserRows.length === 0 && cloudMembersById.size > 0) {
			return [...cloudMembersById.values()].map((member) => ({
				usersHostsId: `${member.userId}:${hostId}`,
				userId: member.userId,
				role: member.role as "owner" | "member",
				name: member.name,
				email: member.email,
			}));
		}

		return hostUserRows
			.map((row) => {
				const u = userMap.get(row.userId);
				const cloudMember = cloudMembersById.get(row.userId);
				return {
					usersHostsId: `${row.userId}:${row.hostId}`,
					userId: row.userId,
					role: row.role as "owner" | "member",
					name: u?.name ?? cloudMember?.name ?? "Unknown user",
					email: u?.email ?? cloudMember?.email ?? "",
				};
			})
			.sort((a, b) => {
				if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}, [cloudMembersQuery.data?.members, hostId, hostUserRows, userMap]);

	const candidates: CandidateRow[] = useMemo(() => {
		if (orgMembers.length === 0 && cloudMembersQuery.data?.candidates) {
			return cloudMembersQuery.data.candidates;
		}

		const onHost = new Set(hostUserRows.map((r) => r.userId));
		return orgMembers
			.filter((m) => !onHost.has(m.userId))
			.map((m) => {
				const u = userMap.get(m.userId);
				return {
					userId: m.userId,
					name: u?.name ?? "Unknown user",
					email: u?.email ?? "",
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [cloudMembersQuery.data?.candidates, orgMembers, hostUserRows, userMap]);

	const isOwner = useMemo(() => {
		if (!currentUserId) return false;
		if (hostUserRows.length === 0) {
			return cloudMembersQuery.data?.currentUserRole === "owner";
		}
		return (
			hostUserRows.find((r) => r.userId === currentUserId)?.role === "owner"
		);
	}, [cloudMembersQuery.data?.currentUserRole, hostUserRows, currentUserId]);

	if (!host) {
		return (
			<div className="p-6 text-sm text-muted-foreground">
				Host not found in this organization.
			</div>
		);
	}

	const handleAdd = (candidate: CandidateRow) => {
		if (!host) return;
		notifyOnPersist(
			actions.v2UsersHosts.addMember({
				hostId,
				userId: candidate.userId,
				organizationId: host.organizationId,
			}),
			"Member added",
		);
	};

	const handleRemove = (member: MemberRowData) => {
		notifyOnPersist(
			actions.v2UsersHosts.removeMember(member.usersHostsId),
			"Member removed",
		);
	};

	const handleSetRole = (member: MemberRowData, role: "owner" | "member") => {
		notifyOnPersist(
			actions.v2UsersHosts.setMemberRole(member.usersHostsId, role),
			"Role updated",
		);
	};

	return (
		<div className="p-6 max-w-4xl w-full mx-auto select-text">
			<HostHeader
				name={host.name}
				isOnline={host.isOnline}
				machineId={host.machineId}
			/>

			<section className="space-y-3">
				<div className="flex items-end justify-between gap-4">
					<div>
						<h3 className="text-sm font-medium">Members</h3>
						{!isOwner && (
							<p className="text-sm text-muted-foreground mt-0.5">
								Only owners can change membership.
							</p>
						)}
					</div>
					{isOwner && (
						<AddMemberDropdown candidates={candidates} onPick={handleAdd} />
					)}
				</div>

				<MembersTable
					members={members}
					isOwner={isOwner}
					onSetRole={handleSetRole}
					onRemove={handleRemove}
				/>
			</section>
		</div>
	);
}
