import { nanoid } from "nanoid";
import { envSchema } from "../common/env";
import { createSqliteConnection } from "./driver";

const env = envSchema.parse(process.env);
const db = createSqliteConnection(env.SQLITE_DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_cache (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS project_cache (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sprint_cache (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS task_cache (
    id TEXT PRIMARY KEY NOT NULL,
    item_no TEXT NOT NULL,
    description TEXT,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    sprint_id TEXT,
    sprint_name TEXT,
    name TEXT NOT NULL,
    status_id TEXT NOT NULL,
    status_name TEXT NOT NULL,
    priority_id TEXT,
    priority_name TEXT,
    assignee_ids_json TEXT NOT NULL DEFAULT '[]',
    assignee_names_json TEXT NOT NULL DEFAULT '[]',
    due_date TEXT,
    estimated_minutes INTEGER,
    logged_minutes INTEGER NOT NULL DEFAULT 0,
    remaining_minutes INTEGER,
    tag_ids_json TEXT NOT NULL DEFAULT '[]',
    tag_names_json TEXT NOT NULL DEFAULT '[]',
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS timesheet_log_cache (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    sprint_id TEXT,
    task_name TEXT,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    billable INTEGER NOT NULL DEFAULT 0,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS status_cache (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    color TEXT,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS priority_cache (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_cache (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tag_cache (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    raw_json TEXT,
    synced_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const now = new Date().toISOString();
const workspaceId = "demo-workspace";
const projectId = "demo-project";
const sprintId = "demo-sprint";

db.prepare("INSERT OR REPLACE INTO workspace_cache (id, name, synced_at) VALUES (?, ?, ?)")
  .run(workspaceId, "Personal Workspace", now);
db.prepare("INSERT OR REPLACE INTO project_cache (id, workspace_id, name, status, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run(projectId, workspaceId, "Zoho Power Grid", "active", now);
db.prepare("INSERT OR REPLACE INTO sprint_cache (id, project_id, workspace_id, name, state, synced_at) VALUES (?, ?, ?, ?, ?, ?)")
  .run(sprintId, projectId, workspaceId, "Sprint 18", "started", now);
db.prepare("INSERT OR REPLACE INTO status_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("todo", workspaceId, projectId, "To Do", now);
db.prepare("INSERT OR REPLACE INTO status_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("in-progress", workspaceId, projectId, "In Progress", now);
db.prepare("INSERT OR REPLACE INTO status_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("review", workspaceId, projectId, "Review", now);
db.prepare("INSERT OR REPLACE INTO priority_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("high", workspaceId, projectId, "High", now);
db.prepare("INSERT OR REPLACE INTO priority_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("medium", workspaceId, projectId, "Medium", now);
db.prepare("INSERT OR REPLACE INTO priority_cache (id, workspace_id, project_id, name, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("low", workspaceId, projectId, "Low", now);
db.prepare("INSERT OR REPLACE INTO user_cache (id, workspace_id, name, email, synced_at) VALUES (?, ?, ?, ?, ?)")
  .run("local-user", workspaceId, "You", "local@power-grid.app", now);
db.prepare("INSERT OR REPLACE INTO tag_cache (id, workspace_id, name, synced_at) VALUES (?, ?, ?, ?)")
  .run("grid", workspaceId, "grid", now);
db.prepare("INSERT OR REPLACE INTO tag_cache (id, workspace_id, name, synced_at) VALUES (?, ?, ?, ?)")
  .run("mvp", workspaceId, "mvp", now);
db.prepare("INSERT OR REPLACE INTO tag_cache (id, workspace_id, name, synced_at) VALUES (?, ?, ?, ?)")
  .run("auth", workspaceId, "auth", now);

const taskStmt = db.prepare(`
  INSERT OR REPLACE INTO task_cache (
    id, item_no, description, workspace_id, project_id, project_name, sprint_id, sprint_name, name,
    status_id, status_name, priority_id, priority_name, assignee_ids_json, assignee_names_json,
    due_date, estimated_minutes, logged_minutes, remaining_minutes, tag_ids_json, tag_names_json, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

[
  {
    id: nanoid(),
    itemNo: "PG-101",
    name: "Build task grid row editing",
    description: "Create a dense spreadsheet-style editing surface for daily task updates.",
    statusId: "in-progress",
    statusName: "In Progress",
    priorityId: "high",
    priorityName: "High",
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    estimatedMinutes: 240,
    loggedMinutes: 90,
    remainingMinutes: 150,
    tags: ["grid", "mvp"],
  },
  {
    id: nanoid(),
    itemNo: "PG-102",
    name: "Design rapid timesheet entry flow",
    description: "Stage repeatable log rows with keyboard-first defaults and quick presets.",
    statusId: "todo",
    statusName: "To Do",
    priorityId: "medium",
    priorityName: "Medium",
    dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    estimatedMinutes: 180,
    loggedMinutes: 30,
    remainingMinutes: 150,
    tags: ["timesheet"],
  },
  {
    id: nanoid(),
    itemNo: "PG-103",
    name: "Wire Zoho OAuth callback",
    description: "Finish the authorization code callback and persist encrypted refresh tokens.",
    statusId: "review",
    statusName: "Review",
    priorityId: "high",
    priorityName: "High",
    dueDate: new Date().toISOString().slice(0, 10),
    estimatedMinutes: 120,
    loggedMinutes: 100,
    remainingMinutes: 20,
    tags: ["auth", "backend"],
  },
].forEach((task) => {
  taskStmt.run(
    task.id,
    task.itemNo,
    task.description,
    workspaceId,
    projectId,
    "Zoho Power Grid",
    sprintId,
    "Sprint 18",
    task.name,
    task.statusId,
    task.statusName,
    task.priorityId,
    task.priorityName,
    JSON.stringify(["local-user"]),
    JSON.stringify(["You"]),
    task.dueDate,
    task.estimatedMinutes,
    task.loggedMinutes,
    task.remainingMinutes,
    JSON.stringify(task.tags),
    JSON.stringify(task.tags),
    now,
  );
});

db.prepare(`
  INSERT OR REPLACE INTO timesheet_log_cache (
    id, task_id, project_id, project_name, sprint_id, task_name, date, duration_minutes, notes, billable, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  nanoid(),
  null,
  projectId,
  "Zoho Power Grid",
  sprintId,
  "Planning",
  new Date().toISOString().slice(0, 10),
  60,
  "Seeded focus session",
  1,
  now,
);

// eslint-disable-next-line no-console
console.log("Seeded demo data");
