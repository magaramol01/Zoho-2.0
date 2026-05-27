import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import type { BootstrapPayload } from "@zoho-power-grid/shared";
import { MetadataService } from "./metadata/metadata.service";
import { ViewsService } from "./views/views.service";
import { AuthService } from "./auth/auth.service";
import { AppConfigService } from "./common/env";

@Controller()
export class BootstrapController {
  constructor(
    private readonly metadataService: MetadataService,
    private readonly viewsService: ViewsService,
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Get("bootstrap")
  async bootstrap(@Req() req: Request): Promise<BootstrapPayload> {
    const session = await this.authService.getSession(req);
    const metadata = await this.metadataService.getMetadata();
    const savedViews = await this.viewsService.listViews();

    return {
      authenticated: Boolean(session),
      authUrl: session ? null : this.authService.buildAuthorizationUrl(),
      currentUser: session
        ? {
            id: session.userId,
            email: session.userEmail,
            displayName: session.userDisplayName,
          }
        : null,
      metadata,
      savedViews,
      shortcuts: [
        { combo: "/", description: "Focus global search" },
        { combo: "g t", description: "Open task grid" },
        { combo: "g l", description: "Open timesheet" },
        { combo: "g d", description: "Open dashboard" },
        { combo: "Ctrl/Cmd+Enter", description: "Quick log for selected task" },
        { combo: "Ctrl/Cmd+Shift+L", description: "Duplicate previous timesheet row" },
      ],
    };
  }
}
