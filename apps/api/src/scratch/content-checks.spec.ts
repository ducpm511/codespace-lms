import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { SCRATCH_PROJECT_JSON_MAX_BYTES } from '@lms/contracts';
import { checkAsset } from './asset-content';
import { parseProjectJson } from './project-json';

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpg-body')]);
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')]);
const SVG = Buffer.from('\uFEFF<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('checkAsset', () => {
  it('nhận png / wav / svg (có BOM + khai báo xml) khi md5 + magic bytes khớp', () => {
    expect(checkAsset(`${md5(PNG)}.png`, PNG)).toEqual({
      md5ext: `${md5(PNG)}.png`,
      dataFormat: 'png',
      mime: 'image/png',
    });
    expect(checkAsset(`${md5(WAV)}.wav`, WAV).mime).toBe('audio/wav');
    expect(checkAsset(`${md5(SVG)}.svg`, SVG).mime).toBe('image/svg+xml');
  });

  it('chặn nội dung không khớp md5 trong tên (chống tráo asset dùng chung)', () => {
    expect(() => checkAsset(`${md5(JPG)}.png`, PNG)).toThrow('không khớp tên');
  });

  it('chặn file đổi đuôi (jpg đặt tên .png)', () => {
    expect(() => checkAsset(`${md5(JPG)}.png`, JPG)).toThrow('không đúng định dạng');
  });

  it('chặn tên ngoài allowlist (đường dẫn, đuôi lạ, chữ hoa)', () => {
    for (const name of ['../x.png', `${md5(PNG)}.exe`, `${md5(PNG).toUpperCase()}.png`, `${md5(PNG)}.png/x`]) {
      expect(() => checkAsset(name, PNG)).toThrow(BadRequestException);
    }
  });

  it('chặn file rỗng', () => {
    expect(() => checkAsset(`${md5(PNG)}.png`, Buffer.alloc(0))).toThrow('Thiếu nội dung');
  });
});

const project = (extra: object = {}) => ({
  targets: [
    { isStage: true, costumes: [{ md5ext: `${'a'.repeat(32)}.svg` }], sounds: [{ md5ext: `${'b'.repeat(32)}.wav` }] },
    { isStage: false, costumes: [{ md5ext: `${'a'.repeat(32)}.svg` }], sounds: [] },
  ],
  meta: { semver: '3.0.0' },
  ...extra,
});
const buf = (v: unknown) => Buffer.from(JSON.stringify(v));

describe('parseProjectJson', () => {
  it('trả về asset tham chiếu, đã bỏ trùng', () => {
    const r = parseProjectJson(buf(project()));
    expect(r.md5exts.sort()).toEqual([`${'a'.repeat(32)}.svg`, `${'b'.repeat(32)}.wav`]);
    expect(r.sizeBytes).toBe(buf(project()).length);
  });

  it('chặn JSON hỏng / không phải dự án Scratch 3', () => {
    expect(() => parseProjectJson(Buffer.from('{oops'))).toThrow('không phải JSON');
    expect(() => parseProjectJson(buf({ targets: [], meta: {} }))).toThrow('Scratch 3');
    expect(() => parseProjectJson(buf([1, 2]))).toThrow('Scratch 3');
  });

  it('chặn md5ext không hợp lệ trong costume/sound', () => {
    const bad = project();
    (bad.targets[1].costumes as { md5ext: string }[]).push({ md5ext: '../../etc/passwd' });
    expect(() => parseProjectJson(buf(bad))).toThrow('md5ext');
  });

  it('chặn quá 5 MB', () => {
    expect(() => parseProjectJson(Buffer.alloc(SCRATCH_PROJECT_JSON_MAX_BYTES + 1, 32))).toThrow('vượt quá');
  });
});
