import { contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
  it('gửi kèm filename* UTF-8 cho tên có dấu, ASCII làm fallback', () => {
    const header = contentDisposition('inline', 'Bài 10. Kiểu dữ liệu.pdf');
    expect(header).toContain('inline;');
    // Fallback ASCII: mọi ký tự có dấu thành '_', KHÔNG mất phần đuôi file.
    expect(header).toContain('filename="B_i 10. Ki_u d_ li_u.pdf"');
    expect(header).toContain("filename*=UTF-8''");
    // Bản percent-encode giải ngược lại phải ra đúng tên gốc.
    const encoded = header.split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(encoded)).toBe('Bài 10. Kiểu dữ liệu.pdf');
  });

  it('header chỉ chứa byte ASCII (nếu không Node/latin1 sẽ làm hỏng tên)', () => {
    const header = contentDisposition('attachment', 'Chứng chỉ — Nguyễn Văn A.pdf');
    expect(/^[\x20-\x7e]*$/.test(header)).toBe(true);
  });

  it('loại nháy kép và backslash để không phá cú pháp header', () => {
    const header = contentDisposition('attachment', 'a"b\\c.pdf');
    expect(header).toContain('filename="abc.pdf"');
  });

  it('escape các ký tự ngoài attr-char của RFC 5987', () => {
    const header = contentDisposition('inline', "a'b(c)d*e.pdf");
    const encoded = header.split("filename*=UTF-8''")[1];
    expect(encoded).not.toMatch(/['()*]/);
    expect(decodeURIComponent(encoded)).toBe("a'b(c)d*e.pdf");
  });

  it('tên toàn ký tự có dấu vẫn có fallback không rỗng', () => {
    const header = contentDisposition('inline', 'Đề');
    expect(header).toContain('filename="__"');
  });
});
