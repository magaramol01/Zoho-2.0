import { createSqliteConnection } from "./driver";
import { migrations } from "./migrations";
import { envSchema } from "../common/env";

const env = envSchema.parse(process.env);
const connection = createSqliteConnection(env.SQLITE_DB_PATH);

connection.exec("CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
const applied = new Set(
  connection.prepare("SELECT id FROM migrations").all().map((row) => String((row as { id: string }).id)),
);

for (const migration of migrations) {
  if (applied.has(migration.id)) {
    continue;
  }

  connection.exec("BEGIN");
  try {
    connection.exec(migration.sql);
    connection.prepare("INSERT INTO migrations (id) VALUES (?)").run(migration.id);
    connection.exec("COMMIT");
    // eslint-disable-next-line no-console
    console.log(`Applied migration ${migration.id}`);
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
