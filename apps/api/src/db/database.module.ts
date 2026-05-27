import { Global, Module } from "@nestjs/common";
import { AppConfigService } from "../common/env";
import { DatabaseService } from "./database.service";

@Global()
@Module({
  providers: [AppConfigService, DatabaseService],
  exports: [AppConfigService, DatabaseService],
})
export class DatabaseModule {}
