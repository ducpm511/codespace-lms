// Hợp đồng BlockSpace (P11, Scratch Studio) FE <-> BE. Chỉ type + hằng số. docs/adr/003-scratch-studio.md.
// Lưu kiểu Scratch: project.json theo PHIÊN BẢN, asset theo nội dung (`md5ext` = "<md5>.<ext>").

export type ScratchVisibilityValue = 'private' | 'class' | 'school' | 'public';

export const SCRATCH_VISIBILITIES: readonly ScratchVisibilityValue[] = ['private', 'class', 'school', 'public'];

/**
 * Phạm vi học viên TỰ đặt được. `public` chỉ có qua quy trình xin → GV duyệt (ADR D4′, T11.5b) — học viên
 * phần lớn dưới 13 tuổi.
 */
export const SCRATCH_SELF_VISIBILITIES: readonly ScratchVisibilityValue[] = ['private', 'class', 'school'];

/** Giới hạn (ADR D3). */
export const SCRATCH_PROJECT_JSON_MAX_BYTES = 5 * 1024 * 1024;
export const SCRATCH_ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const SCRATCH_TITLE_MAX_LENGTH = 100;
/**
 * Hạn mức asset tự tải lên của MỘT người (tổng byte, chốt T11.3). Một dự án Scratch của học viên thường
 * vài MB; 200 MB đủ hàng chục dự án có ghi âm/ảnh mà vẫn chặn được việc dùng làm kho chứa file.
 */
export const SCRATCH_USER_QUOTA_BYTES = 200 * 1024 * 1024;
/** Số phiên bản CHƯA đóng băng giữ lại mỗi dự án (autosave). Bản đóng băng không tính, không bao giờ dọn. */
export const SCRATCH_KEEP_UNFROZEN_VERSIONS = 20;

/** Định dạng asset được nhận (đuôi `md5ext` → mime). Kiểm thêm magic bytes ở API (T11.3). */
export const SCRATCH_ASSET_FORMATS: Readonly<Record<string, string>> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

/** `md5ext` hợp lệ: 32 hex thường + đuôi trong allowlist. Dùng làm tên file → KHÔNG nhận gì khác. */
export const SCRATCH_MD5EXT_PATTERN = /^[0-9a-f]{32}\.(png|svg|jpg|gif|wav|mp3)$/;

// --- Dự án ---

export interface ScratchProjectSummaryDto {
  id: string;
  title: string;
  visibility: ScratchVisibilityValue;
  /** Lớp được chia sẻ (chỉ khi visibility = class). */
  classId: string | null;
  ownerId: string;
  ownerName: string;
  remixOfId: string | null;
  /** Số thứ tự phiên bản mới nhất; null = chưa lưu lần nào. */
  latestSeq: number | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScratchCollaboratorDto {
  userId: string;
  fullName: string;
  createdAt: string;
}

export interface ScratchProjectDetailDto extends ScratchProjectSummaryDto {
  /** Bản gốc nếu là remix (null nếu bản gốc đã bị xóa hoặc người xem không được thấy). */
  remixOf: { id: string; title: string } | null;
  isOwner: boolean;
  /** Chủ dự án hoặc đồng tác giả. */
  canEdit: boolean;
  collaborators: ScratchCollaboratorDto[];
  /** Trạng thái công khai — CHỈ trả cho chủ dự án (người khác: null). */
  publication: ScratchPublicationDto | null;
}

export interface ScratchProjectVersionDto {
  id: string;
  seq: number;
  sizeBytes: number;
  /** Đã đóng băng (nộp bài / công khai) — không bao giờ bị dọn. */
  frozen: boolean;
  savedById: string | null;
  createdAt: string;
}

export interface CreateScratchProjectRequest {
  title: string;
}

export interface UpdateScratchProjectRequest {
  title?: string;
  /** Chỉ trong SCRATCH_SELF_VISIBILITIES. */
  visibility?: ScratchVisibilityValue;
  /** Bắt buộc khi visibility = class; người đổi phải là thành viên lớp đó. */
  classId?: string | null;
}

export interface RemixScratchProjectRequest {
  title?: string;
}

// --- Asset ---

export interface ScratchAssetUploadResponse {
  md5ext: string;
  sizeBytes: number;
  /** false = nội dung này đã có sẵn (cùng md5) — không lưu lại, không tính thêm hạn mức. */
  created: boolean;
}

// --- Chia sẻ, gallery, remix, thích (T11.5) ---

/** Lớp mình được chia sẻ dự án vào / xem gallery: thành viên đang học HOẶC người tạo lớp. */
export interface ScratchClassDto {
  id: string;
  name: string;
}

/** Gallery: dự án chia sẻ trong MỘT lớp, hoặc chia sẻ cả trường. */
export type ScratchGalleryScope = 'class' | 'school';

/** Số dự án tối đa mỗi lần tải gallery (mới cập nhật trước). */
export const SCRATCH_GALLERY_LIMIT = 60;

export interface ScratchLikeResponse {
  likeCount: number;
  likedByMe: boolean;
}

// --- Công khai, biệt danh, báo cáo, kiểm duyệt (T11.5b — ADR D4′) ---

export type ScratchPublicationDecisionValue = 'approved' | 'rejected' | 'removed' | 'withdrawn';

export interface ScratchPublicationDto {
  /** Mã link `/p/<slug>` — chỉ có khi đang công khai. */
  slug: string | null;
  published: boolean;
  publishedAt: string | null;
  /** Đang có yêu cầu chờ GV duyệt. */
  pending: boolean;
  requestedAt: string | null;
  lastDecision: ScratchPublicationDecisionValue | null;
  /** Lời nhắn của GV khi từ chối / gỡ. */
  decisionNote: string | null;
}

/** Biệt danh: 2–24 ký tự chữ (có dấu), số, khoảng trắng, `_ . -`. Không được giống email/họ tên đầy đủ — GV duyệt. */
export const SCRATCH_NICKNAME_PATTERN = /^[\p{L}\p{N} _.-]{2,24}$/u;

export interface ScratchNicknameDto {
  approved: string | null;
  pending: string | null;
}

export interface SetScratchNicknameRequest {
  nickname: string;
}

/** Xin công khai phiên bản mới nhất; kèm biệt danh nếu chưa có / muốn đổi (GV duyệt cùng lúc). */
export interface RequestScratchPublicationRequest {
  nickname?: string;
}

/** Trang công khai — KHÔNG có họ tên, lớp, trường (ADR D4′). */
export interface ScratchPublicProjectDto {
  slug: string;
  title: string;
  nickname: string;
  publishedAt: string;
}

export type ScratchReportReasonValue = 'inappropriate' | 'personal_info' | 'copied' | 'other';
export const SCRATCH_REPORT_REASONS: readonly ScratchReportReasonValue[] = [
  'inappropriate',
  'personal_info',
  'copied',
  'other',
];
export const SCRATCH_REPORT_NOTE_MAX = 500;
export const SCRATCH_DECISION_NOTE_MAX = 300;

export interface CreateScratchReportRequest {
  reason: ScratchReportReasonValue;
  note?: string;
}

export interface ScratchModerationNoteRequest {
  note?: string;
}

export interface ResolveScratchReportRequest {
  action: 'dismiss' | 'remove';
}

export interface ScratchModerationPublicationItem {
  projectId: string;
  title: string;
  ownerName: string;
  /** Biệt danh sẽ hiện nếu duyệt (bản chờ duyệt nếu có, không thì bản đã duyệt). */
  nickname: string | null;
  nicknameIsNew: boolean;
  requestedAt: string;
  /** Đang có bản công khai cũ (yêu cầu này là cập nhật). */
  alreadyPublished: boolean;
}

export interface ScratchModerationReportItem {
  id: string;
  projectId: string;
  projectTitle: string;
  ownerName: string;
  reporterName: string;
  reason: ScratchReportReasonValue;
  note: string | null;
  createdAt: string;
  /** Dự án đang có bản công khai. */
  isPublic: boolean;
  /** Link `/p/<slug>` để GV xem bản công khai (GV có thể không xem được dự án trong LMS). */
  publicSlug: string | null;
}

export interface ScratchModerationNicknameItem {
  userId: string;
  fullName: string;
  approved: string | null;
  pending: string;
}

export interface ScratchModerationQueueDto {
  publications: ScratchModerationPublicationItem[];
  reports: ScratchModerationReportItem[];
  nicknames: ScratchModerationNicknameItem[];
}
