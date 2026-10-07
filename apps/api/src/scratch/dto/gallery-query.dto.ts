import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ScratchGalleryScope } from '@lms/contracts';

export class GalleryQueryDto {
  @IsIn(['class', 'school'])
  scope!: ScratchGalleryScope;

  /** Bắt buộc khi scope = class; quyền với lớp kiểm ở service. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  classId?: string;
}
