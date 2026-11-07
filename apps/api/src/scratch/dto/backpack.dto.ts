import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { SCRATCH_BACKPACK_ITEM_TYPES, SCRATCH_BACKPACK_PAGE_MAX, SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type { CreateScratchBackpackItemRequest, ScratchBackpackItemTypeValue } from '@lms/contracts';

/** Trường văn bản của multipart thêm mục ba lô (file `body` + `thumbnail` kiểm ở service). */
export class CreateScratchBackpackItemDto implements CreateScratchBackpackItemRequest {
  @IsIn(SCRATCH_BACKPACK_ITEM_TYPES)
  type!: ScratchBackpackItemTypeValue;

  @IsString()
  @Matches(/\S/, { message: 'Tên không được để trống' })
  @MaxLength(SCRATCH_TITLE_MAX_LENGTH)
  name!: string;
}

/** Phân trang kiểu trình soạn Scratch: offset + limit. */
export class ListScratchBackpackQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SCRATCH_BACKPACK_PAGE_MAX)
  limit: number = 20;
}
