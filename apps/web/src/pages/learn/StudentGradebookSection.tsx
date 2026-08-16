import { useStudentOwnGradebook } from '../../features/gradebook/hooks';
import { useMyCertificates } from '../../features/certificates/hooks';

export function StudentGradebookSection({ classId }: { classId: string | null }): JSX.Element {
  const { data: gradebook, isLoading: loadingGrades } = useStudentOwnGradebook(classId);
  const { data: certificates, isLoading: loadingCerts } = useMyCertificates();

  if (!classId) return <></>;

  return (
    <div className="space-y-6 mt-8">
      {/* Gradebook Header & Summary */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white cx-display flex items-center gap-2">
              <i className="ph ph-trophy text-amber-400 text-2xl" />
              Kết Quả Học Tập & Chứng Chỉ Của Tôi
            </h2>
            <p className="text-xs text-slate-400">Theo dõi điểm số tích lũy và chứng chỉ đã nhận trong lớp học này</p>
          </div>

          {gradebook && (
            <div className="flex items-center gap-3">
              <div className="bg-purple-950/60 border border-purple-800/50 rounded-2xl px-4 py-2 text-center">
                <div className="text-xs text-slate-400 font-medium">Tổng điểm tích lũy</div>
                <div className="text-xl font-bold text-purple-300">{gradebook.totalWeightedScore}%</div>
              </div>
              <div className="bg-teal-950/60 border border-teal-800/50 rounded-2xl px-4 py-2 text-center">
                <div className="text-xs text-slate-400 font-medium">Tiến độ hoàn thành</div>
                <div className="text-xl font-bold text-teal-300">{gradebook.completionRate}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Grade Items Table */}
        {loadingGrades ? (
          <div className="py-6 text-center text-slate-500 text-sm">Đang tải kết quả học tập...</div>
        ) : !gradebook || gradebook.items.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">Chưa có cột điểm nào trong lớp học này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Bài học / Đánh giá</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Loại bài</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Điểm tối đa</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Điểm của bạn</th>
                </tr>
              </thead>
              <tbody>
                {gradebook.items.map((item) => {
                  const score = gradebook.grades[item.id];
                  return (
                    <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="py-2.5 px-3 font-medium text-white">{item.title}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          {item.sourceType === 'assignment' && <i className="ph ph-file-text text-blue-400" />}
                          {item.sourceType === 'quiz' && <i className="ph ph-question text-teal-400" />}
                          {item.sourceType === 'coding' && <i className="ph ph-code text-amber-400" />}
                          {item.sourceType.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">{item.maxScore}đ</td>
                      <td className="py-2.5 px-3 text-center">
                        {score !== null && score !== undefined ? (
                          <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                            {score}đ
                          </span>
                        ) : (
                          <span className="text-slate-600">Chưa có điểm</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Certificates List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white cx-display flex items-center gap-2">
          <i className="ph ph-certificate text-purple-400 text-xl" />
          Chứng Chỉ Đã Nhận
        </h3>

        {loadingCerts ? (
          <div className="py-4 text-slate-500 text-sm">Đang tải chứng chỉ...</div>
        ) : !certificates || certificates.length === 0 ? (
          <p className="text-sm text-slate-500">Bạn chưa nhận được chứng chỉ nào. Hoàn thành khóa học để nhận chứng chỉ!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="bg-slate-950 border border-purple-900/40 hover:border-purple-600/60 transition-all rounded-2xl p-5 space-y-3 relative shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 text-xl">
                    <i className="ph ph-certificate" />
                  </div>
                  {cert.revokedAt ? (
                    <span className="text-xs text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                      Đã thu hồi
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      Hợp lệ
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-white text-base">{cert.courseTitle}</h4>
                  <p className="text-xs font-mono text-purple-300 mt-0.5">{cert.serialNo}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Điểm: <strong className="text-amber-400">{cert.finalScore}%</strong></span>
                  <span>Cấp ngày: {new Date(cert.issuedAt).toLocaleDateString('vi-VN')}</span>
                </div>

                <div className="pt-1 text-right">
                  <a
                    href={`/verify/${cert.verificationCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <i className="ph ph-arrow-square-out" /> Xem trang xác thực công khai
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
