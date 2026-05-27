import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppConfigService } from "../common/env";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Get("login")
  login(@Res() res: Response) {
    return res.redirect(this.authService.buildAuthorizationUrl());
  }

  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("accounts-server") accountsServer: string | undefined,
    @Res() res: Response,
  ) {
    await this.authService.handleCallback({ code, accountsServer });
    await this.authService.ensureLocalSession(res);
    return res.redirect(this.config.appUrl);
  }

  @Get("logout")
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.authService.logout(req, res);
    return res.json({ ok: true });
  }
}
