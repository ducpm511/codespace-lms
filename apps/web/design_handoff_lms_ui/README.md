# Handoff: CodeSpace LMS — Playful redesign (Nocturne design system)

## Overview
A **playful, gamified visual redesign** of the CodeSpace LMS web app (`apps/web`: React + Vite + Tailwind + TanStack Query + react-i18next). It re-skins every existing screen — login, student **Học tập** (Learn), teacher **Giảng dạy** (Teach), and **Quản trị** (Admin) — on top of the **Nocturne** dark design system plus CodeSpace brand assets (logo + the "Cody" mascot).

Target users: teachers and students aged 7–16. This iteration deliberately pushes **more playful** than the first pass: a gamified Learn dashboard (greeting hero with streak / XP / badges / level ring), a category color system, chunky rounded "sticker" cards, a friendlier display typeface (Baloo 2) for headings, and light micro-motion (mascot float/bob, decorative blobs, shooting stars, pop-in celebration) — all still inside Nocturne's dark, low-chroma discipline.

> **This replaces the previous handoff.** It supersedes the earlier (flatter) version of `CodeSpace-LMS-design.html` + README in this same folder. The app logic, routes, hooks, and i18n keys are unchanged — this is a **styling + layout + information-architecture** refresh, not a rebuild.

## About the Design Files
`CodeSpace-LMS-design.html` is a **design reference** — a single self-contained, clickable HTML prototype (inline state, no build step) showing intended look, layout, copy, and interaction flow. **It is not production code to port in.** Recreate the design inside `apps/web`'s existing React + Tailwind environment using its established patterns (the `src/features/*/hooks.ts` TanStack Query hooks, `react-i18next`, the existing route/page/component structure) — do **not** copy the prototype's inline-style markup verbatim.

Open the file in a browser and click through: login → app shell → switch **Học tập / Giảng dạy / Quản trị** → within Learn, expand/collapse chapters, filter Bài tập, open a lesson (see its assigned exercises + discussion), take a quiz, open a coding problem → within Teach, switch Lớp học / Bài tập & chấm điểm / Trắc nghiệm, reassign a course, toggle lesson gates, publish a quiz, open the grading dialog.

## Fidelity
**High-fidelity.** All colors, spacing, radii, and base type come from Nocturne's token sheet (`nocturne-tokens.css`, bundled) — use the exact `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `--font-*` values (key ones reproduced under **Design Tokens**), not approximations from screenshots. Nocturne's component classes (`.btn`, `.card`, `.tag`, `.field`/`.input`, `.radio`, `.seg`, `.table`, `.dialog`, `.nav`) are defined in that sheet — port them as a Tailwind `@layer components` layer or CSS module, keeping the exact values. The **playful layer on top** (see below) is a small set of custom tokens + utilities, not part of Nocturne — reproduce those exactly too.

## The playful layer (new — additive to Nocturne)
Defined in the prototype's `<style>` block; treat these as project-local additions on top of the Nocturne tokens.

- **Category color system** — four accent tints used to color-code content types, all layered as `color-mix(... 20%, transparent)` fills behind Phosphor icons and as `... 30%, transparent` inset top-borders on cards:
  - `--cx-purple: var(--color-accent)` (#9184d9) — lessons / "continue" / primary
  - `--cx-amber: #f0a94e` — streak, assignments, "Bài tập" hub
  - `--cx-teal: #55cdb3` — coding, progress, success
  - `--cx-coral: #ef7d92` — quizzes, celebration
  - `--cx-blue: #6db2f0` — reading lessons, discussion
  These are **decorative tints only**, always used at low opacity over the dark ground (never as saturated floods) — consistent with Nocturne's "accent as line/glow" rule. They are not Nocturne tokens; keep them in a small `:root` block.
- **`--cx-radius: 22px`** — the "sticker" card radius for hero + primary tiles (Nocturne's `--radius-lg` 14px still applies to smaller/inner cards; secondary rows use 16–18px).
- **Display font**: **Baloo 2** (Google Fonts, weights 500/600/700), class `.cx-display`, used for headings, card titles, stat numbers. Body text stays **Inter** (`--font-body`). Load Baloo 2 via the app's existing font pipeline.
- **Buttons are pill-shaped here**: `.btn.btn-primary` and chips get `border-radius: 999px` (a friendlier override of Nocturne's 8px). Keep Nocturne's *outlined* primary treatment (accent border on transparent), just rounded fully.
- **Utilities / motion** (all subtle, `ease`, 3–5s loops; honor `prefers-reduced-motion` by disabling the loops):
  - `.cx-tile:hover` / `.cx-lift:hover` — `translateY(-2/-3px)` + shadow, 0.16s.
  - `.cx-press:active` — `scale(0.97)` tap feedback on buttons.
  - `.cx-float` (5s), `.cx-bob` (3.2s) — mascot idle motion.
  - `@keyframes cx-pop` — 0.3s pop-in for celebration / result cards.
  - `.cx-shooting-star` (`@keyframes cx-shoot`, 4.5s, staggered) — login banner streaks.
  - `.cx-blob` — 48px-blur radial color spots at ~0.3–0.5 opacity behind heroes.
  - `.cx-dots` — 20px radial-dot texture on the greeting hero.
- **Toggle switch** (`.cx-toggle`) — custom 34×20px pill track (accent when on, `--color-neutral-700` off) with a 16px thumb; used for lesson gates and quiz publish.

## Screens / Views

### 1. Login (`src/pages/LoginPage.tsx`)
- Full-viewport **2-column split**, no outer padding. Left `flex: 1 1 48%`, right `flex: 1 1 52%`, both `min-height: 100vh`.
- **Left banner**: `linear-gradient(155deg, var(--color-section), var(--color-section-glow))`, `overflow:hidden`. Decoration (absolute, `pointer-events:none`): two `--color-section-ghost` radial glows (~0.55 opacity); a 520px `logo-vertical-white.png` watermark at ~0.06 bottom-right, partly off-canvas; **3 `.cx-shooting-star` streaks** (delays 0/1.8/3.2s); 5 static twinkle dots (3–6px, `--color-neutral-100`, 0.3–0.5); `logo-horizontal-white.png` (30px) pinned top-left. Centered content above it: **`mascot-laptop.png` at 280px with `.cx-float`** and a big drop-shadow, then h2 `.cx-display` "Học lập trình, vui như chơi" + one muted line (max-width 380px, centered).
- **Right form**: centered, max-width 360px, sitting on two faint `.cx-blob`s (purple + teal). No card wrapper. h1 `.cx-display` "Đăng nhập" + muted tagline ("Chào mừng trở lại! Cùng học tiếp nào 🚀"), `.field`/`.input` Email + Mật khẩu, `.btn.btn-primary.btn-block.cx-press` with `ph-rocket-launch` "Đăng nhập", muted footer "Quên mật khẩu? Liên hệ giáo viên".

### 2. App shell (`src/components/AppLayout.tsx`)
- `.nav` header, `background: color-mix(in srgb, var(--color-surface) 82%, transparent)` + `backdrop-filter: blur(10px)`, `1px` divider bottom edge, `position: sticky; top:0`. Left: `logo-horizontal-white.png` (26px). Center (`margin-right:auto`): the 3 area tabs as pill `.btn.cx-press` with icons (`ph-graduation-cap` / `ph-chalkboard-teacher` / `ph-shield-check`) — **active** = `color-mix(var(--color-accent) 16%, transparent)` bg + accent text + `border-radius:999px`; **inactive** = text at 0.75 opacity. Right cluster: a **streak pill** (`--cx-amber` 16% bg / 34% border, `ph-fill ph-fire` + "5"), a round notification `btn-icon.btn-secondary`, an avatar-initials circle (32px, `linear-gradient(150deg, --cx-purple, --cx-coral)`, white "CT") + name "Cô Trang", and a pill sign-out `btn-secondary`.

### 3. Learn — dashboard / lesson list (`src/pages/LearnHome.tsx`)
Vertical stack (`gap: var(--space-8)`), max-width 1120px container.

**a) Greeting hero** (`.cx-dots` texture, `--cx-radius`, `linear-gradient(140deg, --color-section, --color-section-glow)`, with a purple `.cx-blob`):
- Left: uppercase eyebrow "Chào buổi sáng", h1 `.cx-display` 38px "Chào Bảo Anh! 👋", one motivational line, then **3 stat chips** (`#fff` 8% bg, 14% border, radius 16px): 🔥 streak "5 ngày", ⭐ XP "1.240", 🏅 badges "8" — each an icon in a category color + `.cx-display` number + muted label.
- Right: a **level ring** — 132px `conic-gradient(--cx-teal 0→0.78turn, #fff-12% rest)` with a 104px `--color-section` inner disc showing `.cx-display` "4" + "Cấp độ"; **`mascot-love.png` (88px, `.cx-bob`)** peeking bottom-right of the ring (the ring wrapper needs right margin so the mascot doesn't clip — see gotchas).

**b) Class picker** — a `.seg` segmented control ("Scratch Nhí K1" / "Python Nhập Môn K3"), replacing the old plain `<select>`.

**c) Celebration banner** (conditional, after completing a lesson) — `.cx-pop` in, `linear-gradient(120deg, color-mix(--cx-teal 22%, surface), surface)` + teal border, `mascot-hearts.png` (64px, `.cx-bob`) + "+40 XP" copy + dismiss (`ph-x`) button.

**d) "Học tiếp nào" (continue) card** — one prominent `.cx-lift` card: 64px rounded gradient icon tile (`ph-fill ph-cursor-click`), then a column with an uppercase kicker + `.cx-display` title, and a **progress row** = full-width 8px track (`linear-gradient(90deg,--cx-teal,--cx-purple)` fill at 60%) + a "60%" label, then a pill `btn-primary` "Tiếp tục" vertically centered. (Layout note: title/kicker and the progress row are stacked with `gap:10px` inside the flex column so nothing collides — this was tuned in review.)

**e) "Bài học" (lessons) — grouped by chapter with collapse + "see more"** *(new IA)*:
- Section header (`ph-book-open` in a `--cx-blue` tile + `.cx-display` "Bài học").
- Lessons are grouped into **chapters** (`Chương 1 · Làm quen`, `Chương 2 · Chuyển động`, `Chương 3 · …`). Each chapter is a **collapsible group**: the chapter header is a full-width button — a caret (`ph-caret-down` open / `ph-caret-right` collapsed) + uppercase chapter title + a `tag-neutral` progress pill ("2/3 bài") + a fading rule — clicking it toggles the whole group open/closed.
- Open chapters render a **responsive card grid** (`repeat(auto-fill, minmax(250px, 1fr))`) of lesson `.cx-tile` cards: a 46px category-colored rounded icon tile (icon + color vary by lesson `type`), a status `.tag` (`tag-accent` hoàn thành / `tag-outline` đang học / `tag-neutral` chưa bắt đầu), title `.card-title.cx-display` (wraps), "{type} · {minutes} phút" meta, and a `.btn.btn-block` action.
- If a chapter has more than **4** lessons, a `btn-ghost` **"Xem thêm N bài" / "Thu gọn"** toggles the overflow within that chapter.
- Two independent per-chapter states: `collapsedChapters` (whole group hidden) and `expandedChapters` (show-all vs first-4).

**f) "Bài tập" (exercises hub) — unified quizzes + coding** *(new IA; was two separate sections)*:
- One section headed by a `--cx-amber` `ph-target` tile + `.cx-display` "Bài tập", with a right-aligned `.seg` **filter**: "Tất cả" / "Trắc nghiệm" / "Lập trình".
- Cards in a `repeat(auto-fill, minmax(340px, 1fr))` grid. Each card (padding `--space-6`, gap `--space-5`, category inset border): a 44px category icon tile (coral `ph-check-square-offset` for quiz, teal `ph-code` for coding); a content column (`gap:10px`) with a row of two tags (`tag-outline` **kind** label + status tag), the `.cx-display` title, then **two context meta lines** each with an icon — `ph-book-bookmark` "{Chương} · Bài: {lesson}" (which lesson/chapter this exercise belongs to) and `ph-list-checks` "{N câu · M điểm}" or "{difficulty · M điểm}"; and a round arrow `btn-icon.btn-secondary` open button, vertically centered.

### 4. Learn — lesson detail (opened from a lesson card; mirror existing `LearnCoding.tsx` open/close pattern, not a new route)
Centered column, max-width 760px.
- Back `btn-ghost.cx-press` → uppercase breadcrumb → h1 `.cx-display` title + `tag-outline` type + "{minutes} phút" meta.
- Type-specific media: **Video** → 16:9 dark panel (`#0b0d15` frame, `--color-neutral-900`→`--color-section` poster gradient) with a circular play button + a mini scrubber footer. **Tương tác** → a `--cx-teal`-tinted `.card` with `ph-cursor-click`, a prompt line, and instructions. **Bài đọc / Bài tập** → no media block.
- **"Nội dung bài học"** `.card` with the body text.
- **"Bài tập của bài học này"** *(new)* — a `--cx-amber` `ph-target` header + a stack of exercise rows filtered to this lesson only (`lessonId` link): kind tag + status tag + title + meta + a pill `btn-secondary` "Làm bài →". Only renders if this lesson has assigned exercises.
- Action bar (`border-top`, `padding-top`): `btn-secondary` "Bài trước" / `btn-primary` "Đánh dấu hoàn thành" (`ph-check-circle`) — completing returns to the list and shows the celebration banner (wire to `useUpdateProgress().onSuccess`).
- **"Thảo luận"** `.card`: existing comment (avatar-initials chip + name + message bubble on `--color-neutral-900`), then an `.input` + icon `btn-primary` (paper-plane) to post.

### 5. Learn — quiz attempt + result (`src/pages/learn/LearnQuiz.tsx`)
Centered column, max-width 640px.
- Back button → h1 `.cx-display` quiz title + "{N} câu hỏi · Điểm tối đa {M}" meta.
- **Taking**: one `.card` per question (`.cx-display` "{n}. {text}") with `.radio` options (native radios + `.dot`), then a `btn-primary.btn-block` "Nộp bài".
- **Result** (after submit): a `.cx-pop` teal result card — `mascot-hearts.png` (58px, `.cx-bob`) + "Đúng {correct}/{total} câu — {score} điểm". Options become disabled and annotated: correct answer gets `ph-check-circle` in `--color-accent-300`; the user's wrong pick gets `ph-x-circle` in `--color-neutral-500`. Score = `round(correct/total * maxScore)`.
- Hooks: `useQuizAttempt(quizId, classId)` to load, `useSubmitQuizAttempt(quizId)` to submit.

### 6. Learn — coding workspace (`src/pages/learn/LearnCoding.tsx`)
Back button, then a 2-col grid (`1fr 1fr`, gap `--space-6`):
- **Left**: problem title (h2 `.cx-display`) + statement (`white-space:pre-wrap`), a "Test mẫu" `.card` of stdin/expected rows, then a **state card**: idle → waiting hint (`mascot-huh.png` 52px, `.cx-bob`, "Bấm Chạy thử…"); passed → `.cx-pop` teal result card (`mascot-hearts.png` 56px) with pass count + score.
- **Right**: faux editor chrome (3 category-colored dot "traffic lights" [coral/amber/teal], `solution.py` label, `#0f111a` bg, monospace `<pre>` with a few colored tokens) — **placeholder only; keep the real Monaco editor**, just re-skin the chrome/border. Then pill `btn-secondary` "Chạy thử" (`ph-play`) + `btn-primary` "Nộp bài chấm điểm", and a muted disclaimer.
- Hooks: `useCodingProblem`, `useCodingAttempt`, `useSubmitCoding`, `useSampleRunner` (Pyodide worker — already wired).

### 7. Teach — shell + tabs (`src/pages/TeachHome.tsx`)
h1 `.cx-display` "Khu vực giảng dạy" + a right-aligned `.seg`: **Lớp học** / **Bài tập & chấm điểm** / **Trắc nghiệm**.

#### 7a. Lớp học (`src/pages/teach/TeachClasses.tsx`, `TeachCourses.tsx`)
Grid `320px 1fr`:
- Left: pill `btn-secondary.btn-block` "Tạo lớp mới" (`useCreateClass`), then class `.cx-lift` card buttons — a category-colored `ph-users-three` tile + name + "{code} · N học viên"; selected card = `--color-accent-900` bg + inset accent-700 ring + accent-100 title.
- Right: header `.card` (name h2 + code + `tag-outline` "Đang diễn ra"); a 2-col grid of:
  - **"Khóa học của lớp"** — now a **course `<select>` dropdown** (`.input`) to **reassign the class's course** (wire to `useAssignCourse(classId)`), with a `ph-arrows-clockwise` helper line. *(new — was a static chip.)*
  - **"Thành viên"** — member name/role rows, plus an **"Thêm học viên vào lớp"** button (both a header icon button and a full-width ghost button; wire to `useEnrollMember(classId)`). *(new.)*
- Full-width **"Mở bài theo tiến độ"** `.card` — lesson-gate rows grouped by chapter, each a title + a `.cx-toggle` switch ("Đang mở"/"Đang khóa"); wire to `useGates(classId)` + `useSetGate(classId)`.

#### 7b. Trắc nghiệm (`src/pages/teach/TeachQuiz.tsx`)
Grid `300px 1fr`:
- Left: pill `btn-secondary.btn-block` "Tạo bài trắc nghiệm" (`useCreateQuiz`), then quiz card buttons ("{N} câu · Đã xuất bản/Bản nháp"), same selected-state treatment.
- Right: header `.card` — title + question count + a **publish `.cx-toggle`** ("Đã xuất bản"/"Bản nháp"; wire to `useUpdateQuiz(id)` with `published`). Then one `.card` per question: "{n}. {text}" + an edit `btn-icon.btn-ghost`, and its options listed with `ph-check-circle` (accent-300) marking the correct one / `ph-circle` (neutral) otherwise. A `btn-secondary` "Thêm câu hỏi" (`useUpsertQuestion(quizId)`).

#### 7c. Bài tập & chấm điểm (`src/pages/teach/TeachAssignments.tsx`)
Grid `300px 1fr`: left = assignment card buttons (title + "Hạn {date} · N bài đã nộp"); right = header `.card` (title + max score) + a `.table` of submissions (Học viên / Nộp lúc / Trạng thái tag / Điểm / "Chấm điểm" ghost button). "Chấm điểm" opens the grading dialog (§9). Hooks: `useAssignments`, `useSubmissions`, `useGradeSubmission`.

### 8. Admin — Users (`src/pages/AdminHome.tsx`)
h1 `.cx-display` "Bảng điều khiển quản trị", a toolbar (`.input` search + pill `btn-secondary` filter + pill `btn-primary` "Thêm người dùng" pushed right), then a padding-0 `.card` wrapping a `.table` (Email / Họ tên / Trạng thái tag / Vai trò).

### 9. Grading dialog (modal)
`.dialog-backdrop` + `.dialog` (`--cx-radius`): title `.cx-display` "Chấm điểm — {tên}", a number `.field` for score, a `textarea.input` for feedback, `.dialog-actions` with pill `btn-secondary` Hủy / `btn-primary` Lưu. **Must close on area navigation** (the prototype resets it in every area-switch handler) so no stale modal survives a route change.

## Interactions & Behavior
- **Area switching** (Học tập / Giảng dạy / Quản trị) — already routes (`/learn`, `/teach`, `/admin`); just restyle the nav and reset any open dialog on switch.
- **Chapter collapse/expand** and **"Xem thêm/Thu gọn"** are two independent local UI states per chapter (`collapsedChapters`, `expandedChapters`), keyed by chapter title.
- **Bài tập filter** — local `exerciseFilter: 'all' | 'quiz' | 'coding'`, filters the merged quiz+coding list.
- **Open lesson / quiz / coding / assignment** — replaces the list with a detail view + back affordance, matching the existing `LearnCoding.tsx` `openId` pattern (don't add new routes for lesson detail / quiz attempt).
- **Complete lesson** → return to list + celebration banner (wire to `useUpdateProgress().onSuccess`).
- **Quiz submit** → in-place result annotation + score (`useSubmitQuizAttempt`).
- **Course reassign / add member / gate toggle / quiz publish** → existing mutations (`useAssignCourse`, `useEnrollMember`, `useSetGate`, `useUpdateQuiz`), with optimistic UI on the toggles.
- **Motion**: keep it subtle and gate the looping animations behind `prefers-reduced-motion: reduce` (disable `.cx-float`/`.cx-bob`/`.cx-shoot`/blob drift; keep hover/press/pop which are short and intentful). Hover/press/focus for standard controls come from Nocturne's CSS — don't add ad-hoc states.

## State Management
No new server-state shapes — reuse `src/features/*/hooks.ts`. New **local UI** state only:
1. `learnView: 'list' | 'lesson' | 'quiz' | 'coding'` + `openLessonId` / `openQuizId` / `openProblemId` (mirror the existing `openId` pattern).
2. `collapsedChapters` / `expandedChapters` (maps keyed by chapter title).
3. `exerciseFilter` ('all' | 'quiz' | 'coding').
4. `showCelebration` (boolean, dismissible; set true on successful complete/submit).
5. Grading dialog open + target, reset on area navigation.
6. Quiz attempt: `quizAnswers` map + `quizSubmitted` (or lean on `useQuizAttempt` server state).

## Design Tokens
Full sheet: `nocturne-tokens.css` (bundled). Key values:
- Ground `--color-bg #161826`, surface `--color-surface #232532`, text `--color-text #e9e9ed`, divider = 16% text mix.
- Accent (mono) `--color-accent #9184d9` + ramp `--color-accent-100…900`: 700–900 for tinted fills/borders, 300 for accent text on dark tints, base only for lines/icons/focus.
- Section (saturated, sparing — login banner + Learn hero only): `--color-section #262a60`, `--color-section-glow #353b80`, `--color-section-ghost #4c5397`.
- Spacing (density 0.7×): `--space-1` 2.8px … `--space-8` 22.4px. Radii `--radius-sm/md/lg` = 4/8/14px. Shadows `--shadow-sm/md/lg`.
- Type: `--font-heading`/`--font-body` = Inter; headings never exceed weight 500.
- **Playful additions** (project-local, not Nocturne): `--cx-purple/amber/teal/coral/blue`, `--cx-radius: 22px`, Baloo 2 display font, pill (999px) primary buttons. See **The playful layer** above.

## Layout gotchas (learned across this design's reviews — worth flagging)
- **Ellipsis clipping**: a `.card-title`/`.card-meta`/name span with `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` inside a flex parent that isn't `flex:1 1 auto` (row) or given `width:100%; align-self:stretch` (column-flex `.card`) shrink-wraps and clips ~1 char even with free space. Always pair the ellipsis trio with `min-width:0` on the flex item and the right sizing on its container.
- **Mascot clipping**: the Learn hero's level ring has `margin-right` so the `mascot-love.png` peeking past its right edge isn't cut by the hero's `overflow:hidden`.
- **Card internal spacing**: exercise cards use `align-items:flex-start`, `padding:--space-6`, icon `margin-right`, and a `gap:10px` content column — several review passes were specifically about giving icon ↔ text ↔ meta enough breathing room. Reproduce the padding/gap, don't tighten.
- **`.seg-opt` labels** need `white-space:nowrap` so segmented options don't wrap.

## Assets
In `assets/` (also already staged at `apps/web/public/brand/` in the repo — use those paths in the app):
- `logo-horizontal.png` / `-white.png`, `logo-vertical.png` / `-white.png` — full + stacked lockups, light/dark.
- `mascot-*.png` — the "Cody" expression set. Used: `mascot-laptop` (login), `mascot-love` (Learn hero), `mascot-hearts` (celebration / quiz + coding success), `mascot-huh` (coding waiting state). `mascot-default`, `mascot-grumpy` are available for future states (e.g. grumpy for a failed submission).
Source: user-provided brand files (not from the design system).

## Files
- `CodeSpace-LMS-design.html` — the full self-contained clickable design reference (open directly in a browser). Do not port its inline markup verbatim.
- `nocturne-tokens.css` — Nocturne's token sheet + component classes.
- `assets/` — brand logo + mascot files.
