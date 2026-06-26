import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { MetadataService } from "./metadata.service";

@Controller("metadata")
@UseGuards(SessionAuthGuard)
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  getMetadata(@CurrentUser() user: { id: string }) {
    return this.metadataService.getMetadata(user.id);
  }
}
