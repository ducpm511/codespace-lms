import { IsIn, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { SCRATCH_SELF_VISIBILITIES, SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type { ScratchVisibilityValue, UpdateScratchProjectRequest } from '@lms/contracts';

export class UpdateScratchProjectDto implements UpdateScratchProjectRequest {
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Tên dự án không được để trống' })
  @MaxLength(SCRATCH_TITLE_MAX_LENGTH)
  title?: string;

  /** `public` KHÔNG có ở đây — chỉ qua quy trình GV duyệt (ADR D4′). */
  @IsOptional()
  @IsIn([...SCRATCH_SELF_VISIBILITIES])
  visibility?: ScratchVisibilityValue;

  /** null = bỏ lớp. Quyền với lớp kiểm ở service (phải là thành viên đang hoạt động). */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  classId?: string | null;
}
