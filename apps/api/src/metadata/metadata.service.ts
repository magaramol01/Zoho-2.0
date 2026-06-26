import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { MetadataBundle } from "@zoho-power-grid/shared";
import { DatabaseService } from "../db/database.service";
import {
  priorityCacheTable,
  projectCacheTable,
  sprintCacheTable,
  statusCacheTable,
  tagCacheTable,
  userCacheTable,
  workspaceCacheTable,
} from "../db/schema";
import { SyncService } from "../sync/sync.service";

@Injectable()
export class MetadataService {
  constructor(
    private readonly db: DatabaseService,
    private readonly syncService: SyncService,
  ) {}

  async getMetadata(userId: string): Promise<MetadataBundle> {
    await this.syncService.syncMetadata(userId);

    const [workspaces, projects, sprints, statuses, priorities, users, tags] = await Promise.all([
      this.db.db.select().from(workspaceCacheTable).where(eq(workspaceCacheTable.ownerId, userId)),
      this.db.db.select().from(projectCacheTable).where(eq(projectCacheTable.ownerId, userId)),
      this.db.db.select().from(sprintCacheTable).where(eq(sprintCacheTable.ownerId, userId)),
      this.db.db.select().from(statusCacheTable).where(eq(statusCacheTable.ownerId, userId)),
      this.db.db.select().from(priorityCacheTable).where(eq(priorityCacheTable.ownerId, userId)),
      this.db.db.select().from(userCacheTable).where(eq(userCacheTable.ownerId, userId)),
      this.db.db.select().from(tagCacheTable).where(eq(tagCacheTable.ownerId, userId)),
    ]);

    return {
      workspaces: workspaces.map((row) => ({ id: row.id, name: row.name })),
      projects: projects.map((row) => {
        let prefix = "";
        try {
          const parsed = JSON.parse(row.rawJson || "{}");
          prefix = typeof parsed.prefix === "string" ? parsed.prefix : "";
        } catch {}
        return { id: row.id, name: row.name, prefix };
      }),
      sprints: sprints.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId })),
      statuses: statuses.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId ?? undefined })),
      priorities: priorities.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId ?? undefined })),
      users: users.map((row) => ({ id: row.id, name: row.name })),
      tags: tags.map((row) => ({ id: row.id, name: row.name })),
    };
  }
}
