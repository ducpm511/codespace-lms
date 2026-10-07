import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCRATCH_REPORT_NOTE_MAX, SCRATCH_REPORT_REASONS } from '@lms/contracts';
import type { ScratchReportReasonValue } from '@lms/contracts';
import { PillButton } from '../../pages/teach/teachUi';
import { useReport } from './hooks';

/** Nút "Báo cáo" + form gọn. Dự án vẫn hiện tới khi giáo viên xem (người dùng chốt 2026-10-07). */
export function ReportControl({ target }: { target: { projectId: string } | { slug: string } }): JSX.Element {
  const { t } = useTranslation();
  const report = useReport(target);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ScratchReportReasonValue | null>(null);
  const [note, setNote] = useState('');

  if (report.isSuccess) {
    return <p className="text-muted m-0 text-sm">{t('studio.report.thanks')}</p>;
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost cx-press self-start text-sm" onClick={() => setOpen(true)}>
        <i className="ph ph-flag" aria-hidden /> {t('studio.report.button')}
      </button>
    );
  }
  return (
    <form
      className="card flex flex-col gap-3 p-4"
      style={{ borderRadius: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason) report.mutate({ reason, note: note.trim() || undefined });
      }}
    >
      <p className="cx-display m-0">{t('studio.report.title')}</p>
      <div className="flex flex-col gap-1.5" role="radiogroup">
        {SCRATCH_REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
            {t(`studio.report.reason_${r}`)}
          </label>
        ))}
      </div>
      <textarea
        className="input"
        rows={2}
        maxLength={SCRATCH_REPORT_NOTE_MAX}
        placeholder={t('studio.report.notePlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <PillButton type="submit" icon="ph-flag" disabled={!reason || report.isPending}>
          {t('studio.report.send')}
        </PillButton>
        <PillButton variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </PillButton>
      </div>
      {report.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {report.error.message}
        </p>
      )}
    </form>
  );
}
