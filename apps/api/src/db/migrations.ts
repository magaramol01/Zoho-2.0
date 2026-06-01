export const migrations = [
  {
    id: "0001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

      CREATE TABLE IF NOT EXISTS zoho_connections (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        api_domain TEXT,
        accounts_server TEXT,
        expires_at TEXT NOT NULL,
        scope TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        session_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(session_token);

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

      CREATE TABLE IF NOT EXISTS task_cache (
        id TEXT PRIMARY KEY NOT NULL,
        item_no TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS saved_views (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        route TEXT NOT NULL,
        filters_json TEXT NOT NULL DEFAULT '{}',
        columns_json TEXT NOT NULL DEFAULT '[]',
        sort_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        density TEXT NOT NULL DEFAULT 'comfortable',
        theme TEXT NOT NULL DEFAULT 'light',
        preferences_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_idx ON user_preferences(user_id);

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        last_success_at TEXT,
        last_error_at TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS mutation_audit (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        response_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: "0002_task_description",
    sql: `
      ALTER TABLE task_cache ADD COLUMN description TEXT;
    `,
  },
  {
    id: "0003_timesheet_log_owner_fields",
    sql: `
      ALTER TABLE timesheet_log_cache ADD COLUMN user_id TEXT;
      ALTER TABLE timesheet_log_cache ADD COLUMN user_name TEXT;
    `,
  },
];
