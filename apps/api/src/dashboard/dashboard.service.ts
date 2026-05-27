import { Injectable } from "@nestjs/common";
import type { DashboardSummary } from "@zoho-power-grid/shared";
import { TasksService } from "../tasks/tasks.service";

@Injectable()
export class DashboardService {
  constructor(private readonly tasksService: TasksService) {}

  async getSummary(): Promise<DashboardSummary> {
    const tasks = await this.tasksService.getTasks({});
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter((task) => task.dueDate && task.dueDate < today);
    const inProgress = tasks.filter((task) => task.statusName.toLowerCase().includes("progress"));
    const sprintProgressMap = new Map<string, DashboardSummary["sprintProgress"][number]>();

    tasks.forEach((task) => {
      if (!task.sprintId || !task.sprintName) {
        return;
      }
      const current = sprintProgressMap.get(task.sprintId) ?? {
        sprintId: task.sprintId,
        sprintName: task.sprintName,
        projectName: task.projectName,
        total: 0,
        completed: 0,
      };
      current.total += 1;
      if (task.statusName.toLowerCase().includes("done") || task.statusName.toLowerCase().includes("closed")) {
        current.completed += 1;
      }
      sprintProgressMap.set(task.sprintId, current);
    });

    return {
      todayCount: tasks.filter((task) => task.dueDate === today).length,
      overdueCount: overdue.length,
      inProgressCount: inProgress.length,
      remainingMinutes: tasks.reduce((sum, task) => sum + (task.remainingMinutes ?? 0), 0),
      recentlyUpdated: tasks.slice(0, 5),
      sprintProgress: Array.from(sprintProgressMap.values()),
    };
  }
}
