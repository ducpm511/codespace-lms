import { useTranslation } from 'react-i18next';

export function FullscreenSpinner(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="text-muted flex min-h-screen items-center justify-center">
      <span className="animate-pulse">{t('common.loading')}</span>
    </div>
  );
}
