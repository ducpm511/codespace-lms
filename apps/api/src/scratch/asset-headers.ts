import type { Response } from 'express';

/**
 * Header khi phục vụ asset private (ảnh/âm thanh học viên). SVG có thể chứa script và được phục vụ CÙNG
 * origin với LMS → `CSP sandbox` + `attachment` để mở thẳng URL cũng không chạy được gì (chống XSS);
 * trình soạn đọc bằng fetch nên không bị ảnh hưởng. Không cache chung (dữ liệu riêng tư).
 */
export function setPrivateAssetHeaders(res: Response, mime: string): void {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
}
