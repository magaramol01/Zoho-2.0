import { Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AppConfigService } from "../common/env";
import { mapUpstreamError } from "../common/http";
import { DatabaseService } from "../db/database.service";
import { zohoConnectionsTable } from "../db/schema";
import { AuthService } from "../auth/auth.service";
import { decryptString, encryptString } from "../common/crypto";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

@Injectable()
export class ZohoApiClient {
  constructor(
    private readonly config: AppConfigService,
    private readonly db: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  private async getConnection() {
    const [connection] = await this.db.db.select().from(zohoConnectionsTable).limit(1);
    if (!connection) {
      throw new UnauthorizedException("Connect Zoho Sprints first");
    }

    const accessToken = decryptString(connection.accessToken, this.config.encryptionKey);
    const refreshToken = decryptString(connection.refreshToken, this.config.encryptionKey);

    if (new Date(connection.expiresAt).getTime() < Date.now() + 60_000 && refreshToken) {
      return this.refreshConnection(connection.id, refreshToken, connection.accountsServer ?? this.config.zohoAccountsBaseUrl);
    }

    return {
      ...connection,
      accessToken,
      refreshToken,
    };
  }

  private async refreshConnection(connectionId: string, refreshToken: string, accountsServer: string) {
    const url = new URL(`${accountsServer}/oauth/v2/token`);
    url.searchParams.set("grant_type", "refresh_token");
    url.searchParams.set("client_id", this.config.zohoClientId);
    url.searchParams.set("client_secret", this.config.zohoClientSecret);
    url.searchParams.set("refresh_token", refreshToken);
    const response = await fetch(url, { method: "POST" });
    const body = await response.json();

    if (!response.ok) {
      throw new UnauthorizedException(body);
    }

    await this.db.db
      .update(zohoConnectionsTable)
      .set({
        accessToken: encryptString(body.access_token, this.config.encryptionKey),
        expiresAt: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000).toISOString(),
      })
      .where(eq(zohoConnectionsTable.id, connectionId));

    const [connection] = await this.db.db.select().from(zohoConnectionsTable).where(eq(zohoConnectionsTable.id, connectionId)).limit(1);
    return {
      ...connection!,
      accessToken: body.access_token as string,
      refreshToken,
    };
  }

  private buildUrl(path: string, query?: QueryParams) {
    const base = this.config.zohoApiBaseUrl.replace(/\/$/, "");
    const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
    return url;
  }

  async request<T>(options: {
    path: string;
    method?: "GET" | "POST" | "DELETE";
    query?: QueryParams;
    body?: BodyInit | null;
    headers?: HeadersInit;
  }): Promise<T> {
    const connection = await this.getConnection();
    const url = this.buildUrl(options.path, options.query);

    const attempt = async () => {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${connection.accessToken}`,
          ...(options.headers ?? {}),
        },
        body: options.body,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const parsedBody = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        throw mapUpstreamError(response.status, parsedBody);
      }

      return parsedBody as T;
    };

    try {
      return await attempt();
    } catch (error) {
      if (options.method === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return attempt();
      }

      throw error;
    }
  }

  async canUseZoho() {
    try {
      await this.authService.requireConnection();
      return true;
    } catch {
      return false;
    }
  }
}
