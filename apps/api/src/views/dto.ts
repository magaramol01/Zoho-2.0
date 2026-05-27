import { IsArray, IsObject, IsString } from "class-validator";

export class SaveViewDto {
  @IsString()
  name!: string;

  @IsString()
  route!: "tasks" | "today" | "timesheet";

  @IsObject()
  filters!: Record<string, string | string[] | null>;

  @IsArray()
  columns!: string[];

  @IsArray()
  sort!: Array<{ field: string; direction: "asc" | "desc" }>;
}
