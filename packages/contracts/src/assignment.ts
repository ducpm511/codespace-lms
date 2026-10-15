// Hợp đồng Assignment/Submission (nộp/chấm tay). Chỉ type. docs/DESIGN.md §4.4, §5.2.
// Điểm (score/maxScore) là Decimal ở DB — API trả `number` (đã convert ở mapper).

import type { ScratchCheck } from './scratch';

/** `scratch` (P11 T11.7): nộp một phiên bản đóng băng của dự án BlockSpace. */
export type SubmissionTypeValue = 'text' | 'file' | 'link' | 'scratch';
export const SUBMISSION_TYPES: readonly SubmissionTypeValue[] = ['text', 'file', 'link', 'scratch'];
export type SubmissionStatusValue = 'draft' | 'submitted' | 'graded' | 'returned';

export interface AssignmentSummary {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  dueAt?: string | null;
  maxScore: number;
  allowLate: boolean;
  submissionType: string;
  /** submissionType = scratch: tiêu chí gợi ý GV đã chọn (null = không có). */
  scratchChecks?: ScratchCheck[] | null;
  createdAt: string;
}

export interface AssignmentDetail extends AssignmentSummary {
  descriptionMd?: string | null;
}

export interface CreateAssignmentRequest {
  courseId: string;
  lessonId?: string;
  title: string;
  descriptionMd?: string;
  dueAt?: string;
  maxScore?: number;
  allowLate?: boolean;
  submissionType?: SubmissionTypeValue;
  scratchChecks?: ScratchCheck[];
}

export interface UpdateAssignmentRequest {
  title?: string;
  descriptionMd?: string | null;
  dueAt?: string | null;
  maxScore?: number;
  allowLate?: boolean;
  submissionType?: SubmissionTypeValue;
  scratchChecks?: ScratchCheck[] | null;
}

/** Bài nộp BlockSpace: phiên bản đóng băng đã nộp (xem / chấm qua `/scratch/submissions/:id/...`). */
export interface SubmissionScratchDto {
  projectId: string;
  projectTitle: string;
  versionSeq: number;
  frozenAt: string;
}

/** Bài nộp. Khi giáo viên xem: kèm danh tính học viên (email/fullName). */
export interface SubmissionDto {
  id: string;
  assignmentId: string;
  userId: string;
  classId: string;
  status: string;
  contentText?: string | null;
  linkUrl?: string | null;
  fileId?: string | null;
  scratch?: SubmissionScratchDto | null;
  score?: number | null;
  feedbackMd?: string | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
  email?: string;
  fullName?: string;
}

/** Học viên lưu/nộp bài trong một lớp cụ thể. */
export interface SaveSubmissionRequest {
  classId: string;
  contentText?: string;
  linkUrl?: string;
  fileId?: string;
  /** submissionType = scratch: dự án của mình (chủ / đồng tác giả) — server đóng băng phiên bản mới nhất. */
  scratchProjectId?: string;
}

/** Giáo viên chấm tay: điểm + nhận xét. Server không tin điểm client cho các loại autograde (P3/P4). */
export interface GradeSubmissionRequest {
  score: number;
  feedbackMd?: string;
}
