/**
 * Dựng header `Content-Disposition` an toàn cho tên file có dấu tiếng Việt.
 *
 * Header HTTP chỉ tải được byte latin1 — nhét thẳng chuỗi UTF-8 vào `filename="..."` sẽ ra mojibake
 * ở phía client. Theo RFC 6266/5987: gửi kèm bản ASCII làm fallback + `filename*=UTF-8''<percent-encoded>`
 * để trình duyệt hiện đại lấy đúng tên có dấu.
 */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const safe = fileName.replace(/["\\]/g, '');
  // Fallback cho client cũ: mọi ký tự ngoài ASCII in được → '_'.
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_') || 'document';
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(safe)}`;
}

/** encodeURIComponent + escape thêm các ký tự không thuộc `attr-char` của RFC 5987. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}
