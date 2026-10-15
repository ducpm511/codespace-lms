import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  SCRATCH_DECISION_NOTE_MAX,
  SCRATCH_NICKNAME_PATTERN,
  SCRATCH_REPORT_NOTE_MAX,
  SCRATCH_REPORT_REASONS,
} from '@lms/contracts';
import type {
  CreateScratchReportRequest,
  RequestScratchPublicationRequest,
  ResolveScratchReportRequest,
  ScratchModerationNoteRequest,
  ScratchReportReasonValue,
  SetScratchNicknameRequest,
} from '@lms/contracts';

const NICKNAME_MESSAGE = 'Biệt danh 2–24 ký tự: chữ, số, khoảng trắng, _ . -';

export class SetNicknameDto implements SetScratchNicknameRequest {
  @IsString()
  @Matches(SCRATCH_NICKNAME_PATTERN, { message: NICKNAME_MESSAGE })
  nickname!: string;
}

export class RequestPublicationDto implements RequestScratchPublicationRequest {
  @IsOptional()
  @IsString()
  @Matches(SCRATCH_NICKNAME_PATTERN, { message: NICKNAME_MESSAGE })
  nickname?: string;
}

export class CreateReportDto implements CreateScratchReportRequest {
  @IsIn([...SCRATCH_REPORT_REASONS])
  reason!: ScratchReportReasonValue;

  @IsOptional()
  @IsString()
  @MaxLength(SCRATCH_REPORT_NOTE_MAX)
  note?: string;
}

export class ModerationNoteDto implements ScratchModerationNoteRequest {
  @IsOptional()
  @IsString()
  @MaxLength(SCRATCH_DECISION_NOTE_MAX)
  note?: string;
}

export class ResolveReportDto implements ResolveScratchReportRequest {
  @IsIn(['dismiss', 'remove'])
  action!: 'dismiss' | 'remove';
}
