# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history → docs/archive/completed_tasks/ -->

Updated: 2026-08-13

## Quy ước đặt tên

- **P<n>** = **Phase** (giai đoạn lớn): P0…P6 — xem Roadmap.
- **T<n>.<k>** = **Task** con của phase P<n>. Ví dụ P0 gồm `T0.0…T0.8`; P1 sẽ gồm `T1.0, T1.1…`.
  → Số sau `T` luôn khớp số phase. `T0.x` = các task của P0.

## Roadmap (theo docs/DESIGN.md §10)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** Scaffold & nền auth/RBAC | monorepo, prisma, auth, PBAC | ✅ Done — 9/9 task |
| **P1** Course & Class | course/section/lesson, class, gate, progress | ✅ Done — 6/6 (T1.0–T1.5) |
| **P2** Assessments | assignment + submission + chấm tay | ✅ Done — 6/6 (T2.0–T2.5) |
| **P3** Coding & Runner | Pyodide FE + Judge0/Piston + autograde | ⬅️ Kế tiếp |
| **P4** Quiz | quiz engine + autograde | Not started |
| **P5** Gradebook & Certificate | tổng hợp điểm, cấp + verify chứng chỉ | Not started |
| **P6** Polish | notification, audit UI, báo cáo | Not started |

Phụ thuộc chung: `contracts → prisma schema → backend → frontend`. P3 runner chạy song song được sau P0.

---

## Active Phase

### Phase P2: Assessments (Assignment + Submission + chấm tay) — ✅ DONE (6/6)

Status: ✅ DONE (6/6). Goal (docs/DESIGN.md §4.4, §5.2): bài tập nộp (text/file/link) + chấm tay
(score `Decimal` + feedback). Coding autograde = P3, Quiz = P4 (KHÔNG trong P2).

#### Task Breakdown (P2)

| Task | Scope | Surface | Risk | Order |
|---|---|---|---|---|
| **T2.0** Schema `Assignment` + `Submission` + enum (SubmissionType text/file/link, SubmissionStatus draft/submitted/graded/returned) + migration | schema | schema | Med | 1 |
| **T2.1** Contracts assignment/submission + PERMISSIONS (assignment.*, submission.read/grade) | contracts | contracts | Low | 2 |
| **T2.2** Module `assignments` (CRUD assignment) + PBAC | backend | api | Med | 3 |
| ✅ **T2.3** Module `submissions` (HV nộp/sửa draft theo membership; GV liệt kê + chấm tay theo scope lớp; điểm Decimal, không tin client) | backend | api | High | 4 |
| ✅ **T2.4** Seed permission assignment/grade cho admin/instructor/TA (idempotent) | schema | schema | Low | 5 |
| ✅ **T2.5** FE Teach (tạo assignment, xem bài nộp, chấm) + Learn (xem đề, nộp, xem điểm/feedback) | frontend | web | Med | 6 |

Dependency: T2.0 → T2.1 → T2.2 → T2.3 → T2.4 → T2.5.

#### Acceptance Criteria (P2)
- `pnpm validate` + migration áp sạch. Điểm là `Decimal` (không Float); không hard-delete Submission.
- GV tạo assignment cho course/lesson; HV (thành viên lớp) nộp bài (draft→submitted); GV chấm (score+feedback,
  status→graded), scope theo lớp (GV/TA chỉ chấm lớp phụ trách). HV xem điểm/feedback sau khi graded.
- Không tin score client gửi; unique 1 submission/(assignment,user,class); IDOR trên :id.
- **Hoãn (không thuộc P2)**: file upload thật (cần StorageAdapter — text/link nộp được ngay, file để sau);
  AuditLog & GradeEntry tổng hợp (P5/P6).

### Phase P1: Course & Class — ✅ DONE (6/6)

Status: ✅ Hoàn tất T1.0–T1.5. Backend (courses+classes+gate/progress+PBAC scope) + FE (Teach/Learn)
đều verify live. (P0 ✅ Done — chi tiết ở Completed Task History.)
Goal (docs/DESIGN.md §4.2–4.3):
- Quản lý khóa học: Course → Section → Lesson (đa loại nội dung), publish/archive.
- Lớp học: Class + gán khóa (ClassCourse) + thành viên (ClassMember).
- **Mở bài theo tiến độ lớp**: LessonGate (isActive) + LessonProgress.

### Task Breakdown (P1)

> Mỗi task một-surface, ≤ 40% context (`cx-token-budget`). Số sau `T` = số phase → `T1.x` = task của P1.

| Task | Scope | Surface | Risk | Order |
|---|---|---|---|---|
| ✅ **T1.0** Schema Course/Section/Lesson + Class/ClassCourse/ClassMember/LessonGate/LessonProgress + enum + migration | schema | schema | Med | 1 |
| ✅ **T1.1** Contracts course/class + mở rộng catalog PERMISSIONS (course.*, class.*) | contracts | contracts | Low | 2 |
| ✅ **T1.2** Module `courses` (CRUD course/section/lesson, publish/archive) + PBAC | backend | api | Med | 3 |
| ✅ **T1.3** Module `classes` (class CRUD, gán khóa, enroll, gate bài, progress) + PBAC + scope lớp | backend | api | High | 4 |
| ✅ **T1.4** Seed: gán permission course/class cho instructor/admin (idempotent) | schema | schema | Low | 5 |
| ✅ **T1.5** FE: Teach (khóa học + lớp: gate/progress), Learn (bài theo gate) | frontend | web | Med | 6 |

Dependency: T1.0 → T1.1 → T1.2/T1.3 → T1.4 → T1.5.

### Acceptance Criteria (P1)

- `pnpm validate` + `prisma validate` pass; migration áp sạch.
- Tạo course có section/lesson + publish; tạo class, gán course, enroll học viên.
- Giáo viên bật LessonGate → học viên mới thấy/làm bài; chưa gate → chặn (invariant domain).
- Route lớp kiểm scope (instructor/TA chỉ thao tác lớp phụ trách) — test PBAC scope theo lớp.

---

## Verification Commands

```bash
pnpm validate
npx prisma format && npx prisma validate
```

## Completed Task History

- **T0.0** (2026-08-12) — Scaffold monorepo pnpm@9.15.9 + Turborepo; `apps/api` (NestJS 10 +
  health controller + Jest), `apps/web` (Vite 5 + React 18 + Tailwind 3 + TanStack Query + Vitest),
  `packages/contracts` (dual CJS/ESM build). `pnpm validate` xanh 12/12 (lint/typecheck/test/build).
- **ESLint** (2026-08-12) — Flat config ESLint 9 + typescript-eslint 8 (base gốc + config mỏng mỗi
  package); react-hooks/react-refresh cho web, jest/node globals cho test. Thay hết `echo` placeholder.
- **T0.1** (2026-08-12) — Prisma 5.22 trong `packages/database` (schema + generated client, output
  `generated/client`, export PrismaClient); model `User` + enum `UserStatus` nền; `PrismaModule`/
  `PrismaService` (@Global) trong api. `.env` per-package cho DATABASE_URL. validate xanh 16/16.
- **Infra dev** (2026-08-12) — `docker-compose.yml`: Postgres 16 + Redis 7 (healthcheck, volume).
  Publish **5433->5432** và **6380->6379** để né PostgreSQL/Redis native đã chạy trên máy. Scripts
  `pnpm db:up|db:down|db:migrate|db:studio`.
- **T0.2** (2026-08-12) — Schema RBAC: `Role`, `Permission`, `RolePermission`, `UserRole` (scope
  `classId?` soft-ref), `RefreshToken` + quan hệ trên `User`. Migration `init_identity_rbac` đã áp
  (7 bảng). validate xanh 16/16.
- **T0.3** (2026-08-12) — Contracts auth (`packages/contracts/src/auth.ts`): LoginRequest, AuthUser,
  LoginResponse, RefreshResponse (type thuần, không logic).
- **T0.4** (2026-08-12) — Module `auth` (apps/api): AuthService (bcryptjs, refresh **rotation** trong
  `$transaction`, refresh lưu SHA-256), AuthController (login/refresh/logout/me), JwtAuthGuard +
  @CurrentUser, ConfigModule global, cookie-parser. 6 unit test (mock Prisma). **Smoke test thật với
  DB PASS**: login→cookie httpOnly+accessToken, /me trả roles/permissions, refresh xoay token, 401
  đúng cho no-token/sai mật khẩu. validate xanh 16/16, 12 test.
- **T0.5** (2026-08-12) — Module `rbac` (@Global): `RbacService.getEffectivePermissions` (tách global
  vs scope theo lớp qua `UserRole.classId`), `@RequirePermission(...keys)` (AND), `PermissionsGuard`
  (chạy sau JwtAuthGuard; classId lấy từ params→body→query). 10 unit test. validate xanh 16/16, 22 test.
- **T0.6** (2026-08-12) — Module `users` (CRUD + assign/revoke role, mapper ẩn passwordHash, IDOR:
  NotFound/Conflict) + `RolesService`/`RbacController` (list/create role, attach permission, list
  permission). Catalog `PERMISSIONS` + `Paginated`/user contracts ở `@lms/contracts`. JwtModule global.
  6 unit test. **PBAC live PASS**: teacher(course.create)→GET /users **403**, admin(super_admin)→
  200/201, validation→400. validate xanh 16/16, 28 test.
- **T0.7** (2026-08-12) — Seed idempotent `packages/database/prisma/seed.cjs`: 8 permission (catalog
  từ `@lms/contracts`), 5 role hệ thống, ma trận role→permission (super_admin=8, admin=7, còn lại 0),
  super_admin user qua env (không hardcode secret). Chạy 2 lần không nhân đôi; verify DB khớp. `pnpm
  --filter @lms/database seed`. validate xanh 16/16.
- **T0.8** (2026-08-13) — FE shell (apps/web): react-router-dom + react-i18next (vi/en). `lib/api`
  (access token in-memory, tự refresh 401 qua cookie), auth hooks (useMe/useLogin/useLogout),
  RequireAuth/RequireRoles/HomeRedirect, AppLayout (nav lọc theo `allowedAreas`), LoginPage,
  AdminHome (bảng /users thật), Teach/LearnHome. 2 web test (roles). **Verify trình duyệt PASS**:
  chưa auth→/login, login admin→/admin + bảng user, nav lọc vai, /teach→403 FE gate, logout→/login.
  validate xanh 16/16, **32 test**. → **Kết thúc Phase P0.**
- **T1.0** (2026-08-13) — Schema P1: `Course/Section/Lesson` (+enum CourseLanguage/Level/Status,
  LessonType) và `Class/ClassCourse/ClassMember/LessonGate/LessonProgress` (+enum ClassStatus/
  ClassMemberRole/Status, ProgressStatus); back-relation trên User. Migration `p1_course_class` áp
  (8 bảng mới). validate xanh 16/16.
- **T1.1** (2026-08-13) — Contracts course/class (`course.ts`, `class.ts`): Course/Section/Lesson +
  Class/member/gate/progress DTO. Mở rộng `PERMISSIONS` +10 key (course.*, class.*). contracts
  build+typecheck OK.
- **T1.2** (2026-08-13) — Module `courses` (apps/api): `CoursesService` + `CoursesController` CRUD
  Course/Section/Lesson + publish/archive, PBAC (`JwtAuthGuard`+`PermissionsGuard`+`@RequirePermission`
  course.read/create/update/publish/delete). Routes: `GET/POST /courses`, `GET/PATCH/DELETE /courses/:id`,
  `POST /courses/:id/publish|archive`, `POST/PATCH/DELETE /courses/:id/sections[/:sectionId]`,
  `.../sections/:sectionId/lessons[/:lessonId]`. IDOR: section/lesson phải thuộc đúng course/section
  trong path (ensureSection/ensureLesson → NotFound). Order auto = max+1; trùng order → 409 (P2002);
  xóa course còn gán lớp → 409 (P2003). Mapper ẩn `createdById`. 6 DTO (allowlist `@IsIn`/`@IsInt`).
  `createdById` lấy từ `@CurrentUser`. 9 unit test (mock Prisma). validate xanh 16/16, **39 test**.
- **T1.4** (2026-08-13) — Seed permission course/class: `PERMISSION_DEFS` +10 key (course.*, class.*),
  ma trận role→permission thêm cho **admin** (đủ 10) + **instructor** (course.read/create/update/publish
  + class.read/update/manage — không delete, theo least-privilege; TA/student để phase scope sau). Seed
  idempotent chạy lại OK: **18 permission, 5 role, 42 liên kết** (super_admin=18, admin=17, instructor=7).
- **T1.3** (2026-08-13) — Module `classes` (apps/api): `ClassesService`+`ClassesController`. Route dùng
  param `:classId` để `PermissionsGuard` trích scope lớp. CRUD class (class.create/read/update/delete),
  `GET /classes/mine` (auth—lớp mình là thành viên), gán khóa `POST/DELETE :classId/courses`
  (class.manage), enroll `POST/DELETE :classId/members` (class.manage, **soft-remove** status=removed +
  upsert reactivate), gate `GET :classId/gates` (class.read) + `PUT :classId/gates` (class.manage — ghi
  activatedBy/At cùng lúc, chặn bài không thuộc khóa đã gán→400), progress học viên (chỉ auth+membership,
  KHÔNG permission key): `GET :classId/my-progress`, `PUT :classId/lessons/:lessonId/progress`.
  **INVARIANT #3**: progress chặn 403 khi lớp chưa có LessonGate isActive. Mapper ẩn createdById.
  13 unit test. **Smoke live PASS (26/26)**: gồm **scope theo lớp** (GV gán role instructor scoped classA
  → set gate/đọc classA OK, classB→403, list-all→403) + invariant #3 (trước gate 403 / sau gate 200) +
  gán khóa trùng→409/không tồn tại→404 + enroll ghost→404 + soft-remove→member rời khỏi lớp thì progress→403.
  validate xanh 16/16, **52 test**. → **Backend Phase P1 hoàn tất (T1.0–T1.4).**
- **T1.5** (2026-08-13) — FE Teach/Learn (`apps/web`). Feature `courses` + `classes` (api+hooks TanStack
  Query). **Teach** (`TeachHome` tabs): Khóa học (tạo, chọn, thêm section/lesson, publish) + Lớp học
  (tạo, gán khóa, enroll theo userId+role, quản lý gate qua checkbox mỗi bài). **Learn** (`LearnHome`):
  chọn lớp mình (`/classes/mine`) → danh sách bài đã mở gate (`/classes/:id/my-lessons`) + nút cập nhật
  progress. i18n vi/en đầy đủ. **Bổ sung backend** (cần cho Learn): `GET /classes/:classId/my-lessons`
  (auth+membership, chỉ bài gated + progress; +contract `MyLessonDto`, +3 test → **55 test**).
  **2 chỉnh do phát hiện khi verify live**: (a) seed T1.4 thêm `class.create` cho instructor (nếu không,
  GV bế tắc: vào được Teach nhưng không tạo được lớp; admin thì ngoài khu vực Teach) → **43 liên kết**;
  (b) FE khu vực `learn` mở cho **mọi user đã đăng nhập** (`allowedAreas` luôn gồm learn, route bỏ
  RequireRoles) vì học viên enroll chưa có global role `student` — nội dung vẫn chặn theo membership ở BE.
  **Verify trình duyệt PASS**: login GV→tạo course/section/lesson→publish (Đã xuất bản); tạo lớp→gán
  khóa→enroll HV→bật gate (Đang mở); login HV→thấy đúng bài đã mở→bấm Hoàn thành→status cập nhật.
  validate xanh 16/16, **api 55 + web 5 test**. → **Phase P1 HOÀN TẤT (T1.0–T1.5).**
  **Smoke live courses PASS (17/17)**: instructor login→CRUD course/section/lesson (auto order)→publish
  (draft→published); slug trùng→409, slug sai định dạng→400, section lạ→404 (IDOR); instructor thiếu
  course.delete→403 & thiếu user.read→403; admin delete→204; mapper không lộ createdById. ⚠️ File `.env`
  vẫn **chưa sửa được** (bị permission deny-rule chặn ghi) — smoke chạy bằng env inline
  `DATABASE_URL=...localhost:5433... REDIS_URL=...localhost:6380... node apps/api/dist/main.js`.
- **T2.3** (2026-08-13) — Module `submissions` (apps/api): SubmissionsService + SubmissionsController + DTOs. Endpoints: save draft (`PUT /assignments/:id/submissions/save`), submit (`POST /assignments/:id/submissions/submit`), mine (`GET /assignments/:id/submissions/mine`), list by class (`GET /classes/:classId/assignments/:id/submissions`), findOne (`GET /submissions/:id`), grade (`PUT /submissions/:id/grade`). Ràng buộc: active member, lesson gate active, score là Decimal, IDOR & scope permission check (`submission.read` / `grade.write`). 18 unit tests mới -> `pnpm validate` xanh 16/16, api **73 test** + web 5 test.
- **T2.4** (2026-08-13) — Seed permission assignment/grade (`packages/database/prisma/seed.cjs`): Thêm 6 PERMISSION_DEFS (`assignment.read/create/update/delete`, `submission.read`, `grade.write`). Cập nhật `ROLE_PERMISSIONS`: admin (đủ 6), instructor (đủ 6), teaching_assistant (`assignment.read`, `submission.read`, `grade.write`). Seed idempotent chạy lại OK: **24 permission, 5 role, 64 liên kết role-permission**. `pnpm validate` xanh 16/16.
- **T2.5** (2026-08-13) — FE Teach/Learn (`apps/web`): Feature `assessments` (API fetch + TanStack Query hooks). **Teach** (`TeachHome` tab "Bài tập & Chấm điểm" / `TeachAssignments.tsx`): Tạo bài tập (tên, mô tả, điểm tối đa, hạn nộp, loại nộp), chọn lớp + bài tập để xem danh sách bài nộp và chấm điểm trực tiếp (điểm số + nhận xét Markdown). **Learn** (`LearnHome` / `StudentAssignmentCard.tsx`): Học viên xem đề bài tập của lớp, nhập bài làm / dán link bài nộp, bấm "Lưu nháp" hoặc "Nộp bài", xem điểm số & nhận xét của giáo viên sau khi đã được chấm (`graded`). Thêm i18n vi/en đầy đủ. `pnpm validate` xanh 16/16, **api 73 test + web 4 test**. → **Phase P2 HOÀN TẤT (T2.0–T2.5).**
