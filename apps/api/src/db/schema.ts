import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
};

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  ...timestamps,
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
}));

export const zohoConnectionsTable = sqliteTable("zoho_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  apiDomain: text("api_domain"),
  accountsServer: text("accounts_server"),
  expiresAt: text("expires_at").notNull(),
  scope: text("scope"),
  ...timestamps,
});

export const sessionsTable = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sessionToken: text("session_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  ...timestamps,
}, (table) => ({
  tokenIdx: uniqueIndex("sessions_token_idx").on(table.sessionToken),
}));

export const workspaceCacheTable = sqliteTable("workspace_cache", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const projectCacheTable = sqliteTable("project_cache", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  status: text("status"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const sprintCacheTable = sqliteTable("sprint_cache", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  state: text("state"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const statusCacheTable = sqliteTable("status_cache", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id"),
  name: text("name").notNull(),
  color: text("color"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const priorityCacheTable = sqliteTable("priority_cache", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id"),
  name: text("name").notNull(),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const userCacheTable = sqliteTable("user_cache", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const tagCacheTable = sqliteTable("tag_cache", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const taskCacheTable = sqliteTable("task_cache", {
  id: text("id").primaryKey(),
  itemNo: text("item_no").notNull(),
  description: text("description"),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  sprintId: text("sprint_id"),
  sprintName: text("sprint_name"),
  name: text("name").notNull(),
  statusId: text("status_id").notNull(),
  statusName: text("status_name").notNull(),
  priorityId: text("priority_id"),
  priorityName: text("priority_name"),
  assigneeIdsJson: text("assignee_ids_json").notNull().default("[]"),
  assigneeNamesJson: text("assignee_names_json").notNull().default("[]"),
  dueDate: text("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  loggedMinutes: integer("logged_minutes").notNull().default(0),
  remainingMinutes: integer("remaining_minutes"),
  tagIdsJson: text("tag_ids_json").notNull().default("[]"),
  tagNamesJson: text("tag_names_json").notNull().default("[]"),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const timesheetLogCacheTable = sqliteTable("timesheet_log_cache", {
  id: text("id").primaryKey(),
  taskId: text("task_id"),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  sprintId: text("sprint_id"),
  taskName: text("task_name"),
  date: text("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  notes: text("notes").notNull().default(""),
  userId: text("user_id"),
  userName: text("user_name"),
  billable: integer("billable", { mode: "boolean" }).notNull().default(false),
  rawJson: text("raw_json"),
  syncedAt: text("synced_at").notNull(),
  ...timestamps,
});

export const savedViewsTable = sqliteTable("saved_views", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  route: text("route").notNull(),
  filtersJson: text("filters_json").notNull().default("{}"),
  columnsJson: text("columns_json").notNull().default("[]"),
  sortJson: text("sort_json").notNull().default("[]"),
  ...timestamps,
});

export const userPreferencesTable = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  density: text("density").notNull().default("comfortable"),
  theme: text("theme").notNull().default("light"),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  ...timestamps,
}, (table) => ({
  userIdx: uniqueIndex("user_preferences_user_idx").on(table.userId),
}));

export const syncStateTable = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  lastSuccessAt: text("last_success_at"),
  lastErrorAt: text("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  ...timestamps,
});

export const mutationAuditTable = sqliteTable("mutation_audit", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  responseJson: text("response_json"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const migrationsTable = sqliteTable("migrations", {
  id: text("id").primaryKey(),
  appliedAt: text("applied_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type DatabaseSchema = {
  usersTable: typeof usersTable;
  zohoConnectionsTable: typeof zohoConnectionsTable;
  sessionsTable: typeof sessionsTable;
  workspaceCacheTable: typeof workspaceCacheTable;
  projectCacheTable: typeof projectCacheTable;
  sprintCacheTable: typeof sprintCacheTable;
  statusCacheTable: typeof statusCacheTable;
  priorityCacheTable: typeof priorityCacheTable;
  userCacheTable: typeof userCacheTable;
  tagCacheTable: typeof tagCacheTable;
  taskCacheTable: typeof taskCacheTable;
  timesheetLogCacheTable: typeof timesheetLogCacheTable;
  savedViewsTable: typeof savedViewsTable;
  userPreferencesTable: typeof userPreferencesTable;
  syncStateTable: typeof syncStateTable;
  mutationAuditTable: typeof mutationAuditTable;
  migrationsTable: typeof migrationsTable;
};
