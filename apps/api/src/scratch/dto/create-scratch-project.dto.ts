import { IsString, Matches, MaxLength } from 'class-validator';
import { SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type { CreateScratchProjectRequest } from '@lms/contracts';

export class CreateScratchProjectDto implements CreateScratchProjectRequest {
  @IsString()
  @Matches(/\S/, { message: 'Tên dự án không được để trống' })
  @MaxLength(SCRATCH_TITLE_MAX_LENGTH)
  title!: string;
}
