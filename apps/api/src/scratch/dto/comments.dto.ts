import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { SCRATCH_BANNED_WORD_MAX_LENGTH, SCRATCH_COMMENT_MAX_LENGTH } from '@lms/contracts';
import type {
  AddScratchBannedWordRequest,
  CreateScratchCommentRequest,
  ResolveScratchCommentReportRequest,
  ScratchCommentReportActionValue,
  SetScratchCommentsOpenRequest,
} from '@lms/contracts';

export class CreateCommentDto implements CreateScratchCommentRequest {
  @IsString()
  @MinLength(1)
  // Cho dư khoảng trắng đầu/cuối; độ dài thật (sau trim) kiểm ở service.
  @MaxLength(SCRATCH_COMMENT_MAX_LENGTH + 50)
  content!: string;
}

export class SetCommentsOpenDto implements SetScratchCommentsOpenRequest {
  @IsBoolean()
  open!: boolean;
}

export class ResolveCommentReportDto implements ResolveScratchCommentReportRequest {
  @IsIn(['dismiss', 'hide', 'delete'])
  action!: ScratchCommentReportActionValue;
}

export class AddBannedWordDto implements AddScratchBannedWordRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(SCRATCH_BANNED_WORD_MAX_LENGTH)
  word!: string;
}
