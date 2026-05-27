import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export const createSqliteConnection = (pathToDb: string) => {
  const resolved = resolve(process.cwd(), pathToDb);
  mkdirSync(dirname(resolved), { recursive: true });
  return new Database(resolved);
};
