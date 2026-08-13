# wf-architecture-question

<!-- WORKFLOW: Architecture Question (analysis-only) -->
<!-- AGENTS: Gemini (ưu tiên) / any -->
<!-- MAX: 120 lines. -->

Cho câu hỏi thiết kế / trade-off / ADR. **Output là phân tích — KHÔNG đổi code.**

## Steps
1. Đọc `docs/DESIGN.md` + phần liên quan `docs/DESIGN.md` + ADR liên quan.
2. Trình bày: bối cảnh → các phương án → trade-off → **khuyến nghị rõ** (không chỉ liệt kê).
3. Kiểm tính nhất quán với INVARIANTS (đề xuất không được phá luật cốt lõi).
4. Nếu chốt được quyết định kiến trúc → hướng dẫn ghi ADR mới (qua `wf-memory-update.md`).

## Never
- Implement code.
- Đưa khuyến nghị mâu thuẫn INVARIANTS mà không nêu rõ đánh đổi.
