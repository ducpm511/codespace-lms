# Active Tasks

<!-- SIZE LIMIT: 200 lines. Do not exceed. -->
<!-- Completed task history -> docs/archive/completed_tasks/ -->

Updated: 2026-08-13

## Quy ước đặt tên

- **P<n>** = **Phase** (giai đoạn lớn): P0...P6, xem Roadmap.
- **T<n>.<k>** = **Task** con của phase P<n>; số sau `T` luôn khớp số phase.

## Roadmap (theo docs/DESIGN.md §10)

| Phase | Nội dung | Trạng thái |
|---|---|---|
| **P0** Scaffold & nền auth/RBAC | monorepo, prisma, auth, PBAC | ✅ Done |
| **P1** Course & Class | course/section/lesson, class, gate, progress | ✅ Done |
| **P2** Assessments | assignment + submission + chấm tay | ✅ Done |
| **P3** Coding & Runner | Pyodide FE + Judge0/Piston + autograde | ⬅️ Active |
| **P4** Quiz | quiz engine + autograde | Not started |
| **P5** Gradebook & Certificate | tổng hợp điểm, cấp + verify chứng chỉ | Not started |
| **P6** Polish | notification, audit UI, báo cáo | Not started |

Phụ thuộc chung: `contracts -> prisma schema -> backend -> frontend`. P3 runner có thể phát triển song song sau khi contracts/schema chốt.

---

## Active Phase

### Phase P3: Coding & Runner (Pyodide FE + server autograde) — ⬅️ ACTIVE

Status: 🔄 Đang chạy — T3.0–T3.6 ✅ (contracts + schema + backend authoring + seed + **runner/queue + submit/autograde**). Còn **T3.7/T3.8 FE**, **T3.9 verify**. `pnpm validate` xanh 16/16 (api **105 test**). Goal (docs/DESIGN.md §4.5, §5.2, §6): bài tập lập trình Python, học viên chạy thử bằng Pyodide với sample test trên trình duyệt, nộp chính thức qua server runner cách ly, chấm toàn bộ sample + hidden test và tính điểm `Decimal`.

**Bước kế: T3.7/T3.8** — FE Teach coding (author UI) + FE Learn (Monaco + Pyodide worker sample, submit + polling). Runner/queue backend đã sẵn sàng (T3.4/T3.5).

#### Task Breakdown (P3)

| Task | Scope | Surface | Risk | Order |
|---|---|---|---|---|
| ✅ **T3.0** Chốt runner ADR: dùng Piston self-hosted cho MVP, giữ `RunnerService` interface để thêm Judge0; env config, không hardcode endpoint/secret | architecture | docs | High | 1 |
| ✅ **T3.1** Contracts coding: DTO/problem/testcase/submission/result + permission keys `coding.*`; student DTO chỉ expose sample tests | contracts | contracts | High | 2 |
| ✅ **T3.2** Schema coding: `CodingProblem`, `TestCase`, `CodingSubmission`, `TestCaseResult` + enum/status/index/migration (áp DB); điểm/weight `Decimal`. **Fix invalid-UTF8 comment** (làm hỏng prisma schema engine) | schema | schema | High | 3 |
| ✅ **T3.3** Backend coding authoring: CRUD problem/testcase cho GV/admin, PBAC + IDOR; **student `GET :id/attempt` chỉ sample (membership+gate), không lộ hidden/solution**. Smoke live 14/14 | backend | api | High | 4 |
| ✅ **T3.4** Runner adapter + queue: `RunnerService` interface + Piston adapter (env) + Stub (non-exec dev) + `RunnerModule`; `AutograderService` (chấm all-test, score Decimal weighted, transaction + LessonProgress); `SubmissionQueue` port + Inline/Bull driver (BullMQ Redis 6380) qua `CODE_QUEUE_DRIVER` | backend | api/queue | High | 5 |
| ✅ **T3.5** Backend submission/autograde: `POST /coding-problems/:id/submissions` (membership+gate, tạo queued + enqueue), `GET /coding-submissions/:id` (ownership hoặc coding.result.read scoped); chấm lại server-side, không tin client; KHÔNG lộ stdin/expected ra client | backend | api | High | 6 |
| ✅ **T3.6** Seed permission coding cho admin/instructor/TA/student theo least privilege (30 perm / 85 liên kết) | schema | seed | Med | 7 |
| **T3.7** FE Teach coding: tạo/sửa coding problem + sample/hidden testcase UI; không render hidden expected output cho student surface | frontend | web | Med | 8 |
| **T3.8** FE Learn coding: Monaco + Pyodide worker chạy sample tests, submit server, polling trạng thái autograde/result | frontend | web | High | 9 |
| **T3.9** Verify live: docker runner/queue smoke, security regression hidden-test leak, `pnpm validate`, prisma validate | test | all | High | 10 |

Dependency: T3.0–T3.6 ✅ -> T3.7/T3.8 (FE) -> T3.9 (verify).

**Env mới (T3.4/T3.5)** — `.env.example` bị deny-rule nên ghi ở đây, thêm tay khi cấu hình runner thật:
`CODE_QUEUE_DRIVER=inline|bull` (mặc định inline — chấm đồng bộ, không cần Redis; `bull` cần `REDIS_URL`),
`CODE_RUNNER_PROVIDER=stub|piston` (mặc định stub — KHÔNG thực thi code, chỉ echo stdin để chạy pipeline dev;
`piston` cần `CODE_RUNNER_URL`, tùy chọn `CODE_RUNNER_TOKEN`, `CODE_RUNNER_PYTHON_VERSION` mặc định `*`),
`CODE_RUNNER_STDOUT_LIMIT_BYTES` (mặc định 65536). Prod: `CODE_QUEUE_DRIVER=bull` + `CODE_RUNNER_PROVIDER=piston`.

#### Acceptance Criteria (P3)

- `pnpm validate` + `npx prisma format && npx prisma validate` pass; migration áp sạch.
- GV tạo coding problem gắn course/lesson/class, có sample + hidden tests; client student chỉ nhận sample test.
- Học viên trong lớp, lesson đã mở gate, chạy thử Python bằng Pyodide với sample tests; kết quả preview không ghi điểm.
- Submit chính thức tạo `CodingSubmission status=queued`, job runner cách ly chấm all tests, lưu `TestCaseResult`, tính `score Decimal` weighted và cập nhật trạng thái.
- Server không chạy code trong API process; runner cấu hình qua env, không network, giới hạn CPU/RAM/wall-time/stdout theo thiết kế.
- PBAC/IDOR: instructor/TA chỉ thao tác/chấm lớp phụ trách; student chỉ xem/nộp bài của mình.
- Không hard-delete submission/result; không lộ hidden testcase/stdout/expected output không phù hợp cho client đang làm bài.

#### Open Decisions / Blockers

- Runner MVP: **đã chốt Piston self-hosted** trong `docs/adr/001-code-runner-piston-mvp.md`; nếu cần multi-language/status/scaling chi tiết hơn thì thêm Judge0 adapter sau.
- Gradebook/AuditLog tổng hợp đầy đủ vẫn thuộc P5/P6; P3 chỉ ghi score coding và chuẩn bị điểm nối nếu schema hiện có cho phép.

---

## Completed Phase Summary

- **P0** Done: scaffold monorepo, Prisma/Postgres/Redis, auth JWT + refresh cookie, PBAC, users/rbac CRUD, seed, FE login/admin shell.
- **P1** Done: course/section/lesson, class/course/member/gate/progress, Teach/Learn FE, PBAC scope theo lớp, lesson gate invariant.
- **P2** Done: assignment/submission schema + contracts + backend + seed + FE Teach/Learn chấm tay. `pnpm validate` xanh: api 73 test + web 4 test.

## Verification Commands

```bash
pnpm validate
npx prisma format && npx prisma validate
```
