import { EnvValidationError, validateEnv } from './env.validation';

const SECRET_A = 'a'.repeat(48);
const SECRET_B = 'b'.repeat(48);

const devEnv = (over: Record<string, string> = {}): Record<string, string> => ({
  DATABASE_URL: 'postgresql://lms:lms@localhost:5433/lms',
  JWT_ACCESS_SECRET: 'dev-access',
  JWT_REFRESH_SECRET: 'dev-refresh',
  ...over,
});

const prodEnv = (over: Record<string, string> = {}): Record<string, string> => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://lms:pw@postgres:5432/lms',
  JWT_ACCESS_SECRET: SECRET_A,
  JWT_REFRESH_SECRET: SECRET_B,
  WEB_ORIGIN: 'https://lms.example.com',
  CODE_RUNNER_PROVIDER: 'piston',
  CODE_RUNNER_URL: 'http://piston:2000',
  ...over,
});

/** Gom message lỗi để assert theo nội dung thay vì thứ tự. */
const problemsOf = (env: Record<string, string>): string[] => {
  try {
    validateEnv(env);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return (err as EnvValidationError).problems;
  }
};

describe('validateEnv', () => {
  it('chấp nhận cấu hình dev tối thiểu', () => {
    expect(() => validateEnv(devEnv())).not.toThrow();
  });

  it('chấp nhận cấu hình production đầy đủ', () => {
    expect(() => validateEnv(prodEnv())).not.toThrow();
  });

  it('trả lại chính env đã nhận để ConfigService đọc tiếp', () => {
    const env = devEnv();
    expect(validateEnv(env)).toBe(env);
  });

  describe('biến bắt buộc ở mọi env', () => {
    it.each(['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])(
      'thiếu %s thì throw',
      (key) => {
        const env = devEnv();
        delete env[key];
        expect(problemsOf(env)).toContain(`${key} bắt buộc phải có`);
      },
    );

    it('chuỗi rỗng / toàn khoảng trắng coi như thiếu', () => {
      expect(problemsOf(devEnv({ DATABASE_URL: '   ' }))).toContain('DATABASE_URL bắt buộc phải có');
    });

    it('gom TẤT CẢ vấn đề trong một lần throw, không dừng ở lỗi đầu tiên', () => {
      const problems = problemsOf({ NODE_ENV: 'development' });
      expect(problems).toHaveLength(3);
    });
  });

  describe('production siết chặt hơn', () => {
    it('thiếu WEB_ORIGIN thì throw', () => {
      const env = prodEnv();
      delete env.WEB_ORIGIN;
      expect(problemsOf(env)).toContain('WEB_ORIGIN bắt buộc phải có');
    });

    it('secret ngắn (placeholder chưa thay) bị chặn', () => {
      const problems = problemsOf(prodEnv({ JWT_ACCESS_SECRET: 'changeme' }));
      expect(problems.join('\n')).toContain('JWT_ACCESS_SECRET ở production phải dài tối thiểu 32');
    });

    it('hai secret trùng nhau bị chặn', () => {
      const problems = problemsOf(
        prodEnv({ JWT_ACCESS_SECRET: SECRET_A, JWT_REFRESH_SECRET: SECRET_A }),
      );
      expect(problems).toContain('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau');
    });

    it('secret ngắn vẫn chấp nhận ở dev', () => {
      expect(() => validateEnv(devEnv({ JWT_ACCESS_SECRET: 'short' }))).not.toThrow();
    });

    it('runner stub ở production bị chặn (chấm giả mà không ai biết)', () => {
      const env = prodEnv({ CODE_RUNNER_PROVIDER: 'stub' });
      delete env.CODE_RUNNER_URL;
      expect(problemsOf(env).join('\n')).toContain('CODE_RUNNER_PROVIDER=stub');
    });
  });

  describe('driver và phụ thuộc kéo theo', () => {
    it('NODE_ENV lạ bị chặn', () => {
      expect(problemsOf(devEnv({ NODE_ENV: 'prod' })).join('\n')).toContain('NODE_ENV phải là');
    });

    it('CODE_RUNNER_PROVIDER gõ sai bị chặn thay vì âm thầm rơi về stub', () => {
      expect(problemsOf(devEnv({ CODE_RUNNER_PROVIDER: 'pistion' })).join('\n')).toContain(
        'CODE_RUNNER_PROVIDER phải là một trong [stub, piston]',
      );
    });

    it('piston mà thiếu CODE_RUNNER_URL thì throw', () => {
      expect(problemsOf(devEnv({ CODE_RUNNER_PROVIDER: 'piston' }))).toContain(
        'CODE_RUNNER_URL bắt buộc phải có',
      );
    });

    it('queue bull mà thiếu REDIS_URL thì throw', () => {
      expect(problemsOf(devEnv({ CODE_QUEUE_DRIVER: 'bull' }))).toContain(
        'REDIS_URL bắt buộc phải có',
      );
    });

    it('queue inline (mặc định) KHÔNG đòi REDIS_URL', () => {
      expect(() => validateEnv(devEnv({ CODE_QUEUE_DRIVER: 'inline' }))).not.toThrow();
    });

    it('storage cloudinary đòi đủ 3 biến credential', () => {
      const problems = problemsOf(devEnv({ STORAGE_DRIVER: 'cloudinary' }));
      expect(problems).toEqual(
        expect.arrayContaining([
          'CLOUDINARY_CLOUD_NAME bắt buộc phải có',
          'CLOUDINARY_API_KEY bắt buộc phải có',
          'CLOUDINARY_API_SECRET bắt buộc phải có',
        ]),
      );
    });

    it('storage local (mặc định) KHÔNG đòi credential Cloudinary', () => {
      expect(() => validateEnv(devEnv({ STORAGE_DRIVER: 'local' }))).not.toThrow();
    });

    it('giá trị driver không phân biệt hoa thường', () => {
      expect(() => validateEnv(devEnv({ STORAGE_DRIVER: 'LOCAL' }))).not.toThrow();
    });
  });

  describe('số nguyên dương', () => {
    it.each(['0', '-1', 'abc', '3.5'])('API_PORT=%s bị chặn', (value) => {
      expect(problemsOf(devEnv({ API_PORT: value })).join('\n')).toContain(
        'API_PORT phải là số nguyên dương',
      );
    });

    it('API_PORT hợp lệ thì qua', () => {
      expect(() => validateEnv(devEnv({ API_PORT: '3000' }))).not.toThrow();
    });

    it('RATE_LIMIT_PER_MINUTE sai kiểu bị chặn', () => {
      expect(problemsOf(devEnv({ RATE_LIMIT_PER_MINUTE: 'nhiều' })).join('\n')).toContain(
        'RATE_LIMIT_PER_MINUTE phải là số nguyên dương',
      );
    });
  });

  it('message lỗi liệt kê đủ các vấn đề', () => {
    try {
      validateEnv({ NODE_ENV: 'production' });
      fail('phải throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('WEB_ORIGIN');
      expect(message).toContain('.env.example');
    }
  });
});
