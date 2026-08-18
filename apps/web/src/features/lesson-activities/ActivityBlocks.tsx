import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { ApiError, apiFetchObjectUrl } from '../../lib/api';
import { toEmbedUrl } from './videoEmbed';

/**
 * Markdown an toàn: react-markdown mặc định KHÔNG render raw HTML (không bật `rehype-raw`)
 * → chống XSS từ nội dung giáo viên soạn.
 */
export function MarkdownBlock({ content }: { content: string }): JSX.Element {
  return (
    <div className="cx-prose text-sm">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * PDF private: `<iframe src>` không gửi được header Authorization nên phải fetch có Bearer
 * rồi nhúng blob URL (thu hồi khi unmount).
 */
export function PdfBlock({ fileId, fileName }: { fileId: string; fileName?: string | null }): JSX.Element {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(null);

    apiFetchObjectUrl(`/files/${fileId}`)
      .then((u) => {
        objectUrl = u;
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        setUrl(u);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!url) return <p className="text-muted text-sm">{t('common.loading')}</p>;

  return (
    <div className="space-y-2">
      <iframe
        src={url}
        title={fileName ?? t('activity.type_pdf')}
        className="w-full"
        style={{ height: 560, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }}
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary cx-press">
        <i className="ph ph-arrow-square-out" aria-hidden /> {t('activity.openPdf')}
      </a>
    </div>
  );
}

/** Video nhúng: chỉ host trong allowlist mới lên iframe, và iframe luôn có `sandbox`. */
export function VideoBlock({ videoUrl }: { videoUrl: string }): JSX.Element {
  const { t } = useTranslation();
  const embed = toEmbedUrl(videoUrl);

  if (!embed) {
    return (
      <p className="text-sm">
        <span className="text-muted">{t('activity.videoNotEmbeddable')} </span>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer nofollow">
          {videoUrl}
        </a>
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden"
      style={{ borderRadius: 'var(--cx-radius)', border: '1px solid var(--color-divider)' }}
    >
      <iframe
        src={embed}
        title={t('activity.type_video')}
        className="w-full"
        style={{ aspectRatio: '16 / 9', border: 0, display: 'block' }}
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
