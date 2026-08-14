# Handoff: CodeSpace LMS — UI redesign (Nocturne design system)

## Overview
New visual design for the CodeSpace LMS (`apps/web`, React + Vite + Tailwind + TanStack Query), applying the **Nocturne** dark design system and CodeSpace brand assets (logo + "Rex" mascot) to the existing functional screens: login, student Learn area (lessons, lesson detail, assignments, coding workspace), teacher Teach area (classes + lesson gates, assignments & grading), and admin (users).

Target users: teachers and students aged 7–16. Tone: playful but compact, per Nocturne's own direction (outlined buttons, soft 8px radii, accent used as line/glow not flood) with the mascot reserved for welcome/celebration/waiting moments — not a persistent sidebar character.

## About the Design Files
The file in this bundle (`CodeSpace-LMS-design.html`) is a **design reference** — a static/lightly-interactive HTML prototype (built as a single-file mockup with inline state, not a Next/React app) showing intended look, layout, copy, and basic interaction flow. **It is not production code to copy in.** The task is to recreate this design inside `apps/web`'s existing React + Tailwind environment, using its established patterns (TanStack Query hooks, `react-i18next`, existing route/component structure) — not to port the HTML/inline-style markup directly.

Open `CodeSpace-LMS-design.html` in a browser to click through the states (login → app shell → switch Học tập/Giảng dạy/Quản trị → open a lesson/coding problem/assignment → grading dialog).

## Fidelity
**High-fidelity.** Colors, spacing, radii, and type all come from Nocturne's token sheet (`nocturne-tokens.css`, also bundled here) — use the exact `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `--font-*` values (reproduced in Design Tokens below) rather than approximating. Component classes (`.btn`, `.card`, `.tag`, `.field`/`.input`, `.seg`, `.table`, `.dialog`, `.nav`) are also defined in that file — port them as Tailwind `@layer components` classes or a small CSS module, keeping the exact values.

## Current codebase state (what this replaces)
Today `apps/web` renders all screens with plain Tailwind utility classes on a light `slate` palette (see `src/components/AppLayout.tsx`, `src/pages/*.tsx`) — functional but with no real visual design. This handoff replaces that visual layer only; the existing data-fetching hooks (`src/features/*/hooks.ts`), routing (`src/routes/*`, `src/App.tsx`), and i18n keys (`src/i18n/vi.json`, `en.json`) should be kept and reused — this is a **styling/layout replacement**, not a rebuild of app logic.

## Screens / Views

### 1. Login (`src/pages/LoginPage.tsx`)
- **Layout**: Full-viewport 2-column split, no outer padding/centering. Left panel `flex: 1 1 48%`, right panel `flex: 1 1 52%`, both `min-height: 100vh`.
- **Left banner panel**: background `linear-gradient(155deg, var(--color-section), var(--color-section-glow))`, `overflow: hidden`, `position: relative`. Layered decoration (all `position: absolute`, low opacity, `pointer-events: none` except content):
  - Two radial-gradient glows using `var(--color-section-ghost)` at ~88%/8% and 6%/96%, opacity 0.55.
  - A large (520px) `logo-vertical-white.png` watermark, opacity 0.06, bottom-right, partially off-canvas.
  - 3 looping "shooting star" streaks (90×2px linear-gradient bars, `rotate(35deg)`, `@keyframes cx-shoot` translating -220px/+150px with fade in/out over 4.5s, staggered delays 0s/1.8s/3.2s) at different top/left positions.
  - 5 small static "twinkle" dots (3–6px circles, `var(--color-neutral-100)` at 0.3–0.5 opacity) scattered around.
  - `logo-horizontal-white.png` (30px tall) pinned top-left, `var(--space-8)` inset.
  - Centered content (z-index above decoration): mascot `mascot-laptop.png` at 260px wide with `drop-shadow(0 20px 40px rgba(0,0,0,0.35))`, then heading "Học lập trình, vui như chơi" (h2) and one line of muted body copy, max-width 360px, centered text.
- **Right form panel**: centered flex, form max-width 360px. Heading "Đăng nhập" (26px) + muted tagline, then `.field`/`.input` for Email and Mật khẩu, `.btn.btn-primary.btn-block` submit with a rocket icon, and a muted footer line "Quên mật khẩu? Liên hệ giáo viên" (link in accent).
- No card/shadow wrapper on the form — it sits directly on the page background.

### 2. Learn — lesson list (`src/pages/LearnHome.tsx`)
- Header row: eyebrow "Xin chào, {tên}" in `var(--color-accent-300)`, uppercase, 12px, letter-spacing 0.08em, then h1 "Khu vực học tập". Right-aligned: a `.seg` (segmented control) class picker replacing the current plain `<select>`.
- Optional celebration banner (shown after completing a lesson): `.card`-like row, `background: var(--color-accent-900)`, `border: 1px solid var(--color-accent-700)`, `radius-lg`, mascot `mascot-hearts.png` (64px) + congratulatory copy + dismiss (`ph-x`) icon button. Animates in with a small pop keyframe (`translateY(6px) scale(0.98)` → identity, 0.25s).
- **Bài học** (lessons) section: `h3` with `ph-book-open` icon, then a vertical stack of `.card` rows (flex-row, space-between, wrap): 40×40 icon tile (`var(--color-neutral-800)` bg, `var(--color-accent-300)` icon) + title/meta (title nowrap+ellipsis via `.card-title`/`.card-meta`, which must be `width:100%; align-self:stretch` in their column-flex `.card` — see Design Tokens note on that pattern) + status tag (`tag-accent`=hoàn thành, `tag-outline`=đang học, `tag-neutral`=chưa bắt đầu) + action button (`btn-primary` continue / `btn-secondary` start or review).
- **Bài tập** (assignments) section: single `.card` per assignment, title + due-date/submission-type meta + status tag.
- **Bài lập trình** (coding) section: same row pattern as lessons, ends in `btn-primary` "Mở bài" with `ph-arrow-right`, opening the coding workspace.

### 3. Learn — lesson detail (new sub-view, opened from a lesson row)
- Centered column, `max-width: 760px; margin: 0 auto`.
- Back button (`btn-ghost`, `ph-arrow-left`) → breadcrumb-style muted eyebrow ("{Class} · {Chapter}") → h1 title + `tag-outline` type tag on one row → muted "{minutes} phút" meta.
- Content varies by lesson type:
  - **Video**: 16:9 dark panel (`#0b0d15` bg for the frame, gradient `var(--color-neutral-900)`→`var(--color-section)` for the "poster" area) with a circular play button, plus a mini scrubber-bar footer row with a speaker icon and `0:00 / {minutes}:24`.
  - **Tương tác (interactive)**: centered `.card` on `var(--color-neutral-900)`, cursor-click icon, bold prompt line, muted instructions paragraph.
  - **Bài đọc / Bài tập** fall through to just the body card below (no special media block).
- Below media: a `.card` "Nội dung bài học" with the lesson body text.
- Action bar (`border-top`, `padding-top: var(--space-4)`, space-between): `btn-secondary` "Bài trước" / `btn-primary` "Đánh dấu hoàn thành" (`ph-check-circle`) — completing returns to the list and re-triggers the celebration banner.
- **Thảo luận (discussion)** card below the action bar: existing comment(s) as avatar-initial-chip + name + message in a `var(--color-neutral-900)` bubble, then an `.input` + icon-only `btn-primary` (paper-plane) row to post a new message.

### 4. Learn — coding workspace (`src/pages/learn/LearnCoding.tsx`)
- Back button, then a 2-column grid (`1fr 1fr`, `gap: var(--space-6)`):
  - **Left**: problem title (h2) + statement paragraph (muted, `white-space: pre-wrap`), a `.card` "Test mẫu" listing sample stdin/expected pairs, then a state card that's *either* a waiting hint (mascot `mascot-huh.png` at 52px + "Chưa có kết quả…" on `var(--color-neutral-900)`) *or*, after a passing submit, a result card (mascot `mascot-hearts.png` at 56px, `var(--color-accent-900)` bg + `var(--color-accent-700)` border) with the pass count and score.
  - **Right**: a faux code-editor chrome (3 dot "traffic lights", filename label, `#0f111a` background, monospace `<pre>` with a couple of manually-colored tokens — this is a placeholder; the real implementation keeps the existing Monaco editor, just re-skin its chrome/border to match), then `btn-secondary` "Chạy thử" (`ph-play`) + `btn-primary` "Nộp bài chấm điểm" (`ph-paper-plane-tilt`), and a muted disclaimer line.

### 5. Teach — Lớp học (classes) (`src/pages/teach/TeachClasses.tsx`)
- h1 "Khu vực giảng dạy" + a `.seg` toggle for "Lớp học" / "Bài tập & chấm điểm" (both `.seg-opt` need `white-space: nowrap` — see Design Tokens gotchas).
- **Grid `320px 1fr`**:
  - Left: `btn-secondary.btn-block` "Tạo lớp mới", then a stack of class `.card` buttons (name + `code · N học viên` meta); the selected card gets `background: var(--color-accent-900)` + `box-shadow: inset 0 0 0 1px var(--color-accent-700)` and its title switches to `var(--color-accent-100)` for contrast.
  - Right: selected-class header `.card` (name h2 + code meta + `tag-outline` "Đang diễn ra" badge), a 2-col grid of "Khóa học của lớp" (assigned course name on a `var(--color-neutral-900)` chip) and "Thành viên" (name/role rows), then a full-width "Mở bài theo tiến độ" `.card` with lesson-gate rows grouped by chapter — each row is a title + a small custom toggle switch (34×20px pill track, accent when on / `var(--color-neutral-700)` off, 16px thumb sliding left/right).

### 6. Teach — Bài tập & chấm điểm (assignments/grading) (`src/pages/teach/TeachAssignments.tsx`, new)
- Grid `300px 1fr`: left is a list of assignment `.card` buttons (title + due date/submission count meta, same selected-state treatment as classes); right is the selected assignment's header `.card` (title + max score) followed by a `.table` of submissions (Học viên / Nộp lúc / Trạng thái tag / Điểm / "Chấm điểm" ghost-button).
- Clicking "Chấm điểm" opens a **`.dialog-backdrop` + `.dialog`** modal: title "Chấm điểm — {tên}", a number `.field` for score and a `textarea.input` for feedback, `dialog-actions` with `btn-secondary` Hủy / `btn-primary` Lưu.

### 7. Admin — Users (`src/pages/AdminHome.tsx`)
- h1 "Bảng điều khiển quản trị", a toolbar row (`.input` search, `btn-secondary` filter, `btn-primary` "Thêm người dùng" pushed right via `margin-left: auto`), then a `.card` (padding 0) wrapping a `.table` of Email / Họ tên / Trạng thái (tag) / Vai trò.

## App shell (`src/components/AppLayout.tsx`)
- `.nav` header on `var(--color-surface)` with a `1px solid var(--color-divider)` bottom edge: `logo-horizontal-white.png` (26px), then the 3 area links as `.btn`-styled buttons (active state: `background: color-mix(in srgb, var(--color-accent) 16%, transparent); color: var(--color-accent)`; inactive: default text at 0.75 opacity) — replace the current bold/pill-and-slate NavLink treatment. Right side: notification `btn-icon.btn-secondary`, an avatar-initials circle (30px, `var(--color-accent-800)` bg / `var(--color-accent-100)` text) + name, then a sign-out `btn-secondary` icon button.

## Interactions & Behavior
- Area switching (Học tập / Giảng dạy / Quản trị) is a simple client-side view swap in the prototype; in the real app this is already routing (`/learn`, `/teach`, `/admin`) — keep the routes, just restyle the nav.
- Opening a lesson, a coding problem, or an assignment replaces the list view with a detail view and shows a "back" affordance — this matches the **existing** `LearnCoding.tsx` open/close pattern (`openId` state); apply the same pattern for the new lesson-detail view instead of introducing a new route.
- Completing a lesson (prototype: clicking "Đánh dấu hoàn thành") returns to the list and re-shows the celebration banner — wire this to the real `useUpdateProgress` mutation's `onSuccess`.
- The grading dialog must close when the user navigates to a different area (fixed in the prototype: `goLearn`/`goTeach`/`goAdmin` all reset `gradingOpen`) — replicate this so a stale modal never persists across route changes.
- Hover/press/focus states are inherited from Nocturne's own CSS (`.btn`, `.input`, `.seg-opt`, table row hover) — don't add ad-hoc hover styles.

## State Management
No new state shapes beyond what's already in `src/features/*/hooks.ts`. Two additions:
1. A `learnView: 'list' | 'lesson' | 'coding'` (or a route) plus `openLessonId` for the new lesson-detail view, mirroring the existing `openId` pattern in `LearnCoding.tsx`.
2. A `showCelebration` boolean (local UI state, not server state) that flips true on a successful `useUpdateProgress`/submit mutation and is dismissible.

## Design Tokens
Full token sheet is `nocturne-tokens.css` (bundled) — do not hand-copy hex values from screenshots. Key ones used throughout:
- Ground: `--color-bg #161826`, surfaces `--color-surface #232532`, text `--color-text #e9e9ed`, divider `--color-divider` (16% mix of text).
- Accent (mono scheme): `--color-accent #9184d9` with ramp `--color-accent-100…900`; use 700–900 for tinted fills/borders, 300 for accent text on dark tints, the base only for lines/icons/focus rings.
- Section (saturated, sparing use — login banner, deck dividers only): `--color-section #262a60`, `--color-section-glow #353b80`, `--color-section-ghost #4c5397`.
- Spacing (already density-scaled): `--space-1` 2.8px … `--space-8` 22.4px. Radii: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 14px. Shadows: `--shadow-sm/md/lg`.
- Type: `--font-heading`/`--font-body` = Inter; headings never exceed weight 500.
- One brand-specific exception: the login banner's orbit/rocket accent color `#f4793c` (CodeSpace brand orange, matched from the logo asset) is used only as a one-off decorative echo of the logo mark — not a token, don't reuse it elsewhere in the UI.

**Layout gotcha worth flagging to whoever implements this**: several rounds of this design's review caught the same bug — a `.card-title`/`.card-meta`/name `<span>` given `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` inside a flex-row parent that itself isn't given `flex: 1 1 auto` (or inside a column-flex `.card` without `align-self: stretch; width: 100%`) will shrink-wrap to its own content and clip 1 character even with plenty of free space. Only add the ellipsis trio to elements that can actually overflow, and always pair it with `min-width: 0` on the flex item plus `flex: 1 1 auto` (row) or `width: 100%` (column) on its immediate container.

## Assets
All in `assets/` (also already in the app's `apps/web/public` or wherever the team's asset pipeline expects logos — place them there):
- `logo-horizontal.png` / `logo-horizontal-white.png` — full lockup, light/dark backgrounds.
- `logo-vertical.png` / `logo-vertical-white.png` — stacked mark, light/dark backgrounds.
- `mascot-default.png`, `mascot-love.png`, `mascot-huh.png`, `mascot-hearts.png`, `mascot-laptop.png`, `mascot-grumpy.png` — "Rex" mascot expression set. Used so far: `mascot-laptop` (login welcome), `mascot-hearts` (celebration / correct-answer states), `mascot-huh` (waiting-for-first-run state in the coding workspace). `mascot-default`, `mascot-love`, `mascot-grumpy` are provided for future states (e.g. `mascot-grumpy` for a failed submission, `mascot-default`/`mascot-love` for other empty states) — not yet placed in a screen.
Source: user-provided brand files (not from the design system).

## Files
- `CodeSpace-LMS-design.html` — the full clickable design reference (open directly in a browser; uses inline React-like templating, not meant to run inside the actual app).
- `nocturne-tokens.css` — the Nocturne design system's token sheet + component classes (`.btn`, `.card`, `.tag`, `.field`/`.input`, `.seg`, `.table`, `.dialog`, `.nav`, etc.) referenced throughout this doc.
- `assets/` — brand logo and mascot files.
