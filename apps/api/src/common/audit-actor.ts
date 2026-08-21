/**
 * Ai đang thực hiện thao tác — truyền xuống service để ghi AuditLog trong cùng transaction
 * với thay đổi dữ liệu (INVARIANT #6). `ip` lấy từ req.ip (đúng nhờ `trust proxy`, xem main.ts).
 */
export interface AuditActor {
  userId: string;
  ip?: string;
}
