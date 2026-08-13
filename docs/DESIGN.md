# CodeSpace LMS — Design

<!-- Tài liệu thiết kế (product + technical). Nguồn sự thật cho quyết định thiết kế & data model. -->

> Version 0.1 — 2026-08-12. Bản thiết kế nền tảng LMS của CodeSpace Việt Nam, tối ưu cho việc dạy/học
> lập trình **Scratch** và **Python**. Đồng bộ data model với `prisma/schema.prisma` khi scaffold.

---

## 1. Mục tiêu

Nền tảng LMS phục vụ dạy–học lập trình (Scratch, Python), STEAM, AI tại CodeSpace. Trọng tâm khác biệt
so với LMS phổ thông:

1. **Live coding trên trình duyệt** — học viên viết Python, chạy code, xem kết quả chấm theo test case
   ngay lập tức mà không cần cài đặt gì.
2. **Lớp học theo tiến độ (cohort)** — giáo viên mở khóa bài học dần theo nhịp lớp, không phải self-paced
   thả cửa.
3. **Chấm điểm hỗn hợp** — tự động (coding/quiz) + thủ công (assignment) gộp về một sổ điểm.
4. **Chứng chỉ** có mã xác thực công khai.

Phi mục tiêu (giai đoạn đầu): thanh toán/thương mại, live video conferencing, mobile app native,
đa ngôn ngữ lập trình ngoài Python (kiến trúc để mở, nhưng chỉ bật Python trước).

## 2. Người dùng & vai trò

| Persona | Vai trò hệ thống | Mục tiêu chính |
|---|---|---|
| Quản trị hệ thống | `super_admin` | Toàn quyền, cấu hình nền tảng, quản lý role/permission |
| Quản trị đào tạo | `admin` | Quản lý user, khóa học, lớp, chứng chỉ; không đụng cấu hình hệ thống |
| Giáo viên | `instructor` | Tạo/biên soạn khóa học, mở bài theo tiến độ lớp, chấm điểm, cấp chứng chỉ |
| Trợ giảng | `teaching_assistant` | Chấm bài, hỗ trợ lớp được phân công; không sửa cấu trúc khóa học |
| Học viên | `student` | Học bài, làm quiz/assignment/coding, xem điểm & chứng chỉ |

Role là dữ liệu (không hardcode), gán qua bảng nối. Một user có thể nhiều role; một số quyền còn bị
**giới hạn theo phạm vi lớp** (scope), xem §5.

## 3. Kiến trúc tổng thể

```
                          ┌──────────────────────────────┐
   Browser (React SPA)    │  apps/web                     │
   Monaco editor + Pyodide│  Vite + Tailwind + TanStack Q │
                          └──────────────┬────────────────┘
                                         │ REST/JSON (JWT access + refresh cookie httpOnly)
                          ┌──────────────▼────────────────┐
                          │  apps/api (NestJS)             │
                          │  Auth · RBAC guard · module    │
                          │  service layer · Prisma        │
                          └───┬─────────────┬───────┬──────┘
                              │             │       │
                   ┌──────────▼──┐   ┌──────▼───┐  ┌▼──────────────┐
                   │ PostgreSQL  │   │  Redis   │  │ Object storage│
                   │ (nguồn thật)│   │ queue +  │  │ StorageAdapter│
                   └─────────────┘   │  cache   │  │ R2 + Cloudinary│
                                     └────┬─────┘  └───────────────┘
                                          │ BullMQ jobs (coding submissions)
                                  ┌───────▼─────────┐
                                  │ Code Runner svc │  ← CÁCH LY, không network,
                                  │ (Judge0/Piston  │    giới hạn CPU/RAM/wall-time
                                  │  self-hosted)   │
                                  └─────────────────┘
```

**Monorepo** (pnpm + Turborepo — đã chốt trong CURRENT_STATE):

```
apps/web        — frontend (frontend-only)
apps/api        — backend NestJS (backend-only)
packages/
  contracts/    — DTO/type/enum dùng chung FE↔BE (KHÔNG logic)
  database/     — Prisma schema + migrations + generated client (nguồn sự thật data); export PrismaClient
services/
  code-runner/  — wrapper quanh Judge0/Piston (chạy code cách ly)
```

Ranh giới bất di bất dịch (`cx-hard-limits`): không import chéo app, không logic trong `contracts`,
không render UI trong api.

## 4. Data model

> Quy ước (`sk-schema-conventions`): `id String @id @default(cuid())`, `createdAt/updatedAt`, UTC,
> enum value snake_case, **điểm/score dùng `Decimal`** không Float, `@@unique` cho thao tác idempotent.

### 4.1 Identity & RBAC

```
User(id, email @unique, passwordHash, fullName, avatarUrl?, status[active/suspended/invited],
     lastLoginAt?, createdAt, updatedAt)
Role(id, key @unique, name, description?, isSystem)                 // super_admin, instructor, ...
Permission(id, key @unique, description)                            // "course.create", "grade.write"...
RolePermission(roleId, permissionId)                    @@unique([roleId, permissionId])
UserRole(id, userId, roleId, classId?)                  @@unique([userId, roleId, classId])
   // classId != null => role có phạm vi trong 1 lớp (vd TA của lớp X)
RefreshToken(id, userId, tokenHash, expiresAt, revokedAt?, userAgent?, ip?)  // server-side
```

Quyền = hợp của permission từ mọi role của user (lọc theo scope lớp khi cần). Guard đọc permission,
**không tin role/ownership từ client** (`cx-hard-limits`).

### 4.2 Course & nội dung

```
Course(id, slug @unique, title, description?, thumbnailUrl?, language[scratch/python/other],
       level[beginner/intermediate/advanced], status[draft/published/archived], createdById, ...)
Section(id, courseId, title, order)                     @@unique([courseId, order])
Lesson(id, sectionId, title, order, type[video/article/interactive/coding/quiz/assignment],
       contentMd?, videoUrl?, refId?, estimatedMinutes?)   @@unique([sectionId, order])
   // refId trỏ tới CodingProblem / Quiz / Assignment tùy type (soft-ref trong cùng DB, có index)
LessonResource(id, lessonId, fileId, label)              // tài liệu đính kèm (private storage)
```

### 4.3 Lớp học (cohort) & tiến độ

```
Class(id, name, code @unique, description?, startDate?, endDate?,
      status[planning/active/finished/archived], createdById)
ClassCourse(id, classId, courseId, order)               @@unique([classId, courseId])   // gán khóa cho lớp
ClassMember(id, classId, userId, roleInClass[student/ta/instructor], status, joinedAt)
                                                        @@unique([classId, userId])
LessonGate(id, classId, lessonId, isActive, activatedAt?, activatedById?)
                                                        @@unique([classId, lessonId])
   // "active bài học theo tiến độ": bài chỉ mở cho lớp khi có gate isActive=true
LessonProgress(id, userId, lessonId, classId, status[not_started/in_progress/completed],
       completedAt?)                                    @@unique([userId, lessonId, classId])
```

**Luật mở bài:** học viên chỉ thấy/làm được `Lesson` khi tồn tại `LessonGate(classId, lessonId, isActive=true)`.
Giáo viên bật gate thủ công hoặc theo rule (vd tự mở bài kế khi ≥X% lớp hoàn thành bài trước — job nền).

### 4.4 Assignment (bài tập nộp/chấm tay)

```
Assignment(id, lessonId?, courseId, title, descriptionMd, dueAt?, maxScore Decimal, allowLate,
       submissionType[text/file/link])
Submission(id, assignmentId, userId, classId, contentText?, fileId?, linkUrl?, submittedAt,
       status[draft/submitted/graded/returned], score Decimal?, feedbackMd?, gradedById?, gradedAt?)
                                                        @@unique([assignmentId, userId, classId])
```

### 4.5 Bài tập lập trình (coding) — autograded

```
CodingProblem(id, title, statementMd, language[python], starterCode?, solutionCode?,
       timeLimitMs, memoryLimitMb, difficulty[easy/medium/hard], maxScore Decimal)
TestCase(id, problemId, name?, stdin, expectedStdout, kind[sample/hidden], weight Decimal, order)
   // sample = học viên thấy được; hidden = chỉ chạy khi Submit, KHÔNG gửi ra client
CodingSubmission(id, problemId, userId, classId?, sourceCode, language,
       status[queued/running/passed/failed/error], score Decimal?, runtimeMs?, memoryKb?,
       submittedAt)
TestCaseResult(id, submissionId, testCaseId, status[passed/failed/tle/mle/re/ce],
       actualStdout?, runtimeMs?)                        @@unique([submissionId, testCaseId])
```

Chi tiết engine chạy code: §6.2.

### 4.6 Quiz — autograded

```
Quiz(id, courseId, lessonId?, title, timeLimitSec?, attemptsAllowed, passScore Decimal,
       shuffleQuestions, shuffleOptions)
Question(id, quizId, type[single_choice/multiple_choice/true_false/short_answer/code_fill],
       promptMd, points Decimal, order)
QuestionOption(id, questionId, textMd, isCorrect, order)   // isCorrect KHÔNG gửi ra client khi làm bài
QuizAttempt(id, quizId, userId, classId?, startedAt, submittedAt?, score Decimal?,
       status[in_progress/submitted/expired])           @@unique nếu attemptsAllowed=1
QuizAnswer(id, attemptId, questionId, selectedOptionIds Json?, textAnswer?, awardedPoints Decimal?,
       isCorrect?)
```

### 4.7 Sổ điểm & chứng chỉ

```
GradeItem(id, classId, sourceType[assignment/quiz/coding], sourceId, title, weight Decimal, maxScore)
GradeEntry(id, gradeItemId, userId, score Decimal, computedAt)   @@unique([gradeItemId, userId])
   // tổng hợp tự động từ Submission/QuizAttempt/CodingSubmission; là "view vật chất" của sổ điểm

CertificateTemplate(id, name, backgroundFileId?, layoutJson)
Certificate(id, userId, classId?, courseId, templateId, serialNo @unique,
       verificationCode @unique, finalScore Decimal, issuedAt, issuedById, pdfFileId?,
       revokedAt?, revokedReason?)                       @@unique([userId, courseId, classId])
```

### 4.8 Cross-cutting

```
File(id, ownerId, provider[r2/cloudinary/local], storageKey, mime, sizeBytes,
     visibility[private/public], createdAt)              // private mặc định; provider chọn theo §5.5
AuditLog(id, actorId?, action, entity, entityId, metaJson, ip?, createdAt)  // ghi CÙNG transaction domain
Notification(id, userId, type, payloadJson, readAt?, createdAt)
```

## 5. Quyết định kỹ thuật đã chốt

### 5.1 Auth & RBAC
- JWT **access token** ngắn hạn (15m) trong memory FE; **refresh token** httpOnly cookie, lưu hash
  server-side (`RefreshToken`), xoay vòng khi refresh. Không lộ JWT nhạy cảm ra JS (`cx-hard-limits`).
- **PBAC**: guard kiểm `permission.key` (vd `course.publish`), không kiểm role thô. Role→permission là data.
- **Scope theo lớp**: quyền như `grade.write` chỉ áp cho lớp user được phân công (`UserRole.classId` hoặc
  `ClassMember.roleInClass`). Mọi route `:id` kiểm ownership/scope ở service (`sk-idor-enforcement`).

### 5.2 Chấm điểm
- **Coding/Quiz**: chấm tự động, điểm là `Decimal`, tính weighted theo `TestCase.weight`/`Question.points`.
- **Assignment**: chấm tay, có rubric/feedback.
- **Nguồn sự thật điểm coding = server** (kết quả runner), Pyodide chỉ để học viên xem trước (§6.1).
- Ghi điểm + `AuditLog` trong **cùng transaction** (`cx-hard-limits` DATA INTEGRITY).

### 5.3 Chứng chỉ
- Điều kiện cấp: hoàn thành ≥ ngưỡng % bài + `finalScore ≥ passScore` (cấu hình theo khóa/lớp).
- Sinh PDF server-side, lưu private storage; `verificationCode` cho trang xác thực công khai
  `/verify/:code` (chỉ hiển thị tên, khóa, ngày — **không PII nhạy cảm trên URL/trang**).
- Thu hồi = set `revokedAt`, không hard-delete (giữ lịch sử).

### 5.4 Lưu trữ file (`StorageAdapter` — provider-agnostic)
- Interface `StorageAdapter` (`put/getSignedUrl/delete`) với các impl chọn qua env — **không khóa vendor**:
  - `LocalAdapter` — dev/CI (ghi đĩa).
  - `CloudinaryAdapter` — **media công khai** (avatar, thumbnail khóa học, video ngắn); tận dụng
    transform/optimize + CDN. Free tier ~25 credit/tháng.
  - `R2Adapter` — **file riêng tư** (bài nộp học viên, PDF chứng chỉ, tài liệu lớp); Cloudflare R2
    S3-compatible, 10GB free, egress miễn phí, private + **signed URL**.
- Chọn adapter theo `File.visibility`: `public → Cloudinary`, `private → R2`. Route qua service `files`,
  không lộ storageKey/URL nội bộ ra client — chỉ trả **signed URL** ngắn hạn cho file private.
- Dự án phi lợi nhuận → cả hai đều free tier; đổi provider sau chỉ là thêm 1 impl adapter.

### 5.5 Bất biến domain (đề xuất điền vào `cx-hard-limits §DOMAIN`)
```
NEVER chạy code học viên trong tiến trình API — luôn qua runner cách ly.
NEVER gửi TestCase.kind=hidden hoặc QuestionOption.isCorrect ra client khi đang làm bài.
NEVER cho học viên truy cập Lesson khi lớp chưa có LessonGate isActive.
NEVER hard-delete Certificate/Submission/GradeEntry — chỉ soft-delete/revoke.
NEVER tin điểm/kết quả do client gửi lên (Pyodide) — chấm lại ở server.
```

## 6. Live coding & chấm code (deep dive)

### 6.1 Chạy nhanh phía trình duyệt (feedback tức thì)
- **Monaco Editor** + **Pyodide** (CPython biên dịch WebAssembly) chạy trong Web Worker.
- Học viên bấm **Run** → chạy Python ngay trong trình duyệt với các `TestCase.kind=sample`, hiện stdout.
- Ưu điểm: 0 chi phí server, phản hồi tức thì, an toàn (sandbox của trình duyệt). Hợp học viên mới.
- Kết quả này **chỉ tham khảo**, không tính điểm.

### 6.2 Chấm chính thức phía server (nguồn sự thật)
1. Học viên **Submit** → `POST /coding-submissions` → tạo bản ghi `status=queued` → đẩy **BullMQ** job.
2. **Code Runner service** (Judge0 CE hoặc Piston self-hosted, gói trong `services/code-runner`) chạy
   source với **toàn bộ** test case (sample + hidden).
3. Cách ly bắt buộc: **không network**, FS read-only, giới hạn **CPU/RAM (`memoryLimitMb`)**,
   **wall-time (`timeLimitMs`)**, cap kích thước stdout, mỗi lần chạy một tiến trình biệt lập.
4. Map kết quả → `TestCaseResult` (passed/failed/tle/mle/re/ce) → tính `score` weighted →
   cập nhật `CodingSubmission`, `LessonProgress`, `GradeEntry` + `AuditLog` (cùng transaction).
5. FE nhận trạng thái qua polling (TanStack Query) hoặc SSE.

> Vì sao hybrid: Pyodide cho trải nghiệm "chạy là thấy" tức thì; runner server đảm bảo **tính toàn vẹn
> điểm** và chạy được hidden test mà client không bao giờ nhìn thấy.

## 7. Backend module map (NestJS)

`auth` · `users` · `rbac` (roles/permissions) · `courses` (course/section/lesson) · `classes`
(class/enrollment/gate/progress) · `assignments` · `coding` (problems/testcases/submissions) ·
`quizzes` · `grading` (gradebook) · `certificates` · `files` · `notifications` · `audit`.

Mỗi module theo `sk-nestjs-module-pattern`; DTO validate allowlist ở biên (`sk-dto-validation`,
chống mass assignment); response chuẩn hóa (`sk-api-response-rules`).

## 8. API surface (phác thảo)

```
POST   /auth/login · /auth/refresh · /auth/logout        GET /auth/me
CRUD   /users               POST /users/:id/roles
CRUD   /roles · /permissions
CRUD   /courses · /courses/:id/sections · /sections/:id/lessons     POST /courses/:id/publish
CRUD   /classes             POST /classes/:id/courses · /classes/:id/members
POST   /classes/:id/lessons/:lessonId/gate   (bật/tắt mở bài)
GET    /classes/:id/progress                 (bảng tiến độ lớp)
CRUD   /assignments         POST /assignments/:id/submissions · /submissions/:id/grade
CRUD   /coding-problems · /coding-problems/:id/testcases
POST   /coding-submissions  GET /coding-submissions/:id  (poll kết quả)
CRUD   /quizzes · /quizzes/:id/questions
POST   /quizzes/:id/attempts · /attempts/:id/submit
GET    /classes/:id/gradebook
POST   /certificates/issue · POST /certificates/:id/revoke   GET /verify/:code  (public)
```

## 9. Frontend (apps/web)
- Route theo vai: `/admin/*`, `/teach/*`, `/learn/*`. Data qua TanStack Query (`sk-react-query-patterns`).
- Màn hình cốt lõi: quản lý user/role, trình soạn khóa học, bảng điều khiển lớp (gate + tiến độ),
  **IDE học viên** (Monaco + panel test case + kết quả), trình làm quiz, sổ điểm, trang chứng chỉ + verify.
- Design system + i18n theo `sk-ui-design-system`, `sk-localization-rules`.

## 10. Roadmap (đề xuất cho ACTIVE_TASKS)

| Phase | Nội dung | Ghi chú |
|---|---|---|
| **P0** Scaffold | monorepo, prisma wiring, auth + RBAC nền | T1.0/T1.1 sẵn có |
| **P1** Course & Class | course/section/lesson, class, gate, progress | lõi vận hành |
| **P2** Assessments | assignment + submission + chấm tay | sổ điểm sơ khai |
| **P3** Coding & Runner | Pyodide FE + Judge0/Piston + autograde | phần khó nhất, tách service |
| **P4** Quiz | quiz engine + autograde | |
| **P5** Gradebook & Certificate | tổng hợp điểm, cấp + verify chứng chỉ | |
| **P6** Polish | notification, audit UI, báo cáo | |

Phụ thuộc: `contracts → prisma schema → backend → frontend`; P3 runner chạy song song được sau P0.

## 11. Open questions
- Hosting runner: Judge0 CE (đủ tính năng, nặng) vs Piston (nhẹ, tự quản) — chốt khi vào P3.
- Scratch: nhúng scratch-gui/scratch-vm (chấm project Scratch tự động rất khó — có thể chỉ nộp + chấm tay ở P1).
- Rule tự mở bài theo % lớp: ngưỡng và ai kích hoạt (thủ công vs job nền).
- Đa tenant/nhiều cơ sở CodeSpace: có cần `Organization` tách dữ liệu không?
