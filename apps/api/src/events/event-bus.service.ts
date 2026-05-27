import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export type AppEvent =
  | { type: "sync"; scope: string; at: string }
  | { type: "task-updated"; taskId: string; at: string }
  | { type: "timesheet-updated"; at: string };

@Injectable()
export class EventBusService {
  private readonly stream = new Subject<AppEvent>();

  emit(event: AppEvent) {
    this.stream.next(event);
  }

  asObservable() {
    return this.stream.asObservable();
  }
}
