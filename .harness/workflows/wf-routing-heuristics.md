# wf-routing-heuristics

<!-- WORKFLOW: Automatic Routing Heuristics -->
<!-- AGENTS: All agents — apply at session start before selecting workflow -->
<!-- MAX: 120 lines. -->

Đọc file này khi nhận task mà chưa chắc dùng workflow nào. Match theo signal, dừng ở match đầu tiên.

---

## Step 1 — Đọc Task
```
Task action:  [implement / fix / review / plan / refactor / test / update / ask]
Task surface: [backend / frontend / schema / contracts / agent-files / all]
Risk signals: [auth / IDOR / migration / PII / AI-LLM / <domain>]
Output type:  [code / analysis / memory-update / test-only]
```

## Step 2 — Route theo Action
| Action | Workflow |
|---|---|
| `implement`, `build`, `add`, `create`, `integrate` | `wf-feature-implementation.md` |
| `fix`, `debug`, `patch`, `hotfix` | `wf-bugfix-hotfix.md` |
| `plan`, `break down`, `roadmap`, `decompose phase` | `wf-phase-planning.md` |
| `review`, `audit`, `check`, `inspect` | `wf-security-review.md` |
| `migrate`, `schema change`, `add model/field/index` | `wf-schema-migration.md` |
| `component`, `page`, `UI`, `screen`, `frontend` | `wf-frontend-component.md` |
| `refactor`, `extract`, `restructure` | `wf-refactor.md` |
| `write tests`, `coverage`, `missing spec` | `wf-write-tests.md` |
| `update memory`, `sync state`, `mark complete` | `wf-memory-update.md` |
| `architecture`, `trade-off`, `ADR`, `decision` | `wf-architecture-question.md` |
| Task trải schema + backend + frontend là 1 deliverable | `wf-composite-task.md` |

## Step 3 — Risk Signals → Load thêm Skill
| Task nhắc tới... | Load thêm skill |
|---|---|
| `login`, `session`, `JWT`, `auth`, `:id`, `ownership`, `IDOR` | `.harness/skills/security/sk-idor-enforcement.md` |
| `ảnh`, `upload`, `PII`, dữ liệu người dùng nhạy cảm, `LLM/AI` | `.harness/skills/security/sk-pii-handling.md` |
| `migration`, `schema`, `Prisma model`, `enum`, `index` | `.harness/skills/schema/sk-prisma-migration.md` + `sk-schema-conventions.md` |
| `Decimal`, `tiền`, `giá trị`, `upsert`, ghi DB | `.harness/skills/backend/sk-prisma-data-rules.md` |
| `NestJS module`, `controller`, `service`, `guard` | `.harness/skills/backend/sk-nestjs-module-pattern.md` |
| `DTO`, `validation`, `request body` | `.harness/skills/backend/sk-dto-validation.md` |
| `error`, `exception`, `HTTP status`, `response` | `.harness/skills/backend/sk-api-response-rules.md` |
| `component`, `Tailwind`, `card` | `.harness/skills/frontend/sk-ui-design-system.md` |
| `useQuery`, `useMutation`, `TanStack`, `optimistic` | `.harness/skills/frontend/sk-react-query-patterns.md` |
| `i18n`, `localization` | `.harness/skills/frontend/sk-localization-rules.md` |
| `test`, `spec`, `E2E`, `Playwright` | `.harness/skills/agent-ops/sk-test-coverage-rules.md` |
| `handoff`, `task done`, `update memory` | `.harness/skills/agent-ops/sk-handoff-protocol.md` |
| _(domain: điền signal → skill riêng của dự án)_ | _(vd `.harness/skills/integration/*`)_ |

**Luôn load cho mọi implementation task:**
```
.harness/skills/security/sk-security-checklist.md
.harness/constraints/cx-hard-limits.md
```

## Step 4 — Agent Signal (đa-vendor)
| Task cần... | Agent |
|---|---|
| Code scoped, một module | Codex (ChatGPT) / Claude |
| Planning, thiết kế mơ hồ, review rộng | Gemini |
| Composite multi-surface | Gemini phân rã → Codex/Claude từng lớp |

## Step 5 — Composite Detection
≥2 trong {schema, backend, frontend} là deliverable → `wf-composite-task.md`.

## Step 6 — Risk Escalation
≥2 signal trong {auth/session, ownership mới, migration, AI/LLM, upload PII} → **High Risk**:
nêu rõ từng yêu cầu bảo mật trong prompt, dùng biến thể high-security của `wf-feature-implementation.md`.

## Quick Decision Tree
```
fix/crash → wf-bugfix-hotfix · plan → wf-phase-planning · review → wf-security-review
schema(+be/fe? → wf-composite) → wf-schema-migration · UI → wf-frontend-component
refactor → wf-refactor · test → wf-write-tests · memory → wf-memory-update
architecture → wf-architecture-question · default → wf-feature-implementation
```
