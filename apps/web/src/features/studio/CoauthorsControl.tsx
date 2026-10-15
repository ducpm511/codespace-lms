import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCRATCH_COLLAB_SEARCH_MIN, SCRATCH_MAX_COLLABORATORS } from '@lms/contracts';
import type { ScratchCollaboratorDto, ScratchProjectDetailDto } from '@lms/contracts';
import { useConfirm } from '../../components/useConfirm';
import { addCollaborator, removeCollaborator, searchCollaboratorCandidates } from './api';
import { studioKeys } from './hooks';

/** Gõ xong ngần này ms mới tìm — không bắn một request mỗi phím. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Đồng tác giả (T11.6b). Chủ dự án: tìm người trong trường để mời (tối đa SCRATCH_MAX_COLLABORATORS), gỡ.
 * Đồng tác giả: thấy danh sách, tự rời. Mời / gỡ đều lưu ngay; bị gỡ thì phiên làm chung đang mở đóng luôn.
 */
export function CoauthorsControl({ project, meId }: { project: ScratchProjectDetailDto; meId: string }): JSX.Element {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const full = project.collaborators.length >= SCRATCH_MAX_COLLABORATORS;
  const searching = project.isOwner && !full && debounced.length >= SCRATCH_COLLAB_SEARCH_MIN;
  const candidates = useQuery({
    queryKey: ['scratch-coauthor-candidates', project.id, debounced],
    queryFn: () => searchCollaboratorCandidates(project.id, debounced),
    enabled: searching,
    staleTime: 30_000,
  });

  const setCollaborators = (list: ScratchCollaboratorDto[]) => {
    qc.setQueryData<ScratchProjectDetailDto>(studioKeys.project(project.id), (d) =>
      d ? { ...d, collaborators: list } : d,
    );
    void qc.invalidateQueries({ queryKey: ['scratch-coauthor-candidates', project.id] });
  };
  const add = useMutation({
    mutationFn: (user: { userId: string; fullName: string }) => addCollaborator(project.id, user.userId),
    onSuccess: (list, user) => {
      setCollaborators(list);
      setQuery('');
      setNotice(t('studio.coauthors.invited', { name: user.fullName }));
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeCollaborator(project.id, userId),
    onSuccess: (list, userId) => {
      if (userId === meId) {
        void qc.invalidateQueries({ queryKey: studioKeys.mine });
        navigate('/studio');
        return;
      }
      setCollaborators(list);
    },
  });
  const busy = add.isPending || remove.isPending;
  const error = add.error ?? remove.error;

  const onRemove = async (c: ScratchCollaboratorDto) => {
    const leaving = c.userId === meId;
    const ok = await confirm(
      leaving
        ? {
            title: t('studio.coauthors.confirmLeaveTitle'),
            message: t('studio.coauthors.confirmLeaveBody'),
            confirmLabel: t('studio.coauthors.leave'),
          }
        : {
            title: t('studio.coauthors.confirmRemoveTitle', { name: c.fullName }),
            message: t('studio.coauthors.confirmRemoveBody', { name: c.fullName }),
            confirmLabel: t('studio.coauthors.remove'),
          },
    );
    if (ok) remove.mutate(c.userId);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted m-0 text-xs">{t('studio.coauthors.hint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li className="flex items-center gap-2 text-sm">
          <i className="ph ph-crown-simple" style={{ color: 'var(--cx-amber)' }} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{project.ownerName}</span>
          <span className="tag tag-outline">{t('studio.coauthors.owner')}</span>
        </li>
        {project.collaborators.map((c) => (
          <li key={c.userId} className="flex items-center gap-2 text-sm">
            <i className="ph ph-user" style={{ color: 'var(--cx-teal)' }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{c.fullName}</span>
            {(project.isOwner || c.userId === meId) && (
              <button
                type="button"
                className="btn btn-ghost cx-press"
                style={{ borderRadius: 999, padding: '4px 12px' }}
                disabled={busy}
                onClick={() => void onRemove(c)}
              >
                {c.userId === meId ? t('studio.coauthors.leave') : t('studio.coauthors.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {project.isOwner && project.collaborators.length === 0 && (
        <p className="text-muted m-0 text-sm">{t('studio.coauthors.empty')}</p>
      )}

      {project.isOwner &&
        (full ? (
          <p className="text-muted m-0 text-sm">{t('studio.coauthors.full', { max: SCRATCH_MAX_COLLABORATORS })}</p>
        ) : (
          <div className="field m-0">
            <label htmlFor={`coauthor-search-${project.id}`}>{t('studio.coauthors.searchLabel')}</label>
            <input
              id={`coauthor-search-${project.id}`}
              className="input"
              type="search"
              autoComplete="off"
              maxLength={100}
              placeholder={t('studio.coauthors.searchPlaceholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setNotice(null);
              }}
            />
            {searching && candidates.data && (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {candidates.data.length === 0 && (
                  <li className="text-muted text-sm">{t('studio.coauthors.noResults')}</li>
                )}
                {candidates.data.map((u) => (
                  <li key={u.userId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {u.fullName} <span className="text-muted text-xs">{u.emailHint}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary cx-press"
                      style={{ borderRadius: 999, padding: '4px 12px' }}
                      disabled={busy}
                      onClick={() => add.mutate({ userId: u.userId, fullName: u.fullName })}
                    >
                      <i className="ph ph-user-plus" aria-hidden /> {t('studio.coauthors.invite')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      {notice && (
        <p className="m-0 text-sm" role="status" style={{ color: 'var(--cx-teal)' }}>
          {notice}
        </p>
      )}
      {error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {error.message}
        </p>
      )}
    </div>
  );
}
