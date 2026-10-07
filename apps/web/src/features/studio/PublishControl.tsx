import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCRATCH_NICKNAME_PATTERN } from '@lms/contracts';
import type { ScratchProjectDetailDto } from '@lms/contracts';
import { useConfirm } from '../../components/useConfirm';
import { PillButton } from '../../pages/teach/teachUi';
import { useMyNickname, usePublication } from './hooks';

/**
 * Công khai (ADR D4′): chủ dự án XIN, giáo viên DUYỆT. Trang công khai chỉ hiện biệt danh — không họ tên,
 * lớp, trường. Bản công khai là bản đã duyệt; sửa tiếp không đổi nó tới khi xin + được duyệt lại.
 */
export function PublishControl({ project }: { project: ScratchProjectDetailDto }): JSX.Element {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const nickname = useMyNickname();
  const { request, withdraw } = usePublication(project.id);
  const pub = project.publication;
  const current = nickname.data?.pending ?? nickname.data?.approved ?? '';
  const [nick, setNick] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const value = nick ?? current;
  const nickValid = SCRATCH_NICKNAME_PATTERN.test(value.trim());
  const link = pub?.slug ? `${window.location.origin}/p/${pub.slug}` : null;
  const error = request.error ?? withdraw.error;

  const submit = () => request.mutate(value.trim() !== (nickname.data?.approved ?? '') ? value.trim() : undefined);
  const takeDown = async () => {
    if (await confirm({ message: t('studio.publish.confirmWithdraw'), confirmLabel: t('studio.publish.withdraw') })) {
      withdraw.mutate();
    }
  };
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted m-0 text-xs">{t('studio.publish.explain')}</p>

      {link && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag tag-accent">{t('studio.publish.live')}</span>
          <a href={link} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm">
            {link}
          </a>
          <button type="button" className="btn btn-ghost cx-press" onClick={() => void copy()}>
            <i className={`ph ${copied ? 'ph-check' : 'ph-copy'}`} aria-hidden />{' '}
            {copied ? t('studio.publish.copied') : t('studio.publish.copy')}
          </button>
        </div>
      )}
      {pub?.pending && <p className="m-0 text-sm">{t('studio.publish.pending')}</p>}
      {!pub?.pending && (pub?.lastDecision === 'rejected' || pub?.lastDecision === 'removed') && (
        <p className="m-0 text-sm" style={{ color: '#f4a3a3' }}>
          {t(`studio.publish.${pub.lastDecision}`)}
          {pub.decisionNote && ` — “${pub.decisionNote}”`}
        </p>
      )}

      {!pub?.pending && (
        <div className="field m-0">
          <label htmlFor={`nick-${project.id}`}>{t('studio.publish.nickname')}</label>
          <input
            id={`nick-${project.id}`}
            className="input"
            maxLength={24}
            value={value}
            placeholder={t('studio.publish.nicknamePlaceholder')}
            onChange={(e) => setNick(e.target.value)}
          />
          <span className="text-muted text-xs">
            {nickname.data?.pending
              ? t('studio.publish.nicknamePending', { name: nickname.data.pending })
              : t('studio.publish.nicknameHint')}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!pub?.pending && (
          <PillButton icon="ph-globe-hemisphere-east" disabled={!nickValid || request.isPending} onClick={submit}>
            {pub?.published ? t('studio.publish.requestUpdate') : t('studio.publish.request')}
          </PillButton>
        )}
        {(pub?.published || pub?.pending) && (
          <PillButton variant="ghost" icon="ph-eye-slash" disabled={withdraw.isPending} onClick={() => void takeDown()}>
            {pub.published ? t('studio.publish.withdraw') : t('studio.publish.cancel')}
          </PillButton>
        )}
      </div>
      {error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {error.message}
        </p>
      )}
    </div>
  );
}
