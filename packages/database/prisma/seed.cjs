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
  // P4 — Quiz
  { key: PERMISSIONS.QUIZ_READ, description: 'Xem quiz (authoring)' },
  { key: PERMISSIONS.QUIZ_CREATE, description: 'Tạo quiz' },
  { key: PERMISSIONS.QUIZ_UPDATE, description: 'Sửa quiz + câu hỏi/đáp án' },
  { key: PERMISSIONS.QUIZ_DELETE, description: 'Xóa quiz' },
  { key: PERMISSIONS.QUIZ_SUBMIT, description: 'Làm/nộp quiz chấm tự động' },
  { key: PERMISSIONS.QUIZ_RESULT_READ, description: 'Xem kết quả quiz của lớp' },
  // P5 — Gradebook & Certificate
  { key: PERMISSIONS.GRADE_READ, description: 'Xem sổ điểm của lớp' },
  { key: PERMISSIONS.CERTIFICATE_READ, description: 'Xem chứng chỉ' },
  { key: PERMISSIONS.CERTIFICATE_ISSUE, description: 'Cấp chứng chỉ cho học viên' },
  { key: PERMISSIONS.CERTIFICATE_REVOKE, description: 'Thu hồi chứng chỉ' },
  // P6 — Polish, Audit & Notifications
  { key: PERMISSIONS.AUDIT_READ, description: 'Xem nhật ký kiểm toán hệ thống' },
  { key: PERMISSIONS.CERTIFICATE_TEMPLATE_MANAGE, description: 'Quản lý mẫu thiết kế chứng chỉ' },
  { key: PERMISSIONS.NOTIFICATION_READ, description: 'Xem thông báo cá nhân' },
];

// 5 role hệ thống (isSystem = true → không cho xóa).
const ROLE_DEFS = [
  { key: 'super_admin', name: 'Quản trị hệ thống', description: 'Toàn quyền + cấu hình hệ thống' },
  { key: 'admin', name: 'Quản trị đào tạo', description: 'Quản lý user/khóa học/lớp/chứng chỉ' },
  { key: 'instructor', name: 'Giáo viên', description: 'Biên soạn khóa học, mở bài, chấm điểm' },
  { key: 'teaching_assistant', name: 'Trợ giảng', description: 'Chấm bài, hỗ trợ lớp được phân công' },
  { key: 'student', name: 'Học viên', description: 'Học bài, làm bài, xem điểm & chứng chỉ' },
];

// Danh mục huy hiệu hệ thống P6 (upsert theo code).
const BADGE_DEFS = [
  { code: 'first_lesson', name: 'Học viên xuất sắc', description: 'Hoàn thành bài học đầu tiên', icon: 'ph-medal' },
  { code: 'first_code', name: 'Coder nhí', description: 'Chấm đạt bài lập trình Python đầu tiên', icon: 'ph-code' },
  { code: 'quiz_master', name: 'Bậc thầy Trắc nghiệm', description: 'Đạt điểm tối đa một bài trắc nghiệm', icon: 'ph-check-square-offset' },
  { code: 'streak_3', name: 'Chăm chỉ 3 ngày', description: 'Duy trì chuỗi học 3 ngày liên tiếp', icon: 'ph-fire' },
  { code: 'streak_7', name: 'Chiến binh 7 ngày', description: 'Duy trì chuỗi học 7 ngày liên tiếp', icon: 'ph-fire' },
  { code: 'xp_500', name: 'Nhà thám hiểm', description: 'Đạt 500 XP đầu tiên (Level 2)', icon: 'ph-star' },
  // T10.3 — huy hiệu GV trao TAY. Không có tiêu chí tự động; với trẻ 7–16 lời khen từ cô giáo
  // có sức nặng hơn con số máy tính ra.
  { code: 'helping_hand', name: 'Giúp bạn', description: 'Chủ động giúp bạn trong lớp học', icon: 'ph-hand-heart', isManual: true },
  { code: 'good_question', name: 'Câu hỏi hay', description: 'Đặt câu hỏi hay, làm cả lớp cùng hiểu ra', icon: 'ph-lightbulb', isManual: true },
  { code: 'big_progress', name: 'Tiến bộ vượt bậc', description: 'Tiến bộ rõ rệt so với chính mình', icon: 'ph-trend-up', isManual: true },
];

// Ma trận role → permission. P6: thêm audit.read, certificate.template.manage, notification.read.
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
    PERMISSIONS.QUIZ_READ, PERMISSIONS.QUIZ_CREATE, PERMISSIONS.QUIZ_UPDATE,
    PERMISSIONS.QUIZ_DELETE, PERMISSIONS.QUIZ_SUBMIT, PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.GRADE_READ, PERMISSIONS.CERTIFICATE_READ, PERMISSIONS.CERTIFICATE_ISSUE, PERMISSIONS.CERTIFICATE_REVOKE,
    PERMISSIONS.AUDIT_READ, PERMISSIONS.CERTIFICATE_TEMPLATE_MANAGE, PERMISSIONS.NOTIFICATION_READ,
  ],
  instructor: [
    PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.CLASS_READ, PERMISSIONS.CLASS_CREATE, PERMISSIONS.CLASS_UPDATE, PERMISSIONS.CLASS_MANAGE,
    PERMISSIONS.ASSIGNMENT_READ, PERMISSIONS.ASSIGNMENT_CREATE, PERMISSIONS.ASSIGNMENT_UPDATE,
    PERMISSIONS.ASSIGNMENT_DELETE, PERMISSIONS.SUBMISSION_READ, PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.CODING_READ, PERMISSIONS.CODING_CREATE, PERMISSIONS.CODING_UPDATE,
    PERMISSIONS.CODING_DELETE, PERMISSIONS.CODING_RESULT_READ,
    PERMISSIONS.QUIZ_READ, PERMISSIONS.QUIZ_CREATE, PERMISSIONS.QUIZ_UPDATE,
    PERMISSIONS.QUIZ_DELETE, PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.GRADE_READ, PERMISSIONS.CERTIFICATE_READ, PERMISSIONS.CERTIFICATE_ISSUE, PERMISSIONS.CERTIFICATE_REVOKE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  teaching_assistant: [
    PERMISSIONS.ASSIGNMENT_READ, PERMISSIONS.SUBMISSION_READ, PERMISSIONS.GRADE_WRITE,
    PERMISSIONS.CODING_READ, PERMISSIONS.CODING_RESULT_READ,
    PERMISSIONS.QUIZ_READ, PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.GRADE_READ, PERMISSIONS.CERTIFICATE_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  // học viên: nộp code/quiz + xem kết quả của mình + nhận thông báo
  student: [
    PERMISSIONS.CODING_SUBMIT, PERMISSIONS.CODING_RESULT_READ,
    PERMISSIONS.QUIZ_SUBMIT, PERMISSIONS.QUIZ_RESULT_READ,
    PERMISSIONS.NOTIFICATION_READ,
  ],
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

    // 4) Badges (upsert theo code)
    let badgeCount = 0;
    for (const b of BADGE_DEFS) {
      await prisma.badge.upsert({
        where: { code: b.code },
        update: { name: b.name, description: b.description, icon: b.icon, isManual: b.isManual ?? false },
        create: { ...b, isManual: b.isManual ?? false },
      });
      badgeCount++;
    }

    // 5) (Tùy chọn) super_admin đầu tiên từ env — KHÔNG hardcode secret.
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

    console.log(`✔ Seed xong: ${PERMISSION_DEFS.length} permission, ${ROLE_DEFS.length} role, ${linkCount} liên kết role-permission, ${badgeCount} badges.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
