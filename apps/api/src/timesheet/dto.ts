import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class TimesheetQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;
}

export class TimesheetAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(26)
  weeks?: number;
}

export class CreateTaskLogDto {
  @IsString()
  date!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsBoolean()
  billable!: boolean;
}

export class TimesheetDraftDto extends CreateTaskLogDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  sprintId?: string;
}

export class BulkTimesheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetDraftDto)
  logs!: TimesheetDraftDto[];
}

export class UpdateTimesheetLogDto {
  @IsString()
  date!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
