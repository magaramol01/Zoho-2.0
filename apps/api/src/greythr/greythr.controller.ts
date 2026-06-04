import { Controller, Get, Post, Body } from '@nestjs/common';
import { GreythrService } from './greythr.service';

@Controller('greythr')
export class GreythrController {
  constructor(private readonly greythrService: GreythrService) {}

  @Get('credentials')
  async getCredentials() {
    const creds = await this.greythrService.getCredentials();
    return creds || { username: '', password: '' };
  }

  @Post('credentials')
  async saveCredentials(@Body() body: any) {
    await this.greythrService.saveCredentials(body.username, body.password);
    return { success: true };
  }

  @Post('sync')
  async syncGreythr() {
    try {
      const data = await this.greythrService.syncGreythr();
      return { success: true, ...data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
