import { Injectable } from "@nestjs/common";
import type { SavedView } from "@zoho-power-grid/shared";
import { eq } from "drizzle-orm";
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

  async listViews() {
    const rows = await this.db.db.select().from(savedViewsTable);
    return rows.map((row) => this.toSavedView(row));
  }

  async createView(body: SaveViewDto) {
    const user = await this.db.ensureDefaultUser();
    await this.db.db.insert(savedViewsTable).values({
      id: nanoid(),
      userId: user.id,
      name: body.name,
      route: body.route,
      filtersJson: JSON.stringify(body.filters),
      columnsJson: JSON.stringify(body.columns),
      sortJson: JSON.stringify(body.sort),
    });
    return this.listViews();
  }

  async updateView(viewId: string, body: SaveViewDto) {
    await this.db.db.update(savedViewsTable).set({
      name: body.name,
      route: body.route,
      filtersJson: JSON.stringify(body.filters),
      columnsJson: JSON.stringify(body.columns),
      sortJson: JSON.stringify(body.sort),
      updatedAt: new Date().toISOString(),
    }).where(eq(savedViewsTable.id, viewId));
    return this.listViews();
  }
}
