import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCRATCH_BANNED_WORD_MAX_LENGTH } from '@lms/contracts';
import type { ScratchCommentReportActionValue, ScratchModerationCommentReportItem } from '@lms/contracts';
import { useConfirm } from '../../components/useConfirm';
import { PillButton } from '../../pages/teach/teachUi';
import { addBannedWord, listBannedWords, removeBannedWord, resolveCommentReport } from './api';
import { studioKeys } from './hooks';

/** Một báo cáo bình luận trong hàng chờ GV (T11.8): bỏ qua / ẩn / xóa. */
export function CommentReportRow({ item }: { item: ScratchModerationCommentReportItem }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const resolve = useMutation({
    mutationFn: (action: ScratchCommentReportActionValue) => resolveCommentReport(item.id, action),
    onSuccess: () => void qc.invalidateQueries({ queryKey: studioKeys.queue }),
  });
  const remove = async () => {
    if (await confirm({ message: t('studio.comments.confirmDelete'), confirmLabel: t('studio.comments.delete') })) {
      resolve.mutate('delete');
    }
  };
  return (
    <div className="card flex flex-col gap-2 p-5" style={{ borderRadius: 18 }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="card-title cx-display m-0">{item.authorName}</span>
        <span className="tag tag-outline">{t(`studio.report.reason_${item.reason}`)}</span>
        {item.hidden && <span className="tag tag-outline">{t('studio.comments.hiddenTag')}</span>}
      </div>
      <blockquote
        className="m-0 text-sm"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          borderLeft: '3px solid var(--color-divider)',
          paddingLeft: 10,
        }}
      >
        {item.content}
      </blockquote>
      <span className="text-muted text-xs">
        {t('studio.mod.commentReportedBy', {
          project: item.projectTitle,
          reporter: item.reporterName,
          date: new Date(item.createdAt).toLocaleString(i18n.language),
        })}
      </span>
      {item.note && <p className="m-0 text-sm">“{item.note}”</p>}
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/studio/${item.projectId}`}
          target="_blank"
          className="btn btn-secondary cx-press"
          style={{ borderRadius: 999 }}
        >
          <i className="ph ph-arrow-square-out" aria-hidden /> {t('studio.mod.openProject')}
        </Link>
        <PillButton
          variant="secondary"
          icon="ph-check"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate('dismiss')}
        >
          {t('studio.mod.dismiss')}
        </PillButton>
        {!item.hidden && (
          <PillButton
            variant="secondary"
            icon="ph-eye-slash"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate('hide')}
          >
            {t('studio.comments.hide')}
          </PillButton>
        )}
        <PillButton icon="ph-trash" disabled={resolve.isPending} onClick={() => void remove()}>
          {t('studio.comments.delete')}
        </PillButton>
      </div>
      {resolve.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {resolve.error.message}
        </p>
      )}
    </div>
  );
}

/** Danh sách từ cấm trong bình luận — chỉ admin (scratch.moderate) sửa (người dùng chốt 2026-10-15). */
export function BannedWordsPanel(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const queryKey = ['scratch-banned-words'];
  const words = useQuery({ queryKey, queryFn: listBannedWords });
  const [draft, setDraft] = useState('');
  const set = (list: Awaited<ReturnType<typeof listBannedWords>>) => qc.setQueryData(queryKey, list);
  const add = useMutation({
    mutationFn: () => addBannedWord(draft),
    onSuccess: (list) => {
      set(list);
      setDraft('');
    },
  });
  const remove = useMutation({ mutationFn: removeBannedWord, onSuccess: set });
  const error = words.error ?? add.error ?? remove.error;

  return (
    <div className="card flex flex-col gap-3 p-5" style={{ borderRadius: 18 }}>
      <p className="text-muted m-0 text-sm">{t('studio.mod.bannedHint')}</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add.mutate();
        }}
      >
        <input
          className="input min-w-0 flex-1"
          maxLength={SCRATCH_BANNED_WORD_MAX_LENGTH}
          placeholder={t('studio.mod.bannedPlaceholder')}
          aria-label={t('studio.mod.bannedPlaceholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <PillButton type="submit" icon="ph-plus" disabled={!draft.trim() || add.isPending}>
          {t('studio.mod.bannedAdd')}
        </PillButton>
      </form>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {(words.data ?? []).map((w) => (
          <li key={w.word} className="tag tag-outline flex items-center gap-1">
            {w.word}
            <button
              type="button"
              className="cx-press"
              aria-label={t('studio.mod.bannedRemove', { word: w.word })}
              title={t('studio.mod.bannedRemove', { word: w.word })}
              disabled={remove.isPending}
              onClick={() => remove.mutate(w.word)}
              style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}
            >
              <i className="ph ph-x" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {error.message}
        </p>
      )}
    </div>
  );
}
