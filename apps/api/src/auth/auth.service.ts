import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
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

  async handleCallback({ code, accountsServer }: CallbackPayload): Promise<string> {
    if (!code) {
      throw new UnauthorizedException("Missing Zoho authorization code");
    }

    const url = new URL(`${accountsServer ?? this.config.zohoAccountsBaseUrl}/oauth/v2/token`);
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("client_id", this.config.zohoClientId);
    url.searchParams.set("client_secret", this.config.zohoClientSecret);
    url.searchParams.set("redirect_uri", this.config.zohoRedirectUri);
    url.searchParams.set("code", code);

    const response = await fetch(url, { method: "POST" });
    const body = await response.json() as any;
    if (!response.ok) {
      throw new UnauthorizedException(body);
    }

    // Call Sprints API using access_token to fetch Zoho User ID and details
    const resolvedAccountsServer = (accountsServer ?? this.config.zohoAccountsBaseUrl).toLowerCase();
    let apiBase = this.config.zohoApiBaseUrl;
    if (resolvedAccountsServer.includes("zoho.in")) {
      apiBase = "https://sprintsapi.zoho.in";
    } else if (resolvedAccountsServer.includes("zoho.eu")) {
      apiBase = "https://sprintsapi.zoho.eu";
    } else if (resolvedAccountsServer.includes("zoho.com.cn")) {
      apiBase = "https://sprintsapi.zoho.com.cn";
    } else if (resolvedAccountsServer.includes("zoho.com")) {
      apiBase = "https://sprintsapi.zoho.com";
    }

    console.log(`[AuthService] accountsServer: ${resolvedAccountsServer}, Resolved Sprints apiBase: ${apiBase}`);

    const teamsRes = await fetch(`${apiBase}/zsapi/teams/`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${body.access_token}`,
      },
    });
    if (!teamsRes.ok) {
      const errText = await teamsRes.text().catch(() => "");
      console.error(`[AuthService] Sprints API teams error: status=${teamsRes.status}, body=${errText}`);
      throw new UnauthorizedException({
        message: "Failed to fetch user teams details from Zoho Sprints",
        details: errText || teamsRes.statusText,
      });
    }
    const teamsPayload = await teamsRes.json() as any;

    const userDisplayNameMap = teamsPayload?.userDisplayName || {};
    const zohoUserId = Object.keys(userDisplayNameMap)[0] || "";
    const displayName = userDisplayNameMap[zohoUserId] || "Zoho User";

    let email = `user_${zohoUserId}@zoho.com`; // fallback

    const workspaceId = teamsPayload?.portals?.[0]?.zsoid;
    if (workspaceId && zohoUserId) {
      try {
        const usersRes = await fetch(`${apiBase}/zsapi/team/${workspaceId}/users/?action=data&index=1&range=250`, {
          headers: {
            Authorization: `Zoho-oauthtoken ${body.access_token}`,
          },
        });
        if (usersRes.ok) {
          const usersPayload = await usersRes.json() as any;
          const usersList = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
          const matchingUser = usersList.find((u: any) => String(u.iamUserId) === String(zohoUserId));
          if (matchingUser?.email) {
            email = matchingUser.email;
          }
        }
      } catch (err) {
        console.error("Failed to fetch user email from workspace details:", err);
      }
    }

    // Find existing user by ID (Zoho ZUID) or by email
    let [existingUser] = await this.db.db.select().from(usersTable).where(eq(usersTable.id, zohoUserId)).limit(1);
    if (!existingUser) {
      [existingUser] = await this.db.db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    }

    const userId = existingUser?.id ?? zohoUserId;

    await this.db.db.insert(usersTable).values({
      id: userId,
      email,
      displayName,
    }).onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email,
        displayName,
        updatedAt: new Date().toISOString(),
      },
    });

    await this.db.db.delete(zohoConnectionsTable).where(eq(zohoConnectionsTable.userId, userId));

    await this.db.db.insert(zohoConnectionsTable).values({
      id: nanoid(),
      userId,
      accessToken: encryptString(body.access_token, this.config.encryptionKey),
      refreshToken: encryptString(body.refresh_token ?? "", this.config.encryptionKey),
      apiDomain: apiBase,
      accountsServer: accountsServer ?? this.config.zohoAccountsBaseUrl,
      expiresAt: new Date(Date.now() + Number(body.expires_in ?? 3600) * 1000).toISOString(),
      scope: body.scope ?? this.config.zohoScopes,
    });

    return userId;
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

  async requireConnection(userId: string) {
    const [connection] = await this.db.db.select().from(zohoConnectionsTable).where(eq(zohoConnectionsTable.userId, userId)).limit(1);
    if (!connection) {
      throw new UnauthorizedException("Connect Zoho Sprints first");
    }

    return {
      ...connection,
      accessToken: decryptString(connection.accessToken, this.config.encryptionKey),
      refreshToken: decryptString(connection.refreshToken, this.config.encryptionKey),
    };
  }

  async ensureLocalSession(userId: string, res: Response) {
    const sessionToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await this.db.db.insert(sessionsTable).values({
      id: nanoid(),
      userId,
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
    const session = await this.getSession(req);
    await this.logout(req, res);
    
    if (session) {
      const userId = session.userId;
      await this.db.db.delete(zohoConnectionsTable).where(eq(zohoConnectionsTable.userId, userId));
      await this.db.db.delete(workspaceCacheTable).where(eq(workspaceCacheTable.ownerId, userId));
      await this.db.db.delete(projectCacheTable).where(eq(projectCacheTable.ownerId, userId));
      await this.db.db.delete(sprintCacheTable).where(eq(sprintCacheTable.ownerId, userId));
      await this.db.db.delete(statusCacheTable).where(eq(statusCacheTable.ownerId, userId));
      await this.db.db.delete(priorityCacheTable).where(eq(priorityCacheTable.ownerId, userId));
      await this.db.db.delete(userCacheTable).where(eq(userCacheTable.ownerId, userId));
      await this.db.db.delete(tagCacheTable).where(eq(tagCacheTable.ownerId, userId));
      await this.db.db.delete(taskCacheTable).where(eq(taskCacheTable.ownerId, userId));
      await this.db.db.delete(timesheetLogCacheTable).where(eq(timesheetLogCacheTable.ownerId, userId));
      await this.db.db.delete(savedViewsTable).where(eq(savedViewsTable.userId, userId));
      await this.db.db.delete(userPreferencesTable).where(eq(userPreferencesTable.userId, userId));
      await this.db.db.delete(mutationAuditTable).where(eq(mutationAuditTable.ownerId, userId));
      await this.db.db.delete(syncStateTable).where(eq(syncStateTable.ownerId, userId));
    }
  }
}
