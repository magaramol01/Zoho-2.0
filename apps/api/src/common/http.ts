import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common";

export const mapUpstreamError = (status: number, body: unknown) => {
  if (status === 429) {
    return new ServiceUnavailableException({
      message: "Zoho rate limit reached",
      details: body,
    });
  }

  if (status >= 500) {
    return new GatewayTimeoutException({
      message: "Zoho Sprints is temporarily unavailable",
      details: body,
    });
  }

  return new BadGatewayException({
    message: "Unexpected Zoho response",
    details: body,
  });
};
