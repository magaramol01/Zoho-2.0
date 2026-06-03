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

  const zohoMessage =
    typeof body === "object" && body !== null && "message" in body && typeof (body as any).message === "string"
      ? (body as any).message
      : "Unexpected Zoho response";

  return new BadGatewayException({
    message: zohoMessage,
    details: body,
  });
};
