/**
 * Schema env cho ConfigModule. Chạy lúc boot: thiếu/sai biến -> throw -> API CHẾT ngay,
 * thay vì chạy được rồi đổ ở request đầu tiên (INVARIANT: fail fast, không hardcode secret).
 *
 * Nguyên tắc:
 *  - Biến sống-còn (DATABASE_URL, JWT secret) bắt buộc ở MỌI env — thiếu là app vô dụng.
 *  - Ràng buộc chỉ có ý nghĩa ở production (WEB_ORIGIN, độ dài secret) bật theo NODE_ENV.
 *  - Biến chọn driver luôn được kiểm giá trị: gõ sai `pistion` mà im lặng rơi về `stub`
 *    thì bài lập trình "chạy" nhưng không chấm thật — lỗi câm, khó phát hiện hơn crash.
 */

export type NodeEnv = 'development' | 'test' | 'production';

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];
const STORAGE_DRIVERS = ['local', 'cloudinary'] as const;
const QUEUE_DRIVERS = ['inline', 'bull'] as const;
const RUNNER_PROVIDERS = ['stub', 'piston'] as const;

/** Secret ngắn hơn ngưỡng này ở production coi như placeholder chưa thay. */
const MIN_SECRET_LENGTH = 32;

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Cấu hình env không hợp lệ — API dừng khởi động:\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        `\nXem .env.example để biết danh sách biến bắt buộc.`,
    );
    this.name = 'EnvValidationError';
  }
}

type RawEnv = Record<string, unknown>;

function str(env: RawEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function requireStr(env: RawEnv, key: string, problems: string[]): string | undefined {
  const value = str(env, key);
  if (value === undefined) problems.push(`${key} bắt buộc phải có`);
  return value;
}

function requireEnum<T extends string>(
  env: RawEnv,
  key: string,
  allowed: readonly T[],
  fallback: T,
  problems: string[],
): T {
  const value = str(env, key);
  if (value === undefined) return fallback;
  const lower = value.toLowerCase() as T;
  if (!allowed.includes(lower)) {
    problems.push(`${key} phải là một trong [${allowed.join(', ')}], nhận được "${value}"`);
    return fallback;
  }
  return lower;
}

function requirePositiveInt(
  env: RawEnv,
  key: string,
  fallback: number,
  problems: string[],
): number {
  const value = str(env, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    problems.push(`${key} phải là số nguyên dương, nhận được "${value}"`);
    return fallback;
  }
  return parsed;
}

/**
 * ConfigModule gọi hàm này với toàn bộ env đã nạp. Trả về object env đã chuẩn hoá
 * (ConfigService sẽ đọc từ đó), hoặc throw EnvValidationError nếu có vấn đề.
 */
export function validateEnv(env: RawEnv): RawEnv {
  const problems: string[] = [];

  const nodeEnv = requireEnum(env, 'NODE_ENV', NODE_ENVS, 'development', problems);
  const isProduction = nodeEnv === 'production';

  // --- Bắt buộc ở mọi env: không có thì app không làm được gì ---
  requireStr(env, 'DATABASE_URL', problems);
  const accessSecret = requireStr(env, 'JWT_ACCESS_SECRET', problems);
  const refreshSecret = requireStr(env, 'JWT_REFRESH_SECRET', problems);

  // --- Ràng buộc riêng cho production ---
  if (isProduction) {
    requireStr(env, 'WEB_ORIGIN', problems);

    for (const [key, value] of [
      ['JWT_ACCESS_SECRET', accessSecret],
      ['JWT_REFRESH_SECRET', refreshSecret],
    ] as const) {
      if (value !== undefined && value.length < MIN_SECRET_LENGTH) {
        problems.push(
          `${key} ở production phải dài tối thiểu ${MIN_SECRET_LENGTH} ký tự (hiện ${value.length})`,
        );
      }
    }

    if (accessSecret !== undefined && accessSecret === refreshSecret) {
      problems.push('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau');
    }
  }

  // --- Driver: kiểm giá trị + phụ thuộc kéo theo ---
  const storageDriver = requireEnum(env, 'STORAGE_DRIVER', STORAGE_DRIVERS, 'local', problems);
  if (storageDriver === 'cloudinary') {
    requireStr(env, 'CLOUDINARY_CLOUD_NAME', problems);
    requireStr(env, 'CLOUDINARY_API_KEY', problems);
    requireStr(env, 'CLOUDINARY_API_SECRET', problems);
  }

  const queueDriver = requireEnum(env, 'CODE_QUEUE_DRIVER', QUEUE_DRIVERS, 'inline', problems);
  if (queueDriver === 'bull') requireStr(env, 'REDIS_URL', problems);

  const runnerProvider = requireEnum(
    env,
    'CODE_RUNNER_PROVIDER',
    RUNNER_PROVIDERS,
    'stub',
    problems,
  );
  if (runnerProvider === 'piston') requireStr(env, 'CODE_RUNNER_URL', problems);

  // Chạy production bằng stub runner = bài lập trình chấm giả. Chặn luôn ở boot.
  if (isProduction && runnerProvider === 'stub') {
    problems.push(
      'CODE_RUNNER_PROVIDER=stub không dùng được ở production: stub KHÔNG chạy code thật, ' +
        'bài lập trình sẽ được chấm giả mà không ai biết. Đặt CODE_RUNNER_PROVIDER=piston.',
    );
  }

  requirePositiveInt(env, 'API_PORT', 3000, problems);
  requirePositiveInt(env, 'RATE_LIMIT_PER_MINUTE', 600, problems);

  if (problems.length > 0) throw new EnvValidationError(problems);

  return env;
}
