import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url().default("http://localhost:5173"),
  SESSION_COOKIE_NAME: z.string().default("zoho_power_grid_session"),
  APP_ENCRYPTION_KEY: z.string().min(32),
  SQLITE_DB_PATH: z.string().default("./data/zoho-power-grid.db"),
  ZOHO_CLIENT_ID: z.string().default(""),
  ZOHO_CLIENT_SECRET: z.string().default(""),
  ZOHO_REDIRECT_URI: z.string().url().default("http://localhost:3001/api/auth/callback"),
  ZOHO_SCOPES: z.string().default("ZohoSprints.projects.ALL,ZohoSprints.sprints.ALL,ZohoSprints.items.ALL,ZohoSprints.timesheet.ALL"),
  ZOHO_ACCOUNTS_BASE_URL: z.string().url().default("https://accounts.zoho.com"),
  ZOHO_API_BASE_URL: z.string().url().default("https://sprintsapi.zoho.com"),
});

export type AppEnv = z.infer<typeof envSchema>;

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  get port() {
    return this.config.get("PORT", { infer: true });
  }

  get appUrl() {
    return this.config.get("APP_URL", { infer: true });
  }

  get sessionCookieName() {
    return this.config.get("SESSION_COOKIE_NAME", { infer: true });
  }

  get encryptionKey() {
    return this.config.get("APP_ENCRYPTION_KEY", { infer: true });
  }

  get sqlitePath() {
    return this.config.get("SQLITE_DB_PATH", { infer: true });
  }

  get zohoClientId() {
    return this.config.get("ZOHO_CLIENT_ID", { infer: true });
  }

  get zohoClientSecret() {
    return this.config.get("ZOHO_CLIENT_SECRET", { infer: true });
  }

  get zohoRedirectUri() {
    return this.config.get("ZOHO_REDIRECT_URI", { infer: true });
  }

  get zohoScopes() {
    return this.config.get("ZOHO_SCOPES", { infer: true });
  }

  get zohoAccountsBaseUrl() {
    return this.config.get("ZOHO_ACCOUNTS_BASE_URL", { infer: true });
  }

  get zohoApiBaseUrl() {
    return this.config.get("ZOHO_API_BASE_URL", { infer: true });
  }
}
