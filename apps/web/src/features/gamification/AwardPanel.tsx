import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MANUAL_NOTE_MAX_LENGTH, MANUAL_XP_MAX, MANUAL_XP_MIN } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useAwardManually, useManualBadges } from './useGamification';

/** Mức thưởng bấm nhanh — số tròn, cùng bậc với 50 XP/bài học nên không lấn át việc học thật. */
const QUICK_XP = [10, 25, 50];

/**
 * Ô trao thưởng của giáo viên ở màn hình chấm bài (T10.3).
 *
 * Có mặt ở đây là chủ ý: lúc cô giáo đang đọc bài của một em là lúc lời khen cụ thể nhất.
 * Bắt cô mở một màn hình khác để khen thì sẽ không ai khen cả.
 */
export function AwardPanel({
  classId,
  studentId,
  studentName,
}: {
  classId: string;
  studentId: string;
  studentName: string;
}): JSX.Element {
  const { t } = useTranslation();
  const badges = useManualBadges();
  const award = useAwardManually(classId);

  const [badgeCode, setBadgeCode] = useState<string | null>(null);
  const [xp, setXp] = useState<number>(0);
  const [note, setNote] = useState('');

  const nothingChosen = !badgeCode && xp <= 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (nothingChosen) return;
    award.mutate(
      {
        studentId,
        body: {
          classId,
          badgeCode: badgeCode ?? undefined,
          xpAmount: xp > 0 ? xp : undefined,
          note: note.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setBadgeCode(null);
          setXp(0);
          setNote('');
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{
            background: 'color-mix(in srgb, var(--cx-amber) 22%, transparent)',
            color: 'var(--cx-amber)',
          }}
        >
          <i className="ph-fill ph-gift" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="cx-display m-0" style={{ fontSize: 15 }}>
            {t('gamification.awardHeading')}
          </p>
          <p className="text-muted m-0 truncate" style={{ fontSize: 11 }}>
            {t('gamification.awardFor', { name: studentName })}
          </p>
        </div>
      </div>

      <div className="field">
        <label>{t('gamification.awardBadgeLabel')}</label>
        {badges.isLoading && <p className="text-muted m-0 text-xs">{t('common.loading')}</p>}
        <div className="flex flex-wrap gap-2">
          {(badges.data ?? []).map((b) => {
            const active = badgeCode === b.code;
            return (
              <button
                key={b.code}
                type="button"
                title={b.description}
                onClick={() => setBadgeCode(active ? null : b.code)}
                className="btn cx-press"
                style={{
                  borderRadius: 999,
                  color: active ? 'var(--cx-amber)' : undefined,
                  boxShadow: active
                    ? 'inset 0 0 0 1.5px var(--cx-amber)'
                    : 'inset 0 0 0 1px var(--color-divider)',
                }}
              >
                {b.icon && <i className={`ph-fill ${b.icon}`} aria-hidden />} {b.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label>{t('gamification.awardXpLabel')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_XP.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setXp(xp === v ? 0 : v)}
              className="btn cx-press"
              style={{
                borderRadius: 999,
                color: xp === v ? 'var(--cx-teal)' : undefined,
                boxShadow:
                  xp === v ? 'inset 0 0 0 1.5px var(--cx-teal)' : 'inset 0 0 0 1px var(--color-divider)',
              }}
            >
              +{v}
            </button>
          ))}
          <input
            className="input"
            type="number"
            min={0}
            max={MANUAL_XP_MAX}
            step={5}
            value={xp || ''}
            placeholder={`${MANUAL_XP_MIN}–${MANUAL_XP_MAX}`}
            onChange={(e) => setXp(Number(e.target.value))}
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <div className="field">
        <label>{t('gamification.awardNoteLabel')}</label>
        <textarea
          className="input"
          value={note}
          maxLength={MANUAL_NOTE_MAX_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('gamification.awardNotePlaceholder')}
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={nothingChosen || award.isPending}
        className="btn btn-primary btn-block cx-press"
      >
        <i className="ph ph-hand-heart" aria-hidden /> {t('gamification.awardSubmit')}
      </button>

      {award.isSuccess && (
        <p className="m-0 text-xs" style={{ color: 'var(--cx-teal)' }}>
          ✔ {t('gamification.awardSaved')}
        </p>
      )}
      {award.isError && (
        <p className="m-0 text-xs" style={{ color: '#f4a3a3' }}>
          {award.error instanceof ApiError ? award.error.message : String(award.error)}
        </p>
      )}
    </form>
  );
}
