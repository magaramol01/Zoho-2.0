import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { TaskPatch } from "@zoho-power-grid/shared";
import { TaskBulkDto, TaskPatchDto, TaskQueryDto } from "./dto";
import { TasksService } from "./tasks.service";
import { CreateTaskLogDto } from "../timesheet/dto";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("tasks")
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getTasks(@CurrentUser() user: { id: string }, @Query() query: TaskQueryDto) {
    return this.tasksService.getTasks(user.id, query);
  }

  @Patch(":taskId")
  updateTask(
    @CurrentUser() user: { id: string },
    @Param("taskId") taskId: string,
    @Body() body: TaskPatchDto,
  ) {
    return this.tasksService.updateTask(user.id, taskId, body as TaskPatch);
  }

  @Post("bulk")
  bulkUpdate(@CurrentUser() user: { id: string }, @Body() body: TaskBulkDto) {
    return this.tasksService.bulkUpdate(user.id, body);
  }

  @Post("sync")
  async syncTasks(@CurrentUser() user: { id: string }, @Body() body: TaskQueryDto) {
    await this.tasksService.syncTasksIfStale(user.id, body, true);
    return { ok: true };
  }

  @Post(":taskId/logs")
  addLog(
    @CurrentUser() user: { id: string },
    @Param("taskId") taskId: string,
    @Body() body: CreateTaskLogDto,
  ) {
    return this.tasksService.addTaskLog(user.id, taskId, body);
  }
}
