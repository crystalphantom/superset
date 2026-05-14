import { db, dbWs } from "@superset/db/client";
import { v2UsersHostRoleValues } from "@superset/db/enums";
import { members, users, v2Hosts, v2UsersHosts } from "@superset/db/schema";
import { getCurrentTxid } from "@superset/db/utils";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { requireActiveOrgId } from "../utils/active-org";

async function requireHostOwner(
	userId: string,
	machineId: string,
	organizationId: string,
) {
	const host = await db.query.v2Hosts.findFirst({
		where: and(
			eq(v2Hosts.organizationId, organizationId),
			eq(v2Hosts.machineId, machineId),
		),
		columns: { machineId: true, organizationId: true, createdByUserId: true },
	});

	if (!host) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Host not found in this organization",
		});
	}

	const access = await db.query.v2UsersHosts.findFirst({
		where: and(
			eq(v2UsersHosts.organizationId, organizationId),
			eq(v2UsersHosts.userId, userId),
			eq(v2UsersHosts.hostId, machineId),
		),
		columns: { role: true },
	});

	if (!access || access.role !== "owner") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only host owners can change membership",
		});
	}

	return host;
}

async function requireHostAccess(
	userId: string,
	machineId: string,
	organizationId: string,
) {
	const host = await db.query.v2Hosts.findFirst({
		where: and(
			eq(v2Hosts.organizationId, organizationId),
			eq(v2Hosts.machineId, machineId),
		),
		columns: { machineId: true, organizationId: true, createdByUserId: true },
	});

	if (!host) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Host not found in this organization",
		});
	}

	const access = await db.query.v2UsersHosts.findFirst({
		where: and(
			eq(v2UsersHosts.organizationId, organizationId),
			eq(v2UsersHosts.userId, userId),
			eq(v2UsersHosts.hostId, machineId),
		),
		columns: { role: true },
	});

	if (!access) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not have access to this host",
		});
	}

	return { host, access };
}

async function requireOrgMember(userId: string, organizationId: string) {
	const member = await db.query.members.findFirst({
		where: and(
			eq(members.userId, userId),
			eq(members.organizationId, organizationId),
		),
		columns: { id: true },
	});

	if (!member) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "User is not a member of this organization",
		});
	}
}

export const v2HostRouter = {
	members: protectedProcedure
		.input(z.object({ hostId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const organizationId = requireActiveOrgId(ctx);
			const { access } = await requireHostAccess(
				ctx.session.user.id,
				input.hostId,
				organizationId,
			);

			const hostMembers = await db
				.select({
					userId: v2UsersHosts.userId,
					role: v2UsersHosts.role,
					name: users.name,
					email: users.email,
				})
				.from(v2UsersHosts)
				.leftJoin(users, eq(users.id, v2UsersHosts.userId))
				.where(
					and(
						eq(v2UsersHosts.organizationId, organizationId),
						eq(v2UsersHosts.hostId, input.hostId),
					),
				);

			const organizationMembers = await db
				.select({
					userId: members.userId,
					name: users.name,
					email: users.email,
				})
				.from(members)
				.leftJoin(users, eq(users.id, members.userId))
				.where(eq(members.organizationId, organizationId));

			const hostUserIds = new Set(hostMembers.map((member) => member.userId));

			return {
				organizationId,
				currentUserRole: access.role,
				members: hostMembers
					.map((member) => ({
						userId: member.userId,
						role: member.role,
						name: member.name ?? "Unknown user",
						email: member.email ?? "",
					}))
					.sort((a, b) => {
						if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
						return a.name.localeCompare(b.name);
					}),
				candidates: organizationMembers
					.filter((member) => !hostUserIds.has(member.userId))
					.map((member) => ({
						userId: member.userId,
						name: member.name ?? "Unknown user",
						email: member.email ?? "",
					}))
					.sort((a, b) => a.name.localeCompare(b.name)),
			};
		}),

	rename: protectedProcedure
		.input(
			z.object({
				hostId: z.string().min(1),
				name: z
					.string()
					.max(120)
					.transform((value) => value.trim())
					.pipe(z.string().min(1, "Host name cannot be empty")),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = requireActiveOrgId(ctx);
			await requireHostOwner(ctx.session.user.id, input.hostId, organizationId);

			const txid = await dbWs.transaction(async (tx) => {
				await tx
					.update(v2Hosts)
					.set({ name: input.name })
					.where(
						and(
							eq(v2Hosts.organizationId, organizationId),
							eq(v2Hosts.machineId, input.hostId),
						),
					);
				return await getCurrentTxid(tx);
			});

			return { success: true, txid };
		}),

	addMember: protectedProcedure
		.input(
			z.object({
				hostId: z.string().min(1),
				userId: z.string().uuid(),
				role: z.enum(v2UsersHostRoleValues).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = requireActiveOrgId(ctx);
			await requireHostOwner(ctx.session.user.id, input.hostId, organizationId);
			await requireOrgMember(input.userId, organizationId);

			const result = await dbWs.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(v2UsersHosts)
					.values({
						organizationId,
						userId: input.userId,
						hostId: input.hostId,
						role: input.role ?? "member",
					})
					.onConflictDoNothing({
						target: [
							v2UsersHosts.organizationId,
							v2UsersHosts.userId,
							v2UsersHosts.hostId,
						],
					})
					.returning();
				const txid = await getCurrentTxid(tx);
				return { inserted, txid };
			});

			if (!result.inserted) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "User already has access to this host",
				});
			}

			return { ...result.inserted, txid: result.txid };
		}),

	removeMember: protectedProcedure
		.input(
			z.object({
				hostId: z.string().min(1),
				userId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = requireActiveOrgId(ctx);
			const host = await requireHostOwner(
				ctx.session.user.id,
				input.hostId,
				organizationId,
			);

			if (host.createdByUserId === input.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This user runs the host service for this device and can't be removed.",
				});
			}

			const txid = await dbWs.transaction(async (tx) => {
				const target = await tx.query.v2UsersHosts.findFirst({
					where: and(
						eq(v2UsersHosts.organizationId, organizationId),
						eq(v2UsersHosts.userId, input.userId),
						eq(v2UsersHosts.hostId, input.hostId),
					),
					columns: { role: true },
				});

				if (!target) {
					return await getCurrentTxid(tx);
				}

				if (target.role === "owner") {
					const otherOwners = await tx
						.select({ userId: v2UsersHosts.userId })
						.from(v2UsersHosts)
						.where(
							and(
								eq(v2UsersHosts.organizationId, organizationId),
								eq(v2UsersHosts.hostId, input.hostId),
								eq(v2UsersHosts.role, "owner"),
								ne(v2UsersHosts.userId, input.userId),
							),
						)
						.for("update");
					if (otherOwners.length === 0) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "A host must have at least one owner.",
						});
					}
				}

				await tx
					.delete(v2UsersHosts)
					.where(
						and(
							eq(v2UsersHosts.organizationId, organizationId),
							eq(v2UsersHosts.userId, input.userId),
							eq(v2UsersHosts.hostId, input.hostId),
						),
					);
				return await getCurrentTxid(tx);
			});

			return { success: true, txid };
		}),

	setMemberRole: protectedProcedure
		.input(
			z.object({
				hostId: z.string().min(1),
				userId: z.string().uuid(),
				role: z.enum(v2UsersHostRoleValues),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = requireActiveOrgId(ctx);
			const host = await requireHostOwner(
				ctx.session.user.id,
				input.hostId,
				organizationId,
			);

			if (input.role === "member" && host.createdByUserId === input.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This user runs the host service for this device and must remain an owner.",
				});
			}

			const txid = await dbWs.transaction(async (tx) => {
				const target = await tx.query.v2UsersHosts.findFirst({
					where: and(
						eq(v2UsersHosts.organizationId, organizationId),
						eq(v2UsersHosts.userId, input.userId),
						eq(v2UsersHosts.hostId, input.hostId),
					),
					columns: { role: true },
				});

				if (!target) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "User is not a member of this host",
					});
				}

				if (input.role === "member" && target.role === "owner") {
					const otherOwners = await tx
						.select({ userId: v2UsersHosts.userId })
						.from(v2UsersHosts)
						.where(
							and(
								eq(v2UsersHosts.organizationId, organizationId),
								eq(v2UsersHosts.hostId, input.hostId),
								eq(v2UsersHosts.role, "owner"),
								ne(v2UsersHosts.userId, input.userId),
							),
						)
						.for("update");
					if (otherOwners.length === 0) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "A host must have at least one owner.",
						});
					}
				}

				await tx
					.update(v2UsersHosts)
					.set({ role: input.role })
					.where(
						and(
							eq(v2UsersHosts.organizationId, organizationId),
							eq(v2UsersHosts.userId, input.userId),
							eq(v2UsersHosts.hostId, input.hostId),
						),
					);
				return await getCurrentTxid(tx);
			});

			return { success: true, txid };
		}),
} satisfies TRPCRouterRecord;
