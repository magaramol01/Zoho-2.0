import { Controller, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { interval, map, merge } from "rxjs";
import { EventBusService } from "./event-bus.service";

@Controller("events")
export class EventsController {
  constructor(private readonly eventBus: EventBusService) {}

  @Sse()
  stream() {
    return merge(
      this.eventBus.asObservable().pipe(map((data): MessageEvent => ({ data }))),
      interval(15_000).pipe(map((): MessageEvent => ({ data: { type: "heartbeat", at: new Date().toISOString() } }))),
    );
  }
}
