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
