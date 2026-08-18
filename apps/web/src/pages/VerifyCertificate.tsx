import { useParams } from 'react-router-dom';
import { useVerifyCertificate } from '../features/certificates/hooks';

export function VerifyCertificate(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useVerifyCertificate(code || null);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      {/* Background ambient radial glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 blur-[120px] rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--cx-purple) 18%, transparent)' }}
      />
      <div
        className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 blur-[120px] rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--cx-amber) 12%, transparent)' }}
      />

      <div
        className="max-w-xl w-full card backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10"
        style={{ borderRadius: 'var(--cx-radius)', background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
            style={{
              background: 'color-mix(in srgb, var(--cx-purple) 20%, transparent)',
              color: 'var(--cx-purple)',
              fontSize: 32,
            }}
          >
            <i className="ph-fill ph-certificate" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold cx-display" style={{ color: 'var(--color-fg)' }}>
            Xác Thực Chứng Chỉ
          </h1>
          <p className="text-sm text-muted">Hệ thống Quản lý Học tập CodeSpace LMS</p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted flex flex-col items-center gap-3">
            <i className="ph ph-spinner animate-spin text-3xl" style={{ color: 'var(--cx-purple)' }} />
            <span>Đang tra cứu thông tin chứng chỉ...</span>
          </div>
        ) : error || !data ? (
          <div
            className="py-8 text-center space-y-3 rounded-2xl p-6"
            style={{
              background: 'color-mix(in srgb, var(--cx-coral) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--cx-coral) 30%, transparent)',
            }}
          >
            <i className="ph ph-warning-circle text-4xl" style={{ color: 'var(--cx-coral)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>Không Tìm Thấy Chứng Chỉ</h2>
            <p className="text-sm text-muted">
              Mã xác thực <code className="px-2 py-0.5 rounded font-mono text-xs" style={{ background: 'var(--color-bg)', color: 'var(--cx-coral)' }}>{code}</code> không tồn tại hoặc đã bị xóa khỏi hệ thống.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="text-center">
              {data.status === 'valid' ? (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
                  style={{
                    background: 'color-mix(in srgb, var(--cx-teal) 20%, transparent)',
                    color: 'var(--cx-teal)',
                    border: '1px solid color-mix(in srgb, var(--cx-teal) 40%, transparent)',
                  }}
                >
                  <i className="ph-fill ph-check-circle text-lg" />
                  CHỨNG CHỈ HỢP LỆ
                </div>
              ) : (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
                  style={{
                    background: 'color-mix(in srgb, var(--cx-coral) 20%, transparent)',
                    color: 'var(--cx-coral)',
                    border: '1px solid color-mix(in srgb, var(--cx-coral) 40%, transparent)',
                  }}
                >
                  <i className="ph-fill ph-x-circle text-lg" />
                  CHỨNG CHỈ ĐÃ THU HỒI
                </div>
              )}
            </div>

            {/* Certificate Details Card */}
            <div
              className="rounded-2xl p-5 sm:p-6 space-y-4"
              style={{
                background: 'color-mix(in srgb, var(--color-bg) 60%, transparent)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="pb-3 flex justify-between items-center border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs uppercase font-semibold tracking-wider text-muted">Học viên tốt nghiệp</span>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    background: 'color-mix(in srgb, var(--cx-purple) 20%, transparent)',
                    color: 'var(--cx-purple)',
                    border: '1px solid color-mix(in srgb, var(--cx-purple) 30%, transparent)',
                  }}
                >
                  {data.serialNo}
                </span>
              </div>

              <div className="text-center py-2">
                <h3 className="text-xl sm:text-2xl font-bold cx-display tracking-wide" style={{ color: 'var(--color-fg)' }}>
                  {data.studentName}
                </h3>
                <p className="text-sm text-muted mt-1">Đã hoàn thành xuất sắc khóa học</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--cx-purple)' }}>{data.courseTitle}</p>
              </div>

              <div className="pt-4 border-t flex items-center justify-around" style={{ borderColor: 'var(--color-border)' }}>
                <div
                  className="rounded-xl p-3 text-center flex-1 max-w-xs"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span className="text-xs text-muted">Ngày cấp</span>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-fg)' }}>
                    {new Date(data.issuedAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>

              {data.revokedAt && (
                <div
                  className="rounded-xl p-3 text-xs text-center"
                  style={{
                    background: 'color-mix(in srgb, var(--cx-coral) 15%, transparent)',
                    color: 'var(--cx-coral)',
                    border: '1px solid color-mix(in srgb, var(--cx-coral) 30%, transparent)',
                  }}
                >
                  Chứng chỉ này đã bị thu hồi vào ngày {new Date(data.revokedAt).toLocaleDateString('vi-VN')}.
                </div>
              )}
            </div>

            <div className="text-center text-xs text-muted">
              Mã xác thực duy nhất: <span className="font-mono text-slate-300">{data.verificationCode}</span>
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <a
            href="/"
            className="text-xs text-muted hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <i className="ph ph-arrow-left" /> Trở về trang chủ CodeSpace LMS
          </a>
        </div>
      </div>
    </div>
  );
}
