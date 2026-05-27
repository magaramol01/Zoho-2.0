import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TasksModule } from "../tasks/tasks.module";

@Module({
  imports: [TasksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
