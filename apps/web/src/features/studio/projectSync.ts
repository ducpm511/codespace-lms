import { SCRATCH_MD5EXT_PATTERN } from '@lms/contracts';
import type { ScratchProjectVersionDto } from '@lms/contracts';
import { getLatestProjectJson, getProjectAsset, saveProjectVersion, uploadAsset } from './api';
import type { EditorAsset, EditorExport } from './useBlockSpace';

/** Số request asset chạy song song — đủ nhanh mà không dồn cả lớp vào rate limit chung. */
const PARALLEL = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** md5ext của mọi costume/sound mà project.json tham chiếu (bỏ trùng, bỏ tên không hợp lệ). */
export function referencedAssets(projectJson: string): string[] {
  const project = JSON.parse(projectJson) as { targets?: { costumes?: unknown[]; sounds?: unknown[] }[] };
  const names = new Set<string>();
  for (const target of project.targets ?? []) {
    for (const item of [...(target.costumes ?? []), ...(target.sounds ?? [])]) {
      const md5ext = (item as { md5ext?: unknown })?.md5ext;
      if (typeof md5ext === 'string' && SCRATCH_MD5EXT_PATTERN.test(md5ext)) names.add(md5ext);
    }
  }
  return [...names];
}

export interface LoadedProject {
  /** null = dự án chưa lưu lần nào → mở dự án mới (Rex). */
  projectJson: string | null;
  assets: EditorAsset[];
  /** Asset KHÔNG cần tải lên khi lưu: đã có trên server, hoặc là asset thư viện Scratch (CDN). */
  known: Set<string>;
}

/** Tải phiên bản mới nhất + asset riêng của dự án (có token) để đưa vào trình soạn. */
export async function fetchProjectForEditor(projectId: string): Promise<LoadedProject> {
  const projectJson = await getLatestProjectJson(projectId);
  if (projectJson === null) return { projectJson, assets: [], known: new Set() };
  const names = referencedAssets(projectJson);
  const datas = await mapLimit(names, PARALLEL, (md5ext) => getProjectAsset(projectId, md5ext));
  const assets: EditorAsset[] = [];
  names.forEach((md5ext, i) => {
    // 404 = asset thư viện Scratch: trình soạn tự tải từ CDN, không cần sao lên server.
    const data = datas[i];
    if (data) assets.push({ md5ext, data });
  });
  return { projectJson, assets, known: new Set(names) };
}

/**
 * Lưu bản xuất từ trình soạn: tải asset MỚI lên trước (server chỉ gắn asset đã có vào phiên bản), rồi
 * lưu project.json. `known` được cập nhật để lần lưu sau không gửi lại.
 */
export async function pushProject(
  projectId: string,
  exported: EditorExport,
  known: Set<string>,
): Promise<ScratchProjectVersionDto> {
  const fresh = exported.assets.filter((a) => !known.has(a.md5ext) && SCRATCH_MD5EXT_PATTERN.test(a.md5ext));
  await mapLimit(fresh, PARALLEL, async (a) => {
    await uploadAsset(a.md5ext, a.data);
    known.add(a.md5ext);
  });
  return saveProjectVersion(projectId, exported.projectJson);
}
