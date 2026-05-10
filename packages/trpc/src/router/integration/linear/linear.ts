import { db, dbWs } from "@superset/db/client";
import {
	integrationConnections,
	type LinearConfig,
	taskStatuses,
	tasks,
} from "@superset/db/schema";
import { seedDefaultStatuses } from "@superset/db/seed-default-statuses";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { Client } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../../env";
import { protectedProcedure } from "../../../trpc";
import { verifyOrgAdmin, verifyOrgMembership } from "../utils";
import { callLinear } from "./refresh";

const qstash = new Client({ token: env.QSTASH_TOKEN });

export const linearRouter = {
	getConnection: protectedProcedure
		.input(z.object({ organizationId: z.uuid() }))
		.query(async ({ ctx, input }) => {
			await verifyOrgMembership(ctx.session.user.id, input.organizationId);
			const connection = await db.query.integrationConnections.findFirst({
				where: and(
					eq(integrationConnections.organizationId, input.organizationId),
					eq(integrationConnections.provider, "linear"),
				),
				columns: {
					id: true,
					provider: true,
					externalOrgId: true,
					externalOrgName: true,
					config: true,
					disconnectedAt: true,
					disconnectReason: true,
					createdAt: true,
					updatedAt: true,
				},
			});
			if (!connection) return null;
			return {
				id: connection.id,
				provider: connection.provider,
				externalOrgId: connection.externalOrgId,
				externalOrgName: connection.externalOrgName,
				config: connection.config as LinearConfig | null,
				needsReconnect: !!connection.disconnectedAt,
				disconnectReason: connection.disconnectReason,
				createdAt: connection.createdAt,
				updatedAt: connection.updatedAt,
			};
		}),

	disconnect: protectedProcedure
		.input(z.object({ organizationId: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			await verifyOrgAdmin(ctx.session.user.id, input.organizationId);

			try {
				await callLinear(input.organizationId, (client) => client.logout());
			} catch {}

			const result = await dbWs.transaction(async (tx) => {
				// 1. Delete Linear-synced tasks
				await tx
					.delete(tasks)
					.where(
						and(
							eq(tasks.organizationId, input.organizationId),
							eq(tasks.externalProvider, "linear"),
						),
					);

				// 2. Seed default statuses inside the transaction
				const backlogStatusId = await seedDefaultStatuses(
					input.organizationId,
					tx,
				);

				// 3. Remap remaining local tasks from Linear statuses to default statuses
				const allStatuses = await tx.query.taskStatuses.findMany({
					where: eq(taskStatuses.organizationId, input.organizationId),
				});

				const defaultStatusByType = new Map<string, string>();
				for (const status of allStatuses) {
					if (!status.externalProvider && status.type) {
						if (!defaultStatusByType.has(status.type)) {
							defaultStatusByType.set(status.type, status.id);
						}
					}
				}

				for (const status of allStatuses) {
					if (status.externalProvider === "linear") {
						const defaultStatusId =
							(status.type && defaultStatusByType.get(status.type)) ||
							backlogStatusId;
						await tx
							.update(tasks)
							.set({ statusId: defaultStatusId })
							.where(
								and(
									eq(tasks.organizationId, input.organizationId),
									eq(tasks.statusId, status.id),
								),
							);
					}
				}

				// 4. Delete Linear task statuses
				await tx
					.delete(taskStatuses)
					.where(
						and(
							eq(taskStatuses.organizationId, input.organizationId),
							eq(taskStatuses.externalProvider, "linear"),
						),
					);

				// 5. Delete the integration connection
				return tx
					.delete(integrationConnections)
					.where(
						and(
							eq(integrationConnections.organizationId, input.organizationId),
							eq(integrationConnections.provider, "linear"),
						),
					)
					.returning({ id: integrationConnections.id });
			});

			if (result.length === 0) {
				return { success: false, error: "No connection found" };
			}

			return { success: true };
		}),

	triggerSync: protectedProcedure
		.input(z.object({ organizationId: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			await verifyOrgMembership(ctx.session.user.id, input.organizationId);

			const connection = await db.query.integrationConnections.findFirst({
				where: and(
					eq(integrationConnections.organizationId, input.organizationId),
					eq(integrationConnections.provider, "linear"),
				),
				columns: {
					id: true,
					disconnectedAt: true,
				},
			});

			if (!connection) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Linear connection not found",
				});
			}

			if (connection.disconnectedAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Linear connection needs to be reconnected before syncing",
				});
			}

			const syncUrl = `${env.NEXT_PUBLIC_API_URL}/api/integrations/linear/jobs/initial-sync`;
			const syncBody = {
				organizationId: input.organizationId,
				creatorUserId: ctx.session.user.id,
			};

			// In development, call the sync endpoint directly (QStash can't reach localhost)
			if (env.NODE_ENV === "development") {
				const response = await fetch(syncUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(syncBody),
				});

				if (!response.ok) {
					const body = await response.text();
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Linear sync failed: ${body}`,
					});
				}
				const result = (await response.json()) as {
					tasksUpserted?: number;
				};
				return { success: true, imported: result.tasksUpserted ?? 0 };
			} else {
				await qstash.publishJSON({
					url: syncUrl,
					body: syncBody,
					retries: 3,
				});
			}

			return { success: true };
		}),

	getTeams: protectedProcedure
		.input(z.object({ organizationId: z.uuid() }))
		.query(async ({ ctx, input }) => {
			await verifyOrgMembership(ctx.session.user.id, input.organizationId);
			const teams = await callLinear(input.organizationId, (client) =>
				client.teams(),
			);
			if (!teams) return [];
			return teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key }));
		}),

	updateConfig: protectedProcedure
		.input(
			z.object({
				organizationId: z.uuid(),
				newTasksTeamId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await verifyOrgAdmin(ctx.session.user.id, input.organizationId);

			const config: LinearConfig = {
				provider: "linear",
				newTasksTeamId: input.newTasksTeamId,
			};

			await db
				.update(integrationConnections)
				.set({ config })
				.where(
					and(
						eq(integrationConnections.organizationId, input.organizationId),
						eq(integrationConnections.provider, "linear"),
					),
				);

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
