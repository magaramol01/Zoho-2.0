import { Injectable } from "@nestjs/common";
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

  async getMetadata(): Promise<MetadataBundle> {
    await this.syncService.syncMetadata();

    const [workspaces, projects, sprints, statuses, priorities, users, tags] = await Promise.all([
      this.db.db.select().from(workspaceCacheTable),
      this.db.db.select().from(projectCacheTable),
      this.db.db.select().from(sprintCacheTable),
      this.db.db.select().from(statusCacheTable),
      this.db.db.select().from(priorityCacheTable),
      this.db.db.select().from(userCacheTable),
      this.db.db.select().from(tagCacheTable),
    ]);

    return {
      workspaces: workspaces.map((row) => ({ id: row.id, name: row.name })),
      projects: projects.map((row) => ({ id: row.id, name: row.name })),
      sprints: sprints.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId })),
      statuses: statuses.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId ?? undefined })),
      priorities: priorities.map((row) => ({ id: row.id, name: row.name, projectId: row.projectId ?? undefined })),
      users: users.map((row) => ({ id: row.id, name: row.name })),
      tags: tags.map((row) => ({ id: row.id, name: row.name })),
    };
  }
}
