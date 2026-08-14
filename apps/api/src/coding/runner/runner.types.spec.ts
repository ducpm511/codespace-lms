import { capStdout } from './runner.types';

describe('capStdout', () => {
  it('passes short output through untouched', () => {
    const r = capStdout('hello', 1024);
    expect(r).toEqual({ text: 'hello', truncated: false });
  });

  it('truncates output beyond the byte budget', () => {
    const r = capStdout('abcdef', 3);
    expect(r.truncated).toBe(true);
    expect(Buffer.from(r.text, 'utf8').byteLength).toBeLessThanOrEqual(3);
    expect(r.text).toBe('abc');
  });

  it('does not leave a split multibyte char at the boundary', () => {
    // 'é' is 2 bytes in UTF-8; a 1-byte budget must not yield a broken char.
    const r = capStdout('é', 1);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('');
  });
});
