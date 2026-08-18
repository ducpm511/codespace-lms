import { generateCertificatePdf } from './certificate-pdf.generator';

const baseParams = {
  studentName: 'Nguyễn Văn Đức',
  courseTitle: 'Lập trình Python cơ bản',
  serialNo: 'CS-CERT-2026-ABC123',
  verificationCode: 'VC-abc123def456',
  issuedAt: new Date('2026-08-19T00:00:00Z'),
  finalScore: 92,
};

describe('generateCertificatePdf', () => {
  // Hồi quy: trước đây dùng StandardFonts (WinAnsi) nên mọi ký tự tiếng Việt có dấu
  // ném `WinAnsi cannot encode "ơ"` → endpoint tải chứng chỉ 500 với gần như mọi dữ liệu thật.
  it('sinh được PDF khi tên + tiêu đề khóa có dấu tiếng Việt', async () => {
    const buf = await generateCertificatePdf(baseParams);

    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('không vỡ với dải dấu đầy đủ (ơ ư ạ ế ữ Đ ỗ ằ)', async () => {
    await expect(
      generateCertificatePdf({
        ...baseParams,
        studentName: 'Đỗ Thị Hằng Nữ',
        courseTitle: 'Cơ sở dữ liệu — Lưu trữ & truy vấn nâng cao',
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('vẫn chạy với chuỗi ASCII thuần', async () => {
    const buf = await generateCertificatePdf({ ...baseParams, studentName: 'John Doe', courseTitle: 'Basic Python' });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
