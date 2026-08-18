# ADR 002: Gamification System (XP, Streak, Level, Badges)

Date: 2026-08-17
Status: Accepted

## Context

Frontend `LearnHome` và `AppLayout` đã có giao diện Gamification (streak pill, XP, badges, level ring trong GreetingHero) nhưng đang là mock tĩnh. Phase P6 cần triển khai hệ thống Gamification THẬT từ backend, tính điểm từ các hoạt động học tập thực tế (hoàn thành bài học, nộp quiz, bài tập coding).

Yêu cầu kỹ thuật:
1. **Server-side authority**: Toàn bộ điểm XP, Level, Streak, Badge phải được tính toán và xác thực ở server, không tin bất kỳ dữ liệu nào từ client.
2. **Data Integrity & Idempotency**: Ghi nhận hoạt động phải gắn với transaction của sự kiện gốc (LessonProgress, QuizAttempt, CodingSubmission) và bảo đảm tính idempotent (không thể bị cộng trùng XP hay trao trùng huy hiệu khi gọi lại).
3. **Hiệu năng & Tối giản**: Không lưu các giá trị dẫn xuất (như Level, ringTurn) thành cột dữ liệu riêng nếu có thể tính toán tức thời từ XP tổng.

## Decision

### D1. Mô hình XP & Idempotency
- Bảng `XpEvent(id, userId, source, sourceId, amount, createdAt)` với ràng buộc `@@unique([userId, source, sourceId])`.
- Các nguồn điểm:
  - `lesson_complete`: 50 XP (khi LessonProgress chuyển sang `completed`).
  - `quiz_pass`: 100 XP (khi QuizAttempt đạt `score >= passScore`).
  - `coding_pass`: 100 XP (khi CodingSubmission đạt status `passed`).
- Tổng XP = $\sum$ `amount` của người dùng.

### D2. Mô hình Level (Hàm thuần)
- Cấp độ (Level) được suy từ tổng XP theo công thức:
  - `level = Math.floor(totalXp / 500) + 1`
  - `currentLevelXp = totalXp % 500`
  - `nextLevelXp = 500`
  - `progressPercent = (currentLevelXp / 500) * 100`
  - `ringTurn = currentLevelXp / 500` (giá trị 0.0 - 1.0 cho CSS conic-gradient)
- Không lưu Level thành cột riêng trong DB để tránh mất đồng bộ.

### D3. Mô hình Streak
- Bảng `UserStreak(id, userId @unique, currentStreak, longestStreak, lastActiveDate, updatedAt)`.
- Ngày hoạt động được chuẩn hóa theo chuẩn `YYYY-MM-DD` (UTC):
  - Nếu `lastActiveDate == today`: Giữ nguyên streak (đã ghi nhận trong ngày).
  - Nếu `lastActiveDate == yesterday`: `currentStreak += 1`, `longestStreak = max(longestStreak, currentStreak)`.
  - Nếu `lastActiveDate` trước hôm qua hoặc null: `currentStreak = 1`, `longestStreak = max(longestStreak, 1)`.
  - Cập nhật `lastActiveDate = today`.

### D4. Mô hình Badge
- Bảng `Badge(id, code @unique, name, description, icon, criteriaJson)` và bảng quan hệ `UserBadge(id, userId, badgeId, awardedAt)` với `@@unique([userId, badgeId])`.
- Hệ thống seed sẵn các huy hiệu khởi đầu:
  - `first_lesson`: "Học viên xuất sắc" - Hoàn thành bài học đầu tiên (icon `ph-medal`).
  - `first_code`: "Coder nhí" - Chấm đạt bài lập trình Python đầu tiên (icon `ph-code`).
  - `quiz_master`: "Bậc thầy Trắc nghiệm" - Vượt qua bài trắc nghiệm (icon `ph-check-square-offset`).
  - `streak_3`: "Chăm chỉ 3 ngày" - Duy trì chuỗi học 3 ngày liên tiếp (icon `ph-fire`).
  - `streak_7`: "Chiến binh 7 ngày" - Duy trì chuỗi học 7 ngày liên tiếp (icon `ph-fire`).
  - `xp_500`: "Nhà thám hiểm" - Đạt 500 XP đầu tiên (Level 2) (icon `ph-star`).
- Khi trao Badge, tạo đồng thời một `Notification` tương ứng gửi tới học viên.

## Consequences

- Frontend loại bỏ 100% mock tĩnh trong `GreetingHero` và `AppLayout`.
- Mọi hoạt động học tập lập trình và lý thuyết đều mang lại phần thưởng trực quan tức thì cho học viên.
- Toàn bộ thao tác ghi điểm XP được bọc trong cùng transaction nghiệp vụ, đảm bảo tính nhất quán dữ liệu tuyệt đối theo tiêu chuẩn `cx-hard-limits`.
