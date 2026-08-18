import React, { useState } from 'react';
import { useLessonComments } from './useLessonComments';

interface LessonCommentsSectionProps {
  lessonId: string;
  classId: string;
}

export const LessonCommentsSection: React.FC<LessonCommentsSectionProps> = ({
  lessonId,
  classId,
}) => {
  const { comments, isLoading, createComment, isSubmitting } = useLessonComments(
    lessonId,
    classId,
  );
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setError(null);
      await createComment({ classId, content: content.trim() });
      setContent('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi bình luận.';
      setError(msg);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-800">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>💬</span> Thảo luận bài học ({comments.length})
      </h3>

      {/* Form nộp bình luận */}
      <form onSubmit={handleSubmit} className="mb-6">
        {error && (
          <div className="p-3 mb-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Đặt câu hỏi hoặc chia sẻ ý kiến của bạn về bài học..."
            rows={2}
            className="w-full px-3 py-2 text-sm text-slate-200 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 transition-colors shadow"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi bình luận'}
          </button>
        </div>
      </form>

      {/* Danh sách bình luận */}
      {isLoading ? (
        <div className="text-center py-6 text-xs text-slate-500">Đang tải thảo luận...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60">
          Chưa có thảo luận nào cho bài này. Hãy là người đầu tiên đặt câu hỏi!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex gap-3 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                {c.userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">{c.userName}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {new Date(c.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
