import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class TaskQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  mine?: string;
}

export class TaskPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  priorityId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  estimatedMinutes?: number | null;

  @IsOptional()
  @IsInt()
  remainingMinutes?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

export class TaskBulkDto {
  @IsIn(["set-status", "move-sprint", "set-priority"])
  type!: "set-status" | "move-sprint" | "set-priority";

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  taskIds!: string[];

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  priorityId?: string | null;
}
