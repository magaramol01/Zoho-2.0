import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, desc, eq } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { EventBusService } from "../events/event-bus.service";
import {
  priorityCacheTable,
  projectCacheTable,
  sprintCacheTable,
  statusCacheTable,
  syncStateTable,
  tagCacheTable,
  userCacheTable,
  workspaceCacheTable,
  zohoConnectionsTable,
} from "../db/schema";
import { ZohoApiClient } from "../zoho/zoho-api.client";
import { ZohoNormalizer } from "../zoho/zoho-normalizer";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (value && typeof value === "object" ? (value as UnknownRecord) : {});
const asString = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
const coerceList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord);
  }

  return [];
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly metadataTtlMs = 15 * 60 * 1000;

  constructor(
    private readonly db: DatabaseService,
    private readonly zohoApiClient: ZohoApiClient,
    private readonly zohoNormalizer: ZohoNormalizer,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runMetadataSyncCron() {
    const connections = await this.db.db.select().from(zohoConnectionsTable);
    for (const connection of connections) {
      try {
        await this.syncMetadata(connection.userId);
      } catch (error) {
        this.logger.warn(
          `Cron metadata sync skipped for user ${connection.userId}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  async syncMetadata(userId: string, force = false) {
    if (!(await this.zohoApiClient.canUseZoho(userId))) {
      return;
    }

    const [latestWorkspace] = await this.db.db
      .select()
      .from(workspaceCacheTable)
      .where(eq(workspaceCacheTable.ownerId, userId))
      .orderBy(desc(workspaceCacheTable.syncedAt))
      .limit(1);

    if (
      !force &&
      latestWorkspace &&
      Date.now() - new Date(latestWorkspace.syncedAt).getTime() < this.metadataTtlMs
    ) {
      return;
    }

    const syncedAt = new Date().toISOString();

    try {
      const workspacesPayload = await this.zohoApiClient.request<unknown>(userId, {
        path: "/zsapi/teams/",
      });

      const workspaceContainer = asRecord(workspacesPayload);
      const workspaceRows = coerceList(workspaceContainer.portals).map((entry) => asRecord(entry));
      const workspaces = this.zohoNormalizer.normalizeWorkspaces(workspacesPayload);
      const workspaceRowMap = new Map(
        workspaceRows
          .map((row) => {
            const id = asString(row.zsoid ?? row.teamId ?? row.id);
            return id ? [id, row] : null;
          })
          .filter((entry): entry is [string, UnknownRecord] => Boolean(entry)),
      );

      for (const workspace of workspaces) {
        await this.db.db
          .insert(workspaceCacheTable)
          .values({
            id: workspace.id,
            ownerId: userId,
            name: workspace.name,
            rawJson: JSON.stringify(workspaceRowMap.get(workspace.id) ?? workspace),
            syncedAt,
          })
          .onConflictDoUpdate({
            target: [workspaceCacheTable.id, workspaceCacheTable.ownerId],
            set: {
              name: workspace.name,
              rawJson: JSON.stringify(workspaceRowMap.get(workspace.id) ?? workspace),
              syncedAt,
              updatedAt: syncedAt,
            },
          });
      }

      const currentUserMap = asRecord(workspaceContainer.userDisplayName);
      const currentZohoUserId =
        Object.keys(currentUserMap)[0] ??
        asString(workspaceRows[0]?.portalOwner ?? workspaceRows[0]?.ownerId);
      const currentZohoUserName = asString(currentUserMap[currentZohoUserId]);

      if (currentZohoUserId) {
        await this.upsertSyncState(userId, "current_zoho_user_id", currentZohoUserId, syncedAt);
      }
      if (currentZohoUserName) {
        await this.upsertSyncState(userId, "current_zoho_user_name", currentZohoUserName, syncedAt);
      }

      for (const workspace of workspaces) {
        try {
          await this.syncWorkspaceMetadata(userId, workspace.id, syncedAt, currentZohoUserId || null);
        } catch (error) {
          this.logger.warn(
            `Workspace metadata sync skipped for workspace ${workspace.id} user ${userId}: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      }

      this.eventBus.emit({ type: "sync", scope: "metadata", at: syncedAt });
    } catch (error) {
      this.logger.warn(`Metadata sync skipped for user ${userId}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  private async syncWorkspaceMetadata(
    userId: string,
    workspaceId: string,
    syncedAt: string,
    currentZohoUserZuid: string | null,
  ) {
    const [projectsPayload, usersPayload, tagsPayload] = await Promise.all([
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/projects/`,
        query: { action: "data", index: 1, range: 250 },
      }),
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/users/`,
        query: { action: "data", index: 1, range: 250 },
      }),
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/tags/`,
        query: { action: "data", index: 1, range: 250 },
      }),
    ]);

    const projects = this.zohoNormalizer.normalizeProjects(projectsPayload);
    const users = this.zohoNormalizer.normalizeUsers(usersPayload);
    const tags = this.zohoNormalizer.normalizeTags(tagsPayload);

    const currentInternalUser = currentZohoUserZuid
      ? users.find((user) => user.iamUserId === currentZohoUserZuid)
      : null;
    if (currentInternalUser?.id) {
      await this.upsertSyncState(userId, "current_zoho_internal_user_id", currentInternalUser.id, syncedAt);
      await this.upsertSyncState(userId, "current_zoho_internal_user_name", currentInternalUser.name, syncedAt);
    }

    for (const user of users) {
      await this.db.db
        .insert(userCacheTable)
        .values({
          id: user.id,
          ownerId: userId,
          workspaceId,
          name: user.name,
          email: user.email ?? null,
          rawJson: JSON.stringify(user),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [userCacheTable.id, userCacheTable.ownerId],
          set: {
            workspaceId,
            name: user.name,
            email: user.email ?? null,
            rawJson: JSON.stringify(user),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
    }

    for (const tag of tags) {
      await this.db.db
        .insert(tagCacheTable)
        .values({
          id: tag.id,
          ownerId: userId,
          workspaceId,
          name: tag.name,
          color: tag.color ?? null,
          rawJson: JSON.stringify(tag),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [tagCacheTable.id, tagCacheTable.ownerId],
          set: {
            workspaceId,
            name: tag.name,
            color: tag.color ?? null,
            rawJson: JSON.stringify(tag),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
    }

    for (const project of projects) {
      await this.db.db
        .insert(projectCacheTable)
        .values({
          id: project.id,
          ownerId: userId,
          workspaceId,
          name: project.name,
          rawJson: JSON.stringify(project),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [projectCacheTable.id, projectCacheTable.ownerId],
          set: {
            workspaceId,
            name: project.name,
            rawJson: JSON.stringify(project),
            syncedAt,
            updatedAt: syncedAt,
          },
        });

      try {
        await this.syncProjectMetadata(userId, workspaceId, project.id, project.name, syncedAt);
      } catch (error) {
        this.logger.warn(
          `Project metadata sync skipped for project ${project.id} user ${userId}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  private async syncProjectMetadata(
    userId: string,
    workspaceId: string,
    projectId: string,
    projectName: string,
    syncedAt: string,
  ) {
    const [sprintsPayload, backlogPayload, prioritiesPayload, statusesPayload, projectDetailsPayload] = await Promise.all([
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/projects/${projectId}/sprints/`,
        query: { action: "data", index: 1, range: 250, type: "[1,2,3,4]" },
      }),
      this.zohoApiClient
        .request<unknown>(userId, {
          path: `/zsapi/team/${workspaceId}/projects/${projectId}/`,
          query: { action: "getbacklog" },
        })
        .catch(() => null),
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/projects/${projectId}/priority/`,
        query: { action: "data", index: 1, range: 100 },
      }),
      this.zohoApiClient.request<unknown>(userId, {
        path: `/zsapi/team/${workspaceId}/projects/${projectId}/itemstatus/`,
        query: { action: "data", index: 1, range: 100 },
      }),
      this.zohoApiClient
        .request<unknown>(userId, {
          path: `/zsapi/team/${workspaceId}/projects/${projectId}/`,
          query: { action: "details" },
        })
        .catch(() => null),
    ]);

    const sprintMap = new Map(
      this.zohoNormalizer
        .normalizeSprints(sprintsPayload)
        .map((sprint) => [sprint.id, sprint] as const),
    );
    const backlogId = asString(asRecord(backlogPayload).backlogId);
    if (backlogId) {
      sprintMap.set(backlogId, { id: backlogId, name: `${projectName} backlog`, state: "backlog" });
    }

    const priorities = this.zohoNormalizer.normalizePriorities(prioritiesPayload);
    const statuses = this.zohoNormalizer.normalizeStatuses(statusesPayload);

    const details = asRecord(projectDetailsPayload);
    const prefix = asString(details.prefix);
    if (prefix) {
      const [existingProject] = await this.db.db
        .select()
        .from(projectCacheTable)
        .where(and(eq(projectCacheTable.id, projectId), eq(projectCacheTable.ownerId, userId)))
        .limit(1);

      if (existingProject) {
        let rawObj: Record<string, any> = {};
        try {
          rawObj = JSON.parse(existingProject.rawJson || "{}");
        } catch {}
        rawObj.prefix = prefix;
        await this.db.db
          .update(projectCacheTable)
          .set({
            rawJson: JSON.stringify(rawObj),
            updatedAt: syncedAt,
          })
          .where(and(eq(projectCacheTable.id, projectId), eq(projectCacheTable.ownerId, userId)));
      }
    }

    for (const sprint of sprintMap.values()) {
      await this.db.db
        .insert(sprintCacheTable)
        .values({
          id: sprint.id,
          ownerId: userId,
          projectId,
          workspaceId,
          name: sprint.name,
          state: sprint.state ?? null,
          rawJson: JSON.stringify(sprint),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [sprintCacheTable.id, sprintCacheTable.ownerId],
          set: {
            projectId,
            workspaceId,
            name: sprint.name,
            state: sprint.state ?? null,
            rawJson: JSON.stringify(sprint),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
    }

    for (const priority of priorities) {
      await this.db.db
        .insert(priorityCacheTable)
        .values({
          id: priority.id,
          ownerId: userId,
          workspaceId,
          projectId,
          name: priority.name,
          rawJson: JSON.stringify(priority),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [priorityCacheTable.id, priorityCacheTable.ownerId],
          set: {
            workspaceId,
            projectId,
            name: priority.name,
            rawJson: JSON.stringify(priority),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
    }

    for (const status of statuses) {
      await this.db.db
        .insert(statusCacheTable)
        .values({
          id: status.id,
          ownerId: userId,
          workspaceId,
          projectId,
          name: status.name,
          color: status.color ?? null,
          rawJson: JSON.stringify(status),
          syncedAt,
        })
        .onConflictDoUpdate({
          target: [statusCacheTable.id, statusCacheTable.ownerId],
          set: {
            workspaceId,
            projectId,
            name: status.name,
            color: status.color ?? null,
            rawJson: JSON.stringify(status),
            syncedAt,
            updatedAt: syncedAt,
          },
        });
    }
  }

  private async upsertSyncState(userId: string, key: string, value: string, syncedAt: string) {
    await this.db.db
      .insert(syncStateTable)
      .values({
        key,
        ownerId: userId,
        value,
        lastSuccessAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: [syncStateTable.key, syncStateTable.ownerId],
        set: {
          value,
          lastSuccessAt: syncedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
          updatedAt: syncedAt,
        },
      });
  }

  async getSyncValue(userId: string, key: string) {
    const [row] = await this.db.db
      .select()
      .from(syncStateTable)
      .where(and(eq(syncStateTable.key, key), eq(syncStateTable.ownerId, userId)))
      .limit(1);
    return row?.value ?? null;
  }
}
