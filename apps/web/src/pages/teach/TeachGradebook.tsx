import { useState } from 'react';
import type { ClassSummary } from '@lms/contracts';
import { useClasses, useClass } from '../../features/classes/hooks';
import { useClassGradebook } from '../../features/gradebook/hooks';
import {
  useClassCertificates,
  useCertificateTemplates,
  useIssueCertificate,
  useRevokeCertificate,
} from '../../features/certificates/hooks';

export function TeachGradebook(): JSX.Element {
  const { data: classesData, isLoading: loadingClasses } = useClasses();
  const classes: ClassSummary[] = classesData?.items || [];

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const activeClassId = selectedClassId || (classes.length > 0 ? classes[0].id : null);

  const { data: classDetail } = useClass(activeClassId);
  const { data: gradebook, isLoading: loadingGradebook } = useClassGradebook(activeClassId);
  const { data: certificates, isLoading: loadingCertificates } = useClassCertificates(activeClassId);
  const { data: templates } = useCertificateTemplates();

  const issueMutation = useIssueCertificate(activeClassId);
  const revokeMutation = useRevokeCertificate(activeClassId);

  // Issue modal state
  const [issueModalUser, setIssueModalUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Revoke modal state
  const [revokeCertId, setRevokeCertId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');

  const courseId = classDetail?.courses && classDetail.courses.length > 0 ? classDetail.courses[0].courseId : null;

  const handleIssue = async () => {
    if (!issueModalUser || !courseId || !activeClassId) return;
    const tId = selectedTemplateId || (templates && templates.length > 0 ? templates[0].id : 'std-template');
    try {
      await issueMutation.mutateAsync({
        userId: issueModalUser.id,
        courseId,
        classId: activeClassId,
        templateId: tId,
      });
      setIssueModalUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cấp chứng chỉ';
      alert(msg);
    }
  };

  const handleRevoke = async () => {
    if (!revokeCertId || !revokeReason.trim()) return;
    try {
      await revokeMutation.mutateAsync({
        id: revokeCertId,
        data: { reason: revokeReason.trim() },
      });
      setRevokeCertId(null);
      setRevokeReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi thu hồi chứng chỉ';
      alert(msg);
    }
  };

  if (loadingClasses) {
    return <div className="p-6 text-slate-400">Đang tải danh sách lớp...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Class Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <h2 className="text-xl font-bold text-white cx-display flex items-center gap-2">
            <i className="ph ph-trophy text-amber-400 text-2xl" />
            Sổ Điểm & Chứng Chỉ
          </h2>
          <p className="text-sm text-slate-400">Tổng hợp điểm số các bài tập/quiz/code và quản lý chứng chỉ học viên</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-300">Chọn lớp:</label>
          <select
            value={activeClassId || ''}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            {classes.map((c: ClassSummary) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingGradebook ? (
        <div className="p-6 text-center text-slate-400">Đang tính toán sổ điểm...</div>
      ) : !gradebook ? (
        <div className="p-6 text-center text-slate-400">Vui lòng chọn lớp học để xem sổ điểm</div>
      ) : (
        <>
          {/* Gradebook Table */}
          <div className="bg-slate-800/40 rounded-2xl border border-slate-700/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <i className="ph ph-table text-purple-400" />
                Bảng Điểm Lớp ({gradebook.rows.length} học viên)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-400">
                    <th className="p-3 font-semibold">Học viên</th>
                    {gradebook.items.map((item) => (
                      <th key={item.id} className="p-3 font-semibold text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="flex items-center gap-1 text-slate-200">
                            {item.sourceType === 'assignment' && <i className="ph ph-file-text text-blue-400" />}
                            {item.sourceType === 'quiz' && <i className="ph ph-question text-teal-400" />}
                            {item.sourceType === 'coding' && <i className="ph ph-code text-amber-400" />}
                            {item.title}
                          </span>
                          <span className="text-xs text-slate-500 font-normal">Max: {item.maxScore}đ</span>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 font-semibold text-center">Tổng điểm (%)</th>
                    <th className="p-3 font-semibold text-center">Hoàn thành</th>
                    <th className="p-3 font-semibold text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {gradebook.rows.length === 0 ? (
                    <tr>
                      <td colSpan={gradebook.items.length + 4} className="p-6 text-center text-slate-500">
                        Chưa có học viên trong lớp
                      </td>
                    </tr>
                  ) : (
                    gradebook.rows.map((row) => {
                      const hasCert = certificates?.some((c) => c.userId === row.userId && !c.revokedAt);
                      return (
                        <tr key={row.userId} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-medium text-white">
                            <div>{row.userFullName}</div>
                            <div className="text-xs text-slate-400">{row.userEmail}</div>
                          </td>

                          {gradebook.items.map((item) => {
                            const score = row.grades[item.id];
                            return (
                              <td key={item.id} className="p-3 text-center">
                                {score !== null && score !== undefined ? (
                                  <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/50">
                                    {score}đ
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="p-3 text-center">
                            <span className="font-bold text-amber-400">{row.totalWeightedScore}%</span>
                          </td>

                          <td className="p-3 text-center">
                            <span className="text-xs font-medium text-teal-400 bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-800/40">
                              {row.completionRate}%
                            </span>
                          </td>

                          <td className="p-3 text-center">
                            {hasCert ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/50">
                                <i className="ph ph-seal-check text-emerald-400" /> Đã cấp
                              </span>
                            ) : (
                              <button
                                onClick={() => setIssueModalUser({ id: row.userId, name: row.userFullName })}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center gap-1 mx-auto shadow-md hover:shadow-purple-500/20"
                              >
                                <i className="ph ph-certificate" /> Cấp chứng chỉ
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Issued Certificates Section */}
          <div className="bg-slate-800/40 rounded-2xl border border-slate-700/60 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <i className="ph ph-certificate text-amber-400" />
              Danh Sách Chứng Chỉ Đã Cấp ({certificates?.length || 0})
            </h3>

            {loadingCertificates ? (
              <div className="p-4 text-slate-400">Đang tải chứng chỉ...</div>
            ) : !certificates || certificates.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có chứng chỉ nào được cấp trong lớp này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-400">
                      <th className="p-3 font-semibold">Mã số (Serial No)</th>
                      <th className="p-3 font-semibold">Học viên</th>
                      <th className="p-3 font-semibold">Khóa học</th>
                      <th className="p-3 font-semibold text-center">Điểm tổng kết</th>
                      <th className="p-3 font-semibold">Ngày cấp</th>
                      <th className="p-3 font-semibold text-center">Trạng thái</th>
                      <th className="p-3 font-semibold text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="p-3 font-mono text-xs text-purple-300">{cert.serialNo}</td>
                        <td className="p-3 font-medium text-white">{cert.userFullName}</td>
                        <td className="p-3 text-slate-300">{cert.courseTitle}</td>
                        <td className="p-3 text-center font-bold text-amber-400">{cert.finalScore}%</td>
                        <td className="p-3 text-slate-400 text-xs">{new Date(cert.issuedAt).toLocaleDateString('vi-VN')}</td>
                        <td className="p-3 text-center">
                          {cert.revokedAt ? (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50" title={cert.revokedReason || ''}>
                              <i className="ph ph-x-circle" /> Đã thu hồi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                              <i className="ph ph-check-circle" /> Hợp lệ
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <a
                            href={`/verify/${cert.verificationCode}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-purple-400 hover:underline inline-flex items-center gap-1 mr-3"
                          >
                            <i className="ph ph-arrow-square-out" /> Tra cứu
                          </a>
                          {!cert.revokedAt && (
                            <button
                              onClick={() => setRevokeCertId(cert.id)}
                              className="text-xs text-rose-400 hover:text-rose-300 underline"
                            >
                              Thu hồi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Issue Modal */}
      {issueModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white cx-display flex items-center gap-2">
              <i className="ph ph-certificate text-purple-400" />
              Xác Nhận Cấp Chứng Chỉ
            </h3>
            <p className="text-sm text-slate-300">
              Bạn có chắc chắn muốn cấp chứng chỉ tốt nghiệp cho học viên <strong className="text-purple-300">{issueModalUser.name}</strong>?
            </p>

            {templates && templates.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">Chọn mẫu chứng chỉ:</label>
                <select
                  value={selectedTemplateId || templates[0].id}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIssueModalUser(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl border border-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={handleIssue}
                disabled={issueMutation.isPending}
                className="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg transition-all"
              >
                {issueMutation.isPending ? 'Đang cấp...' : 'Cấp Chứng Chỉ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeCertId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white cx-display flex items-center gap-2 text-rose-400">
              <i className="ph ph-warning" />
              Thu Hồi Chứng Chỉ
            </h3>
            <p className="text-sm text-slate-300">
              Nhập lý do thu hồi chứng chỉ này. Thao tác này sẽ ghi nhận vào nhật ký kiểm toán hệ thống.
            </p>

            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Nhập lý do thu hồi..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokeCertId(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl border border-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={handleRevoke}
                disabled={revokeMutation.isPending || !revokeReason.trim()}
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {revokeMutation.isPending ? 'Đang xử lý...' : 'Xác Nhận Thu Hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
