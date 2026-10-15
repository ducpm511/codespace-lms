import type { ScratchCheck, ScratchCheckKey } from '@lms/contracts';

/**
 * Gợi ý tiêu chí khi chấm bài BlockSpace (T11.7 — ADR D6c): đọc project.json TĨNH, không chạy dự án.
 * Chỉ để GV nhìn nhanh — GV vẫn tự cho điểm. Chỉ đếm khối nằm trong một kịch bản bắt đầu bằng khối mũ
 * (khối kéo ra để đó không chạy được thì không tính).
 */

/** Tiêu chí gợi ý mặc định khi GV tạo bài nộp BlockSpace mới. */
export const DEFAULT_SCRATCH_CHECKS: ScratchCheck[] = [{ key: 'greenFlag' }, { key: 'loop' }];

interface RawBlock {
  opcode?: string;
  parent?: string | null;
  topLevel?: boolean;
}

interface RawTarget {
  isStage?: boolean;
  blocks?: Record<string, RawBlock | unknown[]>;
}

/** Khối mũ: bắt đầu một kịch bản. */
const HAT = /^(event_when|control_start_as_clone|procedures_definition)/;

/** Khối nào thỏa tiêu chí nào (tiêu chí `minSprites` tính riêng theo số nhân vật). */
const OPCODES: Record<Exclude<ScratchCheckKey, 'minSprites'>, (op: string) => boolean> = {
  greenFlag: (op) => op === 'event_whenflagclicked',
  loop: (op) => op === 'control_repeat' || op === 'control_forever' || op === 'control_repeat_until',
  condition: (op) => op === 'control_if' || op === 'control_if_else' || op === 'control_wait_until',
  variable: (op) => op === 'data_setvariableto' || op === 'data_changevariableby',
  broadcast: (op) => op === 'event_broadcast' || op === 'event_broadcastandwait',
  interaction: (op) =>
    op === 'event_whenkeypressed' ||
    op === 'event_whenthisspriteclicked' ||
    op === 'event_whenstageclicked' ||
    op === 'sensing_askandwait' ||
    op === 'sensing_keypressed' ||
    op === 'sensing_mousedown',
  sound: (op) => op === 'sound_play' || op === 'sound_playuntildone',
  clone: (op) => op === 'control_create_clone_of',
  customBlock: (op) => op === 'procedures_definition',
};

export interface ScratchCheckResult {
  key: ScratchCheckKey;
  passed: boolean;
  /** Số khối thỏa (hoặc số nhân vật với minSprites). */
  count: number;
  min?: number;
}

/** Opcode của mọi khối đang thuộc một kịch bản (gốc là khối mũ), theo từng target. */
function scriptOpcodes(target: RawTarget): string[] {
  const blocks = target.blocks ?? {};
  const get = (id: string): RawBlock | null => {
    const b = blocks[id];
    return b && !Array.isArray(b) ? (b as RawBlock) : null; // mảng = biến/danh sách nổi trên vùng code
  };
  const rootIsHat = new Map<string, boolean>();
  const inScript = (id: string): boolean => {
    const seen: string[] = [];
    let cur: string | null = id;
    let ok = false;
    // Đi lên cha tới gốc; nhớ kết quả để mỗi khối chỉ duyệt một lần.
    while (cur) {
      if (rootIsHat.has(cur)) {
        ok = rootIsHat.get(cur)!;
        break;
      }
      seen.push(cur);
      const b = get(cur);
      if (!b) break;
      if (!b.parent) {
        ok = HAT.test(b.opcode ?? '');
        break;
      }
      if (seen.length > 10_000) break; // project.json hỏng (vòng cha) — không treo trang chấm
      cur = b.parent;
    }
    for (const s of seen) rootIsHat.set(s, ok);
    return ok;
  };
  return Object.keys(blocks)
    .filter((id) => get(id) && inScript(id))
    .map((id) => get(id)!.opcode ?? '');
}

export function analyzeScratchProject(projectJson: unknown, checks: ScratchCheck[]): ScratchCheckResult[] {
  const targets: RawTarget[] = Array.isArray((projectJson as { targets?: unknown })?.targets)
    ? ((projectJson as { targets: RawTarget[] }).targets ?? [])
    : [];
  const opcodes = targets.flatMap(scriptOpcodes);
  const sprites = targets.filter((t) => !t.isStage).length;
  return checks.map(({ key, min }) => {
    if (key === 'minSprites') {
      const need = min ?? 2;
      return { key, passed: sprites >= need, count: sprites, min: need };
    }
    const count = opcodes.filter(OPCODES[key]).length;
    return { key, passed: count > 0, count };
  });
}
