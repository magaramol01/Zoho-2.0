import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { MetadataService } from "./metadata.service";

@Controller("metadata")
@UseGuards(SessionAuthGuard)
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  getMetadata() {
    return this.metadataService.getMetadata();
  }
}
