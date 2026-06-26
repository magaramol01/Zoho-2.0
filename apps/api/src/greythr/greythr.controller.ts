import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { GreythrService } from './greythr.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('greythr')
@UseGuards(SessionAuthGuard)
export class GreythrController {
  constructor(private readonly greythrService: GreythrService) {}

  @Get('credentials')
  async getCredentials(@CurrentUser() user: { id: string }) {
    const creds = await this.greythrService.getCredentials(user.id);
    return {
      hasCredentials: !!(creds?.username && creds?.password),
      username: creds?.username ?? null,
    };
  }

  @Post('credentials')
  async saveCredentials(@CurrentUser() user: { id: string }, @Body() body: any) {
    await this.greythrService.saveCredentials(user.id, body.username, body.password);
    return { success: true };
  }

  @Post('sync')
  async syncGreythr(@CurrentUser() user: { id: string }) {
    try {
      const data = await this.greythrService.syncGreythr(user.id);
      return { success: true, ...data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
