import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
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
  listLogs(@Query() query: TimesheetQueryDto) {
    return this.timesheetService.listLogs(query);
  }

  @Get("analytics")
  getAnalytics(@Query() query: TimesheetAnalyticsQueryDto) {
    return this.timesheetService.getAnalytics(query);
  }

  @Post("bulk")
  createLogs(@Body() body: BulkTimesheetDto) {
    return this.timesheetService.createLogs(body.logs);
  }

  @Patch(":logId")
  updateLog(@Param("logId") logId: string, @Body() body: UpdateTimesheetLogDto) {
    return this.timesheetService.updateLog(logId, body);
  }
}
