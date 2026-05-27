import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { SaveViewDto } from "./dto";
import { ViewsService } from "./views.service";

@Controller("views")
@UseGuards(SessionAuthGuard)
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get()
  list() {
    return this.viewsService.listViews();
  }

  @Post()
  create(@Body() body: SaveViewDto) {
    return this.viewsService.createView(body);
  }

  @Patch(":viewId")
  update(@Param("viewId") viewId: string, @Body() body: SaveViewDto) {
    return this.viewsService.updateView(viewId, body);
  }
}
