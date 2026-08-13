// Seed idempotent (T0.7): catalog permission P0 + 5 role hệ thống + ma trận role→permission.
// Chạy lại nhiều lần không nhân đôi (upsert theo unique key). Xem docs/DESIGN.md §2, §5.1.
//
//   pnpm --filter @lms/database seed
//   (tùy chọn) đặt SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD để tạo super_admin đầu tiên.

const { PrismaClient } = require('@lms/database');
const { PERMISSIONS } = require('@lms/contracts');
const { hashSync } = require('bcryptjs');

// Danh mục permission P0 (mở rộng theo phase: course.*, class.*, grade.*, ...).
const PERMISSION_DEFS = [
  { key: PERMISSIONS.USER_READ, description: 'Xem người dùng' },
  { key: PERMISSIONS.USER_CREATE, description: 'Tạo người dùng' },
  { key: PERMISSIONS.USER_UPDATE, description: 'Sửa người dùng' },
  { key: PERMISSIONS.USER_DELETE, description: 'Xóa/khóa người dùng' },
  { key: PERMISSIONS.ROLE_READ, description: 'Xem vai trò' },
  { key: PERMISSIONS.ROLE_CREATE, description: 'Tạo vai trò' },
  { key: PERMISSIONS.ROLE_ASSIGN, description: 'Gán role/permission' },
  { key: PERMISSIONS.PERMISSION_READ, description: 'Xem danh mục quyền' },
  // P1 — Course
  { key: PERMISSIONS.COURSE_READ, description: 'Xem khóa học' },
  { key: PERMISSIONS.COURSE_CREATE, description: 'Tạo khóa học' },
  { key: PERMISSIONS.COURSE_UPDATE, description: 'Biên soạn khóa học (section/lesson)' },
  { key: PERMISSIONS.COURSE_PUBLISH, description: 'Xuất bản/lưu trữ khóa học' },
  { key: PERMISSIONS.COURSE_DELETE, description: 'Xóa khóa học' },
  // P1 — Class
  { key: PERMISSIONS.CLASS_READ, description: 'Xem lớp học' },
  { key: PERMISSIONS.CLASS_CREATE, description: 'Tạo lớp học' },
  { key: PERMISSIONS.CLASS_UPDATE, description: 'Sửa thông tin lớp' },
  { key: PERMISSIONS.CLASS_MANAGE, description: 'Gán khóa, enroll thành viên, mở/tắt gate bài' },
  { key: PERMISSIONS.CLASS_DELETE, description: 'Xóa lớp học' },
  // P2 — Assessments (Assignment & Submission)
  { key: PERMISSIONS.ASSIGNMENT_READ, description: 'Xem bài tập' },
  { key: PERMISSIONS.ASSIGNMENT_CREATE, description: 'Tạo bài tập' },
  { key: PERMISSIONS.ASSIGNMENT_UPDATE, description: 'Sửa bài tập' },
  { key: PERMISSIONS.ASSIGNMENT_DELETE, description: 'Xóa bài tập' },
  { key: PERMISSIONS.SUBMISSION_READ, description: 'Xem bài nộp của học viên' },
  { key: PERMISSIONS.GRADE_WRITE, description: 'Chấm điểm & nhận xét bài nộp' },
  // P3 — Coding & Runner
  { key: PERMISSIONS.CODING_READ, description: 'Xem bài lập trình (authoring)' },
  { key: PERMISSIONS.CODING_CREATE, description: 'Tạo bài lập trình' },
  { key: PERMISSIONS.CODING_UPDATE, description: 'Sửa bài lập trình + testcase' },
  { key: PERMISSIONS.CODING_DELETE, description: 'Xóa bài lập trình' },
  { key: PERMISSIONS.CODING_SUBMIT, description: 'Nộp bài code chấm tự động' },
  { key: PERMISSIONS.CODING_RESULT_READ, description: 'Xem kết quả chấm code' },
];

// 5 role hệ thống (isSystem = true → không cho xóa).
const ROLE_DEFS = [
  { key: 'super_admin', name: 'Quản trị hệ thống', description: 'Toàn quyền + cấu hình hệ thống' },
  { key: 'admin', name: 'Quản trị đào tạo', description: 'Quản lý user/khóa học/lớp/chứng chỉ' },
  { key: 'instructor', name: 'Giáo viên', description: 'Biên soạn khóa học, mở bài, chấm điểm' },
  { key: 'teaching_assistant', name: 'Trợ giảng', description: 'Chấm bài, hỗ trợ lớp được phân công' },
  { key: 'student', name: 'Học viên', description: 'Học bài, làm bài, xem điểm & chứng chỉ' },
];

// Ma trận role → permission. P2 (T2.4): thêm assignment.*/submission.read/grade.write cho admin,
// instructor và teaching_assistant (chấm bài + xem bài nộp scope-lớp).
const ALL = Object.values(PERMISSIONS);
const ROLE_PERMISSIONS = {
  super_admin: ALL,
  admin: [
    PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE,
    PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_ASSIGN, PERMISSIONS.PERMISSION_READ,
    PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_PUBLISH, PERMISSIONS.COURSE_DELETE,
    PERMISSIONS.CLASS_READ, PERMISSIONS.CLASS_CREATE, PERMISSIONS.CLASS_UPDATE,
    PERMISSIONS.CLASS_MANAGE, PERMISSIONS.CLASS_DELETE,
    PERMISSIONS.ASSIGNMENT_READ, PERMISSIONS.ASSIGNMENT_CREATE, PERMISSIONS.ASSIGNMENT_UPDATE,
    PERMISSIONS.ASSIGNMENT_DELETE, PERMISSIONS.SUBMISSION_READ, PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.CODING_READ, PERMISSIONS.CODING_CREATE, PERMISSIONS.CODING_UPDATE,
    PERMISSIONS.CODING_DELETE, PERMISSIONS.CODING_SUBMIT, PERMISSIONS.CODING_RESULT_READ,
  ],
  instructor: [
    PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.CLASS_READ, PERMISSIONS.CLASS_CREATE, PERMISSIONS.CLASS_UPDATE, PERMISSIONS.CLASS_MANAGE,
    PERMISSIONS.ASSIGNMENT_READ, PERMISSIONS.ASSIGNMENT_CREATE, PERMISSIONS.ASSIGNMENT_UPDATE,
    PERMISSIONS.ASSIGNMENT_DELETE, PERMISSIONS.SUBMISSION_READ, PERMISSIONS.GRADE_WRITE,
    // coding authoring + xem kết quả (không submit như học viên)
    PERMISSIONS.CODING_READ, PERMISSIONS.CODING_CREATE, PERMISSIONS.CODING_UPDATE,
    PERMISSIONS.CODING_DELETE, PERMISSIONS.CODING_RESULT_READ,
  ],
  teaching_assistant: [
    PERMISSIONS.ASSIGNMENT_READ, PERMISSIONS.SUBMISSION_READ, PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.CODING_READ, PERMISSIONS.CODING_RESULT_READ,
  ],
  // học viên: nộp code + xem kết quả của mình (xem đề qua route membership, không cần coding.read)
  student: [PERMISSIONS.CODING_SUBMIT, PERMISSIONS.CODING_RESULT_READ],
};

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1) Permissions
    const permId = {};
    for (const def of PERMISSION_DEFS) {
      const p = await prisma.permission.upsert({
        where: { key: def.key },
        update: { description: def.description },
        create: def,
      });
      permId[def.key] = p.id;
    }

    // 2) Roles
    const roleId = {};
    for (const def of ROLE_DEFS) {
      const r = await prisma.role.upsert({
        where: { key: def.key },
        update: { name: def.name, description: def.description, isSystem: true },
        create: { ...def, isSystem: true },
      });
      roleId[def.key] = r.id;
    }

    // 3) Role → Permission (upsert theo unique kép; idempotent)
    let linkCount = 0;
    for (const [rKey, keys] of Object.entries(ROLE_PERMISSIONS)) {
      for (const pKey of keys) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roleId[rKey], permissionId: permId[pKey] } },
          update: {},
          create: { roleId: roleId[rKey], permissionId: permId[pKey] },
        });
        linkCount++;
      }
    }

    // 4) (Tùy chọn) super_admin đầu tiên từ env — KHÔNG hardcode secret.
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (email && password) {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: hashSync(password, 10),
          fullName: process.env.SEED_ADMIN_NAME || 'System Admin',
          status: 'active',
        },
      });
      const has = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: roleId.super_admin, classId: null },
      });
      if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: roleId.super_admin } });
      console.log(`✔ super_admin user: ${email}`);
    } else {
      console.log('· Bỏ qua tạo admin (đặt SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD để tạo).');
    }

    console.log(`✔ Seed xong: ${PERMISSION_DEFS.length} permission, ${ROLE_DEFS.length} role, ${linkCount} liên kết role-permission.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
