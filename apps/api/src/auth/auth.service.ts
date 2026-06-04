import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { decryptString, encryptString } from "../common/crypto";
import { AppConfigService } from "../common/env";
import { DatabaseService } from "../db/database.service";
import {
  sessionsTable,
  syncStateTable,
  usersTable,
  zohoConnectionsTable,
  workspaceCacheTable,
  projectCacheTable,
  sprintCacheTable,
  statusCacheTable,
  priorityCacheTable,
  userCacheTable,
  tagCacheTable,
  taskCacheTable,
  timesheetLogCacheTable,
  savedViewsTable,
  userPreferencesTable,
  mutationAuditTable,
} from "../db/schema";

type CallbackPayload = {
  code?: string;
  accountsServer?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

  buildAuthorizationUrl() {
    const url = new URL(`${this.config.zohoAccountsBaseUrl}/oauth/v2/auth`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.zohoClientId);
    url.searchParams.set("scope", this.config.zohoScopes);
    url.searchParams.set("redirect_uri", this.config.zohoRedirectUri);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async handleCallback({ code, accountsServer }: CallbackPayload) {
    if (!code) {
      throw new UnauthorizedException("Missing Zoho authorization code");
    }

    const user = await this.db.ensureDefaultUser();
    const url = new URL(`${accountsServer ?? this.config.zohoAccountsBaseUrl}/oauth/v2/token`);
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("client_id", this.config.zohoClientId);
    url.searchParams.set("client_secret", this.config.zohoClientSecret);
    url.searchParams.set("redirect_uri", this.config.zohoRedirectUri);
    url.searchParams.set("code", code);

    const response = await fetch(url, { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      throw new UnauthorizedException(body);
    }

    await this.db.db.insert(usersTable).values({
      id: user.id,
      email: body.email ?? user.email,
      displayName: body.display_name ?? user.displayName,
    }).onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: body.email ?? user.email,
        displayName: body.display_name ?? user.displayName,
      },
    });

    await this.db.db.delete(zohoConnectionsTable);

    await this.db.db.insert(zohoConnectionsTable).values({
      id: nanoid(),
      userId: user.id,
      accessToken: encryptString(body.access_token, this.config.encryptionKey),
      refreshToken: encryptString(body.refresh_token ?? "", this.config.encryptionKey),
      apiDomain: body.api_domain ?? this.config.zohoApiBaseUrl,
      accountsServer: accountsServer ?? this.config.zohoAccountsBaseUrl,
      expiresAt: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000).toISOString(),
      scope: body.scope ?? this.config.zohoScopes,
    });
  }

  async getSession(req: Request) {
    const token = req.cookies?.[this.config.sessionCookieName] as string | undefined;
    if (!token) {
      return null;
    }

    const [session] = await this.db.db.select().from(sessionsTable).where(eq(sessionsTable.sessionToken, token)).limit(1);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    const [user] = await this.db.db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    if (!user) {
      return null;
    }

    return {
      id: session.id,
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
    };
  }

  async requireConnection() {
    const [connection] = await this.db.db.select().from(zohoConnectionsTable).limit(1);
    if (!connection) {
      throw new UnauthorizedException("Connect Zoho Sprints first");
    }

    return {
      ...connection,
      accessToken: decryptString(connection.accessToken, this.config.encryptionKey),
      refreshToken: decryptString(connection.refreshToken, this.config.encryptionKey),
    };
  }

  async ensureLocalSession(res: Response) {
    const user = await this.db.ensureDefaultUser();
    const sessionToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await this.db.db.insert(sessionsTable).values({
      id: nanoid(),
      userId: user.id,
      sessionToken,
      expiresAt,
    });

    res.cookie(this.config.sessionCookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(expiresAt),
    });
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[this.config.sessionCookieName] as string | undefined;
    if (token) {
      await this.db.db.delete(sessionsTable).where(eq(sessionsTable.sessionToken, token));
    }
    res.clearCookie(this.config.sessionCookieName, { path: "/" });
  }

  async disconnect(req: Request, res: Response) {
    await this.logout(req, res);
    
    // Clear all connection and cache data to ensure a completely fresh start on next login
    await this.db.db.delete(zohoConnectionsTable);
    await this.db.db.delete(workspaceCacheTable);
    await this.db.db.delete(projectCacheTable);
    await this.db.db.delete(sprintCacheTable);
    await this.db.db.delete(statusCacheTable);
    await this.db.db.delete(priorityCacheTable);
    await this.db.db.delete(userCacheTable);
    await this.db.db.delete(tagCacheTable);
    await this.db.db.delete(taskCacheTable);
    await this.db.db.delete(timesheetLogCacheTable);
    await this.db.db.delete(savedViewsTable);
    await this.db.db.delete(userPreferencesTable);
    await this.db.db.delete(mutationAuditTable);
    
    // We clear all sync state, not just specific keys, to ensure full wipe
    await this.db.db.delete(syncStateTable);
  }
}
