import { PERMISSIONS } from '@lms/contracts';
import type { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac.service';

/** Quyền của từng role, trích từ `seed.cjs` phần liên quan tới bài làm của học viên. */
export const ROLE_KEYS = {
  student: [PERMISSIONS.CODING_RESULT_READ, PERMISSIONS.QUIZ_SUBMIT, PERMISSIONS.QUIZ_RESULT_READ],
  instructor: [
    PERMISSIONS.SUBMISSION_READ,
    PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.QUIZ_READ,
    PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.CERTIFICATE_READ,
    PERMISSIONS.CERTIFICATE_ISSUE,
    PERMISSIONS.CERTIFICATE_REVOKE,
  ],
  admin: [
    PERMISSIONS.SUBMISSION_READ,
    PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.QUIZ_READ,
    PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.CERTIFICATE_READ,
    PERMISSIONS.CERTIFICATE_ISSUE,
    PERMISSIONS.CERTIFICATE_REVOKE,
    PERMISSIONS.CLASS_DELETE,
  ],
} as const;

export type RoleName = keyof typeof ROLE_KEYS;

export interface RealRbacScenario {
  /** Role gán global. */
  role?: RoleName;
  /** Role gán riêng cho lớp, dạng `{ classId: role }`. */
  scoped?: Record<string, RoleName>;
  /** Người tạo lớp. */
  createdById?: string;
  /** Tư cách của user trong lớp. */
  member?: { status: 'active' | 'removed'; roleInClass: 'student' | 'ta' | 'instructor' };
}

/**
 * RbacService THẬT trên DB giả. Test về phạm vi lớp phải dùng cái này: mock `hasPermission` trả true/false
 * sẽ che mất đúng loại lỗi cần bắt (quyền global của instructor, role student gán global).
 */
export function realRbac(scenario: RealRbacScenario): RbacService {
  const toRole = (classId: string | null, role: RoleName) => ({
    classId,
    role: { permissions: ROLE_KEYS[role].map((key) => ({ permission: { key } })) },
  });
  const userRoles = [
    ...(scenario.role ? [toRole(null, scenario.role)] : []),
    ...Object.entries(scenario.scoped ?? {}).map(([classId, role]) => toRole(classId, role)),
  ];
  const db = {
    userRole: { findMany: async () => userRoles },
    class: {
      findUnique: async () => ({
        createdById: scenario.createdById ?? 'nguoi-tao-lop',
        members: scenario.member ? [scenario.member] : [],
      }),
    },
  };
  return new RbacService(db as unknown as PrismaService);
}
