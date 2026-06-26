import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  BulkTimesheetDto,
  TimesheetAnalyticsQueryDto,
  TimesheetQueryDto,
  UpdateTimesheetLogDto,
} from "./dto";
import { TimesheetService } from "./timesheet.service";

@Controller("timesheet")
@UseGuards(SessionAuthGuard)
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Get()
  listLogs(@CurrentUser() user: { id: string }, @Query() query: TimesheetQueryDto) {
    return this.timesheetService.listLogs(user.id, query);
  }

  @Get("analytics")
  getAnalytics(@CurrentUser() user: { id: string }, @Query() query: TimesheetAnalyticsQueryDto) {
    return this.timesheetService.getAnalytics(user.id, query);
  }

  @Post("bulk")
  createLogs(@CurrentUser() user: { id: string }, @Body() body: BulkTimesheetDto) {
    return this.timesheetService.createLogs(user.id, body.logs);
  }

  @Patch(":logId")
  updateLog(
    @CurrentUser() user: { id: string },
    @Param("logId") logId: string,
    @Body() body: UpdateTimesheetLogDto,
  ) {
    return this.timesheetService.updateLog(user.id, logId, body);
  }

  @Delete(":logId")
  @HttpCode(200)
  deleteLog(@CurrentUser() user: { id: string }, @Param("logId") logId: string) {
    return this.timesheetService.deleteLog(user.id, logId);
  }
}
