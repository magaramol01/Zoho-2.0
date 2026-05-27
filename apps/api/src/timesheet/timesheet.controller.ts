import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { BulkTimesheetDto, TimesheetQueryDto } from "./dto";
import { TimesheetService } from "./timesheet.service";

@Controller("timesheet")
@UseGuards(SessionAuthGuard)
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @Get()
  listLogs(@Query() query: TimesheetQueryDto) {
    return this.timesheetService.listLogs(query);
  }

  @Post("bulk")
  createLogs(@Body() body: BulkTimesheetDto) {
    return this.timesheetService.createLogs(body.logs);
  }
}
