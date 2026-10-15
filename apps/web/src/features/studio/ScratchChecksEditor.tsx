import { useTranslation } from 'react-i18next';
import { SCRATCH_CHECK_KEYS, SCRATCH_CHECK_MIN_MAX, SCRATCH_CHECKS_WITH_MIN } from '@lms/contracts';
import type { ScratchCheck } from '@lms/contracts';

/**
 * GV chọn tiêu chí GỢI Ý cho bài nộp BlockSpace (T11.7). Chỉ để nhìn nhanh lúc chấm (đọc project.json tĩnh),
 * không tự cho điểm.
 */
export function ScratchChecksEditor({
  value,
  onChange,
}: {
  value: ScratchCheck[];
  onChange: (next: ScratchCheck[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const byKey = new Map(value.map((c) => [c.key, c]));
  const toggle = (key: ScratchCheck['key'], on: boolean) =>
    onChange(
      on
        ? [...value, SCRATCH_CHECKS_WITH_MIN.includes(key) ? { key, min: 2 } : { key }]
        : value.filter((c) => c.key !== key),
    );
  const setMin = (key: ScratchCheck['key'], min: number) =>
    onChange(value.map((c) => (c.key === key ? { ...c, min } : c)));

  return (
    <fieldset className="field m-0" style={{ border: 0, padding: 0 }}>
      <legend className="text-sm" style={{ marginBottom: 4 }}>
        {t('assignments.scratchChecks')}
      </legend>
      <p className="text-muted m-0 text-xs" style={{ marginBottom: 6 }}>
        {t('assignments.scratchChecksHint')}
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {SCRATCH_CHECK_KEYS.map((key) => {
          const on = byKey.has(key);
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={on} onChange={(e) => toggle(key, e.target.checked)} />
              <span>{t(`scratchChecks.${key}`)}</span>
              {on && SCRATCH_CHECKS_WITH_MIN.includes(key) && (
                <input
                  type="number"
                  className="input"
                  aria-label={t('assignments.scratchCheckMin')}
                  min={1}
                  max={SCRATCH_CHECK_MIN_MAX}
                  value={byKey.get(key)?.min ?? 2}
                  onChange={(e) =>
                    setMin(key, Math.min(SCRATCH_CHECK_MIN_MAX, Math.max(1, Math.round(Number(e.target.value) || 1))))
                  }
                  style={{ width: 64, padding: '2px 6px' }}
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
