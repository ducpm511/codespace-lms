import { readFileSync } from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * KHÔNG dùng `StandardFonts` (Helvetica…): chúng mã hóa WinAnsi nên ném
 * `WinAnsi cannot encode "ơ"` với mọi tên/tiêu đề tiếng Việt có dấu.
 * Nhúng Roboto (Apache-2.0, phủ đủ Vietnamese) qua fontkit thay thế.
 */
const FONT_FILES = {
  regular: 'roboto-fontface/fonts/roboto/Roboto-Regular.woff',
  bold: 'roboto-fontface/fonts/roboto/Roboto-Bold.woff',
  italic: 'roboto-fontface/fonts/roboto/Roboto-RegularItalic.woff',
} as const;

/** Đọc file font 1 lần rồi cache — mỗi lần sinh PDF chỉ nhúng lại buffer đã có. */
const fontCache = new Map<string, Buffer>();
function loadFont(key: keyof typeof FONT_FILES): Buffer {
  const cached = fontCache.get(key);
  if (cached) {
    return cached;
  }
  const bytes = readFileSync(require.resolve(FONT_FILES[key]));
  fontCache.set(key, bytes);
  return bytes;
}

export interface GenerateCertificatePdfParams {
  studentName: string;
  courseTitle: string;
  serialNo: string;
  verificationCode: string;
  issuedAt: Date;
  finalScore: number;
}

export async function generateCertificatePdf(params: GenerateCertificatePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Landscape A4: 842 x 595.28 points
  const page = pdfDoc.addPage([842, 595.28]);
  const { width, height } = page.getSize();

  // `subset: true` → chỉ nhúng glyph thực dùng, giữ file PDF nhỏ.
  const fontBold = await pdfDoc.embedFont(loadFont('bold'), { subset: true });
  const fontRegular = await pdfDoc.embedFont(loadFont('regular'), { subset: true });
  const fontOblique = await pdfDoc.embedFont(loadFont('italic'), { subset: true });

  // Background navy dark ground
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.08, 0.09, 0.14), // #141724
  });

  // Outer decorative border (amber / gold #F59E0B)
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.96, 0.62, 0.04), // amber
    borderWidth: 2,
    color: rgb(0.1, 0.11, 0.18), // #1a1c2e surface
  });

  // Inner thin border
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.96, 0.62, 0.04),
    borderWidth: 0.75,
  });

  // Corner decorative marks
  const cornerSize = 20;
  const corners = [
    { x: 38, y: 38 },
    { x: width - 38 - cornerSize, y: 38 },
    { x: 38, y: height - 38 - cornerSize },
    { x: width - 38 - cornerSize, y: height - 38 - cornerSize },
  ];
  for (const c of corners) {
    page.drawRectangle({
      x: c.x,
      y: c.y,
      width: cornerSize,
      height: cornerSize,
      borderColor: rgb(0.96, 0.62, 0.04),
      borderWidth: 1,
    });
  }

  // Header Title
  const brand = 'CODESPACE LMS VIETNAM';
  const brandWidth = fontBold.widthOfTextAtSize(brand, 14);
  page.drawText(brand, {
    x: (width - brandWidth) / 2,
    y: height - 80,
    size: 14,
    font: fontBold,
    color: rgb(0.96, 0.62, 0.04),
  });

  const title = 'CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC';
  const titleWidth = fontBold.widthOfTextAtSize(title, 26);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const subtitle = 'CERTIFICATE OF COMPLETION';
  const subWidth = fontRegular.widthOfTextAtSize(subtitle, 12);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 142,
    size: 12,
    font: fontRegular,
    color: rgb(0.7, 0.73, 0.8),
  });

  // Presented To
  const presentedText = 'Chứng nhận trao cho / This is proudly presented to:';
  const presWidth = fontOblique.widthOfTextAtSize(presentedText, 13);
  page.drawText(presentedText, {
    x: (width - presWidth) / 2,
    y: height - 200,
    size: 13,
    font: fontOblique,
    color: rgb(0.8, 0.82, 0.9),
  });

  // Student Name
  const name = params.studentName;
  const nameWidth = fontBold.widthOfTextAtSize(name, 30);
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: height - 250,
    size: 30,
    font: fontBold,
    color: rgb(0.3, 0.8, 0.75), // teal accent
  });

  // Name underline
  page.drawLine({
    start: { x: (width - Math.max(nameWidth, 280)) / 2 - 20, y: height - 262 },
    end: { x: (width + Math.max(nameWidth, 280)) / 2 + 20, y: height - 262 },
    thickness: 1,
    color: rgb(0.96, 0.62, 0.04),
  });

  // Course Description
  const completionText = 'Đã hoàn thành khóa học / For successfully completing the course:';
  const compWidth = fontRegular.widthOfTextAtSize(completionText, 13);
  page.drawText(completionText, {
    x: (width - compWidth) / 2,
    y: height - 310,
    size: 13,
    font: fontRegular,
    color: rgb(0.8, 0.82, 0.9),
  });

  // Course Title
  const course = params.courseTitle;
  const courseWidth = fontBold.widthOfTextAtSize(course, 22);
  page.drawText(course, {
    x: (width - courseWidth) / 2,
    y: height - 350,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Footer Details: Serial, Verification Code, Date
  const dateStr = params.issuedAt.toISOString().slice(0, 10);
  const leftX = 70;
  const rightX = width - 300;
  const footerY = 80;

  page.drawText(`Mã số / Serial No: ${params.serialNo}`, {
    x: leftX,
    y: footerY + 20,
    size: 11,
    font: fontRegular,
    color: rgb(0.7, 0.73, 0.8),
  });
  page.drawText(`Mã xác thực / Code: ${params.verificationCode}`, {
    x: leftX,
    y: footerY,
    size: 11,
    font: fontRegular,
    color: rgb(0.7, 0.73, 0.8),
  });

  page.drawText(`Ngày cấp / Issue Date: ${dateStr}`, {
    x: rightX,
    y: footerY + 20,
    size: 11,
    font: fontRegular,
    color: rgb(0.7, 0.73, 0.8),
  });
  page.drawText(`Xác thực tại: verify.codespace.vn`, {
    x: rightX,
    y: footerY,
    size: 11,
    font: fontRegular,
    color: rgb(0.7, 0.73, 0.8),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
