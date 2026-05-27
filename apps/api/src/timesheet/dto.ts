import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class TimesheetQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;
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
