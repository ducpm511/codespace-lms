import { describe, expect, it } from 'vitest';
import { analyzeScratchProject } from './rubric';

const project = {
  targets: [
    { isStage: true, blocks: {} },
    {
      isStage: false,
      blocks: {
        hat: { opcode: 'event_whenflagclicked', parent: null, topLevel: true },
        loop: { opcode: 'control_forever', parent: 'hat' },
        move: { opcode: 'motion_movesteps', parent: 'loop' },
        cond: { opcode: 'control_if', parent: 'loop' },
        // Khối rời không có mũ: KHÔNG tính.
        looseSound: { opcode: 'sound_play', parent: null, topLevel: true },
        looseVar: { opcode: 'data_setvariableto', parent: 'looseSound' },
        // Biến nổi trên vùng code (mảng) không phải khối.
        floating: [12, 'biến', 'id', 10, 20],
      },
    },
    {
      isStage: false,
      blocks: {
        key: { opcode: 'event_whenkeypressed', parent: null, topLevel: true },
        bc: { opcode: 'event_broadcast', parent: 'key' },
      },
    },
  ],
};

describe('analyzeScratchProject', () => {
  it('chỉ đếm khối trong kịch bản có khối mũ', () => {
    const out = analyzeScratchProject(project, [
      { key: 'greenFlag' },
      { key: 'loop' },
      { key: 'condition' },
      { key: 'sound' },
      { key: 'variable' },
      { key: 'broadcast' },
      { key: 'interaction' },
      { key: 'clone' },
    ]);
    expect(Object.fromEntries(out.map((r) => [r.key, r.passed]))).toEqual({
      greenFlag: true,
      loop: true,
      condition: true,
      sound: false,
      variable: false,
      broadcast: true,
      interaction: true,
      clone: false,
    });
  });

  it('minSprites: đếm nhân vật (không tính sân khấu), mặc định ≥ 2', () => {
    expect(analyzeScratchProject(project, [{ key: 'minSprites' }])).toEqual([
      { key: 'minSprites', passed: true, count: 2, min: 2 },
    ]);
    expect(analyzeScratchProject(project, [{ key: 'minSprites', min: 3 }])[0].passed).toBe(false);
  });

  it('project.json hỏng / vòng cha không làm treo', () => {
    expect(analyzeScratchProject(null, [{ key: 'loop' }])).toEqual([{ key: 'loop', passed: false, count: 0 }]);
    const loopParents = { targets: [{ blocks: { a: { opcode: 'control_repeat', parent: 'b' }, b: { parent: 'a' } } }] };
    expect(analyzeScratchProject(loopParents, [{ key: 'loop' }])[0].passed).toBe(false);
  });
});
