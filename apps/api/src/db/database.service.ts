import { Injectable, OnModuleInit } from "@nestjs/common";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AppConfigService } from "../common/env";
import { createSqliteConnection } from "./driver";
import * as schema from "./schema";
import { migrations } from "./migrations";

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly sqlite;
  readonly db: BetterSQLite3Database<typeof schema>;

  constructor(private readonly config: AppConfigService) {
    this.sqlite = createSqliteConnection(this.config.sqlitePath);
    this.db = drizzle(this.sqlite, { schema });
  }

  async onModuleInit() {
    await this.applyMigrations();
  }

  private async applyMigrations() {
    this.sqlite.exec(
      "CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    const applied = new Set(
      (await this.db.select().from(schema.migrationsTable)).map((row) => row.id),
    );

    for (const migration of migrations) {
      if (applied.has(migration.id)) {
        continue;
      }

      this.sqlite.exec("BEGIN");
      try {
        this.sqlite.exec(migration.sql);
        await this.db.insert(schema.migrationsTable).values({ id: migration.id });
        this.sqlite.exec("COMMIT");
      } catch (error) {
        this.sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  }

  async getSingletonUser() {
    const [user] = await this.db.select().from(schema.usersTable).limit(1);
    return user ?? null;
  }

  async ensureDefaultUser() {
    const existing = await this.getSingletonUser();
    if (existing) {
      return existing;
    }

    const id = nanoid();
    await this.db.insert(schema.usersTable).values({
      id,
      email: "local@power-grid.app",
      displayName: "Local Power User",
    });
    const [user] = await this.db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
    return user!;
  }
}
