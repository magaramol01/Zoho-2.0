import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { TaskPatch } from "@zoho-power-grid/shared";
import { TaskBulkDto, TaskPatchDto, TaskQueryDto } from "./dto";
import { TasksService } from "./tasks.service";
import { CreateTaskLogDto } from "../timesheet/dto";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getTasks(@Query() query: TaskQueryDto) {
    return this.tasksService.getTasks(query);
  }

  @Patch(":taskId")
  updateTask(@Param("taskId") taskId: string, @Body() body: TaskPatchDto) {
    return this.tasksService.updateTask(taskId, body as TaskPatch);
  }

  @Post("bulk")
  bulkUpdate(@Body() body: TaskBulkDto) {
    return this.tasksService.bulkUpdate(body);
  }

  @Post("sync")
  async syncTasks(@Body() body: TaskQueryDto) {
    await this.tasksService.syncTasksIfStale(body, true);
    return { ok: true };
  }

  @Post(":taskId/logs")
  addLog(@Param("taskId") taskId: string, @Body() body: CreateTaskLogDto) {
    return this.tasksService.addTaskLog(taskId, body);
  }
}
