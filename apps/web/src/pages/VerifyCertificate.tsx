import { useParams } from 'react-router-dom';
import { useVerifyCertificate } from '../features/certificates/hooks';

export function VerifyCertificate(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useVerifyCertificate(code || null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-400 text-3xl mb-2">
            <i className="ph ph-certificate" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white cx-display">Xác Thực Chứng Chỉ</h1>
          <p className="text-sm text-slate-400">Hệ thống Quản lý Học tập CodeSpace LMS</p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <i className="ph ph-spinner animate-spin text-3xl text-purple-400" />
            <span>Đang tra cứu thông tin chứng chỉ...</span>
          </div>
        ) : error || !data ? (
          <div className="py-8 text-center space-y-3 bg-rose-950/30 border border-rose-900/50 rounded-2xl p-6">
            <i className="ph ph-warning-circle text-4xl text-rose-400" />
            <h2 className="text-lg font-bold text-white">Không Tìm Thấy Chứng Chỉ</h2>
            <p className="text-sm text-slate-300">
              Mã xác thực <code className="bg-slate-950 px-2 py-0.5 rounded text-rose-300 font-mono text-xs">{code}</code> không tồn tại hoặc đã bị xóa khỏi hệ thống.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="text-center">
              {data.status === 'valid' ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-lg shadow-emerald-950/50">
                  <i className="ph-fill ph-check-circle text-emerald-400 text-lg" />
                  CHỨNG CHỈ HỢP LỆ
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-lg shadow-rose-950/50">
                  <i className="ph-fill ph-x-circle text-rose-400 text-lg" />
                  CHỨNG CHỈ ĐÃ THU HỒI
                </div>
              )}
            </div>

            {/* Certificate Details Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="border-b border-slate-800/80 pb-3 flex justify-between items-center">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Học viên tốt nghiệp</span>
                <span className="text-xs font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                  {data.serialNo}
                </span>
              </div>

              <div className="text-center py-2">
                <h3 className="text-xl sm:text-2xl font-bold text-white cx-display tracking-wide">{data.studentName}</h3>
                <p className="text-sm text-slate-400 mt-1">Đã hoàn thành xuất sắc khóa học</p>
                <p className="text-lg font-bold text-purple-300 mt-1">{data.courseTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/50">
                  <span className="text-xs text-slate-400">Điểm tổng kết</span>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">{data.finalScore}%</div>
                </div>

                <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/50">
                  <span className="text-xs text-slate-400">Ngày cấp</span>
                  <div className="text-sm font-semibold text-slate-200 mt-1">
                    {new Date(data.issuedAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>

              {data.revokedAt && (
                <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-3 text-xs text-rose-300 text-center">
                  Chứng chỉ này đã bị thu hồi vào ngày {new Date(data.revokedAt).toLocaleDateString('vi-VN')}.
                </div>
              )}
            </div>

            <div className="text-center text-xs text-slate-500">
              Mã xác thực duy nhất: <span className="font-mono text-slate-400">{data.verificationCode}</span>
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <i className="ph ph-arrow-left" /> Trở về trang chủ CodeSpace LMS
          </a>
        </div>
      </div>
    </div>
  );
}
