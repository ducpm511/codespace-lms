import { useTranslation } from 'react-i18next';
import { SCRATCH_SELF_VISIBILITIES } from '@lms/contracts';
import type { ScratchProjectDetailDto, ScratchVisibilityValue } from '@lms/contracts';
import { useScratchClasses, useUpdateProject } from './hooks';

/**
 * Chủ dự án chọn ai được xem: chỉ mình / một lớp mình thuộc / cả trường. "Công khai" KHÔNG có ở đây —
 * phải xin giáo viên duyệt (ADR D4′, T11.5b). Đổi là lưu ngay (server ghi audit).
 */
export function ShareControl({ project }: { project: ScratchProjectDetailDto }): JSX.Element {
  const { t } = useTranslation();
  const classes = useScratchClasses();
  const update = useUpdateProject(project.id);
  const myClasses = classes.data ?? [];
  const busy = update.isPending;

  if (project.visibility === 'public') {
    return <p className="text-muted m-0 text-sm">{t('studio.share.publicLocked')}</p>;
  }

  const choose = (visibility: ScratchVisibilityValue) => {
    if (visibility === project.visibility) return;
    if (visibility === 'class') {
      const classId = project.classId ?? myClasses[0]?.id;
      if (classId) update.mutate({ visibility, classId });
      return;
    }
    update.mutate({ visibility });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="seg flex-wrap" role="radiogroup" aria-label={t('studio.share.title')}>
        {SCRATCH_SELF_VISIBILITIES.map((v) => {
          const disabled = busy || (v === 'class' && myClasses.length === 0);
          return (
            <label key={v} className="seg-opt" style={{ whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1 }}>
              <input
                type="radio"
                name={`share-${project.id}`}
                value={v}
                checked={project.visibility === v}
                disabled={disabled}
                onChange={() => choose(v)}
              />
              {t(`studio.visibility_${v}`)}
            </label>
          );
        })}
      </div>
      {project.visibility === 'class' && myClasses.length > 0 && (
        <div className="field m-0">
          <label htmlFor={`share-class-${project.id}`}>{t('studio.share.classLabel')}</label>
          <select
            id={`share-class-${project.id}`}
            className="input"
            value={project.classId ?? ''}
            disabled={busy}
            onChange={(e) => update.mutate({ visibility: 'class', classId: e.target.value })}
          >
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-muted m-0 text-xs">
        {myClasses.length === 0 && project.visibility !== 'class'
          ? t('studio.share.noClass')
          : t(`studio.share.hint_${project.visibility}`)}
      </p>
      {update.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {update.error.message}
        </p>
      )}
    </div>
  );
}
