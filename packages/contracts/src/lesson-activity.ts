// Hợp đồng LessonActivity (P7) — 1 bài học = danh sách activity có thứ tự. Chỉ type. docs/DESIGN.md §4.2.
// INVARIANT: student-facing DTO KHÔNG chứa đáp án quiz / hidden test coding / quiz draft.
// Activity trỏ tới engine (quiz/coding/assignment) chỉ mang `refId` + tiêu đề — nội dung lấy qua endpoint engine
// sẵn có (đã tự enforce membership/gate/không lộ đáp án).

export type LessonActivityTypeValue = 'markdown' | 'pdf' | 'video' | 'quiz' | 'coding' | 'assignment';

export const LESSON_ACTIVITY_TYPES: readonly LessonActivityTypeValue[] = [
  'markdown',
  'pdf',
  'video',
  'quiz',
  'coding',
  'assignment',
];

/** Activity trỏ tới engine sẵn có — cần `refId`. */
export const REF_ACTIVITY_TYPES: readonly LessonActivityTypeValue[] = ['quiz', 'coding', 'assignment'];

/**
 * Allowlist host được phép nhúng `<iframe>` cho activity video (INVARIANT chống clickjacking/inject).
 * Dùng chung BE (validate khi ghi) và FE (chỉ render khi host khớp).
 */
export const VIDEO_EMBED_HOSTS: readonly string[] = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'drive.google.com',
];

/** Kích thước tối đa cho file upload (PDF slide). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Mime được phép upload ở P7 (chỉ PDF slide — video dùng link nhúng, không upload). */
export const ALLOWED_UPLOAD_MIMES: readonly string[] = ['application/pdf'];

// --- File ---

export interface FileUploadResponse {
  id: string;
  fileName?: string | null;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

// --- Activity ---

interface LessonActivityBase {
  id: string;
  lessonId: string;
  order: number;
  type: LessonActivityTypeValue;
  title?: string | null;
  /** type=markdown */
  contentMd?: string | null;
  /** type=pdf — tải qua `GET /files/:id` (private, có guard membership). */
  fileId?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  /** type=video — link nhúng, host thuộc `VIDEO_EMBED_HOSTS`. */
  videoUrl?: string | null;
  /** type=quiz|coding|assignment — id của Quiz/CodingProblem/Assignment. */
  refId?: string | null;
  refTitle?: string | null;
}

/** Author surface (giáo viên soạn bài). */
export interface LessonActivityDto extends LessonActivityBase {
  createdAt: string;
  updatedAt: string;
}

/**
 * Student surface. `refAvailable=false` khi ref bị khoá (quiz chưa publish, bài đã xoá…) —
 * FE hiển thị trạng thái chờ thay vì mở workspace.
 */
export interface StudentLessonActivityDto extends LessonActivityBase {
  refAvailable?: boolean;
}

// --- Requests ---

export interface CreateLessonActivityRequest {
  type: LessonActivityTypeValue;
  title?: string;
  order?: number;
  contentMd?: string;
  fileId?: string;
  videoUrl?: string;
  refId?: string;
}

export interface UpdateLessonActivityRequest {
  title?: string | null;
  contentMd?: string | null;
  fileId?: string | null;
  videoUrl?: string | null;
  refId?: string | null;
}

/** Sắp xếp lại: gửi ĐỦ id của mọi activity trong bài, theo thứ tự mong muốn. */
export interface ReorderLessonActivitiesRequest {
  activityIds: string[];
}
