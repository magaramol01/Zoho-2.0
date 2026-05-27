import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.authService.getSession(request);

    if (!session) {
      throw new UnauthorizedException("Sign in with Zoho first");
    }

    return true;
  }
}
