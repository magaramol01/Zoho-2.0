import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { envSchema } from "./common/env";
import { DatabaseModule } from "./db/database.module";
import { AuthModule } from "./auth/auth.module";
import { ZohoModule } from "./zoho/zoho.module";
import { MetadataModule } from "./metadata/metadata.module";
import { TasksModule } from "./tasks/tasks.module";
import { TimesheetModule } from "./timesheet/timesheet.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ViewsModule } from "./views/views.module";
import { EventsModule } from "./events/events.module";
import { SyncModule } from "./sync/sync.module";
import { BootstrapController } from "./bootstrap.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (input) => envSchema.parse(input),
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ZohoModule,
    MetadataModule,
    TasksModule,
    TimesheetModule,
    DashboardModule,
    ViewsModule,
    EventsModule,
    SyncModule,
  ],
  controllers: [BootstrapController],
})
export class AppModule {}
