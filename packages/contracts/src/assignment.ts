// Hợp đồng Assignment/Submission (nộp/chấm tay). Chỉ type. docs/DESIGN.md §4.4, §5.2.
// Điểm (score/maxScore) là Decimal ở DB — API trả `number` (đã convert ở mapper).

export type SubmissionTypeValue = 'text' | 'file' | 'link';
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
}

export interface UpdateAssignmentRequest {
  title?: string;
  descriptionMd?: string | null;
  dueAt?: string | null;
  maxScore?: number;
  allowLate?: boolean;
  submissionType?: SubmissionTypeValue;
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
}

/** Giáo viên chấm tay: điểm + nhận xét. Server không tin điểm client cho các loại autograde (P3/P4). */
export interface GradeSubmissionRequest {
  score: number;
  feedbackMd?: string;
}
