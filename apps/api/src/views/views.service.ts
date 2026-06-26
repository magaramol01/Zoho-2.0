import { Injectable, NotFoundException } from "@nestjs/common";
import type { SavedView } from "@zoho-power-grid/shared";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DatabaseService } from "../db/database.service";
import { savedViewsTable } from "../db/schema";
import type { SaveViewDto } from "./dto";

@Injectable()
export class ViewsService {
  constructor(private readonly db: DatabaseService) {}

  private toSavedView(row: typeof savedViewsTable.$inferSelect): SavedView {
    return {
      id: row.id,
      name: row.name,
      route: row.route as SavedView["route"],
      filters: JSON.parse(row.filtersJson) as SavedView["filters"],
      columns: JSON.parse(row.columnsJson) as SavedView["columns"],
      sort: JSON.parse(row.sortJson) as SavedView["sort"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listViews(userId: string) {
    const rows = await this.db.db.select().from(savedViewsTable).where(eq(savedViewsTable.userId, userId));
    return rows.map((row) => this.toSavedView(row));
  }

  async createView(userId: string, body: SaveViewDto) {
    const viewId = nanoid();
    await this.db.db.insert(savedViewsTable).values({
      id: viewId,
      userId: userId,
      name: body.name,
      route: body.route,
      filtersJson: JSON.stringify(body.filters),
      columnsJson: JSON.stringify(body.columns),
      sortJson: JSON.stringify(body.sort),
    });
    return this.listViews(userId);
  }

  async updateView(userId: string, viewId: string, body: SaveViewDto) {
    const [existing] = await this.db.db.select().from(savedViewsTable).where(and(eq(savedViewsTable.id, viewId), eq(savedViewsTable.userId, userId))).limit(1);
    if (!existing) {
      throw new NotFoundException("Saved view not found");
    }

    await this.db.db.update(savedViewsTable).set({
      name: body.name,
      route: body.route,
      filtersJson: JSON.stringify(body.filters),
      columnsJson: JSON.stringify(body.columns),
      sortJson: JSON.stringify(body.sort),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(savedViewsTable.id, viewId), eq(savedViewsTable.userId, userId)));
    return this.listViews(userId);
  }
}
