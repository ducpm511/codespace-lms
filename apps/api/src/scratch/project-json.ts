import { BadRequestException } from '@nestjs/common';
import { SCRATCH_MD5EXT_PATTERN, SCRATCH_PROJECT_JSON_MAX_BYTES } from '@lms/contracts';

/** project.json đã kiểm: object gốc + danh sách asset (md5ext) mà nó tham chiếu. */
export interface ParsedProjectJson {
  json: Record<string, unknown>;
  sizeBytes: number;
  md5exts: string[];
}

/**
 * Đọc project.json do trình soạn gửi lên (bytes thô). Chỉ kiểm phần LMS dựa vào — cấu trúc khối lệnh do
 * scratch-vm tự kiểm khi nạp. Mọi `md5ext` phải khớp allowlist: chúng sau này thành tên file / khóa
 * tra cứu asset, nên không nhận chuỗi tùy ý.
 */
export function parseProjectJson(buffer: Buffer | undefined): ParsedProjectJson {
  if (!buffer || buffer.length === 0) throw new BadRequestException('Thiếu project.json');
  if (buffer.length > SCRATCH_PROJECT_JSON_MAX_BYTES) {
    throw new BadRequestException(`project.json vượt quá ${SCRATCH_PROJECT_JSON_MAX_BYTES / (1024 * 1024)}MB`);
  }
  let json: unknown;
  try {
    json = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new BadRequestException('project.json không phải JSON hợp lệ');
  }
  if (!isRecord(json) || !Array.isArray(json.targets) || json.targets.length === 0 || !isRecord(json.meta)) {
    throw new BadRequestException('project.json không đúng định dạng Scratch 3');
  }

  const md5exts = new Set<string>();
  for (const target of json.targets) {
    if (!isRecord(target)) throw new BadRequestException('project.json: target không hợp lệ');
    for (const key of ['costumes', 'sounds'] as const) {
      const list = target[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) throw new BadRequestException(`project.json: ${key} không hợp lệ`);
      for (const item of list) {
        const md5ext = isRecord(item) ? item.md5ext : undefined;
        if (typeof md5ext !== 'string' || !SCRATCH_MD5EXT_PATTERN.test(md5ext)) {
          throw new BadRequestException('project.json: asset có md5ext không hợp lệ');
        }
        md5exts.add(md5ext);
      }
    }
  }
  return { json, sizeBytes: buffer.length, md5exts: [...md5exts] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
