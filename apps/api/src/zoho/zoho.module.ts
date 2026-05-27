import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ZohoApiClient } from "./zoho-api.client";
import { ZohoNormalizer } from "./zoho-normalizer";

@Global()
@Module({
  imports: [AuthModule],
  providers: [ZohoApiClient, ZohoNormalizer],
  exports: [ZohoApiClient, ZohoNormalizer],
})
export class ZohoModule {}
