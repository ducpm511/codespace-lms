import { useTranslation } from 'react-i18next';

export function FullscreenSpinner(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      <span className="animate-pulse">{t('common.loading')}</span>
    </div>
  );
}
