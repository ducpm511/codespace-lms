import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Không có trong @lms/contracts (thao tác biên soạn nội bộ) — DTO cục bộ apps/api. */
export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}
