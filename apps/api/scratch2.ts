import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { TimesheetService } from "./src/timesheet/timesheet.service";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(TimesheetService);
  const res = await service.getAnalytics({});
  console.log(JSON.stringify(res, null, 2));
  await app.close();
}
run();
