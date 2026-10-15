import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { SCRATCH_ASSET_FORMATS, SCRATCH_ASSET_MAX_BYTES, SCRATCH_MD5EXT_PATTERN } from '@lms/contracts';

export interface CheckedAsset {
  md5ext: string;
  dataFormat: string;
  mime: string;
}

/**
 * Kiểm asset trước khi lưu (ADR D7, INVARIANT #4):
 * 1. tên `md5ext` đúng allowlist;
 * 2. md5 của NỘI DUNG khớp tên — asset lưu theo nội dung và dùng chung giữa mọi người, nên nếu không
 *    kiểm, ai đó có thể "chiếm" một md5ext bằng nội dung khác và tráo ảnh trong dự án của bạn khác;
 * 3. magic bytes khớp định dạng — chặn file đổi đuôi.
 * Mime lấy từ allowlist theo đuôi, KHÔNG từ client.
 */
export function checkAsset(md5ext: string, buffer: Buffer | undefined): CheckedAsset {
  if (!SCRATCH_MD5EXT_PATTERN.test(md5ext)) throw new BadRequestException('Tên asset không hợp lệ');
  if (!buffer || buffer.length === 0) throw new BadRequestException('Thiếu nội dung asset');
  if (buffer.length > SCRATCH_ASSET_MAX_BYTES) {
    throw new BadRequestException(`Asset vượt quá ${SCRATCH_ASSET_MAX_BYTES / (1024 * 1024)}MB`);
  }
  const [md5, dataFormat] = md5ext.split('.');
  if (createHash('md5').update(buffer).digest('hex') !== md5) {
    throw new BadRequestException('Nội dung asset không khớp tên (md5)');
  }
  if (!matchesFormat(dataFormat, buffer)) {
    throw new BadRequestException('Nội dung asset không đúng định dạng');
  }
  return { md5ext, dataFormat, mime: SCRATCH_ASSET_FORMATS[dataFormat] };
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function matchesFormat(dataFormat: string, buf: Buffer): boolean {
  switch (dataFormat) {
    case 'png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'gif':
      return startsWith(buf, ascii('GIF87a')) || startsWith(buf, ascii('GIF89a'));
    case 'wav':
      return startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WAVE'), 8);
    case 'mp3':
      // Thẻ ID3 hoặc khung MPEG audio (11 bit đồng bộ).
      return startsWith(buf, ascii('ID3')) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
    case 'svg': {
      // Văn bản XML có thẻ <svg. Nội dung SVG có thể chứa script → khi PHỤC VỤ luôn kèm CSP sandbox.
      const head = buf
        .subarray(0, 4096)
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .trimStart();
      return head.startsWith('<') && /<svg[\s>]/i.test(head);
    }
    default:
      return false;
  }
}
