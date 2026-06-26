import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SaveViewDto } from "./dto";
import { ViewsService } from "./views.service";

@Controller("views")
@UseGuards(SessionAuthGuard)
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.viewsService.listViews(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() body: SaveViewDto) {
    return this.viewsService.createView(user.id, body);
  }

  @Patch(":viewId")
  update(
    @CurrentUser() user: { id: string },
    @Param("viewId") viewId: string,
    @Body() body: SaveViewDto,
  ) {
    return this.viewsService.updateView(user.id, viewId, body);
  }
}
