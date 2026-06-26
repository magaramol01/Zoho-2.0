import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  summary(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getSummary(user.id);
  }
}
