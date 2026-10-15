import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCRATCH_COMMENT_MAX_LENGTH } from '@lms/contracts';
import type { ScratchCommentDto, ScratchCommentsDto } from '@lms/contracts';
import { useConfirm } from '../../components/useConfirm';
import { PillButton } from '../../pages/teach/teachUi';
import { createComment, deleteComment, listComments, setCommentHidden, setCommentsOpen } from './api';
import { ReportControl } from './ReportControl';

const key = (projectId: string) => ['scratch-comments', projectId] as const;

/**
 * Bình luận trên trang dự án (T11.8 — ADR D8). Chỉ khi dự án chia sẻ lớp / trường; trang /p công khai KHÔNG có.
 * Chủ dự án: ẩn / bỏ ẩn, bật / tắt bình luận. GV: ẩn, xóa. Tác giả: tự xóa. Mọi người: báo cáo.
 */
export function CommentsSection({ projectId }: { projectId: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [draft, setDraft] = useState('');
  const comments = useQuery({ queryKey: key(projectId), queryFn: () => listComments(projectId) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key(projectId) });

  const post = useMutation({
    mutationFn: () => createComment(projectId, draft),
    onSuccess: (c) => {
      setDraft('');
      qc.setQueryData<ScratchCommentsDto>(key(projectId), (d) => (d ? { ...d, items: [c, ...d.items] } : d));
    },
  });
  const act = useMutation({
    mutationFn: async ({ c, action }: { c: ScratchCommentDto; action: 'hide' | 'unhide' | 'delete' }) => {
      if (action === 'delete') return deleteComment(c.id);
      return setCommentHidden(c.id, action === 'hide');
    },
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: (open: boolean) => setCommentsOpen(projectId, open),
    onSuccess: refresh,
  });

  const data = comments.data;
  if (!data?.available) return null;
  const length = draft.trim().length;

  const onDelete = async (c: ScratchCommentDto) => {
    if (await confirm({ message: t('studio.comments.confirmDelete'), confirmLabel: t('studio.comments.delete') })) {
      act.mutate({ c, action: 'delete' });
    }
  };

  return (
    <section className="card mx-auto flex w-full flex-col gap-3 p-5" style={{ maxWidth: 482, borderRadius: 18 }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="cx-display m-0 flex items-center gap-2 text-lg">
          <i className="ph ph-chat-circle-dots" style={{ color: 'var(--cx-teal)' }} aria-hidden />
          {t('studio.comments.title', { count: data.items.length })}
        </h2>
        {data.isOwner && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={data.open}
              disabled={toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
            {t('studio.comments.allow')}
          </label>
        )}
      </div>

      {data.canComment ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (length > 0) post.mutate();
          }}
        >
          <textarea
            className="input"
            rows={2}
            maxLength={SCRATCH_COMMENT_MAX_LENGTH}
            placeholder={t('studio.comments.placeholder')}
            aria-label={t('studio.comments.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-xs">
              {length}/{SCRATCH_COMMENT_MAX_LENGTH} · {t('studio.comments.kind')}
            </span>
            <PillButton type="submit" icon="ph-paper-plane-tilt" disabled={length === 0 || post.isPending}>
              {t('studio.comments.send')}
            </PillButton>
          </div>
          {post.error && (
            <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
              {post.error.message}
            </p>
          )}
        </form>
      ) : (
        <p className="text-muted m-0 text-sm">{t('studio.comments.closed')}</p>
      )}

      {data.items.length === 0 ? (
        <p className="text-muted m-0 text-sm">{t('studio.comments.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.items.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1"
              style={{ opacity: c.hidden ? 0.6 : 1, borderTop: '1px solid var(--color-divider)', paddingTop: 10 }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{c.authorName}</span>
                <span className="text-muted">
                  {new Date(c.createdAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                {c.hidden && <span className="tag tag-outline">{t('studio.comments.hiddenTag')}</span>}
              </div>
              <p className="m-0 text-sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {c.content}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {(data.isOwner || data.canModerate) && (
                  <button
                    type="button"
                    className="btn btn-ghost cx-press text-xs"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ c, action: c.hidden ? 'unhide' : 'hide' })}
                  >
                    <i className={`ph ${c.hidden ? 'ph-eye' : 'ph-eye-slash'}`} aria-hidden />{' '}
                    {c.hidden ? t('studio.comments.unhide') : t('studio.comments.hide')}
                  </button>
                )}
                {(c.mine || data.canModerate) && (
                  <button
                    type="button"
                    className="btn btn-ghost cx-press text-xs"
                    disabled={act.isPending}
                    onClick={() => void onDelete(c)}
                  >
                    <i className="ph ph-trash" aria-hidden /> {t('studio.comments.delete')}
                  </button>
                )}
                {!c.mine && !c.hidden && <ReportControl target={{ commentId: c.id }} compact />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {act.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {act.error.message}
        </p>
      )}
    </section>
  );
}
