import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { ZohoApiClient } from "./src/zoho/zoho-api.client";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const client = app.get(ZohoApiClient);
  const res = await client.request({
    path: `/zsapi/team/60032691013/projects/32201000000320377/timesheet/`,
    query: { action: "data", index: 1, range: 2 }
  });
  console.log(JSON.stringify(res, null, 2));
  await app.close();
}
run();
