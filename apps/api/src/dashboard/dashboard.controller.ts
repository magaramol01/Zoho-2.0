import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  summary() {
    return this.dashboardService.getSummary();
  }
}
