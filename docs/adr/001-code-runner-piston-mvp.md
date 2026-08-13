# ADR 001: Code Runner cho Phase P3

Date: 2026-08-13
Status: Accepted

## Context

Phase P3 cần chạy code Python của học viên để chấm tự động. Domain invariant bắt buộc: API không bao giờ chạy code học viên trong tiến trình API; runner phải cách ly, không network, giới hạn CPU/RAM/wall-time và cap stdout. Pyodide trên frontend chỉ dùng để preview sample test, không phải nguồn điểm.

Hai lựa chọn trong thiết kế hiện tại:

- **Piston self-hosted**: nhẹ, API đơn giản (`/api/v2/execute`), có Docker, dùng Isolate/cgroup, mặc định không outbound network và có timeout/memory/stdout cap. Public API không còn dùng tự do từ 2026-02-15, nên chỉ dùng self-host cho LMS.
- **Judge0 CE self-hosted**: giàu tính năng hơn, sandboxed execution, nhiều language, API có config chi tiết cho CPU/wall-time/memory và trạng thái submission, nhưng nặng hơn để vận hành local-dev/MVP.

## Decision

D1. Phase P3 MVP dùng **Piston self-hosted** làm runner mặc định cho Python.

D2. Backend chỉ phụ thuộc `RunnerService` interface nội bộ, không phụ thuộc trực tiếp vào Piston trong service nghiệp vụ. Adapter đầu tiên là `PistonRunnerAdapter`; adapter Judge0 có thể thêm sau mà không đổi API coding/submission.

D3. Không dùng public Piston API cho production/dev mặc định. Endpoint runner lấy từ env, ví dụ `CODE_RUNNER_PROVIDER=piston`, `PISTON_BASE_URL=http://localhost:2000`; không hardcode token/URL bí mật.

D4. Mỗi testcase chính thức được chạy server-side qua queue worker. Worker gửi source, stdin và limits sang runner; sau đó map kết quả runner về `passed/failed/tle/mle/re/ce`, lưu `TestCaseResult`, tính điểm `Decimal`.

D5. Hidden testcase không bao giờ được gửi tới client student. FE Pyodide chỉ nhận sample tests và chỉ tạo kết quả preview.

## Consequences

- P3 có đường local-dev nhẹ hơn Judge0 và đủ cho Python-first MVP.
- Nếu sau này cần đa ngôn ngữ sâu hơn, batch submission/status API giàu hơn hoặc scaling worker phức tạp hơn, thêm `Judge0RunnerAdapter` và đổi env provider.
- Vì Piston `/execute` là sync theo từng run, batch testcase và retry/backoff nằm ở BullMQ/Nest worker của LMS.
- Vận hành runner phải tách container/service, không chạy chung process API.

## Implementation Notes

- T3.1 contracts phải tách DTO authoring và DTO student-facing để không lộ hidden test.
- T3.4 tạo interface runner với input/output trung lập: language, sourceCode, stdin, expectedStdout, timeLimitMs, memoryLimitMb, stdoutLimitBytes.
- T3.5 tính điểm từ DB testcase weight, không tin bất kỳ kết quả Pyodide/client gửi lên.
